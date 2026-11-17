import json
import re
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional
from src.core.config import get_settings
from src.core.logger import get_logger

logger = get_logger(__name__)


class MultiProviderLLMClient:
    """
    Enterprise Multi-Provider LLM Client with Cascading Fallback & Model Health Checks.
    
    Fallback Order:
      1. Groq (Ultra-fast, Llama/Qwen)
      2. Google Gemini (Gemma-4 / Gemini-Flash)
      3. OpenRouter (Free Tier Catalog)
      4. Deterministic Rulebase Fallback (Zero crash guarantee)
    """

    def __init__(self):
        self.settings = get_settings()
        self.headers_base = {
            "User-Agent": "ClauseGuardAI/1.0",
            "Content-Type": "application/json",
        }
        self._healthy_model_cache: Dict[str, bool] = {}

    @staticmethod
    def _is_valid_key(key: Optional[str]) -> bool:
        if not key:
            return False
        clean = key.strip().lower()
        return not (clean.startswith("your_") or "placeholder" in clean or "dummy" in clean)

    def _call_groq(self, prompt: str, model: str) -> Optional[str]:
        """Execute chat completion via Groq API."""
        if not self._is_valid_key(self.settings.GROQ_API_KEY):
            return None
        
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            **self.headers_base,
            "Authorization": f"Bearer {self.settings.GROQ_API_KEY}",
        }
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a senior corporate legal counsel specializing in contract risk intelligence and Indian statutory contract law (Indian Contract Act, 1872). Output clear, factual legal analysis.",
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 600,
        }

        req = urllib.request.Request(url, headers=headers, data=json.dumps(payload).encode("utf-8"))
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                if content:
                    logger.info("LLM inference succeeded via Groq", extra={"model": model})
                    return content.strip()
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.warning(f"Groq API error HTTP {e.code} for model {model}: {err_body[:150]}")
        except Exception as e:
            logger.warning(f"Groq connection failure for model {model}: {e}")
        return None

    def _call_gemini(self, prompt: str, model: str) -> Optional[str]:
        """Execute generation via Google Gemini API."""
        if not self._is_valid_key(self.settings.GEMINI_API_KEY):
            return None

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.settings.GEMINI_API_KEY}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": (
                                "You are a senior corporate legal counsel specializing in contract risk intelligence and the Indian Contract Act, 1872. "
                                f"{prompt}"
                            )
                        }
                    ]
                }
            ],
            "generationConfig": {"temperature": 0.1, "maxOutputTokens": 600},
        }

        req = urllib.request.Request(url, headers=self.headers_base, data=json.dumps(payload).encode("utf-8"))
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                candidates = data.get("candidates", [])
                if candidates and "content" in candidates[0]:
                    parts = candidates[0]["content"].get("parts", [])
                    if parts and "text" in parts[0]:
                        logger.info("LLM inference succeeded via Gemini", extra={"model": model})
                        return parts[0]["text"].strip()
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            logger.warning(f"Gemini API error HTTP {e.code} for model {model}: {err_body[:150]}")
        except Exception as e:
            logger.warning(f"Gemini connection failure for model {model}: {e}")
        return None

    def _call_openrouter(self, prompt: str, model: str = "liquid/lfm-3-1.7b:free") -> Optional[str]:
        """Execute chat completion via OpenRouter API."""
        if not self._is_valid_key(self.settings.OPENROUTER_API_KEY):
            return None

        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            **self.headers_base,
            "Authorization": f"Bearer {self.settings.OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://clauseguard.ai",
            "X-Title": "ClauseGuard AI",
        }
        payload = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 400,
        }

        req = urllib.request.Request(url, headers=headers, data=json.dumps(payload).encode("utf-8"))
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                choices = data.get("choices", [])
                if choices and "message" in choices[0]:
                    content = choices[0]["message"].get("content")
                    if content:
                        logger.info("LLM inference succeeded via OpenRouter", extra={"model": model})
                        return content.strip()
        except Exception as e:
            logger.warning(f"OpenRouter connection failure for model {model}: {e}")
        return None

    def generate_with_fallback(self, prompt: str) -> Optional[str]:
        """
        Orchestrates cascading model fallback:
        1. Groq Primary (qwen/qwen3.8-27b)
        2. Groq Fallback (openai/gpt-oss-120b)
        3. Gemini Primary (gemma-4-26b-a4b-it)
        4. Gemini Fallback (gemini-flash-latest)
        5. OpenRouter
        """
        # Tier 1: Groq Primary
        res = self._call_groq(prompt, model=self.settings.PRIMARY_GROQ_MODEL)
        if res:
            return res

        # Tier 1b: Groq Fallback
        res = self._call_groq(prompt, model=self.settings.FALLBACK_GROQ_MODEL)
        if res:
            return res

        # Tier 2: Gemini Primary
        res = self._call_gemini(prompt, model=self.settings.PRIMARY_GEMINI_MODEL)
        if res:
            return res

        # Tier 2b: Gemini Fallback
        res = self._call_gemini(prompt, model=self.settings.FALLBACK_GEMINI_MODEL)
        if res:
            return res

        # Tier 3: OpenRouter
        res = self._call_openrouter(prompt)
        if res:
            return res

        logger.warning("All external LLM providers exhausted or unavailable. Triggering deterministic fallback.")
        return None

    def enrich_risk_with_legal_context(
        self,
        category: str,
        verbatim_quote: str,
        headline: str,
        danger_summary: str,
        counter_term: str,
    ) -> Dict[str, Any]:
        """
        Enhance a flagged risk item with statutory context (Indian Contract Act 1872) and custom legal commentary.
        """
        prompt = f"""You are reviewing an enterprise contract risk.
Clause Category: {category}
Headline: {headline}
Contract Quote: "{verbatim_quote}"
Identified Danger: {danger_summary}
Proposed Counter-Term: {counter_term}

Provide a concise statutory legal advisory (3-4 sentences max):
1. Explain how this violates commercial fairness or statutory law. Specifically reference relevant Indian law (such as Section 23, 27, 28, or 74 of the Indian Contract Act, 1872) if applicable.
2. Provide a practical negotiation counter-strategy for the client.

Respond strictly in valid JSON format with keys "statutory_compliance_note" and "negotiation_advice":
{{
  "statutory_compliance_note": "...",
  "negotiation_advice": "..."
}}
Do not enclose in markdown code blocks if possible.
"""
        raw_response = self.generate_with_fallback(prompt)
        if not raw_response:
            # Deterministic fallback statutory note
            statutory_notes = {
                "TERMINATION": "Under Indian Contract Act Section 56 and standard commercial norms, 90-day auto-renewal locks without convenience exit violate balanced contract terms.",
                "INDEMNITY": "Under Section 124 of Indian Contract Act 1872, unreciprocated third-party indemnities without cap expose customer to infinite consequential liabilities.",
                "IP": "Under Section 27 of Indian Contract Act 1872, post-termination non-compete agreements are void ab initio (restraint of trade).",
                "LIABILITY": "Section 74 of Indian Contract Act 1872 permits only reasonable pre-estimated damages, prohibiting unilateral penal fees.",
                "JURISDICTION": "Section 28 of Indian Contract Act 1872 prohibits complete restraint of legal proceedings or ouster of domestic jurisdiction.",
            }
            return {
                "statutory_compliance_note": statutory_notes.get(
                    category, "Statutory review recommended under Indian Contract Act 1872 provisions."
                ),
                "negotiation_advice": f"Propose replacing with: {counter_term}",
            }

        try:
            # Clean possible markdown fences and normalize unicode spaces
            cleaned = (
                raw_response.strip()
                .replace("\u202f", " ")
                .replace("\u00a0", " ")
                .replace("’", "'")
                .replace("”", '"')
                .replace("“", '"')
            )
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            # Attempt JSON load
            data = json.loads(cleaned)
            return {
                "statutory_compliance_note": data.get("statutory_compliance_note", ""),
                "negotiation_advice": data.get("negotiation_advice", counter_term),
            }
        except Exception:
            # Fallback regex extraction in case of partial JSON formatting
            note_match = re.search(r'"statutory_compliance_note":\s*"([^"]+)"', cleaned, re.DOTALL)
            advice_match = re.search(r'"negotiation_advice":\s*"([^"]+)"', cleaned, re.DOTALL)

            note_val = note_match.group(1).strip() if note_match else cleaned
            advice_val = advice_match.group(1).strip() if advice_match else counter_term
            return {
                "statutory_compliance_note": note_val,
                "negotiation_advice": advice_val,
            }
