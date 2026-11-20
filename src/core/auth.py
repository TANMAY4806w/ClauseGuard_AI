from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import get_settings
from src.core.database import get_db, utcnow
from src.models.user import User


def create_access_token(user_id: str, email: str, is_guest: bool = False) -> str:
    """Mints a signed JWT token containing user identity and session type."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "email": email,
        "is_guest": is_guest,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT token signature and expiration."""
    settings = get_settings()
    try:
        clean_token = token.replace("Bearer ", "").strip()
        payload = jwt.decode(clean_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None


async def get_or_create_user(db: AsyncSession, email: str, is_guest: bool = False) -> User:
    """Finds an existing user by email or creates a new profile."""
    stmt = select(User).where(User.email == email.strip().lower())
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email.strip().lower(),
            is_guest=is_guest,
            created_at=utcnow(),
            last_login_at=utcnow(),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        user.last_login_at = utcnow()
        await db.commit()
        await db.refresh(user)

    return user


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Extracts authenticated User from Authorization header if present.
    Returns None if no token or invalid token, allowing guest fallback.
    """
    if not authorization:
        return None

    payload = decode_access_token(authorization)
    if not payload or "sub" not in payload:
        return None

    stmt = select(User).where(User.id == payload["sub"])
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
