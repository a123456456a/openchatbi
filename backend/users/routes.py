"""Admin user CRUD and role-gated report download."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.auth.deps import require_roles
from backend.auth.models import Role, User
from backend.auth.passwords import hash_password
from backend.db import get_db
from backend.users.schemas import UserCreate, UserOut, UserUpdate
from openchatbi.utils import get_report_download_response

users_router = APIRouter(prefix="/api/users", tags=["users"])
download_router = APIRouter(prefix="/api/download", tags=["download"])

_VALID_ROLES = {r.value for r in Role}


def _validate_role(role: str) -> None:
    if role not in _VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role; expected one of {sorted(_VALID_ROLES)}",
        )


@users_router.get("", response_model=list[UserOut])
def list_users(
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> list[User]:
    return db.query(User).order_by(User.created_at.asc()).all()


@users_router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> User:
    _validate_role(body.role)
    if db.query(User).filter(User.username == body.username).first() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already exists")
    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@users_router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    body: UserUpdate,
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if body.role is not None:
        _validate_role(body.role)
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password is not None:
        user.password_hash = hash_password(body.password)
    db.commit()
    db.refresh(user)
    return user


@download_router.get("/report/{filename}")
def download_report(
    filename: str,
    _user: User = Depends(require_roles("analyst", "admin")),
):
    return get_report_download_response(filename)
