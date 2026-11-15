import io
import fitz  # PyMuPDF
import pytest

from src.ingestion.pdf_parser import PDFParser
from src.ingestion.chunker import SemanticClauseChunker, ClauseChunk
from src.vectorstore.qdrant_client import QdrantVectorStore
from src.vectorstore.reranker import FlashRankReranker


def create_synthetic_contract_pdf() -> bytes:
    """Create an in-memory 2-page sample commercial contract PDF for testing."""
    doc = fitz.open()

    # Page 1
    page1 = doc.new_page()
    text_page1 = (
        "MASTER SERVICES AGREEMENT\n\n"
        "Article I: Definitions and Term\n"
        "This Agreement commences on January 1, 2026 and continues for a period of twelve (12) months.\n\n"
        "Section 14.2 Automatic Renewal and Cancellation\n"
        "Unless Customer provides written notice of non-renewal at least ninety (90) days prior to the expiration "
        "of the Initial Term, this Agreement shall automatically renew for successive twelve (12) month periods.\n\n"
        "Section 8.1 Fees and Payment Terms\n"
        "Customer agrees to pay all undisputed invoices within thirty (30) days of receipt."
    )
    page1.insert_text((50, 72), text_page1, fontsize=11)

    # Page 2
    page2 = doc.new_page()
    text_page2 = (
        "Article II: Liability and Indemnification\n\n"
        "Section 9.1 Uncapped Indemnification\n"
        "Customer shall defend, indemnify, and hold harmless Vendor from and against any and all third-party claims, "
        "losses, damages, and reasonable attorney fees without limitation of liability.\n\n"
        "Section 11.4 Governing Law and Dispute Jurisdiction\n"
        "This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware."
    )
    page2.insert_text((50, 72), text_page2, fontsize=11)

    pdf_bytes = doc.write()
    doc.close()
    return pdf_bytes


class TestIngestionPipeline:
    """Test suite for PDF parsing, semantic chunking, and Qdrant hybrid retrieval."""

    def test_pdf_parser_page_and_hash_extraction(self):
        pdf_bytes = create_synthetic_contract_pdf()
        parser = PDFParser()
        parsed_doc = parser.parse(pdf_bytes, filename="MSA_Test.pdf")

        assert parsed_doc.total_pages == 2
        assert len(parsed_doc.pages) == 2
        assert parsed_doc.pages[0].page_number == 1
        assert parsed_doc.pages[1].page_number == 2
        assert "Automatic Renewal" in parsed_doc.pages[0].text
        assert "Uncapped Indemnification" in parsed_doc.pages[1].text
        assert parsed_doc.sha256_hash is not None
        assert parsed_doc.doc_id.startswith("doc_")

    def test_pdf_parser_scanned_page_warning(self):
        # Empty single page PDF
        doc = fitz.open()
        doc.new_page()
        empty_pdf_bytes = doc.write()
        doc.close()

        parser = PDFParser()
        parsed_doc = parser.parse(empty_pdf_bytes, filename="Scanned.pdf")
        assert parsed_doc.pages[0].is_scanned_warning is True

    def test_semantic_clause_chunker(self):
        pdf_bytes = create_synthetic_contract_pdf()
        parser = PDFParser()
        parsed_doc = parser.parse(pdf_bytes, filename="MSA_Test.pdf")

        chunker = SemanticClauseChunker()
        chunks = chunker.chunk_document(parsed_doc)

        assert len(chunks) >= 4
        # Verify page numbers match physical pages
        page_numbers = {c.page_number for c in chunks}
        assert 1 in page_numbers
        assert 2 in page_numbers

        # Verify section title detection and categorization
        auto_renewal_chunk = next((c for c in chunks if "Renewal" in c.section_title or "14.2" in c.section_number), None)
        assert auto_renewal_chunk is not None
        assert auto_renewal_chunk.category == "TERMINATION"
        assert auto_renewal_chunk.page_number == 1

        indemnity_chunk = next((c for c in chunks if "Indemnif" in c.section_title or "9.1" in c.section_number), None)
        assert indemnity_chunk is not None
        assert indemnity_chunk.category == "INDEMNITY"
        assert indemnity_chunk.page_number == 2

    def test_qdrant_vector_store_upsert_and_search(self):
        pdf_bytes = create_synthetic_contract_pdf()
        parser = PDFParser()
        parsed_doc = parser.parse(pdf_bytes, filename="MSA_Test.pdf")
        chunker = SemanticClauseChunker()
        chunks = chunker.chunk_document(parsed_doc)

        # Test with in-memory Qdrant
        vstore = QdrantVectorStore(collection_name="test_contract_clauses", mode="memory")
        upserted_count = vstore.upsert_clauses(chunks)
        assert upserted_count == len(chunks)

        # Query for auto-renewal clause
        results = vstore.hybrid_search(
            query="advance notice requirement for auto renewal cancel",
            doc_id=parsed_doc.doc_id,
            limit=5,
        )
        assert len(results) > 0
        assert any("renew" in r["raw_text"].lower() for r in results)

        # Query with category filter
        indemnity_results = vstore.hybrid_search(
            query="defend and hold harmless third party claims",
            doc_id=parsed_doc.doc_id,
            category_filter="INDEMNITY",
            limit=5,
        )
        assert len(indemnity_results) > 0
        assert all(r["category"] == "INDEMNITY" for r in indemnity_results)

    def test_flashrank_reranker(self):
        reranker = FlashRankReranker()
        sample_candidates = [
            {
                "chunk_id": "c1",
                "raw_text": "Customer agrees to pay all invoices within thirty (30) days.",
                "score": 0.45,
            },
            {
                "chunk_id": "c2",
                "raw_text": "Unless Customer provides written notice 90 days prior, agreement renews for 12 months.",
                "score": 0.60,
            },
            {
                "chunk_id": "c3",
                "raw_text": "Customer shall indemnify and defend Vendor from all third party losses without cap.",
                "score": 0.50,
            },
        ]

        query = "What is the auto renewal notice window?"
        reranked = reranker.rerank(query=query, candidates=sample_candidates, top_k=2)

        assert len(reranked) == 2
        # The auto-renewal clause (c2) should be ranked highest for this query
        assert reranked[0]["chunk_id"] == "c2"
        assert "rerank_score" in reranked[0]
