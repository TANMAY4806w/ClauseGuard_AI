# PRD: ClauseGuard AI (Product Requirements Document)

---

## 1. Executive Summary & Problem Statement

### 1.1 The Problem
Individuals, freelancers, independent contractors, and small-to-medium businesses (SMBs) routinely sign commercial and legal agreements (such as residential/commercial leases, SaaS vendor agreements, software consulting contracts, NDAs, and loan agreements) without understanding predatory or hazardous terms. 

Full legal review by corporate lawyers is cost-prohibitive (costing ₹10,000 to ₹50,000+ per document review) and time-consuming (taking 3–5 business days). Consequently, parties sign agreements containing:
* **Hidden Auto-Renewal Traps:** Strict 60-to-90-day advance cancellation windows with automatic 12-month lock-ins and full forfeiture.
* **Uncapped & Asymmetric Indemnification:** Forcing the signatory to indemnify the counterparty against any and all third-party claims without liability caps.
* **Unilateral Modification Clauses:** Allowing vendor platforms to alter pricing, SLAs, or terms without customer consent.
* **Onerous Dispute Jurisdiction:** Enforcing dispute litigation in foreign or distant jurisdictions, rendering legal defense unviable.
* **Broad Intellectual Property Assignments:** Inadvertently transferring ownership of pre-existing background IP or work products.

### 1.2 The Solution
**ClauseGuard AI** is an autonomous, production-grade legal intelligence microservice. Users upload a contract (PDF/DOCX). The system semantically extracts clauses, audits them against a curated rulebase of predatory patterns, assigns a quantified risk tier (**HIGH, MEDIUM, LOW, SAFE**), translates the legal risks into plain, non-lawyer English, provides actionable counter-negotiation suggestions, and links every assertion to an **exact verifiable source citation (section number, page number, and verbatim text)** to eliminate hallucinations.

---

## 2. Target Personas & User Stories

### 2.1 Personas
* **Persona 1: The Freelance Engineer / Agency Owner**
  * *Need:* Needs to review client MSAs and SOWs quickly to ensure intellectual property assignment is limited to paid work and liability is capped at fees paid.
* **Persona 2: The SMB Operations Lead / Startup Founder**
  * *Need:* Auditing multi-year vendor SaaS agreements, commercial office leases, and supplier terms without incurring ongoing external legal retainer fees.
* **Persona 3: The Tenant / Individual Signatory**
  * *Need:* Checking lease agreements for hidden forfeiture clauses, arbitrary rent hike clauses, and security deposit withholding loopholes.

### 2.2 Core User Stories
1. *As a user, I want to upload a 10–50 page PDF contract so that I can receive a complete risk breakdown within 15–30 seconds.*
2. *As a user, I want each flagged risk to cite the exact section and page number so that I can verify it myself in the physical document.*
3. *As a user, I want plain-English explanations and counter-negotiation language so that I can request fair modifications from the counterparty.*
4. *As a developer, I want a standardized REST API and Model Context Protocol (MCP) interface so that ClauseGuard AI can be integrated into automated document workflows.*

---

## 3. Product Scope & Functional Requirements

### 3.1 In-Scope Features (MVP & V1)
* **Document Ingestion:** Support for PDF and text-based legal contracts up to 100 pages.
* **Clause-Aware Semantic Chunking:** Ingestion engine that respects legal sections (e.g., Section 1.1, Article IV) rather than slicing arbitrary token windows.
* **Hybrid RAG:** Qdrant-based retrieval combining dense vector embeddings (`bge-small-en-v1.5`) and sparse keyword matching (`BM25`).
* **Cross-Encoder Reranking:** FlashRank reranking to isolate the top-k most relevant contract clauses.
* **Agentic Risk Audit via MCP:** Autonomous agent invoking custom Model Context Protocol (MCP) tools to evaluate 15+ standardized predatory legal patterns.
* **Self-Reflection & Citation Verification:** Internal validation loop cross-checking extracted quotes against the raw document to ensure 100% citation accuracy.
* **FastAPI Backend:** Asynchronous endpoints with JWT authentication and Redis caching for sub-10ms response on cached queries.
* **Empirical Ragas Evaluation:** Continuous quality benchmarking verifying Faithfulness $\ge 0.90$ and Context Precision $\ge 0.88$.

### 3.2 Out-of-Scope (Non-Goals for V1)
* **Formal Legal Representation:** ClauseGuard AI does NOT provide attorney-client legal representation or formal legal opinions. Disclaimers are strictly enforced in all outputs.
* **Contract Redlining & Multi-party Negotiation Automation:** Automated back-and-forth negotiation emails with the counterparty are excluded from V1.
* **Scanned Handwritten OCR:** Documents must be digitally born PDFs or legible text-scans. Low-resolution handwritten notes are out of scope.

---

## 4. Non-Functional Requirements (NFRs)

| Metric | Target Specification |
| :--- | :--- |
| **P95 Latency (Cached Document Query)** | $\le 15 \text{ ms}$ (served via Redis) |
| **P95 Latency (Full 20-Page Contract Analysis)** | $\le 25 \text{ seconds}$ (asynchronous background queue) |
| **Zero-Hallucination Citation Rate** | $100\%$ (all citations must match verbatim source text) |
| **Ragas Faithfulness Benchmark** | $\ge 0.90$ |
| **Ragas Context Precision** | $\ge 0.88$ |
| **Concurrency & Throughput** | $\ge 20 \text{ concurrent analyses}$ on a 4-core, 8GB RAM host |
| **Container Footprint** | Multi-container Docker Compose under 3.5GB peak memory |

---

## 5. Success Metrics & Acceptance Criteria
1. **Accuracy Metric:** High-risk clause detection recall $\ge 90\%$ on the 30-contract golden evaluation dataset.
2. **Reliability Metric:** 0 unhandled 500 internal server errors during continuous stress tests (100 sequential uploads).
3. **Engineering Standard:** Codebase passes 100% of unit tests (`pytest`), adheres to clean architecture principles (`src/core`, `src/ingestion`, `src/agent`, `src/api`), and provides runnable Docker Compose setup.
