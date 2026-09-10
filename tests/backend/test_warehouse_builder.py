from types import SimpleNamespace

from backend.warehouse.builder import build_data_warehouse_config, build_uri


def _conn(**overrides):
    defaults = dict(
        dialect="mysql",
        host="db.example.com",
        port=None,
        database="analytics",
        username="reader",
        uri_override=None,
        include_tables=None,
        catalog_database_name=None,
        token_service_url=None,
        token_username=None,
        extra_params=None,
    )
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_mysql_uri_uses_default_port_and_encodes_password():
    conn = _conn(dialect="mysql")
    uri = build_uri(conn, password="p@ss word", token_password=None)
    assert uri.startswith("mysql+pymysql://reader:")
    assert "db.example.com:3306/analytics" in uri
    assert "p@ss word" not in uri  # must be percent-encoded


def test_postgresql_uri():
    conn = _conn(dialect="postgresql", host="pg.internal", database="warehouse")
    uri = build_uri(conn, password="secret", token_password=None)
    assert uri == "postgresql+psycopg://reader:secret@pg.internal:5432/warehouse"


def test_sqlite_uri_is_file_path_based():
    conn = _conn(dialect="sqlite", host=None, username=None, database="./data/app.sqlite")
    uri = build_uri(conn, password=None, token_password=None)
    assert uri == "sqlite:////data/app.sqlite" or uri == "sqlite:///./data/app.sqlite"


def test_presto_uri_without_token_service():
    conn = _conn(dialect="presto", host="presto.internal", port=8080, database="hive/default", username="alice")
    uri = build_uri(conn, password=None, token_password=None)
    assert uri == "presto://alice@presto.internal:8080/hive/default"


def test_presto_uri_with_token_service_keeps_placeholder():
    conn = _conn(
        dialect="presto",
        host="presto.internal",
        database="hive/default",
        username="ignored",
        token_service_url="https://tokens.internal/v1",
    )
    uri = build_uri(conn, password=None, token_password="tok-pass")
    assert uri == "presto://{user_name}@presto.internal:8080/hive/default"


def test_uri_override_wins_over_discrete_fields():
    conn = _conn(dialect="mysql", uri_override="mysql+pymysql://custom:uri@host/db")
    uri = build_uri(conn, password="ignored", token_password=None)
    assert uri == "mysql+pymysql://custom:uri@host/db"


def test_build_data_warehouse_config_basic():
    conn = _conn(dialect="mysql", catalog_database_name="analytics.public", include_tables=["orders"])
    config = build_data_warehouse_config(conn, password="secret", token_password=None)
    assert config["uri"].startswith("mysql+pymysql://reader:secret@")
    assert config["include_tables"] == ["orders"]
    assert config["database_name"] == "analytics.public"
    assert "token_service" not in config


def test_build_data_warehouse_config_with_token_service():
    conn = _conn(
        dialect="presto",
        host="presto.internal",
        database="hive/default",
        token_service_url="https://tokens.internal/v1",
        token_username="svc-user",
        extra_params={"X-Custom": "1"},
    )
    config = build_data_warehouse_config(conn, password=None, token_password="tok-pass")
    assert config["token_service"] == "https://tokens.internal/v1"
    assert config["user_name"] == "svc-user"
    assert config["password"] == "tok-pass"
    assert config["header_extra_params"] == {"X-Custom": "1"}
