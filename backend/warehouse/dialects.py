"""Catalog of supported data warehouse dialects.

Mirrors the shape of ``backend.llm.providers.PROVIDER_CATALOG``: a small,
explicit registry the API and frontend both read from, instead of letting
users type arbitrary SQLAlchemy driver strings.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class DialectMeta:
    id: str
    label: str
    drivername: str
    default_port: int | None
    requires_host: bool = True
    requires_database: bool = True
    requires_username: bool = True
    requires_password: bool = True
    supports_token_service: bool = False
    extra_package: str | None = None
    database_label: str = "数据库名"
    database_placeholder: str = "database"


DIALECT_CATALOG: dict[str, DialectMeta] = {
    "mysql": DialectMeta(
        id="mysql",
        label="MySQL",
        drivername="mysql+pymysql",
        default_port=3306,
        extra_package="openchatbi[mysql]",
    ),
    "postgresql": DialectMeta(
        id="postgresql",
        label="PostgreSQL",
        drivername="postgresql+psycopg",
        default_port=5432,
        extra_package="openchatbi[postgresql]",
    ),
    "presto": DialectMeta(
        id="presto",
        label="Presto",
        drivername="presto",
        default_port=8080,
        requires_password=False,
        supports_token_service=True,
        database_label="Catalog.Schema",
        database_placeholder="hive/default",
    ),
    "trino": DialectMeta(
        id="trino",
        label="Trino",
        drivername="trino",
        default_port=8080,
        requires_password=False,
        supports_token_service=True,
        database_label="Catalog.Schema",
        database_placeholder="hive/default",
    ),
    "sqlite": DialectMeta(
        id="sqlite",
        label="SQLite",
        drivername="sqlite",
        default_port=None,
        requires_host=False,
        requires_username=False,
        requires_password=False,
        database_label="文件路径",
        database_placeholder="./data/warehouse.sqlite",
    ),
}


def get_dialect(dialect_id: str) -> DialectMeta:
    meta = DIALECT_CATALOG.get(dialect_id)
    if meta is None:
        raise ValueError(f"Unknown dialect: {dialect_id}")
    return meta
