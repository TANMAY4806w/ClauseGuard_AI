import io
import pytest
from fastapi.testclient import TestClient

from src.main import app
from src.services.cache import get_cache_service
from tests.test_ingestion import create_synthetic_contract_pdf


@pytest.fixture
def client():
    """Create FastAPI test client with clean cache."""
    cache = get_cache_service()
    cache.clear_all()
    with TestClient(app) as test_client:
        yield test_client
    cache.clear_all()


class TestAPIEndpoints:
    """Test suite for FastAPI REST endpoints and Redis acceleration."""

    def test_health_check(self, client: TestClient):
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["service"] == "ClauseGuard AI"

    def test_root_endpoint(self, client: TestClient):
        response = client.get("/")
        assert response.status_code == 200
        assert "ClauseGuard AI" in response.json()["message"]

    def test_auth_token_issuance(self, client: TestClient):
        response = client.post(
            "/api/v1/auth/token",
            data={"username": "testuser@lawtech.com", "password": "securepassword123"},
        )
        assert response.status_code == 200
        token_data = response.json()
        assert "access_token" in token_data
        assert token_data["token_type"] == "bearer"
        assert token_data["expires_in"] > 0

    def test_upload_non_pdf_rejected(self, client: TestClient):
        txt_file = io.BytesIO(b"This is just plain text")
        response = client.post(
            "/api/v1/contracts/upload",
            files={"file": ("notes.txt", txt_file, "text/plain")},
        )
        assert response.status_code == 400
        assert "PDF" in response.json()["detail"]

    def test_upload_and_full_audit_lifecycle(self, client: TestClient):
        pdf_bytes = create_synthetic_contract_pdf()
        file_obj = io.BytesIO(pdf_bytes)

        # 1. Upload contract PDF
        upload_resp = client.post(
            "/api/v1/contracts/upload",
            files={"file": ("Vendor_Agreement_2026.pdf", file_obj, "application/pdf")},
        )
        assert upload_resp.status_code == 202
        upload_data = upload_resp.json()
        doc_id = upload_data["doc_id"]
        assert doc_id.startswith("doc_")
        assert upload_data["sha256_hash"] is not None

        # 2. Poll job status
        status_resp = client.get(f"/api/v1/contracts/{doc_id}/status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()
        assert status_data["doc_id"] == doc_id
        # In TestClient, background_tasks execute during the request lifecycle
        assert status_data["is_completed"] is True
        assert status_data["current_stage"] == "COMPLETED"
        assert status_data["progress_percent"] == 100

        # 3. Retrieve finalized analysis report
        analysis_resp = client.get(f"/api/v1/contracts/{doc_id}/analysis")
        assert analysis_resp.status_code == 200
        report = analysis_resp.json()
        assert report["doc_id"] == doc_id
        assert report["overall_contract_risk_score"] > 0
        assert report["flagged_risks_count"] >= 2
        assert len(report["findings"]) >= 2

        # Verify exact findings and citations
        findings = report["findings"]
        auto_renewal = next((f for f in findings if f["clause_category"] == "TERMINATION"), None)
        assert auto_renewal is not None
        assert auto_renewal["risk_level"] == "CRITICAL"
        assert auto_renewal["citation"]["page"] == 1
        assert "renew" in auto_renewal["citation"]["verbatim_text"].lower()

        # 4. Test Redis SHA-256 Cache Hit (Instant response on re-upload)
        file_obj.seek(0)
        reupload_resp = client.post(
            "/api/v1/contracts/upload",
            files={"file": ("Vendor_Agreement_2026.pdf", file_obj, "application/pdf")},
        )
        assert reupload_resp.status_code == 202
        reupload_data = reupload_resp.json()
        assert reupload_data["status"] == "COMPLETED"
        assert reupload_data["estimated_seconds"] == 0
