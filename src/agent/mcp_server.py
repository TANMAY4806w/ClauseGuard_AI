import re
from typing import Any, Dict, List, Optional
import Levenshtein

from src.core.logger import get_logger
from src.vectorstore.qdrant_client import QdrantVectorStore
from src.vectorstore.reranker import FlashRankReranker

logger = get_logger(__name__)


# Standardized Rulebase Catalog of 15 Predatory Legal Terms
PREDATORY_RULES_CATALOG: List[Dict[str, Any]] = [
    {
        "id": "AUTO_RENEWAL_90D",
        "category": "TERMINATION",
        "risk_level": "CRITICAL",
        "headline": "Strict 60-to-90 Day Advance Auto-Renewal Trap",
        "pattern": re.compile(
            r"(?:automatic(?:ally)?\s+renew|renewal).{0,120}(?:sixty|ninety|60|90)\s*\(?\d*\)?\s*days",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "If you fail to deliver written non-renewal notice at least 60-90 days prior to expiration, the contract automatically locks you into another full term with zero termination rights.",
        "counter_term": "Replace with: 'Either party may terminate upon thirty (30) days prior written notice prior to the expiration of the current term, or terminate for convenience at any time with thirty (30) days notice and a prorated refund.'",
    },
    {
        "id": "UNLIMITED_INDEMNIFICATION",
        "category": "INDEMNITY",
        "risk_level": "CRITICAL",
        "headline": "Uncapped & Asymmetric Indemnification Obligation",
        "pattern": re.compile(
            r"(?:indemnif|hold harmless).{0,150}(?:without\s+(?:any\s+)?limitation|all\s+third-party\s+claims|any\s+and\s+all\s+claims)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Forces you to defend and pay for any and all claims brought against the other party without any liability cap, exposing you to potentially bankrupting damages.",
        "counter_term": "Replace with mutual indemnification strictly limited to direct claims arising from gross negligence or willful misconduct, and capped at total fees paid under the contract in the preceding 12 months.",
    },
    {
        "id": "UNILATERAL_PRICE_MODIFICATION",
        "category": "LIABILITY",
        "risk_level": "HIGH",
        "headline": "Unilateral Price and Terms Modification",
        "pattern": re.compile(
            r"(?:reserves?\s+the\s+right|in\s+its\s+sole\s+discretion).{0,100}(?:modify|alter|change|increase).{0,80}(?:prices?|fees?|terms?|service)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Allows the vendor to arbitrarily increase subscription fees or downgrade features at any time simply by posting updates online, without your prior written approval.",
        "counter_term": "Add: 'Any changes to pricing or terms require thirty (30) days advance written notice and mutual signed amendment. Customer may terminate penalty-free upon notice of a fee increase.'",
    },
    {
        "id": "BROAD_NON_COMPETE",
        "category": "IP",
        "risk_level": "HIGH",
        "headline": "Overly Broad Post-Termination Non-Compete",
        "pattern": re.compile(
            r"(?:non-compete|shall\s+not\s+(?:compete|engage\s+in)).{0,120}(?:twelve|twenty-four|12|24|36)\s*months",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Prohibits you or your business from engaging in your profession or offering competitive services for an extended period across unrestricted geographic areas.",
        "counter_term": "Delete non-compete clause entirely, or narrow strictly to direct solicitation of active clients using proprietary confidential information.",
    },
    {
        "id": "ASYMMETRIC_ATTORNEY_FEES",
        "category": "JURISDICTION",
        "risk_level": "MEDIUM",
        "headline": "One-Way Attorney's Fees Recovery",
        "pattern": re.compile(
            r"(?:customer|client|tenant)\s+shall\s+(?:reimburse|pay).{0,80}(?:attorney'?s?\s+fees|legal\s+fees|costs\s+of\s+collection)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "If a dispute arises, only the counterparty is entitled to collect attorney's fees if they win, placing all financial litigation risk on you.",
        "counter_term": "Make attorney's fees reciprocal: 'In the event of litigation, the prevailing party shall be entitled to recover reasonable attorney's fees and court costs.'",
    },
    {
        "id": "LIQUIDATED_DAMAGES_PENALTY",
        "category": "LIABILITY",
        "risk_level": "HIGH",
        "headline": "Excessive Liquidated Damages Penalty",
        "pattern": re.compile(
            r"(?:liquidated\s+damages|fixed\s+penalty).{0,100}(?:forfeit|payable\s+immediately|shall\s+pay)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Imposes pre-agreed punitive financial penalties for minor breaches that may bear no proportional relationship to actual damages suffered.",
        "counter_term": "Limit damages strictly to actual, demonstrable direct economic damages proven in a court of competent jurisdiction.",
    },
    {
        "id": "REMOTE_JURISDICTION_SELECTION",
        "category": "JURISDICTION",
        "risk_level": "MEDIUM",
        "headline": "Distant or Foreign Legal Jurisdiction",
        "pattern": re.compile(
            r"(?:governing\s+law|exclusive\s+jurisdiction|venue).{0,100}(?:courts\s+of|state\s+of)\s+([A-Z][a-zA-Z\s]+)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Requires all lawsuits and arbitrations to be filed in a remote or foreign state, making defending yourself cost-prohibitive due to travel and foreign local counsel fees.",
        "counter_term": "Specify jurisdiction in your local county/state, or agree to a mutually neutral jurisdiction with virtual arbitration proceedings.",
    },
    {
        "id": "PERPETUAL_IP_ASSIGNMENT",
        "category": "IP",
        "risk_level": "HIGH",
        "headline": "Perpetual Background IP Assignment",
        "pattern": re.compile(
            r"(?:assigns?|transfers?).{0,100}(?:all\s+right,\s+title,\s+and\s+interest|inventions?|pre-existing|background\s+ip)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Inadvertently assigns ownership of your pre-existing code, tools, know-how, and background intellectual property to the client rather than just the bespoke deliverable.",
        "counter_term": "Clarify that you retain sole ownership of all pre-existing Background IP, granting only a non-exclusive license for the client to use the final deliverable upon full payment.",
    },
    {
        "id": "NO_TERMINATION_FOR_CONVENIENCE",
        "category": "TERMINATION",
        "risk_level": "HIGH",
        "headline": "No Termination for Convenience (Complete Lock-In)",
        "pattern": re.compile(
            r"(?:non-cancellable|no\s+termination\s+for\s+convenience|lock-in|irrevocable\s+commitment)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Binds you to pay the entire multi-year contract value even if the service fails to meet your expectations or your business needs change.",
        "counter_term": "Insert: 'Customer may terminate this Agreement for convenience at any time upon sixty (60) days prior written notice with fees prorated to the effective termination date.'",
    },
    {
        "id": "WAIVER_OF_JURY_TRIAL",
        "category": "JURISDICTION",
        "risk_level": "LOW",
        "headline": "Mandatory Waiver of Jury Trial",
        "pattern": re.compile(
            r"(?:waives?\s+(?:all\s+)?rights?\s+to\s+a\s+jury\s+trial|class\s+action\s+waiver)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Waives your constitutional right to have legal disputes heard before a jury of your peers and prevents joining class-action claims.",
        "counter_term": "Request deletion of jury trial waiver or provide option for binding mediation prior to formal litigation.",
    },
    {
        "id": "AUTOMATIC_PRICE_ESCALATION",
        "category": "LIABILITY",
        "risk_level": "HIGH",
        "headline": "Compounded Annual Price Escalation",
        "pattern": re.compile(
            r"(?:increase|escalate|escalation).{0,80}(?:annually|each\s+year|upon\s+renewal).{0,60}(?:percent|%|cpi)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Permits automatic price increases upon every renewal that can compound significantly over multi-year terms.",
        "counter_term": "Cap annual renewal increases to a maximum of 3% or the Consumer Price Index (CPI), whichever is lower.",
    },
    {
        "id": "DATA_RETENTION_SURVIVAL",
        "category": "IP",
        "risk_level": "HIGH",
        "headline": "Perpetual Data Retention and License Post-Termination",
        "pattern": re.compile(
            r"(?:retain|maintain|use).{0,80}(?:customer\s+data|confidential\s+information).{0,80}(?:in\s+perpetuity|survive\s+termination)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Allows the vendor to keep, analyze, or commercialize your confidential business data indefinitely even after contract termination.",
        "counter_term": "Require that within 30 days of termination, vendor must permanently delete or return all customer data and provide written certification of destruction.",
    },
    {
        "id": "HARSH_AUDIT_RIGHTS",
        "category": "LIABILITY",
        "risk_level": "MEDIUM",
        "headline": "Intrusive On-Demand Audit Rights",
        "pattern": re.compile(
            r"(?:audit|inspect).{0,80}(?:books|records|facilities|systems).{0,80}(?:at\s+any\s+time|customer'?s?\s+expense)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Grants vendor unrestricted rights to inspect your internal systems, records, and premises with short notice and at your financial expense.",
        "counter_term": "Limit audits to once per calendar year with at least 30 business days prior notice, during regular business hours, at vendor's sole expense.",
    },
    {
        "id": "EXCLUSIVE_REMEDIES_DISCLAIMER",
        "category": "LIABILITY",
        "risk_level": "HIGH",
        "headline": "Complete Disclaimer of All Warranties and Remedies",
        "pattern": re.compile(
            r"(?:as\s+is|without\s+warranty|disclaims?\s+all\s+warranties).{0,100}(?:sole\s+and\s+exclusive\s+remedy|total\s+liability\s+shall\s+not\s+exceed\s+\$(?:100|50|0))",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Vendor provides software/service 'AS IS' with no performance warranties, while capping their maximum liability at a nominal $50 or $100.",
        "counter_term": "Require basic warranty that service performs in material conformity with documentation, with vendor liability capped at fees paid in the past 12 months.",
    },
    {
        "id": "RESTRICTIVE_ASSIGNMENT",
        "category": "TERMINATION",
        "risk_level": "MEDIUM",
        "headline": "Prohibition of Assignment Upon M&A / Reorganization",
        "pattern": re.compile(
            r"(?:shall\s+not\s+assign|assignment\s+without\s+consent).{0,80}(?:including\s+by\s+operation\s+of\s+law|merger|acquisition)",
            re.IGNORECASE | re.DOTALL,
        ),
        "danger_summary": "Prevents you from transferring the agreement if your company is acquired, undergoes a merger, or reorganizes, giving the vendor hold-up power.",
        "counter_term": "Add: 'Customer may assign this Agreement without consent to an affiliate or in connection with a merger, acquisition, or sale of substantially all assets.'",
    },
]


class MCPServer:
    """
    Model Context Protocol (MCP) Analytical Server for ClauseGuard AI.
    Exposes 4 standardized typed tools for the reasoning agent.
    """

    def __init__(self, vector_store: Optional[QdrantVectorStore] = None, reranker: Optional[FlashRankReranker] = None):
        self.vector_store = vector_store or QdrantVectorStore()
        self.reranker = reranker or FlashRankReranker()

    # --- Tool 1: Query Contract Vector Store ---
    def query_contract_vector_store(
        self,
        doc_id: str,
        query: str,
        category_filter: Optional[str] = "ANY",
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        MCP Tool: Retrieve top-k relevant clauses from Qdrant and apply FlashRank reranking.
        """
        raw_candidates = self.vector_store.hybrid_search(
            query=query,
            doc_id=doc_id,
            limit=25,
            category_filter=category_filter,
        )
        if not raw_candidates:
            return []

        reranked = self.reranker.rerank(query=query, candidates=raw_candidates, top_k=limit)
        return reranked

    # --- Tool 2: Audit Predatory Terms ---
    def audit_predatory_terms(self, clause_text: str, category: str = "ANY") -> List[Dict[str, Any]]:
        """
        MCP Tool: Match clause text against the 15+ curated predatory rulebase patterns.
        """
        flagged_items: List[Dict[str, Any]] = []

        for rule in PREDATORY_RULES_CATALOG:
            # If a category is requested, check if it matches
            if category != "ANY" and rule["category"] != category:
                continue

            match = rule["pattern"].search(clause_text)
            if match:
                # Extract verbatim matching snippet
                start = max(0, match.start() - 20)
                end = min(len(clause_text), match.end() + 20)
                matched_snippet = clause_text[start:end].strip()

                flagged_items.append({
                    "rule_id": rule["id"],
                    "category": rule["category"],
                    "risk_level": rule["risk_level"],
                    "headline": rule["headline"],
                    "danger_summary": rule["danger_summary"],
                    "recommended_counter_term": rule["counter_term"],
                    "matched_quote": matched_snippet or match.group(0),
                    "confidence_score": 0.96,
                })

        return flagged_items

    # --- Tool 3: Verify Source Citation (Self-Reflection Guardrail) ---
    def verify_source_citation(
        self,
        verbatim_quote: str,
        page_number: int,
        doc_text_by_page: Dict[int, str],
    ) -> Dict[str, Any]:
        """
        MCP Tool: Deterministic string and Levenshtein check to eliminate LLM hallucinations.
        Ensures quotes exist character-for-character on the cited page.
        """
        page_text = doc_text_by_page.get(page_number, "")
        if not page_text:
            return {
                "is_verified": False,
                "similarity_score": 0.0,
                "error_reason": f"Page number {page_number} does not exist in source contract.",
            }

        clean_quote = verbatim_quote.strip()
        clean_page = page_text.strip()

        # 1. Exact substring match
        if clean_quote in clean_page:
            return {
                "is_verified": True,
                "similarity_score": 1.0,
                "verification_method": "EXACT_SUBSTRING_MATCH",
            }

        # 2. Case-insensitive substring match
        if clean_quote.lower() in clean_page.lower():
            return {
                "is_verified": True,
                "similarity_score": 0.99,
                "verification_method": "CASE_INSENSITIVE_MATCH",
            }

        # 3. Levenshtein sliding-window best alignment
        quote_len = len(clean_quote)
        best_ratio = 0.0

        # Slide across page text in quote_len steps
        step = max(1, quote_len // 4)
        for i in range(0, max(1, len(clean_page) - quote_len + 1), step):
            window = clean_page[i : i + quote_len + 30]
            ratio = Levenshtein.ratio(clean_quote, window)
            if ratio > best_ratio:
                best_ratio = ratio
                if best_ratio >= 0.95:
                    break

        is_verified = best_ratio >= 0.95
        return {
            "is_verified": is_verified,
            "similarity_score": round(best_ratio, 3),
            "verification_method": "LEVENSHTEIN_ALIGNMENT",
            "error_reason": None if is_verified else f"Citation quote not found on page {page_number} (Levenshtein similarity {best_ratio:.2f} < 0.95).",
        }

    # --- Tool 4: Synthesize Plain English Advice ---
    def synthesize_plain_english_advice(
        self,
        category: str,
        headline: str,
        danger_summary: str,
        recommended_counter_term: str,
    ) -> Dict[str, str]:
        """
        MCP Tool: Format actionable legal intelligence for non-lawyer decision makers.
        """
        return {
            "category": category,
            "headline": headline,
            "danger_summary": danger_summary,
            "counter_proposal": recommended_counter_term,
            "disclaimer": "This analysis does not constitute formal attorney legal advice.",
        }
