# Living Implementation Checklist & Progress Tracker

> **Update Protocol:** This checklist is inspected and synced whenever milestone updates are provided to the user.

*Last Synchronized:* 2026-11-16T00:06:00+05:30  
*Current Phase:* **Phase 2: Ingestion Pipeline & Hybrid Vector Store**

---

## 📋 Master Roadmap Checklist

### Phase 1: Environment Setup & Core Foundations
- [x] **Task 1.1:** Initialize virtual environment (`venv`) and activate.
- [x] **Task 1.2:** Create `requirements.txt` with locked versions and install dependencies.
- [x] **Task 1.3:** Create `.env.example` and local `.env` configuration file.
- [x] **Task 1.4:** Implement `src/core/config.py` using `pydantic-settings`.
- [x] **Task 1.5:** Implement `src/core/logger.py` with structured JSON output formatting.
- [x] **Gate 1:** Run config and logger unit tests; verify env loading works cleanly (7/7 tests passed in 0.63s).

---

### Phase 2: Ingestion Pipeline & Hybrid Vector Store
- [ ] **Task 2.1:** Implement `src/ingestion/pdf_parser.py` (PyMuPDF / `fitz` for page text & coordinate extraction).
- [ ] **Task 2.2:** Implement `src/ingestion/chunker.py` (Regex semantic hierarchy chunking preserving legal sections).
- [ ] **Task 2.3:** Implement `src/vectorstore/qdrant_client.py` (Qdrant client supporting embedded local storage & hybrid search).
- [ ] **Task 2.4:** Implement `src/vectorstore/reranker.py` (FlashRank cross-encoder `ms-marco-TinyBERT-L-2-v2`).
- [ ] **Gate 2:** Write `tests/test_ingestion.py`. Ingest sample PDF, verify chunks retain section titles, page numbers, and query via hybrid search.

---

### Phase 3: Model Context Protocol (MCP) Server & LangGraph Agent
- [ ] **Task 3.1:** Implement `src/agent/mcp_server.py` with the 4 core tools:
  - `query_contract_vector_store`
  - `audit_predatory_terms` (15+ codified rule patterns)
  - `verify_source_citation` (Levenshtein verification $\ge 0.95$)
  - `synthesize_plain_english_advice`
- [ ] **Task 3.2:** Define LangGraph state in `src/agent/state.py` (`ClauseGuardState`).
- [ ] **Task 3.3:** Build graph nodes and edges in `src/agent/graph.py` (Plan $\rightarrow$ Retrieve $\rightarrow$ Audit $\rightarrow$ Reflection $\rightarrow$ Finalize).
- [ ] **Gate 3:** Write `tests/test_agent.py`. Verify agent detects an auto-renewal trap with verifiable citations.

---

### Phase 4: FastAPI REST API & Redis Acceleration
- [ ] **Task 4.1:** Implement Pydantic V2 schemas in `src/api/schemas.py`.
- [ ] **Task 4.2:** Implement Redis caching & state service in `src/services/cache.py`.
- [ ] **Task 4.3:** Implement asynchronous endpoints in `src/api/routes.py`:
  - `POST /api/v1/auth/token`
  - `POST /api/v1/contracts/upload`
  - `GET /api/v1/contracts/{doc_id}/status`
  - `GET /api/v1/contracts/{doc_id}/analysis`
- [ ] **Task 4.4:** Build application entry point in `src/main.py`.
- [ ] **Gate 4:** Launch Uvicorn; test upload and polling via Swagger UI at `/docs`.

---

### Phase 5: Ragas Evaluation & Golden Dataset Benchmarking
- [ ] **Task 5.1:** Populate `data/golden_eval_dataset/golden_contracts.json` with 30+ labeled ground-truth clauses.
- [ ] **Task 5.2:** Implement `evaluation/run_ragas_eval.py` benchmarking script.
- [ ] **Task 5.3:** Execute benchmark and assert quality thresholds:
  - Faithfulness $\ge 0.90$
  - Context Precision $\ge 0.88$
  - Context Recall $\ge 0.85$
  - Verbatim Citation Precision = $100\%$
- [ ] **Gate 5:** Export evaluation metrics and update `README.md`.

---

### Phase 6: Multi-Container Docker Deployment & CI/CD
- [ ] **Task 6.1:** Create multi-stage `Dockerfile` (Python 3.11-slim, non-root user).
- [ ] **Task 6.2:** Create `docker-compose.yml` (`api`, `qdrant`, `redis`).
- [ ] **Task 6.3:** Create GitHub Actions CI workflow (`.github/workflows/ci.yml`).
- [ ] **Gate 6:** Run `docker-compose up --build`; verify end-to-end integration and healthchecks.
