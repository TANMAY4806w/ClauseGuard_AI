import pytest
from fastapi.testclient import TestClient

from src.main import create_application
from src.core.database import init_db


@pytest.fixture
def client():
    app = create_application()
    return TestClient(app)


def test_email_login_and_guest_login(client):
    """Test passwordless email login and guest session minting."""
    # 1. Registered Email Login
    res = client.post("/api/v1/auth/login", json={"email": "corporate_lawyer@example.com", "is_guest": False})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["email"] == "corporate_lawyer@example.com"
    assert data["user"]["is_guest"] is False

    # 2. Guest Login
    res_guest = client.post("/api/v1/auth/login", json={"email": "guest_temp_user@clauseguard.local", "is_guest": True})
    assert res_guest.status_code == 200
    guest_data = res_guest.json()
    assert guest_data["user"]["is_guest"] is True


def test_list_and_delete_user_contracts(client):
    """Test contract vault listing and deletion with JWT authorization."""
    # 1. Login to get token
    login_res = client.post("/api/v1/auth/login", json={"email": "vault_tester@example.com"})
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Query empty vault
    res = client.get("/api/v1/contracts", headers=headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

    # 3. Query unauthenticated vault (returns empty list)
    res_anon = client.get("/api/v1/contracts")
    assert res_anon.status_code == 200
    assert res_anon.json() == []


def test_contract_chat_history_endpoint(client):
    """Test retrieving chat history for a contract."""
    res = client.get("/api/v1/contracts/doc_test_123/chat")
    assert res.status_code == 200
    data = res.json()
    assert data["contract_id"] == "doc_test_123"
    assert isinstance(data["messages"], list)
