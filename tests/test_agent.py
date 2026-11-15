import pytest
import fitz

from src.ingestion.pdf_parser import PDFParser
from src.ingestion.chunker import SemanticClauseChunker
from src.vectorstore.qdrant_client import QdrantVectorStore
from src.vectorstore.reranker import FlashRankReranker
from src.agent.mcp_server import MCPServer
from src.agent.graph import build_clauseguard_graph
from tests.test_ingestion import create_synthetic_contract_pdf


class TestMCPServer:
    """Test suite for Model Context Protocol (MCP) server analytical tools."""

    def test_audit_predatory_terms_auto_renewal(self):
        mcp = MCPServer()
        sample_text = (
            "Unless Customer provides written notice of non-renewal at least ninety (90) days "
            "prior to the expiration of the Initial Term, this Agreement shall automatically renew "
            "for successive twelve (12) month periods."
        )

        findings = mcp.audit_predatory_terms(sample_text, category="TERMINATION")
        assert len(findings) >= 1
        auto_renewal = findings[0]
        assert auto_renewal["rule_id"] == "AUTO_RENEWAL_90D"
        assert auto_renewal["risk_level"] == "CRITICAL"
        assert "90 days" in auto_renewal["matched_quote"].lower() or "ninety" in auto_renewal["matched_quote"].lower()
        assert "counter_term" in auto_renewal or "recommended_counter_term" in auto_renewal

    def test_audit_predatory_terms_unlimited_indemnity(self):
        mcp = MCPServer()
        sample_text = (
            "Customer shall defend, indemnify, and hold harmless Vendor from and against any and all "
            "third-party claims, losses, and damages without limitation of liability."
        )

        findings = mcp.audit_predatory_terms(sample_text, category="INDEMNITY")
        assert len(findings) >= 1
        indemnity_risk = findings[0]
        assert indemnity_risk["rule_id"] == "UNLIMITED_INDEMNIFICATION"
        assert indemnity_risk["risk_level"] == "CRITICAL"

    def test_verify_source_citation_exact_match(self):
        mcp = MCPServer()
        doc_pages = {
            1: "This Agreement shall automatically renew for successive twelve (12) month periods.",
            2: "Customer agrees to pay all undisputed invoices within thirty days.",
        }

        quote = "automatically renew for successive twelve (12) month periods."
        result = mcp.verify_source_citation(quote, page_number=1, doc_text_by_page=doc_pages)
        assert result["is_verified"] is True
        assert result["similarity_score"] >= 0.95

    def test_verify_source_citation_hallucination_flagged(self):
        mcp = MCPServer()
        doc_pages = {
            1: "This Agreement shall automatically renew for successive twelve (12) month periods.",
        }

        hallucinated_quote = "Customer shall forfeit five hundred thousand dollars immediately upon breach."
        result = mcp.verify_source_citation(hallucinated_quote, page_number=1, doc_text_by_page=doc_pages)
        assert result["is_verified"] is False
        assert result["similarity_score"] < 0.95
        assert result["error_reason"] is not None


class TestLangGraphAuditWorkflow:
    """Test suite for end-to-end LangGraph state machine execution."""

    def test_agent_graph_execution_with_reflection(self):
        # 1. Parse and chunk synthetic test contract
        pdf_bytes = create_synthetic_contract_pdf()
        parser = PDFParser()
        parsed_doc = parser.parse(pdf_bytes, filename="MSA_Test.pdf")
        chunker = SemanticClauseChunker()
        chunks = chunker.chunk_document(parsed_doc)

        # 2. Ingest into in-memory Qdrant
        vstore = QdrantVectorStore(collection_name="test_agent_clauses", mode="memory")
        vstore.upsert_clauses(chunks)
        reranker = FlashRankReranker()
        mcp_server = MCPServer(vector_store=vstore, reranker=reranker)

        # 3. Construct document text mapping by page
        doc_text_by_page = {page.page_number: page.text for page in parsed_doc.pages}

        # 4. Compile and execute LangGraph workflow
        agent = build_clauseguard_graph(mcp_server=mcp_server)

        initial_state = {
            "doc_id": parsed_doc.doc_id,
            "contract_title": parsed_doc.filename,
            "total_pages": parsed_doc.total_pages,
            "doc_text_by_page": doc_text_by_page,
            "target_risk_categories": ["TERMINATION", "INDEMNITY", "LIABILITY", "JURISDICTION"],
            "retrieved_chunks": [],
            "preliminary_risks": [],
            "verified_risks": [],
            "verification_errors": [],
            "reflection_attempts": 0,
            "overall_risk_score": 0.0,
            "risk_summary_breakdown": {},
            "final_report": None,
        }

        final_state = agent.invoke(initial_state)

        # 5. Assertions on agent output
        assert final_state["final_report"] is not None
        report = final_state["final_report"]
        assert report["doc_id"] == parsed_doc.doc_id
        assert report["overall_contract_risk_score"] > 0
        assert report["flagged_risks_count"] >= 2

        # Verify auto-renewal trap was caught and citation matches page 1
        findings = report["findings"]
        auto_renewal_finding = next((f for f in findings if f["category"] == "TERMINATION"), None)
        assert auto_renewal_finding is not None
        assert auto_renewal_finding["risk_level"] == "CRITICAL"
        assert auto_renewal_finding["citation"]["page_number"] == 1
        assert "renew" in auto_renewal_finding["citation"]["verbatim_quote"].lower()

        # Verify uncapped indemnity was caught and citation matches page 2
        indemnity_finding = next((f for f in findings if f["category"] == "INDEMNITY"), None)
        assert indemnity_finding is not None
        assert indemnity_finding["risk_level"] == "CRITICAL"
        assert indemnity_finding["citation"]["page_number"] == 2
        assert "indemnif" in indemnity_finding["citation"]["verbatim_quote"].lower()
