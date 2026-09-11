"""Unit tests for per-user report path isolation helpers."""

from pathlib import Path

import pytest
from fastapi import HTTPException

from openchatbi.utils import (
    get_user_report_directory,
    resolve_user_report_path,
    sanitize_report_filename,
    sanitize_report_user_id,
)


def test_sanitize_user_id_accepts_uuid_and_simple():
    assert sanitize_report_user_id("default") == "default"
    assert sanitize_report_user_id("user_1") == "user_1"
    uid = "1971d5ef-efa9-4648-b854-b806d330ad18"
    assert sanitize_report_user_id(uid) == uid


@pytest.mark.parametrize("bad", ["", ".", "..", "a/b", "a\\b", "user@x", "../x"])
def test_sanitize_user_id_rejects_unsafe(bad):
    with pytest.raises(ValueError):
        sanitize_report_user_id(bad)


@pytest.mark.parametrize("bad", ["", ".", "..", "../x", "a/b", "a\\b"])
def test_sanitize_filename_rejects_unsafe(bad):
    with pytest.raises(ValueError):
        sanitize_report_filename(bad)


def test_resolve_user_report_path_scopes_to_owner(tmp_path):
    owner = "alice"
    other = "bob"
    path = resolve_user_report_path(tmp_path, owner, "report.md")
    assert path == tmp_path / owner / "report.md"
    assert get_user_report_directory(tmp_path, owner) == tmp_path / owner
    assert get_user_report_directory(tmp_path, other) != get_user_report_directory(tmp_path, owner)


def test_get_report_download_response_404_for_other_user(tmp_path, monkeypatch):
    from openchatbi.utils import get_report_download_response

    monkeypatch.setattr(
        "openchatbi.config.get",
        lambda: type("Cfg", (), {"report_directory": str(tmp_path)})(),
    )
    owner_dir = tmp_path / "alice"
    owner_dir.mkdir()
    (owner_dir / "r.md").write_text("secret", encoding="utf-8")

    # Owner ok
    resp = get_report_download_response("r.md", user_id="alice")
    assert Path(resp.path).read_text(encoding="utf-8") == "secret"

    with pytest.raises(HTTPException) as ei:
        get_report_download_response("r.md", user_id="bob")
    assert ei.value.status_code == 404
