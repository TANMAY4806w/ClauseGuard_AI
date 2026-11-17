import hashlib
import uuid
from typing import Any, Dict, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm

from src.core.config import get_settings
from src.core.logger import get_logger
from src.api.schemas import (
    ContractAnalysisResponse,
    ClauseAuditItem,
    CitationModel,
    JobStatusResponse,
    TokenResponse,
    UploadResponse,
)
from src.services.cache import CacheService, get_cache_service
from src.ingestion.pdf_parser import PDFParser
from src.ingestion.chunker import SemanticClauseChunker
from src.vectorstore.qdrant_client import QdrantVectorStore
from src.vectorstore.reranker import FlashRankReranker
from src.agent.mcp_server import MCPServer
from src.agent.graph import build_clauseguard_graph

logger = get_logger(__name__)
router = APIRouter()


def execute_contract_audit_pipeline(
    pdf_bytes: bytes,
    filename: str,
    doc_id: str,
    doc_hash: str,
    cache: CacheService,
) -> None:
    """
    Asynchronous background pipeline executing Ingestion -> Qdrant -> LangGraph Audit -> Reflection -> Redis Cache.
    """
    try:
        # Step 1: Parse PDF
        cache.set_job_status(doc_id, stage="PARSING", progress=20)
        parser = PDFParser()
        parsed_doc = parser.parse(pdf_bytes, filename=filename)

        # Step 2: Semantic Chunking
        cache.set_job_status(doc_id, stage="CHUNKING", progress=40)
        chunker = SemanticClauseChunker()
        chunks = chunker.chunk_document(parsed_doc)

        # Step 3: Upsert into Vector Store
        cache.set_job_status(doc_id, stage="EMBEDDING", progress=60)
        vstore = QdrantVectorStore()
        vstore.upsert_clauses(chunks)
        reranker = FlashRankReranker()
        mcp_server = MCPServer(vector_store=vstore, reranker=reranker)

        # Step 4: Execute LangGraph Audit Agent with Self-Reflection
        cache.set_job_status(doc_id, stage="AUDITING_PREDATORY_TERMS", progress=80)
        doc_text_by_page = {p.page_number: p.text for p in parsed_doc.pages}
        agent = build_clauseguard_graph(mcp_server=mcp_server)

        initial_state = {
            "doc_id": doc_id,
            "contract_title": filename,
            "total_pages": parsed_doc.total_pages,
            "doc_text_by_page": doc_text_by_page,
            "target_risk_categories": ["TERMINATION", "INDEMNITY", "LIABILITY", "JURISDICTION", "IP"],
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
        report = final_state.get("final_report") or {}

        # Format findings to strictly match Pydantic schema
        formatted_findings = []
        for item in report.get("findings", []):
            citation_raw = item.get("citation", {})
            formatted_findings.append({
                "risk_id": item.get("risk_id", "RISK_001"),
                "clause_category": item.get("category", "General"),
                "risk_level": item.get("risk_level", "LOW"),
                "headline": item.get("headline", ""),
                "danger_summary": item.get("danger_summary", ""),
                "recommended_counter_term": item.get("recommended_counter_term", ""),
                "statutory_compliance_note": item.get("statutory_compliance_note"),
                "negotiation_advice": item.get("negotiation_advice"),
                "citation": {
                    "section": citation_raw.get("section_number", "General"),
                    "page": citation_raw.get("page_number", 1),
                    "verbatim_text": citation_raw.get("verbatim_quote", ""),
                },
            })
        report["findings"] = formatted_findings

        # Step 5: Save in Redis Cache
        cache.set_job_result(doc_id, report)
        cache.set_cached_analysis(doc_hash, report)
        cache.set_job_status(doc_id, stage="COMPLETED", progress=100, is_completed=True)

        logger.info("Background contract audit finished successfully", extra={"doc_id": doc_id})

    except Exception as e:
        logger.error(f"Background contract audit failed for {doc_id}: {e}", exc_info=True)
        cache.set_job_status(doc_id, stage="FAILED", progress=100, is_completed=True, error=str(e))


@router.post("/auth/token", response_model=TokenResponse)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Mock JWT token issuer for development."""
    settings = get_settings()
    # In production, verify username/password against PostgreSQL database
    return TokenResponse(
        access_token=f"mock_token_{uuid.uuid4().hex}",
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/contracts/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    cache: CacheService = Depends(get_cache_service),
):
    """
    Upload contract PDF for asynchronous legal risk audit.
    If document was previously analyzed, returns instant completed status via SHA-256 cache.
    """
    settings = get_settings()

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file format. Please upload a PDF contract document.",
        )

    content = await file.read()
    file_size_mb = len(content) / (1024 * 1024)

    if file_size_mb > settings.MAX_UPLOAD_SIZE_MB:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum size limit of {settings.MAX_UPLOAD_SIZE_MB}MB.",
        )

    doc_hash = hashlib.sha256(content).hexdigest()
    doc_id = f"doc_{doc_hash[:16]}"
    check_status_url = f"/api/v1/contracts/{doc_id}/status"

    # Check Redis cache for instant sub-15ms response
    cached_report = cache.get_cached_analysis(doc_hash)
    if cached_report:
        cache.set_job_status(doc_id, stage="COMPLETED", progress=100, is_completed=True)
        cache.set_job_result(doc_id, cached_report)
        return UploadResponse(
            doc_id=doc_id,
            filename=file.filename,
            sha256_hash=doc_hash,
            status="COMPLETED",
            estimated_seconds=0,
            check_status_url=check_status_url,
        )

    # Initialize job in Redis and dispatch asynchronous background audit
    cache.set_job_status(doc_id, stage="PENDING", progress=0, is_completed=False)
    background_tasks.add_task(
        execute_contract_audit_pipeline,
        pdf_bytes=content,
        filename=file.filename,
        doc_id=doc_id,
        doc_hash=doc_hash,
        cache=cache,
    )

    return UploadResponse(
        doc_id=doc_id,
        filename=file.filename,
        sha256_hash=doc_hash,
        status="PROCESSING",
        estimated_seconds=15,
        check_status_url=check_status_url,
    )


@router.get("/contracts/{doc_id}/status", response_model=JobStatusResponse)
async def get_contract_status(
    doc_id: str,
    cache: CacheService = Depends(get_cache_service),
):
    """Poll real-time audit progress percent and processing stage."""
    job_info = cache.get_job_status(doc_id)
    if job_info.get("current_stage") == "NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document ID '{doc_id}' not found in active jobs.",
        )
    return JobStatusResponse(**job_info)


@router.get("/contracts/{doc_id}/analysis", response_model=ContractAnalysisResponse)
async def get_contract_analysis(
    doc_id: str,
    cache: CacheService = Depends(get_cache_service),
):
    """Retrieve finalized risk intelligence report."""
    job_info = cache.get_job_status(doc_id)

    if job_info.get("current_stage") == "NOT_FOUND":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document ID '{doc_id}' was not found.",
        )

    if not job_info.get("is_completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Analysis is still processing (Stage: {job_info.get('current_stage')}, Progress: {job_info.get('progress_percent')}%). Please poll status endpoint.",
        )

    if job_info.get("error"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {job_info.get('error')}",
        )

    report = cache.get_job_result(doc_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Completed analysis report could not be found in cache.",
        )

    return ContractAnalysisResponse(**report)
