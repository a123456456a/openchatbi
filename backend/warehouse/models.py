"""ORM model for admin-managed data warehouse (target BI database) connections.

Stored in the app's own auth/config database (``backend.db``), independent of
whichever database each connection points *at*. Secrets are Fernet-encrypted
with the same helpers used for per-user LLM API keys.
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class DataWarehouseConnection(Base):
    """A named, admin-managed connection to a target data warehouse/database."""

    __tablename__ = "data_warehouse_connections"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    dialect: Mapped[str] = mapped_column(String(32))

    host: Mapped[str | None] = mapped_column(String(255), nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    database: Mapped[str | None] = mapped_column(String(255), nullable=True)
    username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Advanced escape hatch: a raw SQLAlchemy URI overriding the discrete fields above.
    uri_override: Mapped[str | None] = mapped_column(Text, nullable=True)

    include_tables: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    catalog_database_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Presto/Trino token-service auth (optional).
    token_service_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    token_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    token_password_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    extra_params: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
