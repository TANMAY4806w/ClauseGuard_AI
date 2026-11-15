import datetime
from typing import Any, Dict, List, Literal, Optional
from langgraph.graph import StateGraph, END

from src.agent.state import ClauseGuardState, ClauseCitation, FlaggedRisk
from src.agent.mcp_server import MCPServer
from src.core.logger import get_logger

logger = get_logger(__name__)


# Standard search queries per risk category
CATEGORY_AUDIT_QUERIES = {
    "TERMINATION": "automatic renewal cancellation notice ninety days lock in non-cancellable",
    "INDEMNITY": "indemnify and hold harmless third party claims liability uncapped defend",
    "LIABILITY": "unilateral modify price fees limitation of liability liquidated damages penalty",
    "JURISDICTION": "governing law exclusive jurisdiction attorney legal fees waiver of jury trial",
    "IP": "intellectual property background ip ownership assignment non-compete data retention",
}


def create_plan_node(state: ClauseGuardState) -> Dict[str, Any]:
    """Node 1: Plan audit subqueries and risk categories."""
    target_categories = state.get("target_risk_categories") or list(CATEGORY_AUDIT_QUERIES.keys())
    logger.info("Planning audit strategy", extra={"doc_id": state["doc_id"], "categories": target_categories})

    return {
        "target_risk_categories": target_categories,
        "retrieved_chunks": [],
        "preliminary_risks": [],
        "verified_risks": [],
        "verification_errors": [],
        "reflection_attempts": 0,
    }


def create_retrieve_node(mcp_server: MCPServer):
    """Factory creating Node 2: Retrieve and rerank chunks via Qdrant & FlashRank."""
    def retrieve_and_rerank_node(state: ClauseGuardState) -> Dict[str, Any]:
        doc_id = state["doc_id"]
        categories = state["target_risk_categories"]
        retrieved_map: Dict[str, Dict[str, Any]] = {}

        for category in categories:
            query = CATEGORY_AUDIT_QUERIES.get(category, f"{category} legal obligations risks")
            chunks = mcp_server.query_contract_vector_store(
                doc_id=doc_id,
                query=query,
                category_filter=category,
                limit=3,
            )
            for c in chunks:
                chunk_id = c.get("chunk_id", str(len(retrieved_map)))
                if chunk_id not in retrieved_map:
                    retrieved_map[chunk_id] = c

        all_retrieved = list(retrieved_map.values())
        logger.info("Retrieved and reranked context", extra={"doc_id": doc_id, "chunk_count": len(all_retrieved)})
        return {"retrieved_chunks": all_retrieved}

    return retrieve_and_rerank_node


def create_audit_node(mcp_server: MCPServer):
    """Factory creating Node 3: Audit chunks against MCP predatory rulebase."""
    def audit_node(state: ClauseGuardState) -> Dict[str, Any]:
        preliminary_risks: List[Dict[str, Any]] = []
        risk_counter = 1

        for chunk in state["retrieved_chunks"]:
            raw_text = chunk.get("raw_text", "")
            category = chunk.get("category", "ANY")
            page_number = chunk.get("page_number", 1)
            section_number = chunk.get("section_number", "General")

            # Execute MCP rulebase pattern matching
            findings = mcp_server.audit_predatory_terms(raw_text, category=category)
            for f in findings:
                risk_item = {
                    "risk_id": f"RISK_{risk_counter:03d}",
                    "category": f["category"],
                    "risk_level": f["risk_level"],
                    "headline": f["headline"],
                    "danger_summary": f["danger_summary"],
                    "recommended_counter_term": f["recommended_counter_term"],
                    "citation": {
                        "section_number": section_number,
                        "page_number": page_number,
                        "verbatim_quote": f["matched_quote"],
                    },
                    "confidence_score": f["confidence_score"],
                }
                preliminary_risks.append(risk_item)
                risk_counter += 1

        logger.info(
            "Preliminary risk audit completed",
            extra={"doc_id": state["doc_id"], "detected_risks": len(preliminary_risks)}
        )
        return {"preliminary_risks": preliminary_risks}

    return audit_node


def create_reflection_node(mcp_server: MCPServer):
    """Factory creating Node 4: Adversarial citation verification guardrail."""
    def reflection_node(state: ClauseGuardState) -> Dict[str, Any]:
        doc_text_by_page = state["doc_text_by_page"]
        verified_risks: List[Dict[str, Any]] = []
        verification_errors: List[str] = []

        for risk in state["preliminary_risks"]:
            citation = risk["citation"]
            quote = citation["verbatim_quote"]
            page_no = citation["page_number"]

            check = mcp_server.verify_source_citation(quote, page_no, doc_text_by_page)
            if check["is_verified"]:
                verified_risks.append(risk)
            else:
                err_msg = f"Risk {risk['risk_id']}: {check['error_reason']}"
                verification_errors.append(err_msg)
                logger.warning("Citation verification flagged hallucination", extra={"error": err_msg})

        return {
            "verified_risks": verified_risks,
            "verification_errors": verification_errors,
        }

    return reflection_node


def create_retry_node():
    """Node 5: Self-reflection recovery for hallucinated or offset citations."""
    def reflection_retry_node(state: ClauseGuardState) -> Dict[str, Any]:
        current_attempts = state["reflection_attempts"] + 1
        logger.info("Executing self-reflection citation alignment retry", extra={"attempt": current_attempts})

        # Try recovering unverified quotes by checking adjacent physical pages
        doc_text_by_page = state["doc_text_by_page"]
        recovered_risks: List[Dict[str, Any]] = []

        for risk in state["preliminary_risks"]:
            if risk in state["verified_risks"]:
                recovered_risks.append(risk)
                continue

            quote = risk["citation"]["verbatim_quote"]
            page_no = risk["citation"]["page_number"]

            # Try adjacent pages (page - 1, page + 1)
            for test_page in [page_no - 1, page_no + 1]:
                if test_page in doc_text_by_page and quote in doc_text_by_page[test_page]:
                    risk["citation"]["page_number"] = test_page
                    recovered_risks.append(risk)
                    break

        return {
            "preliminary_risks": recovered_risks,
            "reflection_attempts": current_attempts,
        }

    return reflection_retry_node


def check_reflection_decision(state: ClauseGuardState) -> Literal["retry", "finalize"]:
    """Conditional Edge: Route to retry if citations failed and attempts remain."""
    if state["verification_errors"] and state["reflection_attempts"] < 2:
        return "retry"
    return "finalize"


def create_finalize_node():
    """Node 6: Finalize report, compute overall risk score, and format output."""
    def finalize_node(state: ClauseGuardState) -> Dict[str, Any]:
        verified = state["verified_risks"]

        # Risk scoring weights
        weights = {"CRITICAL": 30.0, "HIGH": 20.0, "MEDIUM": 10.0, "LOW": 5.0, "SAFE": 0.0}
        total_score = 0.0
        breakdown = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}

        for r in verified:
            level = r.get("risk_level", "LOW")
            total_score += weights.get(level, 5.0)
            if level in breakdown:
                breakdown[level] += 1

        overall_score = min(100.0, round(total_score, 1))

        final_report = {
            "doc_id": state["doc_id"],
            "contract_name": state["contract_title"],
            "overall_contract_risk_score": overall_score,
            "total_clauses_analyzed": len(state["retrieved_chunks"]),
            "flagged_risks_count": len(verified),
            "risk_summary_breakdown": breakdown,
            "findings": verified,
            "audit_timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }

        logger.info(
            "Finalized ClauseGuard analysis report",
            extra={"doc_id": state["doc_id"], "risk_score": overall_score, "risks_flagged": len(verified)}
        )

        return {
            "overall_risk_score": overall_score,
            "risk_summary_breakdown": breakdown,
            "final_report": final_report,
        }

    return finalize_node


def build_clauseguard_graph(mcp_server: Optional[MCPServer] = None) -> StateGraph:
    """Build and compile the LangGraph StateGraph agent."""
    server = mcp_server or MCPServer()

    workflow = StateGraph(ClauseGuardState)

    # Register nodes
    workflow.add_node("plan", create_plan_node)
    workflow.add_node("retrieve", create_retrieve_node(server))
    workflow.add_node("audit", create_audit_node(server))
    workflow.add_node("reflection", create_reflection_node(server))
    workflow.add_node("retry", create_retry_node())
    workflow.add_node("finalize", create_finalize_node())

    # Build deterministic edges
    workflow.set_entry_point("plan")
    workflow.add_edge("plan", "retrieve")
    workflow.add_edge("retrieve", "audit")
    workflow.add_edge("audit", "reflection")

    # Conditional reflection loop
    workflow.add_conditional_edges(
        "reflection",
        check_reflection_decision,
        {
            "retry": "retry",
            "finalize": "finalize",
        },
    )
    workflow.add_edge("retry", "reflection")
    workflow.add_edge("finalize", END)

    return workflow.compile()
