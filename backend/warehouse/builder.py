"""Build SQLAlchemy connection URIs and openchatbi ``data_warehouse_config``
dictionaries from a stored/candidate :class:`~backend.warehouse.models.DataWarehouseConnection`
(or an equivalent in-memory payload).

Kept separate from ``service.py`` so URI/config construction can be unit
tested without touching the database or any encryption secrets.
"""

from typing import Any, Protocol
from urllib.parse import quote_plus

from sqlalchemy.engine import URL

from backend.warehouse.dialects import get_dialect


class ConnectionLike(Protocol):
    dialect: str
    host: str | None
    port: int | None
    database: str | None
    username: str | None
    uri_override: str | None
    include_tables: list[str] | None
    catalog_database_name: str | None
    token_service_url: str | None
    token_username: str | None
    extra_params: dict[str, Any] | None


def build_uri(conn: ConnectionLike, *, password: str | None, token_password: str | None) -> str:
    """Build a SQLAlchemy connection URI for ``conn``.

    ``uri_override`` (when set) always wins, letting advanced users paste any
    SQLAlchemy URI the built-in dialect catalog does not model.
    """
    if conn.uri_override and conn.uri_override.strip():
        return conn.uri_override.strip()

    meta = get_dialect(conn.dialect)

    if meta.id == "sqlite":
        return f"sqlite:///{conn.database or ''}"

    username = conn.username or None
    # Presto/Trino token-service auth needs a literal "{user_name}" placeholder
    # in the URI so ``create_sqlalchemy_engine_instance`` can .format() it in.
    if meta.supports_token_service and conn.token_service_url:
        username = "{user_name}"

    url = URL.create(
        drivername=meta.drivername,
        username=username,
        password=password if meta.requires_password else None,
        host=conn.host or None,
        port=conn.port or meta.default_port,
        database=conn.database or None,
    )
    rendered = url.render_as_string(hide_password=False)
    if meta.supports_token_service and conn.token_service_url:
        # URL.create percent-encodes "{" / "}"; restore the literal placeholder.
        rendered = rendered.replace(quote_plus("{user_name}"), "{user_name}")
    return rendered


def build_data_warehouse_config(
    conn: ConnectionLike, *, password: str | None, token_password: str | None
) -> dict[str, Any]:
    """Build the dict consumed by ``openchatbi.catalog.helper.create_sqlalchemy_engine_instance``."""
    config: dict[str, Any] = {
        "uri": build_uri(conn, password=password, token_password=token_password),
        "include_tables": conn.include_tables,
        "database_name": conn.catalog_database_name or conn.database or "default",
    }
    meta = get_dialect(conn.dialect)
    if meta.supports_token_service and conn.token_service_url:
        config["token_service"] = conn.token_service_url
        config["user_name"] = conn.token_username or ""
        config["password"] = token_password or ""
        if conn.extra_params:
            config["header_extra_params"] = dict(conn.extra_params)
    return config
