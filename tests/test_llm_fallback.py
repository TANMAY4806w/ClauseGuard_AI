import pytest
from unittest.mock import patch, MagicMock
from src.agent.llm_client import MultiProviderLLMClient


def test_llm_client_initialization():
    client = MultiProviderLLMClient()
    assert client.settings is not None
    assert client.headers_base["User-Agent"] == "ClauseGuardAI/1.0"


def test_enrich_risk_with_legal_context_deterministic_fallback():
    client = MultiProviderLLMClient()
    with patch.object(client, "generate_with_fallback", return_value=None):
        result = client.enrich_risk_with_legal_context(
            category="TERMINATION",
            verbatim_quote="Automatic renewal unless 90 days notice",
            headline="Auto-renewal trap",
            danger_summary="Locks customer into another year",
            counter_term="30 days notice",
        )
        assert "statutory_compliance_note" in result
        assert "Indian Contract Act" in result["statutory_compliance_note"]
        assert "negotiation_advice" in result


def test_cascading_fallback_groq_to_gemini():
    client = MultiProviderLLMClient()
    # Mock groq failing, gemini succeeding
    with patch.object(client, "_call_groq", return_value=None), \
         patch.object(client, "_call_gemini", return_value="Gemini Analysis Success"):
        response = client.generate_with_fallback("Test prompt")
        assert response == "Gemini Analysis Success"


def test_live_groq_inference_if_key_available():
    client = MultiProviderLLMClient()
    if client.settings.GROQ_API_KEY:
        res = client._call_groq("Say 'OK' in one word.", model=client.settings.PRIMARY_GROQ_MODEL)
        assert res is not None
        assert len(res) > 0
