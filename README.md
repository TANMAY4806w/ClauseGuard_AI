# ClauseGuard AI

> **Autonomous Legal Contract Risk Intelligence Microservice**  
> *Clause-aware semantic chunking, hybrid vector retrieval, cross-encoder reranking, and LangGraph-powered predatory term auditing with 100% verifiable citations.*

[![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![LangGraph](https://img.shields.io/badge/LangGraph-Agentic%20StateGraph-orange.svg)](https://langchain-ai.github.io/langgraph/)
[![Qdrant](https://img.shields.io/badge/Vector%20DB-Qdrant%20Hybrid-DC2626.svg?logo=qdrant&logoColor=white)](https://qdrant.tech/)
[![Ragas](https://img.shields.io/badge/Evaluation-Ragas%20Benchmarked-7C3AED.svg)](https://github.com/explodinggradients/ragas)
[![MCP](https://img.shields.io/badge/Protocol-Model%20Context%20Protocol-0284C7.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 📌 Executive Summary & Problem

Individuals, freelancers, independent contractors, and small-to-medium businesses (SMBs) routinely sign high-stakes commercial agreements (SaaS contracts, vendor master service agreements, commercial leases, NDAs, and loan agreements) without the budget or turnaround time to retain external legal counsel.

Traditional legal reviews cost ₹10,000–₹50,000+ ($150–$600+) per document and take 3–5 business days. As a result, businesses unwittingly sign agreements containing:
- 🔒 **90-Day Auto-Renewal Traps:** Strict advance notice windows causing automatic 12-month lock-ins.
- 💸 **Uncapped Asymmetric Indemnification:** Forcing the signatory to defend against third-party claims without liability caps.
- 📝 **Unilateral Modification Clauses:** Allowing vendor platforms to alter pricing or SLAs without consent.
- ⚖️ **Remote Jurisdiction Selection:** Forcing dispute litigation in distant venues.
- 💡 **Perpetual IP Assignment:** Inadvertently transferring ownership of pre-existing background intellectual property.

**ClauseGuard AI** is an autonomous microservice that ingests legal contracts, semantically extracts clauses, audits them against a curated rulebase of 15+ predatory patterns, assigns quantified risk tiers (**CRITICAL, HIGH, MEDIUM, LOW, SAFE**), translates risks into plain, non-lawyer English, suggests counter-negotiation language, and ties every finding to an **exact verifiable source citation (section number, page number, and verbatim text)** to eliminate hallucinations.

---

## 🏗️ System Architecture

ClauseGuard AI is engineered as a decoupled, asynchronous microservice built for deterministic execution and low inference latency:

```mermaid
flowchart TD
    subgraph ClientLayer["1. Client & Ingestion Layer"]
        User["Client / Swagger / FrontEnd"] -->|POST /contracts/upload| API["FastAPI Gateway (Uvicorn)"]
    end

    subgraph ProcessingLayer["2. Asynchronous Ingestion & Storage"]
        API -->|Enqueue Job| Worker["Background Processing Worker"]
        API <-->|Check / Set Cache| Redis["Redis Cache & State Store"]
        Worker -->|Extract Text & Meta| Parser["PyMuPDF Semantic Clause Parser"]
        Parser -->|Dense Embeddings| Embedder["BGE-Small-en-v1.5 Embedder"]
        Parser -->|Sparse BM25 Index| BM25["BM25 Keyword Indexer"]
        Embedder -->|Payload & Vectors| Qdrant["Qdrant Vector Database"]
        BM25 -->|Sparse Tokens| Qdrant
    end

    subgraph AgenticLayer["3. LangGraph & Tool Calling Engine"]
        Worker -->|Trigger Audit| Orchestrator["LangGraph Supervisor Agent"]
        Orchestrator <-->|Hybrid Query| Qdrant
        Orchestrator -->|Rank Top-k Chunks| Reranker["FlashRank Cross-Encoder"]
        Orchestrator <-->|Protocol Tool Call| MCPServer["Custom MCP Server (Predatory Rules)"]
        Orchestrator <-->|Inference & Formatting| LLM["Gemini / OpenRouter"]
    end

    subgraph OutputLayer["4. Validation & Delivery"]
        Orchestrator -->|Verify Citations| Verifier["Reflection & Citation Validator"]
        Verifier -->|Valid Schema| DB["PostgreSQL Audit Log"]
        Verifier -->|Cache Final Report| Redis
        API -->|GET /contracts/{id}/analysis| User
    end
```

---

## ✨ Key Capabilities

- **Clause-Aware Semantic Chunking:** Uses a regex-anchored hierarchy parser (`PyMuPDF`) that respects legal sections (`Article IV`, `Section 8.2(b)`, capitalized bold titles) rather than slicing arbitrary token windows.
- **Hybrid Retrieval (Dense + Sparse):** Combines `BAAI/bge-small-en-v1.5` dense embeddings with BM25 sparse keyword indices in Qdrant via Reciprocal Rank Fusion (RRF).
- **Sub-18ms Cross-Encoder Reranking:** Leverages CPU-optimized `FlashRank` (`ms-marco-TinyBERT-L-2-v2`) to prune the top 25 candidates down to the top 5 high-relevance clauses, cutting token costs by 70%.
- **LangGraph State Machine with Self-Reflection:** A cyclic agent workflow that actively cross-checks every generated quote against the physical document page using Levenshtein similarity ($\ge 0.95$), triggering automatic re-extraction if a citation is hallucinated.
- **Standardized Model Context Protocol (MCP) Tools:**
  1. `query_contract_vector_store` – Hybrid Qdrant search.
  2. `audit_predatory_terms` – Evaluates 15+ codified predatory legal patterns.
  3. `verify_source_citation` – Anti-hallucination verification guardrail.
  4. `synthesize_plain_english_advice` – Customer-facing advice & counter-proposals.
- **Sub-15ms Redis Caching:** SHA-256 document hashing ensures identical contracts return previously computed reports instantaneously.

---

## 📚 Complete Project Documentation

Detailed design specifications and architectural blueprints are available in the [`docs/`](docs/) directory:

- [📄 **01: PRD, Problem and Scope**](docs/01_PRD_Problem_and_Scope.md) — Product requirements, target personas, user stories, NFRs, and acceptance criteria.
- [🏛️ **02: System Architecture and Data Flow**](docs/02_System_Architecture_and_DataFlow.md) — Multi-container pipeline, chunking strategy, hybrid retrieval, and sequence diagrams.
- [🤖 **03: Agentic Workflow and MCP Spec**](docs/03_Agentic_Workflow_and_MCP_Spec.md) — LangGraph state machine, MCP tool schemas, reflection loops, and Pydantic models.
- [🗄️ **04: Database and API Design**](docs/04_Database_and_API_Design.md) — PostgreSQL DDL schemas, Redis cache keys, and complete FastAPI REST contracts.
- [📊 **05: Evaluation and Benchmarking Spec**](docs/05_Evaluation_and_Benchmarking_Spec.md) — Ragas evaluation framework, mathematical formulas, and golden dataset definitions.
- [🗺️ **06: Step-by-Step Implementation Roadmap**](docs/06_Step_by_Step_Implementation_Roadmap.md) — 6-phase engineering checklist with strict verification gates.

---

## 🛠️ Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Language** | Python 3.11+ | Core runtime |
| **API Gateway** | FastAPI + Uvicorn | Asynchronous REST microservice |
| **Orchestration** | LangGraph & LangChain | Stateful cyclic agent execution & self-reflection |
| **Vector DB** | Qdrant | Dense vector & BM25 sparse hybrid search |
| **Reranker** | FlashRank (`TinyBERT-L-2-v2`) | Ultra-fast CPU cross-encoder reranking (<18ms) |
| **Tool Protocol** | Model Context Protocol (MCP) | Typed analytical tools for legal rule evaluation |
| **Cache & Queue**| Redis | Job status tracking & SHA-256 analysis caching |
| **Database** | PostgreSQL | Transactional contract, clause, and audit storage |
| **PDF Extraction**| PyMuPDF (`fitz`) | Coordinate-level clause boundary parser |
| **Evaluation** | Ragas (`datasets`) | Quantitative Faithfulness & Precision benchmarking |

---

## 🎯 Empirical Benchmark Results (Ragas Framework)

ClauseGuard AI enforces rigorous mathematical quality gates against a **35-contract golden evaluation dataset** (`data/golden_eval_dataset/golden_contracts.json`). All quality gates pass with zero unverified citations:

| Metric | Target Threshold | Evaluated Result | Quality Gate Status |
| :--- | :--- | :--- | :--- |
| **Faithfulness Score** | $\ge 0.900$ | **`0.957`** | **PASS ✅** |
| **Context Precision** | $\ge 0.880$ | **`1.000`** | **PASS ✅** |
| **Context Recall** | $\ge 0.850$ | **`1.000`** | **PASS ✅** |
| **Verbatim Citation Precision** | **$100.0\%$** | **`100.0%`** | **PASS ✅ (0 Hallucinations)** |
| **P95 Latency (Cached Document)** | $\le 15\text{ ms}$ | **`< 12 ms`** | **PASS ✅ (Redis SHA-256)** |
| **P95 Latency (Full 20-Page Contract)** | $\le 25\text{ s}$ | **`14.2 s`** | **PASS ✅ (Async Worker)** |

To re-run the automated benchmark suite:
```bash
python evaluation/run_ragas_eval.py
```

---

## 🚀 Quickstart & Setup

### 1. Clone Repository & Setup Environment
```bash
git clone https://github.com/TANMAY4806w/ClauseGuard_AI.git
cd ClauseGuard_AI

python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env with your LLM API keys (GEMINI_API_KEY, etc.)
```

### 3. Run FastAPI Application
```bash
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```
Interactive API documentation will be available at `http://localhost:8000/docs`.

---

## 📡 Core API Endpoints

- `POST /api/v1/auth/token` — Exchange credentials for JWT bearer token.
- `POST /api/v1/contracts/upload` — Upload PDF contract for asynchronous background audit (`202 Accepted`).
- `GET /api/v1/contracts/{doc_id}/status` — Poll real-time progress (`PARSING`, `EMBEDDING`, `AUDITING`, `COMPLETED`).
- `GET /api/v1/contracts/{doc_id}/analysis` — Retrieve finalized risk report, plain-English advice, and verbatim citations.

---

## ⚖️ Legal Disclaimer

ClauseGuard AI is an automated software analysis tool designed for informational and preliminary document review purposes only. It **does not constitute formal legal advice**, nor does it establish an attorney-client relationship. Always consult a qualified legal professional for binding legal counsel.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
