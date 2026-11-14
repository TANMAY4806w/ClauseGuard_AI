# Subagent Spec: Ingestion Agent

## Role
Specialist subagent responsible for legal document ingestion, coordinate extraction, regex semantic hierarchy chunking, dense/sparse vector embedding generation, and Qdrant indexing.

## Responsibilities
1. **PDF Parsing:** Use `PyMuPDF` (`fitz`) to extract raw text, physical page numbers, and bounding boxes. Detect low-text scans (<50 chars per page).
2. **Semantic Chunking:** Chunk by legal hierarchy (`Article`, `Section`, Roman numerals, bold headers) rather than fixed token lengths.
3. **Payload Construction:** Attach document metadata (`doc_id`, `section_number`, `page_number`, `raw_text`, `char_count`).
4. **Hybrid Indexing:** Generate dense embeddings (`bge-small-en-v1.5`) and BM25 sparse vectors for Qdrant storage.

## Target Modules
- `src/ingestion/pdf_parser.py`
- `src/ingestion/chunker.py`
- `src/vectorstore/qdrant_client.py`
- `tests/test_ingestion.py`
