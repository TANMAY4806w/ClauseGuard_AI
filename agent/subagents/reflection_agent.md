# Subagent Spec: Reflection & Citation Verifier Agent

## Role
Specialist subagent acting as an adversarial self-reflection guardrail. Verifies that every extracted quote and section citation exists verbatim in the source contract, preventing LLM hallucinations.

## Responsibilities
1. **Verbatim Matching:** Retrieve source text for the cited `page_number` from raw document memory or parsed cache.
2. **Levenshtein Alignment:** Compute string similarity between `verbatim_quote` and source page text.
3. **Guardrail Decision:**
   - If similarity $\ge 0.95$: Mark citation as **VERIFIED**.
   - If similarity $< 0.95$: Mark citation as **HALLUCINATED**, return feedback error, and trigger re-retrieval / fuzzy coordinate realignment in LangGraph.
4. **Accuracy Assurance:** Guarantee 100% citation reliability before persisting findings to PostgreSQL.

## Target Modules
- `src/agent/reflection.py`
- `src/agent/mcp_server.py` (`verify_source_citation`)
