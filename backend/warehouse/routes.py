from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from backend.auth.deps import get_current_user, require_roles
from backend.auth.models import User
from backend.db import get_db
from backend.warehouse import service
from backend.warehouse.gate import warehouse_runtime_status
from backend.warehouse.schemas import (
    ConnectionIn,
    ConnectionOut,
    ConnectionsResponse,
    ConnectionUpdate,
    TestConnectionResult,
    WarehouseStatusOut,
)

warehouse_router = APIRouter(prefix="/api/admin/database-connections", tags=["database-connections"])
warehouse_status_router = APIRouter(prefix="/api", tags=["warehouse"])


@warehouse_status_router.get("/warehouse/status", response_model=WarehouseStatusOut)
def get_warehouse_status(
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WarehouseStatusOut:
    """Return whether chat is in demo mode (for the 「演示数据」 banner)."""
    return WarehouseStatusOut(**warehouse_runtime_status(db))


@warehouse_router.get("", response_model=ConnectionsResponse)
def list_connections(
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> ConnectionsResponse:
    rows = service.list_connections(db)
    active = next((row for row in rows if row.is_active), None)
    return ConnectionsResponse(
        catalog=service.dialect_catalog_items(),
        connections=[service.to_connection_out(row) for row in rows],
        active_connection_id=active.id if active else None,
    )


@warehouse_router.post("", response_model=ConnectionOut, status_code=status.HTTP_201_CREATED)
def create_connection(
    body: ConnectionIn,
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> ConnectionOut:
    try:
        row = service.create_connection(db, body)
    except service.WarehouseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.detail) from exc
    return service.to_connection_out(row)


@warehouse_router.patch("/{connection_id}", response_model=ConnectionOut)
def update_connection(
    connection_id: str,
    body: ConnectionUpdate,
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> ConnectionOut:
    try:
        row, runtime_apply = service.update_connection(db, connection_id, body)
    except service.ConnectionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.detail) from exc
    except service.WarehouseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.detail) from exc
    return service.to_connection_out(row, runtime_apply=runtime_apply)


@warehouse_router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_connection(
    connection_id: str,
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> Response:
    try:
        service.delete_connection(db, connection_id)
    except service.ConnectionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.detail) from exc
    except service.WarehouseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.detail) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@warehouse_router.post("/{connection_id}/activate", response_model=ConnectionOut)
def activate_connection(
    connection_id: str,
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> ConnectionOut:
    try:
        row, runtime_apply = service.activate_connection(db, connection_id)
    except service.ConnectionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.detail) from exc
    return service.to_connection_out(row, runtime_apply=runtime_apply)


@warehouse_router.post("/test", response_model=TestConnectionResult)
def test_candidate_connection(
    body: ConnectionIn,
    _admin: User = Depends(require_roles("admin")),
) -> TestConnectionResult:
    try:
        return service.test_connection_payload(body)
    except service.WarehouseError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.detail) from exc


@warehouse_router.post("/{connection_id}/test", response_model=TestConnectionResult)
def test_saved_connection(
    connection_id: str,
    _admin: User = Depends(require_roles("admin")),
    db: Session = Depends(get_db),
) -> TestConnectionResult:
    try:
        return service.test_existing_connection(db, connection_id)
    except service.ConnectionNotFound as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=exc.detail) from exc
    except service.DecryptFailed as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=exc.detail) from exc
