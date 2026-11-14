# System Architecture & Data Flow Specification

---

## 1. High-Level System Architecture

ClauseGuard AI is engineered as a decoupled, multi-container microservice system designed for high reliability, deterministic execution, and low inference latency.

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
        Orchestrator <-->|Inference & Formatting| LLM["Gemini 1.5 Flash / OpenRouter"]
    end

    subgraph OutputLayer["4. Validation & Delivery"]
        Orchestrator -->|Verify Citations| Verifier["Reflection & Citation Validator"]
        Verifier -->|Valid Schema| DB["PostgreSQL Audit Log"]
        Verifier -->|Cache Final Report| Redis
        API -->|GET /contracts/{id}/analysis| User
    end
```

---

## 2. Ingestion Pipeline & Clause-Aware Chunking

### 2.1 The Chunking Challenge in Legal Tech
Standard naive text splitters (e.g., splitting every 500 characters or 200 tokens with 20-token overlap) catastrophically break legal documents. An indemnity clause or cancellation condition that begins at token 180 and ends at token 320 will get sliced across chunks, losing its legal context and distorting cross-references.

### 2.2 Semantic Clause Parser Specification (`src/ingestion/chunker.py`)
ClauseGuard AI uses a **regex-anchored semantic hierarchy splitter**:
1. **Header & Section Extraction:** Detects standardized numbering formats:
   * Roman numerals: `Article I`, `Article II`, etc.
   * Decimal numbering: `1.0`, `1.1`, `1.1.1`, `Section 4(b)`.
   * Bold legal caps: `TERMINATION`, `INDEMNITY`, `GOVERNING LAW`, `CONFIDENTIALITY`.
2. **Page & Coordinate Tracking:** For each extracted clause, PyMuPDF captures:
   * `page_number` (1-indexed physical PDF page).
   * `section_title` (e.g., "Section 8.2 - Automatic Renewal").
   * `bounding_box` coordinates (optional visual highlight coordinates).
   * `verbatim_text` (exact clean string).
3. **Payload Construction:** Every chunk ingested into Qdrant adheres to this metadata schema:
   ```json
   {
     "doc_id": "doc_9a7b2c3d",
     "clause_id": "clause_014",
     "section_number": "8.2",
     "section_title": "Renewal Term and Notice of Cancellation",
     "page_number": 6,
     "character_count": 482,
     "token_count": 112,
     "raw_text": "Unless Customer provides written notice of non-renewal at least ninety (90) days prior to the expiration of the Initial Term..."
   }
   ```

---

## 3. Hybrid Retrieval & Cross-Encoder Reranking

### 3.1 Why Hybrid Search (Dense + Sparse)?
* **Dense Vectors (`BAAI/bge-small-en-v1.5`):** Excels at conceptual semantics (e.g., matching *"who pays if someone sues us"* to an *"Indemnification"* clause).
* **Sparse Search (`BM25`):** Excels at exact numeric and legal identifier matches (e.g., *"90 days"*, *"₹50,000"*, *"triple damages"*, *"delaware"*).
* Combining both via Reciprocal Rank Fusion (RRF) in Qdrant ensures that neither legal concepts nor exact contractual numbers are missed.

### 3.2 FlashRank Cross-Encoder Pipeline (`src/vectorstore/reranker.py`)
1. Qdrant retrieves the top 25 candidate chunks via hybrid search.
2. A lightweight, CPU-optimized cross-encoder model (`ms-marco-TinyBERT-L-2-v2` via `FlashRank`) scores the direct relevance between the audit query and candidate text.
3. The top 5 highest-confidence chunks are forwarded to the agent's context window.
4. **Latency Benefit:** FlashRank executes in $< 18 \text{ ms}$ on CPU, cutting token overhead by $70\%$ before invoking the LLM.

---

## 4. End-to-End Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Client / User
    participant API as FastAPI App
    participant Redis as Redis Cache
    participant Ingest as Ingestion & Qdrant
    participant Agent as LangGraph Agent
    participant MCP as MCP Tool Server
    participant LLM as Foundation LLM

    User->>API: POST /contracts/upload (PDF file)
    API->>API: Compute SHA-256 Document Hash
    API->>Redis: Check if doc_hash is already cached
    alt Cached Analysis Found
        Redis-->>API: Return Cached Risk Report
        API-->>User: 200 OK (Instant Response < 15ms)
    else New Contract
        API->>Redis: Store job_status: "PROCESSING"
        API-->>User: 202 Accepted {doc_id, status: "PROCESSING"}
        API->>Ingest: Trigger Async Ingestion
        Ingest->>Ingest: PyMuPDF Semantic Section Extraction
        Ingest->>Ingest: Generate BGE & BM25 Embeddings
        Ingest->>Qdrant: Upsert Chunks with Metadata
        Ingest->>Agent: Trigger Risk Analysis Workflow
        loop For Each Core Risk Category
            Agent->>Qdrant: Hybrid Search & FlashRank Rerank
            Qdrant-->>Agent: Top-5 Relevant Chunks
            Agent->>MCP: Call audit_predatory_terms(chunks)
            MCP-->>Agent: Standardized Pattern Match Results
            Agent->>LLM: Synthesize Risk Explanation & Citation
            LLM-->>Agent: Structured Pydantic JSON
        end
        Agent->>Agent: Self-Reflection Citation Verification
        Agent->>Redis: Cache Final Report (TTL: 24h)
        Agent->>API: Mark job_status: "COMPLETED"
        User->>API: GET /contracts/{doc_id}/analysis
        API-->>User: 200 OK {status: "COMPLETED", report: {...}}
    end
```
