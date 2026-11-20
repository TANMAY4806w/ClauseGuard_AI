import pytest
import uuid
from sqlalchemy import select

from src.core.database import get_session_maker, init_db, Base, get_engine
from src.models import User, Contract, ChatMessage


@pytest.mark.anyio
async def test_database_init_and_tables():
    """Verify database schema creation and table metadata."""
    await init_db()
    engine = get_engine()
    assert engine is not None
    assert "users" in Base.metadata.tables
    assert "contracts" in Base.metadata.tables
    assert "chat_messages" in Base.metadata.tables


@pytest.mark.anyio
async def test_user_and_multi_contract_lifecycle():
    """Verify user creation, multiple contract associations, and chat message persistence."""
    await init_db()
    session_maker = get_session_maker()

    test_email = f"counsel_{uuid.uuid4().hex[:8]}@example.com"

    async with session_maker() as session:
        # 1. Create User
        user = User(email=test_email, is_guest=False)
        session.add(user)
        await session.commit()
        await session.refresh(user)

        user_id = user.id
        assert user.id is not None
        assert user.email == test_email

        # 2. Add Contract A (MSA)
        contract_a = Contract(
            user_id=user_id,
            filename="Vendor_MSA.pdf",
            file_size=10240,
            sha256_hash="hash_a_12345",
            client_context="Vendor software consulting",
            status="completed",
            risk_score=78,
            analysis_report={"summary": "High liability clause identified"}
        )
        # Add Contract B (Consulting NDA)
        contract_b = Contract(
            user_id=user_id,
            filename="Consultant_NDA.pdf",
            file_size=5120,
            sha256_hash="hash_b_67890",
            client_context="Non-disclosure agreement",
            status="completed",
            risk_score=22,
            analysis_report={"summary": "Standard mutual confidentiality"}
        )
        session.add_all([contract_a, contract_b])
        await session.commit()

        contract_a_id = contract_a.id
        contract_b_id = contract_b.id

        # 3. Add Chat Messages to Contract A
        chat_1 = ChatMessage(
            contract_id=contract_a_id,
            user_id=user_id,
            role="user",
            content="Can I remove the uncapped indemnity clause?"
        )
        chat_2 = ChatMessage(
            contract_id=contract_a_id,
            user_id=user_id,
            role="assistant",
            content="Under Indian Contract Act Section 124, you can propose a 12-month fees cap."
        )
        session.add_all([chat_1, chat_2])
        await session.commit()

    # 4. Verify in a fresh session (simulating next page reload / login)
    async with session_maker() as session:
        stmt = select(User).where(User.id == user_id)
        result = await session.execute(stmt)
        retrieved_user = result.scalar_one_or_none()

        assert retrieved_user is not None
        assert len(retrieved_user.contracts) == 2

        # Verify Contract A has 2 chat messages
        stmt_c = select(Contract).where(Contract.id == contract_a_id)
        res_c = await session.execute(stmt_c)
        c_a = res_c.scalar_one()
        assert len(c_a.chat_messages) == 2
        assert c_a.chat_messages[0].role == "user"
        assert c_a.chat_messages[1].role == "assistant"

        # Verify Contract B has 0 chat messages (isolated context)
        stmt_b = select(Contract).where(Contract.id == contract_b_id)
        res_b = await session.execute(stmt_b)
        c_b = res_b.scalar_one()
        assert len(c_b.chat_messages) == 0
