"""Fail-closed warehouse gate for chat / Text2SQL request paths."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from backend.config import demo_warehouse_allowed, get_settings
from backend.warehouse import service as warehouse_service
from backend.warehouse.models import DataWarehouseConnection

MISSING_WAREHOUSE_DETAIL = "请先在管理端激活数仓"


def require_active_warehouse_or_demo(db: Session) -> DataWarehouseConnection | None:
    """Require an activated warehouse, or an explicit local demo exemption.

    Returns the active connection when present. Returns ``None`` when demo mode
    is allowed and no connection is activated (config.yaml demo SQLite may be used).
    Raises HTTP 400 when neither applies — callers must not silently fall through
    to the demo warehouse.
    """
    active = warehouse_service.get_active_connection(db)
    if active is not None:
        return active

    settings = get_settings()
    if demo_warehouse_allowed(settings.allow_demo_warehouse, settings.app_env):
        return None

    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MISSING_WAREHOUSE_DETAIL)


def warehouse_runtime_status(db: Session) -> dict:
    """Build status payload for the UI demo banner / admin hints."""
    settings = get_settings()
    active = warehouse_service.get_active_connection(db)
    demo_allowed = demo_warehouse_allowed(settings.allow_demo_warehouse, settings.app_env)
    has_active = active is not None
    return {
        "has_active_connection": has_active,
        "active_connection_id": active.id if active is not None else None,
        "demo_allowed": demo_allowed,
        # Visible demo mode: exemption is on and we are not on an activated warehouse.
        "demo_mode": demo_allowed and not has_active,
    }
