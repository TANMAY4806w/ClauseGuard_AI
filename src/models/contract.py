import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from src.core.database import Base


class Contract(Base):
    """
    Contract entity storing uploaded legal agreements, executive risk scores,
    physical page mappings, and full multi-agent audit reports.
    """
    __tablename__ = "contracts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    filename = Column(String(255), nullable=False)
    file_size = Column(Integer, default=0, nullable=False)
    sha256_hash = Column(String(64), index=True, nullable=False)
    client_context = Column(Text, nullable=True)
    status = Column(String(32), default="pending", index=True, nullable=False)  # pending, processing, completed, failed
    risk_score = Column(Integer, default=0, nullable=False)
    analysis_report = Column(JSON, nullable=True)  # Stores the full multi-agent JSON payload

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User", back_populates="contracts")
    chat_messages = relationship("ChatMessage", back_populates="contract", cascade="all, delete-orphan", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Contract id={self.id} filename={self.filename} status={self.status} risk={self.risk_score}>"
