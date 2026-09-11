from typing import Any, Literal

from pydantic import BaseModel, Field


CatalogSyncStatus = Literal["success", "failed", "skipped"]
IndexReloadStatus = Literal["success", "failed", "skipped"]


class ConnectionRuntimeApplyStatus(BaseModel):
    """Outcome of pushing an active warehouse connection into the running catalog."""

    catalog_sync_status: CatalogSyncStatus
    index_reload_status: IndexReloadStatus
    message: str | None = None


class DialectCatalogItem(BaseModel):
    id: str
    label: str
    default_port: int | None
    requires_host: bool
    requires_database: bool
    requires_username: bool
    requires_password: bool
    supports_token_service: bool
    database_label: str
    database_placeholder: str


class ConnectionOut(BaseModel):
    id: str
    name: str
    dialect: str
    host: str | None
    port: int | None
    database: str | None
    username: str | None
    has_password: bool
    has_uri_override: bool
    include_tables: list[str] | None
    catalog_database_name: str | None
    token_service_url: str | None
    token_username: str | None
    has_token_password: bool
    is_active: bool
    created_at: str | None = None
    updated_at: str | None = None
    runtime_apply: ConnectionRuntimeApplyStatus | None = None


class ConnectionsResponse(BaseModel):
    catalog: list[DialectCatalogItem]
    connections: list[ConnectionOut]
    active_connection_id: str | None


class ConnectionIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    dialect: str = Field(min_length=1)
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    uri_override: str | None = None
    include_tables: list[str] | None = None
    catalog_database_name: str | None = None
    token_service_url: str | None = None
    token_username: str | None = None
    token_password: str | None = None
    extra_params: dict[str, Any] | None = None


class ConnectionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=128)
    dialect: str | None = None
    host: str | None = None
    port: int | None = None
    database: str | None = None
    username: str | None = None
    password: str | None = None
    uri_override: str | None = None
    include_tables: list[str] | None = None
    catalog_database_name: str | None = None
    token_service_url: str | None = None
    token_username: str | None = None
    token_password: str | None = None
    extra_params: dict[str, Any] | None = None


class TestConnectionResult(BaseModel):
    ok: bool
    detail: str
