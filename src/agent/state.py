from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict
from pydantic import BaseModel, Field


class ClauseCitation(BaseModel):
    """Verifiable source citation for a flagged legal hazard."""
    section_number: str = Field(default="N/A", description="Section or article number, e.g. '14.2(b)'")
    page_number: int = Field(..., description="1-indexed physical page in PDF where text appears")
    verbatim_quote: str = Field(..., description="Exact quoted text from the contract")


class FlaggedRisk(BaseModel):
    """Detailed predatory finding identified by the audit agent."""
    risk_id: str = Field(..., description="Unique risk identifier, e.g. RISK_001")
    category: str = Field(..., description="Legal category: TERMINATION, INDEMNITY, LIABILITY, JURISDICTION, IP")
    risk_level: str = Field(..., description="Risk tier: CRITICAL, HIGH, MEDIUM, LOW, SAFE")
    headline: str = Field(..., description="Short risk title, e.g. '90-Day Auto-Renewal Lock-in'")
    plain_english_explanation: str = Field(..., description="Non-lawyer explanation of the hazard")
    recommended_counter_term: str = Field(..., description="Suggested replacement or counter-negotiation clause")
    citation: ClauseCitation = Field(..., description="Exact verifiable citation")
    confidence_score: float = Field(default=0.95, ge=0.0, le=1.0, description="Audit confidence score")


class ClauseGuardState(TypedDict):
    """LangGraph StateGraph shared state container."""
    doc_id: str
    contract_title: str
    total_pages: int
    doc_text_by_page: Dict[int, str]
    target_risk_categories: List[str]
    retrieved_chunks: List[Dict[str, Any]]
    preliminary_risks: List[Dict[str, Any]]
    verified_risks: List[Dict[str, Any]]
    verification_errors: List[str]
    reflection_attempts: int
    overall_risk_score: float
    risk_summary_breakdown: Dict[str, int]
    final_report: Optional[Dict[str, Any]]
