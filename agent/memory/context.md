# Agent Memory: Project Context & Knowledge Base

*Last Updated: 2026-11-15T00:47:00+05:30*  
*Active Status: Phase 1 — Environment Setup & Core Foundations*

---

## 1. Project Identity
- **Project Name:** ClauseGuard AI
- **Repository:** `https://github.com/TANMAY4806w/ClauseGuard_AI` (Public)
- **Local Working Path:** `C:\Users\TANMAY\OneDrive\Desktop\Resume\03_Projects\ClauseGuard_AI`
- **Core Purpose:** Autonomous legal contract risk intelligence microservice auditing commercial agreements for predatory clauses (auto-renewal, uncapped indemnification, unilateral modification, remote jurisdiction, IP transfer) with plain-English translations and 100% verifiable verbatim citations.

---

## 2. Technical Stack & Architecture
- **Language:** Python 3.13.5 (Active environment on Windows)
- **API Framework:** FastAPI + Uvicorn (Asynchronous REST)
- **Agent Orchestration:** LangGraph (StateGraph with cyclic reflection loop)
- **Tool Protocol:** Model Context Protocol (MCP) server exposing 4 core tools:
  - `query_contract_vector_store`
  - `audit_predatory_terms` (15+ codified rule patterns)
  - `verify_source_citation` (Levenshtein verification $\ge 0.95$)
  - `synthesize_plain_english_advice`
- **Vector Database:** Qdrant (Dense `BAAI/bge-small-en-v1.5` + Sparse BM25 Hybrid)
- **Cross-Encoder Reranker:** FlashRank (`ms-marco-TinyBERT-L-2-v2`) (<18ms CPU latency)
- **Database:** PostgreSQL (Users, Documents, Clauses, Risk Flags, Audit Logs)
- **Cache & State Store:** Redis (Sub-15ms cached lookup by SHA-256 hash)
- **Evaluation:** Ragas Framework (Faithfulness $\ge 0.90$, Context Precision $\ge 0.88$, Context Recall $\ge 0.85$, Verbatim Citation Precision = $100\%$)

---

## 3. Local Environment & Development Strategy
- **Python Version:** 3.13.5
- **Docker Status:** Docker daemon is currently not in the local host PATH.
  - *Strategy:* For local phases (Phases 1–5), we run **Qdrant in embedded / local storage mode** (`QdrantClient(path="./qdrant_storage")` or `:memory:`) and use **in-memory caching / fakeredis**, keeping all interfaces standard and pluggable so they seamlessly transition to external Docker containers in Phase 6.
- **Git Status:** Git initialized on `main` branch, tracking remote `origin/main`. `agent/` directory is locally ignored via `.gitignore` to preserve context privacy.

---

## 4. Key Architectural Decisions Log
| ID | Decision | Rationale |
| :--- | :--- | :--- |
| **ADR-001** | Regex-anchored semantic hierarchy chunking over naive fixed-token splitting | Fixed-token splitters destroy legal clauses across boundaries; regex preserves `Article`, `Section`, and coordinate metadata. |
| **ADR-002** | FlashRank CPU Reranker before LLM context injection | Pruning 25 candidates to top 5 cuts LLM token overhead by 70% with negligible (<18ms) CPU overhead. |
| **ADR-003** | Self-Reflection Citation Guardrail with Levenshtein String Check | Eliminates LLM citation hallucination; ensures 100% verifiable quote matching before saving to DB. |
| **ADR-004** | SHA-256 Redis Caching Layer | Eliminates redundant LLM calls on repeated contract queries, delivering sub-15ms cached responses. |
