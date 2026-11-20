from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class RiskLevelEnum(str, Enum):
    """Standardized legal risk severity levels."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    SAFE = "SAFE"


class CitationModel(BaseModel):
    """Citation pointing directly to physical PDF page and exact quote."""
    section: str = Field(..., description="Section or article number, e.g. Section 14.2(b)")
    page: int = Field(..., description="Physical page number in PDF")
    verbatim_text: str = Field(..., description="Exact quoted text from contract")


class ClauseAuditItem(BaseModel):
    """An individual flagged legal hazard."""
    risk_id: str = Field(..., description="Unique risk identifier, e.g. RISK_001")
    clause_category: str = Field(..., description="Legal category: Termination, Indemnity, Liability, Jurisdiction, IP")
    risk_level: RiskLevelEnum = Field(..., description="Risk tier")
    headline: str = Field(..., description="Short risk headline")
    danger_summary: str = Field(..., description="Plain-English explanation of why this clause hurts the user")
    recommended_counter_term: str = Field(..., description="Negotiation script/clause to propose instead")
    statutory_compliance_note: Optional[str] = Field(
        default=None,
        description="Statutory legal context, e.g. Indian Contract Act 1872 provisions or case law",
    )
    negotiation_advice: Optional[str] = Field(
        default=None,
        description="Strategic counter-proposal advice generated via LLM fallback reasoning",
    )
    citation: CitationModel = Field(..., description="Exact verifiable source citation")


class ContractAnalysisResponse(BaseModel):
    """Complete finalized audit response."""
    doc_id: str = Field(..., description="Document ID")
    contract_name: str = Field(..., description="Original filename")
    overall_contract_risk_score: float = Field(
        ..., ge=0.0, le=100.0, description="0 (Completely Safe) to 100 (Extremely Hazardous)"
    )
    total_clauses_analyzed: int = Field(..., description="Total clauses evaluated")
    flagged_risks_count: int = Field(..., description="Total risks detected")
    risk_summary_breakdown: Dict[str, int] = Field(
        ..., description="Risk counts by level, e.g. {'CRITICAL': 1, 'HIGH': 2}"
    )
    findings: List[ClauseAuditItem] = Field(..., description="List of verified risk findings")
    audit_timestamp: str = Field(..., description="ISO 8601 audit timestamp")


class UploadResponse(BaseModel):
    """Response returned upon contract upload."""
    doc_id: str = Field(..., description="Assigned document identifier")
    filename: str = Field(..., description="Original file name")
    sha256_hash: str = Field(..., description="SHA-256 document checksum")
    status: str = Field(default="PROCESSING", description="Current status: PROCESSING or COMPLETED")
    estimated_seconds: int = Field(default=15, description="Estimated time to complete")
    check_status_url: str = Field(..., description="URL to poll processing progress")


class JobStatusResponse(BaseModel):
    """Job status polling schema."""
    doc_id: str
    current_stage: str = Field(..., description="Current processing step: PARSING, EMBEDDING, AUDITING, COMPLETED, FAILED")
    progress_percent: int = Field(..., ge=0, le=100)
    is_completed: bool
    error: Optional[str] = None


class TokenResponse(BaseModel):
    """JWT Token response schema."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class VoiceTokenResponse(BaseModel):
    """Temporary token response for AssemblyAI real-time WebSocket streaming."""
    token: str = Field(..., description="Single-use streaming authentication token")
    expires_in_seconds: int = Field(default=300, description="Token validity window in seconds")
    websocket_url: str = Field(
        default="wss://streaming.assemblyai.com/v3/ws?sample_rate=16000",
        description="Target WebSocket endpoint for streaming audio",
    )


class ChatRoleEnum(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    role: ChatRoleEnum
    content: str


class ContractChatRequest(BaseModel):
    """Request schema for conversational legal counsel copilot."""
    message: str = Field(..., min_length=1, description="Client question or negotiation prompt")
    history: Optional[List[ChatMessage]] = Field(default_factory=list, description="Recent conversation history")
    client_context: Optional[str] = Field(default=None, description="Optional personal context or leverage priorities")


class ContractChatResponse(BaseModel):
    """Response schema for conversational legal counsel copilot."""
    doc_id: str
    reply: str = Field(..., description="Actionable corporate counsel legal guidance")
    referenced_sections: List[str] = Field(default_factory=list, description="Specific contract sections referenced")
    suggested_followups: List[str] = Field(default_factory=list, description="Recommended next legal questions")


class EmailLoginRequest(BaseModel):
    """Request schema for email-based or guest login."""
    email: str = Field(..., min_length=3, description="Client email address or guest identifier")
    is_guest: bool = Field(default=False, description="Whether this is an ephemeral guest session")


class UserProfile(BaseModel):
    """User profile data."""
    id: str
    email: str
    is_guest: bool


class LoginResponse(BaseModel):
    """Authentication response returning JWT and user profile."""
    access_token: str
    token_type: str = "bearer"
    user: UserProfile


class ContractListItem(BaseModel):
    """Summarized contract metadata for the multi-contract vault sidebar."""
    id: str
    filename: str
    file_size: int
    status: str
    risk_score: int
    created_at: str
    client_context: Optional[str] = None


class ChatHistoryResponse(BaseModel):
    """Stored chat messages for a contract."""
    contract_id: str
    messages: List[ChatMessage]

