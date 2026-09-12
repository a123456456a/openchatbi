"""Tests for per-user report TTL cleanup."""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from openchatbi.report_cleanup import (
    cleanup_expired_reports,
    resolve_report_ttl_days,
    run_report_ttl_cleanup_from_config,
)


def _touch_old(path: Path, age_days: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("old", encoding="utf-8")
    mtime = time.time() - age_days * 86400
    os.utime(path, (mtime, mtime))


def test_resolve_ttl_default_and_disable(monkeypatch):
    monkeypatch.delenv("REPORT_TTL_DAYS", raising=False)
    assert resolve_report_ttl_days(30) == 30
    assert resolve_report_ttl_days(0) is None
    assert resolve_report_ttl_days(None) is None
    assert resolve_report_ttl_days(-1) is None


def test_resolve_ttl_env_override(monkeypatch):
    monkeypatch.setenv("REPORT_TTL_DAYS", "7")
    assert resolve_report_ttl_days(30) == 7
    monkeypatch.setenv("REPORT_TTL_DAYS", "0")
    assert resolve_report_ttl_days(30) is None
    monkeypatch.setenv("REPORT_TTL_DAYS", "not-a-number")
    assert resolve_report_ttl_days(30) is None


def test_cleanup_disabled_is_noop(tmp_path):
    user_dir = tmp_path / "alice"
    _touch_old(user_dir / "old.md", age_days=100)
    result = cleanup_expired_reports(tmp_path, 0)
    assert result.skipped is True
    assert result.deleted == 0
    assert (user_dir / "old.md").exists()

    result = cleanup_expired_reports(tmp_path, None)
    assert result.skipped is True
    assert (user_dir / "old.md").exists()


def test_cleanup_deletes_only_expired_report_files(tmp_path):
    alice = tmp_path / "alice"
    bob = tmp_path / "bob"
    _touch_old(alice / "stale.md", age_days=40)
    _touch_old(alice / "fresh.md", age_days=1)
    _touch_old(bob / "stale.docx", age_days=60)
    (bob / "fresh.txt").write_text("new", encoding="utf-8")

    # Root-level DB / checkpoint files must never be deleted
    auth_db = tmp_path / "auth.db"
    checkpoints = tmp_path / "checkpoints.db"
    run_cancels = tmp_path / "run_cancels.db"
    for p in (auth_db, checkpoints, run_cancels):
        _touch_old(p, age_days=365)

    # Non-user directory name must be ignored
    weird = tmp_path / "not a user"
    weird.mkdir()
    _touch_old(weird / "x.md", age_days=100)

    now = datetime(2026, 9, 12, tzinfo=timezone.utc)
    result = cleanup_expired_reports(tmp_path, 30, now=now)

    assert result.skipped is False
    assert result.deleted == 2
    assert not (alice / "stale.md").exists()
    assert (alice / "fresh.md").exists()
    assert not (bob / "stale.docx").exists()
    assert (bob / "fresh.txt").exists()
    assert auth_db.exists()
    assert checkpoints.exists()
    assert run_cancels.exists()
    assert (weird / "x.md").exists()


def test_cleanup_scoped_to_single_user(tmp_path):
    _touch_old(tmp_path / "alice" / "old.md", age_days=40)
    _touch_old(tmp_path / "bob" / "old.md", age_days=40)

    result = cleanup_expired_reports(tmp_path, 30, user_id="alice")
    assert result.deleted == 1
    assert not (tmp_path / "alice" / "old.md").exists()
    assert (tmp_path / "bob" / "old.md").exists()


def test_cleanup_skips_nested_directories(tmp_path):
    nested = tmp_path / "alice" / "subdir"
    nested.mkdir(parents=True)
    _touch_old(nested / "deep.md", age_days=100)
    result = cleanup_expired_reports(tmp_path, 30)
    assert result.deleted == 0
    assert (nested / "deep.md").exists()


def test_config_default_report_ttl_days():
    from openchatbi.config_loader import Config

    cfg = Config(default_llm=MagicMock())
    assert cfg.report_ttl_days == 30
    assert cfg.report_directory == "./data"


def test_run_from_config_respects_ttl(tmp_path, monkeypatch):
    from openchatbi.config_loader import ConfigLoader

    monkeypatch.delenv("REPORT_TTL_DAYS", raising=False)
    _touch_old(tmp_path / "u1" / "old.md", age_days=40)

    loader = ConfigLoader()
    loader.set(
        {
            "organization": "T",
            "dialect": "presto",
            "default_llm": MagicMock(),
            "embedding_model": MagicMock(),
            "data_warehouse_config": {"uri": "sqlite:///:memory:", "include_tables": None, "database_name": "t"},
            "report_directory": str(tmp_path),
            "report_ttl_days": 30,
        }
    )
    monkeypatch.setattr("openchatbi.config", loader)

    result = run_report_ttl_cleanup_from_config()
    assert result.deleted == 1
    assert not (tmp_path / "u1" / "old.md").exists()


def test_run_from_config_disabled(tmp_path, monkeypatch):
    from openchatbi.config_loader import ConfigLoader

    monkeypatch.delenv("REPORT_TTL_DAYS", raising=False)
    _touch_old(tmp_path / "u1" / "old.md", age_days=40)

    loader = ConfigLoader()
    loader.set(
        {
            "organization": "T",
            "dialect": "presto",
            "default_llm": MagicMock(),
            "embedding_model": MagicMock(),
            "data_warehouse_config": {"uri": "sqlite:///:memory:", "include_tables": None, "database_name": "t"},
            "report_directory": str(tmp_path),
            "report_ttl_days": 0,
        }
    )
    monkeypatch.setattr("openchatbi.config", loader)

    result = run_report_ttl_cleanup_from_config()
    assert result.skipped is True
    assert (tmp_path / "u1" / "old.md").exists()


def test_template_and_example_document_ttl():
    import yaml

    repo = Path(__file__).resolve().parents[1]
    tmpl = yaml.safe_load((repo / "openchatbi" / "config.yaml.template").read_text(encoding="utf-8"))
    # Template may comment the key; ensure example ships default 30
    example = yaml.safe_load((repo / "example" / "config.yaml").read_text(encoding="utf-8"))
    assert example.get("report_ttl_days") == 30
    # Template text should mention the setting even if commented
    raw = (repo / "openchatbi" / "config.yaml.template").read_text(encoding="utf-8")
    assert "report_ttl_days" in raw
    assert "REPORT_TTL_DAYS" in raw
