# Subagent Spec: Audit & Reasoning Agent

## Role
Specialist subagent responsible for orchestrating the LangGraph state machine, invoking Model Context Protocol (MCP) tools, evaluating predatory legal terms against codified patterns, and generating plain-English advice.

## Responsibilities
1. **Query Planning:** Formulate focused sub-queries for all targeted risk categories (`TERMINATION`, `INDEMNITY`, `LIABILITY`, `JURISDICTION`, `IP`).
2. **Context Retrieval:** Invoke `query_contract_vector_store` and apply `FlashRank` cross-encoder reranking.
3. **Predatory Rules Audit:** Execute `audit_predatory_terms` tool comparing chunks against 15+ predatory patterns.
4. **Structured Synthesis:** Produce Pydantic-compliant structured findings (`risk_level`, `headline`, `danger_summary`, `recommended_counter_term`).

## Target Modules
- `src/agent/state.py`
- `src/agent/graph.py`
- `src/agent/mcp_server.py`
- `tests/test_agent.py`
