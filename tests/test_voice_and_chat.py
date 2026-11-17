import io
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)


def test_voice_streaming_token_endpoint():
    """Verify AssemblyAI v3 temporary streaming token minting."""
    response = client.get("/api/v1/voice/token")
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert len(data["token"]) > 0
    assert data["expires_in_seconds"] == 300
    assert "streaming.assemblyai.com" in data["websocket_url"]


def test_upload_contract_with_client_context():
    """Verify PDF upload with optional client voice/text context."""
    fake_pdf = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"
    files = {"file": ("freelance_contract.pdf", io.BytesIO(fake_pdf), "application/pdf")}
    data = {"client_context": "I am an independent contractor and cannot accept uncapped liability."}

    response = client.post("/api/v1/contracts/upload", files=files, data=data)
    assert response.status_code == 202
    res = response.json()
    assert "doc_id" in res
    assert res["status"] in ["PROCESSING", "COMPLETED"]


def test_chat_with_legal_counsel_copilot():
    """Verify interactive legal counsel Q&A endpoint."""
    payload = {
        "message": "Draft a polite negotiation email asking the vendor to reduce the 90-day auto-renewal notice to 30 days.",
        "history": [],
        "client_context": "Independent software developer",
    }
    response = client.post("/api/v1/contracts/doc_test_123/chat", json=payload)
    assert response.status_code == 200
    res = response.json()
    assert res["doc_id"] == "doc_test_123"
    assert "reply" in res
    assert len(res["reply"]) > 20
    assert "suggested_followups" in res
    assert len(res["suggested_followups"]) > 0
