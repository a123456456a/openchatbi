import logging
import threading
from typing import Any, cast

from sqlalchemy import MetaData, inspect, text
from sqlalchemy.engine import Engine

from .catalog_store import CatalogStore

logger = logging.getLogger(__name__)


class DataCatalogLoader:
    """
    The loader to load data catalog from data warehouse metadata and save to catalog store.
    """

    def __init__(self, engine: Engine, include_tables: list[str] | None = None):
        """
        Initialize catalog loader.

        Args:
            engine (Engine): SQLAlchemy engine instance
            include_tables (Optional[List[str]]): List of table names to include, None for all
        """
        self.engine = engine
        self.include_tables = include_tables
        self.metadata = MetaData()
        self.inspector = inspect(engine)

    def get_tables_and_columns(self) -> dict[str, list[dict[str, Any]]]:
        """
        Extract table and column metadata including comments using SQLAlchemy inspector.

        Returns:
            Dict[str, List[Dict[str, Any]]]: Dictionary mapping table names to list of column information
        """
        try:
            tables_columns = {}

            # Get all table names
            table_names = self.inspector.get_table_names()

            # Filter to specific tables if configured
            if self.include_tables:
                table_names = [name for name in table_names if name in self.include_tables]

            logger.info(f"Found {len(table_names)} tables to process")

            for table_name in table_names:
                try:
                    # Get column information for the table
                    columns = self.inspector.get_columns(table_name)
                    column_list = []
                    for column in columns:
                        is_common_column = column["name"] not in ("id", "name", "type", "status")
                        column_info = {
                            "column_name": column["name"],
                            "display_name": "",
                            "alias": "",
                            "type": str(column["type"]),
                            "category": "",
                            "tag": "",
                            "description": column.get("comment", "") or "",
                            "dimension_table": "",
                            "default": str(column.get("default", "")) if column.get("default") is not None else "",
                            "is_common": is_common_column,
                        }
                        column_list.append(column_info)

                    tables_columns[table_name] = column_list
                    logger.debug(f"Processed table {table_name} with {len(column_list)} columns")

                except Exception as e:
                    logger.error(f"Failed to process table {table_name}: {e}")
                    continue

            logger.info(f"Successfully processed {len(tables_columns)} tables")
            return tables_columns

        except Exception as e:
            logger.error(f"Failed to get tables and columns from data warehouse: {e}")
            return {}

    def get_table_indexes(self, table_name: str) -> list[dict[str, Any]]:
        """
        Get index information for a specific table.

        Args:
            table_name (str): Name of the table

        Returns:
            List[Dict[str, Any]]: List of index information
        """
        try:
            indexes = self.inspector.get_indexes(table_name)
            return cast(list[dict[str, Any]], indexes)
        except Exception as e:
            logger.warning(f"Failed to get indexes for table {table_name}: {e}")
            return []

    def get_foreign_keys(self, table_name: str) -> list[dict[str, Any]]:
        """
        Get foreign key information for a specific table.

        Args:
            table_name (str): Name of the table

        Returns:
            List[Dict[str, Any]]: List of foreign key information
        """
        try:
            foreign_keys = self.inspector.get_foreign_keys(table_name)
            return cast(list[dict[str, Any]], foreign_keys)
        except Exception as e:
            logger.warning(f"Failed to get foreign keys for table {table_name}: {e}")
            return []

    def save_to_catalog_store(
        self, catalog_store: CatalogStore, database_name: str | None = None, update: bool = False
    ) -> bool:
        """
        Extract warehouse metadata and save to catalog store.

        Args:
            catalog_store (CatalogStore): Target catalog store to load data to
            database_name (Optional[str]): Database name in catalog, defaults to 'default'
            update (bool): Update existing catalog store to sync with data warehouse

        Returns:
            bool: True if load was successful, False otherwise
        """
        try:
            if database_name is None:
                database_name = "default"

            # Get tables and columns from data warehouse
            tables_columns = self.get_tables_and_columns()

            if not tables_columns:
                logger.warning("No tables found in data warehouse")
                return True

            # Import each table
            success_count = 0
            total_count = len(tables_columns)

            for table_name, columns in tables_columns.items():
                try:
                    # Get table comment if available
                    table_comment = ""
                    try:
                        raw_comment = self.inspector.get_table_comment(table_name)
                        table_comment = (raw_comment.get("text") or "") if raw_comment else ""
                    except Exception as e:
                        # Some databases don't support table comments
                        logger.info("Skipping table comment for %s: %s", table_name, e)

                    table_info: dict[str, Any] = {"description": table_comment, "selection_rule": "", "sql_rule": ""}
                    if catalog_store.save_table_information(
                        table_name, table_info, columns, database_name, update_existing=update
                    ):
                        success_count += 1
                        logger.info(f"Successfully loaded table: {database_name}.{table_name}")
                    else:
                        logger.error(f"Failed to load table: {database_name}.{table_name}")

                    # init null SQL examples
                    catalog_store.save_table_sql_examples(
                        table_name, [{"question": "null", "answer": "null"}], database_name
                    )

                except Exception as e:
                    logger.error(f"Error loading table {table_name}: {e}")

            # init empty table selection examples
            catalog_store.save_table_selection_examples([("", [])])

            logger.info(f"Load completed: {success_count}/{total_count} tables loaded successfully")
            return success_count == total_count

        except Exception as e:
            logger.error(f"Failed to load data warehouse to catalog store: {e}")
            return False


def load_catalog_from_data_warehouse(catalog_store: CatalogStore) -> bool:
    """
    Load catalog data from data warehouse using SQLAlchemy based on data warehouse config (URI)

    Main entry point for catalog loading.

    Args:
        catalog_store (CatalogStore): Target catalog store

    Returns:
        bool: True if load was successful, False otherwise
    """
    try:
        data_warehouse_config = catalog_store.get_data_warehouse_config()
        database_uri = data_warehouse_config.get("uri")
        include_tables = data_warehouse_config.get("include_tables")
        database_name = data_warehouse_config.get("database_name", "default")
        engine = catalog_store.get_sql_engine()

        loader = DataCatalogLoader(engine, include_tables)
        return loader.save_to_catalog_store(catalog_store, database_name)

    except Exception as e:
        logger.error(f"Failed to import catalog from data warehouse URI {database_uri}: {e}")
        return False


def sync_catalog_from_data_warehouse(catalog_store: CatalogStore) -> bool:
    """Replace catalog contents with a fresh introspection of the configured warehouse.

    Unlike :func:`load_catalog_from_data_warehouse` (merge/append into existing
    files), this clears the store first so leftover tables from a previous
    warehouse (e.g. the demo SQLite schema) cannot linger after activation.

    The clear+load is rollback-safe: a snapshot is taken first, and if the load
    fails (or raises) the previous catalog is restored so activation cannot leave
    an empty catalog while the connection is already active.
    """
    database_uri = None
    snapshot = None
    cleared = False
    try:
        data_warehouse_config = catalog_store.get_data_warehouse_config()
        database_uri = data_warehouse_config.get("uri")
        include_tables = data_warehouse_config.get("include_tables")
        database_name = data_warehouse_config.get("database_name", "default")
        engine = catalog_store.get_sql_engine()

        # Probe connectivity before wiping so a bad URI does not empty the catalog.
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        snapshot = catalog_store.snapshot_catalog()

        if not catalog_store.clear_catalog():
            logger.error("Failed to clear catalog store before sync")
            return False
        cleared = True

        loader = DataCatalogLoader(engine, include_tables)
        ok = loader.save_to_catalog_store(catalog_store, database_name, update=True)
        if ok:
            return True

        logger.error(
            "Catalog sync load failed for URI %s; restoring previous catalog snapshot",
            database_uri,
        )
        if not catalog_store.restore_catalog_snapshot(snapshot):
            logger.error("Failed to restore catalog snapshot after sync load failure")
        return False
    except Exception as e:  # noqa: BLE001
        logger.error("Failed to sync catalog from data warehouse URI %s: %s", database_uri, e)
        if cleared and snapshot is not None:
            try:
                if not catalog_store.restore_catalog_snapshot(snapshot):
                    logger.error("Failed to restore catalog snapshot after sync exception")
            except Exception as restore_exc:  # noqa: BLE001
                logger.error("Exception while restoring catalog snapshot: %s", restore_exc)
        return False


def reload_catalog_indexes(catalog_store: CatalogStore | None = None) -> None:
    """Rebuild BM25 / vector / example indexes after the catalog contents change.

    Module-level imports in schema linking and SQL generation hold references to
    the old retriever objects, so this updates both the source modules and the
    known consumer bindings.
    """
    from openchatbi import config as openchatbi_config
    from openchatbi.catalog.retrival_helper import build_column_tables_mapping, build_columns_retriever
    from openchatbi.text2sql.text2sql_utils import (
        LearnedSQLStore,
        _init_sql_example_retriever,
        _init_table_selection_example_dict,
    )

    store = catalog_store if catalog_store is not None else openchatbi_config.get().catalog_store
    vector_db_path = openchatbi_config.get().vector_db_path

    import openchatbi.catalog.schema_retrival as schema_retrival
    import openchatbi.text2sql.data as text2sql_data
    import openchatbi.text2sql.generate_sql as generate_sql
    import openchatbi.text2sql.schema_linking as schema_linking
    import openchatbi.tool.search_knowledge as search_knowledge

    new_bm25, new_vector_db, new_columns, new_col_dict = build_columns_retriever(store, vector_db_path)
    new_mapping = build_column_tables_mapping(store)

    schema_retrival._catalog_store = store
    schema_retrival.bm25 = new_bm25
    schema_retrival.vector_db = new_vector_db
    schema_retrival.columns = new_columns
    schema_retrival.col_dict.clear()
    schema_retrival.col_dict.update(new_col_dict)
    schema_retrival.column_tables_mapping.clear()
    schema_retrival.column_tables_mapping.update(new_mapping)

    # Keep imported dict aliases pointing at the mutated objects.
    search_knowledge.col_dict = schema_retrival.col_dict
    search_knowledge.column_tables_mapping = schema_retrival.column_tables_mapping
    schema_linking.col_dict = schema_retrival.col_dict
    schema_linking.column_tables_mapping = schema_retrival.column_tables_mapping

    sql_example_retriever, sql_example_dicts, sql_example_vector_db = _init_sql_example_retriever(
        store, vector_db_path
    )
    table_selection_retriever, table_selection_example_dict = _init_table_selection_example_dict(
        store, vector_db_path
    )

    text2sql_data._catalog_store = store
    text2sql_data.sql_example_retriever = sql_example_retriever
    text2sql_data.sql_example_vector_db = sql_example_vector_db
    text2sql_data.sql_example_dicts.clear()
    text2sql_data.sql_example_dicts.update(sql_example_dicts)
    text2sql_data.learned_sql_store = LearnedSQLStore(
        sql_example_vector_db, text2sql_data.sql_example_dicts, threading.Lock()
    )
    text2sql_data.table_selection_retriever = table_selection_retriever
    text2sql_data.table_selection_example_dict.clear()
    text2sql_data.table_selection_example_dict.update(table_selection_example_dict)

    generate_sql.sql_example_retriever = sql_example_retriever
    generate_sql.sql_example_dicts = text2sql_data.sql_example_dicts
    schema_linking.table_selection_retriever = table_selection_retriever
    schema_linking.table_selection_example_dict = text2sql_data.table_selection_example_dict

    logger.info(
        "Reloaded catalog indexes: %s columns, %s tables",
        len(new_columns),
        len(store.get_table_list()),
    )
