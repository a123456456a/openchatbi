import logging
from typing import Any

from cryptography.fernet import InvalidToken
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.llm.crypto import decrypt_api_key, encrypt_api_key
from backend.llm.graph_cache import invalidate_all_graphs
from backend.warehouse.builder import build_data_warehouse_config
from backend.warehouse.dialects import DIALECT_CATALOG
from backend.warehouse.models import DataWarehouseConnection
from backend.warehouse.schemas import (
    ConnectionIn,
    ConnectionOut,
    ConnectionUpdate,
    DialectCatalogItem,
    TestConnectionResult,
)

logger = logging.getLogger(__name__)

DECRYPT_FAILED_DETAIL = "Failed to decrypt stored credentials; please re-enter and save again"


class WarehouseError(Exception):
    def __init__(self, detail: str):
        super().__init__(detail)
        self.detail = detail


class ConnectionNotFound(WarehouseError):
    pass


class DecryptFailed(WarehouseError):
    def __init__(self, detail: str = DECRYPT_FAILED_DETAIL):
        super().__init__(detail)


def dialect_catalog_items() -> list[DialectCatalogItem]:
    return [
        DialectCatalogItem(
            id=meta.id,
            label=meta.label,
            default_port=meta.default_port,
            requires_host=meta.requires_host,
            requires_database=meta.requires_database,
            requires_username=meta.requires_username,
            requires_password=meta.requires_password,
            supports_token_service=meta.supports_token_service,
            database_label=meta.database_label,
            database_placeholder=meta.database_placeholder,
        )
        for meta in DIALECT_CATALOG.values()
    ]


def list_connections(db: Session) -> list[DataWarehouseConnection]:
    return db.query(DataWarehouseConnection).order_by(DataWarehouseConnection.created_at.asc()).all()


def get_connection(db: Session, connection_id: str) -> DataWarehouseConnection:
    row = db.get(DataWarehouseConnection, connection_id)
    if row is None:
        raise ConnectionNotFound(f"No connection with id {connection_id}")
    return row


def _normalized_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _validate_dialect(dialect: str) -> None:
    if dialect not in DIALECT_CATALOG:
        raise WarehouseError(f"Unknown dialect: {dialect}; expected one of {sorted(DIALECT_CATALOG)}")


def create_connection(db: Session, body: ConnectionIn) -> DataWarehouseConnection:
    _validate_dialect(body.dialect)
    if db.query(DataWarehouseConnection).filter(DataWarehouseConnection.name == body.name).first() is not None:
        raise WarehouseError(f"A connection named '{body.name}' already exists")

    row = DataWarehouseConnection(
        name=body.name,
        dialect=body.dialect,
        host=_normalized_optional(body.host),
        port=body.port,
        database=_normalized_optional(body.database),
        username=_normalized_optional(body.username),
        password_encrypted=_maybe_encrypt(body.password),
        uri_override=_normalized_optional(body.uri_override),
        include_tables=body.include_tables,
        catalog_database_name=_normalized_optional(body.catalog_database_name),
        token_service_url=_normalized_optional(body.token_service_url),
        token_username=_normalized_optional(body.token_username),
        token_password_encrypted=_maybe_encrypt(body.token_password),
        extra_params=body.extra_params,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def update_connection(db: Session, connection_id: str, body: ConnectionUpdate) -> DataWarehouseConnection:
    row = get_connection(db, connection_id)
    fields = body.model_fields_set

    if "dialect" in fields and body.dialect is not None:
        _validate_dialect(body.dialect)
        row.dialect = body.dialect
    if "name" in fields and body.name is not None:
        existing = (
            db.query(DataWarehouseConnection)
            .filter(DataWarehouseConnection.name == body.name, DataWarehouseConnection.id != row.id)
            .first()
        )
        if existing is not None:
            raise WarehouseError(f"A connection named '{body.name}' already exists")
        row.name = body.name
    if "host" in fields:
        row.host = _normalized_optional(body.host)
    if "port" in fields:
        row.port = body.port
    if "database" in fields:
        row.database = _normalized_optional(body.database)
    if "username" in fields:
        row.username = _normalized_optional(body.username)
    if "uri_override" in fields:
        row.uri_override = _normalized_optional(body.uri_override)
    if "include_tables" in fields:
        row.include_tables = body.include_tables
    if "catalog_database_name" in fields:
        row.catalog_database_name = _normalized_optional(body.catalog_database_name)
    if "token_service_url" in fields:
        row.token_service_url = _normalized_optional(body.token_service_url)
    if "token_username" in fields:
        row.token_username = _normalized_optional(body.token_username)
    if "extra_params" in fields:
        row.extra_params = body.extra_params

    incoming_password = _normalized_optional(body.password)
    if incoming_password:
        row.password_encrypted = encrypt_api_key(incoming_password)
    incoming_token_password = _normalized_optional(body.token_password)
    if incoming_token_password:
        row.token_password_encrypted = encrypt_api_key(incoming_token_password)

    db.commit()
    db.refresh(row)
    if row.is_active:
        _apply_connection_to_runtime(row)
    return row


def delete_connection(db: Session, connection_id: str) -> None:
    row = get_connection(db, connection_id)
    if row.is_active:
        raise WarehouseError("Cannot delete the currently active connection; activate another one first")
    db.delete(row)
    db.commit()


def activate_connection(db: Session, connection_id: str) -> DataWarehouseConnection:
    row = get_connection(db, connection_id)
    db.query(DataWarehouseConnection).filter(DataWarehouseConnection.id != row.id).update({"is_active": False})
    row.is_active = True
    db.commit()
    db.refresh(row)
    _apply_connection_to_runtime(row)
    return row


def _maybe_encrypt(plain: str | None) -> str | None:
    normalized = _normalized_optional(plain)
    return encrypt_api_key(normalized) if normalized else None


def _decrypt(ciphertext: str | None) -> str | None:
    if not ciphertext:
        return None
    try:
        return decrypt_api_key(ciphertext)
    except InvalidToken as exc:
        raise DecryptFailed() from exc


def _apply_connection_to_runtime(row: DataWarehouseConnection) -> None:
    """Best-effort: push the activated connection into the running openchatbi
    config/catalog store and drop cached agent graphs. Never raises -- if the
    openchatbi runtime config isn't loaded (e.g. tests, or config.yaml
    missing), the change still persists in the app DB and will apply the next
    time it's loaded (see ``apply_active_connection_on_startup``).
    """
    password = _decrypt(row.password_encrypted)
    token_password = _decrypt(row.token_password_encrypted)
    data_warehouse_config = build_data_warehouse_config(row, password=password, token_password=token_password)

    try:
        from openchatbi import config as openchatbi_config

        cfg = openchatbi_config.get()
        cfg.data_warehouse_config = data_warehouse_config
        cfg.catalog_store.set_data_warehouse_config(data_warehouse_config)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not apply data warehouse connection to the running config: %s", exc)
    # Drop cached agent graphs regardless: the persisted active connection changed,
    # so any stale graph must not be served even if the live-apply above failed
    # (e.g. openchatbi config isn't loaded in this process yet).
    invalidate_all_graphs()


def apply_active_connection_on_startup(db: Session) -> None:
    """Called once at app startup: if an admin has previously activated a
    connection, make sure the running openchatbi config reflects it (rather
    than whatever ``config.yaml`` shipped with)."""
    row = db.query(DataWarehouseConnection).filter(DataWarehouseConnection.is_active.is_(True)).first()
    if row is not None:
        _apply_connection_to_runtime(row)


def test_connection_payload(body: ConnectionIn) -> TestConnectionResult:
    """Test a not-yet-saved candidate connection using its plaintext secrets."""
    _validate_dialect(body.dialect)
    data_warehouse_config = build_data_warehouse_config(
        body, password=body.password, token_password=body.token_password
    )
    return _run_connection_test(data_warehouse_config)


def test_existing_connection(db: Session, connection_id: str) -> TestConnectionResult:
    row = get_connection(db, connection_id)
    password = _decrypt(row.password_encrypted)
    token_password = _decrypt(row.token_password_encrypted)
    data_warehouse_config = build_data_warehouse_config(row, password=password, token_password=token_password)
    return _run_connection_test(data_warehouse_config)


def _run_connection_test(data_warehouse_config: dict[str, Any]) -> TestConnectionResult:
    from openchatbi.catalog.helper import create_sqlalchemy_engine_instance

    engine = None
    try:
        engine = create_sqlalchemy_engine_instance(data_warehouse_config)
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return TestConnectionResult(ok=True, detail="连接成功")
    except Exception as exc:  # noqa: BLE001
        return TestConnectionResult(ok=False, detail=str(exc))
    finally:
        if engine is not None:
            engine.dispose()


def to_connection_out(row: DataWarehouseConnection) -> ConnectionOut:
    return ConnectionOut(
        id=row.id,
        name=row.name,
        dialect=row.dialect,
        host=row.host,
        port=row.port,
        database=row.database,
        username=row.username,
        has_password=bool(row.password_encrypted),
        has_uri_override=bool(row.uri_override),
        include_tables=row.include_tables,
        catalog_database_name=row.catalog_database_name,
        token_service_url=row.token_service_url,
        token_username=row.token_username,
        has_token_password=bool(row.token_password_encrypted),
        is_active=row.is_active,
        created_at=row.created_at.isoformat() if row.created_at else None,
        updated_at=row.updated_at.isoformat() if row.updated_at else None,
    )


__all__ = [
    "DECRYPT_FAILED_DETAIL",
    "WarehouseError",
    "ConnectionNotFound",
    "DecryptFailed",
    "dialect_catalog_items",
    "list_connections",
    "get_connection",
    "create_connection",
    "update_connection",
    "delete_connection",
    "activate_connection",
    "apply_active_connection_on_startup",
    "test_connection_payload",
    "test_existing_connection",
    "to_connection_out",
]
