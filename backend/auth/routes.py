from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from backend.auth.deps import get_current_user
from backend.auth.jwt_service import (
    create_access_token,
    create_refresh_token_value,
    hash_token,
)
from backend.auth.models import RefreshToken, Role, User
from backend.auth.passwords import hash_password, verify_password
from backend.auth.schemas import (
    BootstrapRequest,
    RevokeRequest,
    TokenRequest,
    TokenResponse,
    UserInfoResponse,
)
from backend.config import get_settings
from backend.db import get_db

oauth_router = APIRouter(prefix="/oauth", tags=["oauth"])
auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_tokens(db: Session, user: User) -> TokenResponse:
    settings = get_settings()
    access = create_access_token(user.id, user.username, user.role)
    raw_refresh = create_refresh_token_value()
    now = datetime.now(timezone.utc)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_token(raw_refresh),
            expires_at=now + timedelta(days=settings.refresh_token_days),
        )
    )
    db.commit()
    return TokenResponse(
        access_token=access,
        token_type="bearer",
        expires_in=settings.access_token_minutes * 60,
        refresh_token=raw_refresh,
        role=user.role,
        user_id=user.id,
    )


@oauth_router.post("/token", response_model=TokenResponse)
def token(body: TokenRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if body.grant_type == "password":
        if not body.username or not body.password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="username and password required")
        user = db.query(User).filter(User.username == body.username).first()
        if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return _issue_tokens(db, user)

    if body.grant_type == "refresh_token":
        if not body.refresh_token:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="refresh_token required")
        token_row = (
            db.query(RefreshToken)
            .filter(RefreshToken.token_hash == hash_token(body.refresh_token))
            .first()
        )
        now = datetime.now(timezone.utc)
        if token_row is None or token_row.revoked_at is not None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
        expires_at = token_row.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < now:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        user = db.get(User, token_row.user_id)
        if user is None or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        # rotate: revoke old, issue new
        token_row.revoked_at = now
        db.commit()
        return _issue_tokens(db, user)

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported grant_type")


@oauth_router.post("/revoke", status_code=status.HTTP_204_NO_CONTENT)
def revoke(
    body: RevokeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    token_row = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == hash_token(body.refresh_token))
        .first()
    )
    if token_row is None or token_row.revoked_at is not None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    if token_row.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    token_row.revoked_at = datetime.now(timezone.utc)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@oauth_router.get("/userinfo", response_model=UserInfoResponse)
def userinfo(user: User = Depends(get_current_user)) -> UserInfoResponse:
    return UserInfoResponse(user_id=user.id, username=user.username, role=user.role)


@auth_router.post("/bootstrap", status_code=status.HTTP_201_CREATED)
def bootstrap(body: BootstrapRequest, db: Session = Depends(get_db)) -> dict:
    if db.query(User).count() > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bootstrap already done")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=Role.admin.value,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user_id": user.id, "username": user.username, "role": user.role}
