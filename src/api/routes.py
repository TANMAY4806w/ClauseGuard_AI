import hashlib
import json
import urllib.request
import urllib.error
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.logger import get_logger
from src.core.database import get_db, get_session_maker
from src.core.auth import (
    create_access_token,
    get_or_create_user,
    get_current_user_optional,
)
from src.models import (
    User,
    Contract,
    ChatMessage as ChatMessageModel,
)
from src.api.schemas import (
    ContractAnalysisResponse,
    ContractChatRequest,
    ContractChatResponse,
    ClauseAuditItem,
    CitationModel,
    JobStatusResponse,
    TokenResponse,
    UploadResponse,
    VoiceTokenResponse,
    EmailLoginRequest,
    LoginResponse,
    UserProfile,
    ContractListItem,
    ChatHistoryResponse,
    ChatMessage,
)
from src.services.cache import CacheService, get_cache_service
from src.ingestion.pdf_parser import PDFParser
from src.ingestion.chunker import SemanticClauseChunker
from src.vectorstore.qdrant_client import QdrantVectorStore
from src.vectorstore.reranker import FlashRankReranker
from src.agent.mcp_server import MCPServer
from src.agent.llm_client import MultiProviderLLMClient
from src.agent.graph import build_clauseguard_graph

logger = get_logger(__name__)
router = APIRouter()


async def update_contract_db_status(doc_id: str, status: str, report: Optional[dict] = None) -> None:
    """Helper to persist background audit status and report into the database."""
    try:
        session_factory = get_session_maker()
        async with session_factory() as session:
            stmt = select(Contract).where(Contract.id == doc_id)
            res = await session.execute(stmt)
            contract = res.scalar_one_or_none()
            if contract:
                contract.status = status
                if report:
                    contract.risk_score = int(report.get("overall_contract_risk_score", 0))
                    contract.analysis_report = report
                await session.commit()
    except Exception as e:
        logger.warning(f"Could not update database status for doc {doc_id}: {e}")


async def execute_contract_audit_pipeline(
    pdf_bytes: bytes,
    filename: str,
    doc_id: str,
    doc_hash: str,
    cache: CacheService,
    client_context: Optional[str] = None,
) -> None:
    """
    Asynchronous background pipeline executing Ingestion -> Qdrant -> LangGraph Audit -> Reflection -> Redis Cache & DB.
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
        if client_context:
            report["client_context"] = client_context

        # Step 5: Save in Cache and Database
        cache.set_job_result(doc_id, report)
        cache.set_cached_analysis(doc_hash, report)
        cache.set_job_status(doc_id, stage="COMPLETED", progress=100, is_completed=True)
        await update_contract_db_status(doc_id, status="COMPLETED", report=report)

        logger.info("Background contract audit finished successfully", extra={"doc_id": doc_id})

    except Exception as e:
        logger.error(f"Background contract audit failed for {doc_id}: {e}", exc_info=True)
        cache.set_job_status(doc_id, stage="FAILED", progress=100, is_completed=True, error=str(e))
        await update_contract_db_status(doc_id, status="FAILED")


# -------------------------------------------------------------------------
# Authentication Routes
# -------------------------------------------------------------------------

@router.post("/auth/login", response_model=LoginResponse)
async def login_with_email(
    req: EmailLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Passwordless email login or guest session generation.
    Creates or loads user profile and issues JWT access token.
    """
    user = await get_or_create_user(db, email=req.email, is_guest=req.is_guest)
    token = create_access_token(user_id=user.id, email=user.email, is_guest=user.is_guest)
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserProfile(id=user.id, email=user.email, is_guest=user.is_guest),
    )


@router.post("/auth/token", response_model=TokenResponse)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Mock JWT token issuer for backwards-compatible test fixtures."""
    settings = get_settings()
    return TokenResponse(
        access_token=f"mock_token_{uuid.uuid4().hex}",
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/voice/token", response_model=VoiceTokenResponse)
async def get_voice_streaming_token():
    """
    Mint a 300-second single-use streaming authentication token from AssemblyAI v3
    for real-time live WebSocket speech-to-text.
    """
    settings = get_settings()
    key = settings.ASSEMBLYAI_API_KEY
    if not key or key.strip().lower().startswith("your_") or "placeholder" in key.lower():
        # Demo token fallback for isolated / offline testing
        return VoiceTokenResponse(
            token="mock_voice_token_demo_streaming",
            expires_in_seconds=300,
            websocket_url="wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&format_turns=true",
        )

    url = "https://streaming.assemblyai.com/v3/token?expires_in_seconds=300"
    req = urllib.request.Request(url, headers={"Authorization": key})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return VoiceTokenResponse(
                token=data["token"],
                expires_in_seconds=data.get("expires_in_seconds", 300),
                websocket_url="wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&format_turns=true",
            )
    except Exception as e:
        logger.error(f"Failed to mint AssemblyAI streaming token: {e}")
        return VoiceTokenResponse(
            token="fallback_voice_token",
            expires_in_seconds=300,
            websocket_url="wss://streaming.assemblyai.com/v3/ws?sample_rate=16000&format_turns=true",
        )


# -------------------------------------------------------------------------
# Contract Ingestion & Vault Routes
# -------------------------------------------------------------------------

@router.post("/contracts/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    client_context: Optional[str] = Form(None),
    authorization: Optional[str] = Header(None),
    cache: CacheService = Depends(get_cache_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload contract PDF for asynchronous legal risk audit.
    Persists document metadata in the user's multi-contract vault.
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

    # Resolve or create user profile
    user = await get_current_user_optional(authorization=authorization, db=db)
    if not user:
        user = await get_or_create_user(db=db, email="guest@clauseguard.local", is_guest=True)

    doc_hash = hashlib.sha256(content).hexdigest()
    doc_id = f"doc_{doc_hash[:16]}"
    check_status_url = f"/api/v1/contracts/{doc_id}/status"

    # Check Redis cache for instant sub-15ms response
    cached_report = cache.get_cached_analysis(doc_hash)

    # Persist or update contract record in database
    contract = await db.get(Contract, doc_id)
    if not contract:
        contract = Contract(
            id=doc_id,
            user_id=user.id,
            filename=file.filename,
            file_size=len(content),
            sha256_hash=doc_hash,
            client_context=client_context,
            status="COMPLETED" if cached_report else "PROCESSING",
            risk_score=int(cached_report.get("overall_contract_risk_score", 0)) if cached_report else 0,
            analysis_report=cached_report,
        )
        db.add(contract)
        await db.commit()
    else:
        # Re-associate with active user if needed
        contract.user_id = user.id
        contract.client_context = client_context or contract.client_context
        await db.commit()

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
        client_context=client_context,
    )

    return UploadResponse(
        doc_id=doc_id,
        filename=file.filename,
        sha256_hash=doc_hash,
        status="PROCESSING",
        estimated_seconds=15,
        check_status_url=check_status_url,
    )


@router.get("/contracts", response_model=List[ContractListItem])
async def list_user_contracts(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    """
    List all audited contracts belonging to the authenticated user for the multi-contract vault.
    """
    user = await get_current_user_optional(authorization=authorization, db=db)
    if not user:
        return []

    stmt = select(Contract).where(Contract.user_id == user.id).order_by(Contract.created_at.desc())
    res = await db.execute(stmt)
    contracts = res.scalars().all()

    return [
        ContractListItem(
            id=c.id,
            filename=c.filename,
            file_size=c.file_size,
            status=c.status,
            risk_score=c.risk_score,
            created_at=c.created_at.isoformat(),
            client_context=c.client_context,
        )
        for c in contracts
    ]


@router.delete("/contracts/{doc_id}")
async def delete_contract(
    doc_id: str,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
    cache: CacheService = Depends(get_cache_service),
):
    """Delete a contract and associated chat logs from the vault."""
    contract = await db.get(Contract, doc_id)
    if contract:
        await db.delete(contract)
        await db.commit()
    return {"status": "deleted", "doc_id": doc_id}


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
    db: AsyncSession = Depends(get_db),
):
    """Retrieve finalized risk intelligence report from cache or database fallback."""
    job_info = cache.get_job_status(doc_id)

    # 1. Check Redis cache
    report = cache.get_job_result(doc_id)

    # 2. Check Database if not in in-memory cache
    if not report:
        contract = await db.get(Contract, doc_id)
        if contract and contract.analysis_report:
            report = contract.analysis_report

    if not report:
        if job_info.get("current_stage") != "NOT_FOUND" and not job_info.get("is_completed"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Analysis is still processing. Please poll status endpoint.",
            )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document ID '{doc_id}' was not found.",
        )

    return ContractAnalysisResponse(**report)


# -------------------------------------------------------------------------
# Conversational Legal Counsel Copilot Routes
# -------------------------------------------------------------------------

@router.get("/contracts/{doc_id}/chat", response_model=ChatHistoryResponse)
async def get_contract_chat_history(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Load persistent chat history for the active contract."""
    stmt = (
        select(ChatMessageModel)
        .where(ChatMessageModel.contract_id == doc_id)
        .order_by(ChatMessageModel.created_at.asc())
    )
    res = await db.execute(stmt)
    messages = res.scalars().all()
    return ChatHistoryResponse(
        contract_id=doc_id,
        messages=[ChatMessage(role=m.role, content=m.content) for m in messages],
    )


@router.post("/contracts/{doc_id}/chat", response_model=ContractChatResponse)
async def chat_with_legal_counsel(
    doc_id: str,
    req: ContractChatRequest,
    authorization: Optional[str] = Header(None),
    cache: CacheService = Depends(get_cache_service),
    db: AsyncSession = Depends(get_db),
):
    """
    Interactive corporate legal counsel consultation grounded in the audited contract
    and Indian Contract Act 1872. Persists conversation history to the database.
    """
    user = await get_current_user_optional(authorization=authorization, db=db)

    # Load contract report from cache or database
    report = cache.get_job_result(doc_id)
    if not report:
        contract = await db.get(Contract, doc_id)
        if contract and contract.analysis_report:
            report = contract.analysis_report
    report = report or {}

    contract_title = report.get("contract_name", doc_id)
    findings = report.get("findings", [])

    # Semantic retrieval from Qdrant matching user's specific query
    retrieved = []
    try:
        vstore = QdrantVectorStore()
        reranker = FlashRankReranker()
        mcp = MCPServer(vector_store=vstore, reranker=reranker)
        retrieved = mcp.query_contract_vector_store(doc_id=doc_id, query=req.message, limit=4)
    except Exception as e:
        logger.warning(f"Vector store retrieval warning for chat on doc {doc_id}: {e}")

    # Invoke multi-provider legal counsel
    llm = MultiProviderLLMClient()
    history_dicts = [{"role": m.role.value, "content": m.content} for m in (req.history or [])]
    advice = llm.counsel_contract_chat(
        contract_title=contract_title,
        findings=findings,
        retrieved_clauses=retrieved,
        client_question=req.message,
        history=history_dicts,
        client_context=req.client_context or report.get("client_context"),
    )

    # Persist user question and counsel reply in database
    try:
        user_msg = ChatMessageModel(
            contract_id=doc_id,
            user_id=user.id if user else None,
            role="user",
            content=req.message,
        )
        assistant_msg = ChatMessageModel(
            contract_id=doc_id,
            user_id=user.id if user else None,
            role="assistant",
            content=advice["reply"],
        )
        db.add_all([user_msg, assistant_msg])
        await db.commit()
    except Exception as err:
        logger.warning(f"Could not persist chat message to database: {err}")

    return ContractChatResponse(
        doc_id=doc_id,
        reply=advice["reply"],
        referenced_sections=advice.get("referenced_sections", []),
        suggested_followups=advice.get("suggested_followups", []),
    )
