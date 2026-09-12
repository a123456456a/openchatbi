"""TTL cleanup for per-user report files under ``{report_directory}/{user_id}/``.

Deletes only regular files inside validated user subdirectories. Never touches
files at the report root (e.g. ``auth.db``, ``checkpoints.db``, ``run_cancels.db``)
or any path that is not a sanitizeable user_id directory.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from openchatbi.utils import log, sanitize_report_user_id

SECONDS_PER_DAY = 86400


def _is_dir_no_follow(path: Path) -> bool:
    """Directory check without following symlinks (3.11-compatible)."""
    try:
        return path.is_dir(follow_symlinks=False)
    except TypeError:
        return not path.is_symlink() and path.is_dir()


def _is_file_no_follow(path: Path) -> bool:
    """File check without following symlinks (3.11-compatible)."""
    try:
        return path.is_file(follow_symlinks=False)
    except TypeError:
        return not path.is_symlink() and path.is_file()


@dataclass(frozen=True)
class ReportCleanupResult:
    """Outcome of a report TTL cleanup pass."""

    deleted: int = 0
    skipped: bool = False
    errors: int = 0


def resolve_report_ttl_days(configured: int | None) -> int | None:
    """Resolve effective TTL days from env override then config.

    ``REPORT_TTL_DAYS`` env wins when set. Values ``None`` or ``<= 0`` mean
    cleanup is disabled. Returns a positive int when enabled, else ``None``.
    """
    env_raw = os.getenv("REPORT_TTL_DAYS")
    if env_raw is not None and env_raw.strip() != "":
        raw: object = env_raw.strip()
    else:
        raw = configured

    if raw is None:
        return None
    try:
        value = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        log(f"Invalid report TTL days={raw!r}; treating as disabled")
        return None
    if value <= 0:
        return None
    return value


def cleanup_expired_reports(
    report_directory: str | Path,
    ttl_days: int | None,
    *,
    now: datetime | None = None,
    user_id: str | None = None,
) -> ReportCleanupResult:
    """Delete report files older than ``ttl_days`` under per-user directories.

    Args:
        report_directory: Report root (same as ``Config.report_directory``).
        ttl_days: Retention in days. ``None`` or ``<= 0`` disables cleanup.
        now: Optional clock for tests (timezone-aware preferred).
        user_id: If set, only clean that user's directory; otherwise all
            immediate child dirs whose names pass ``sanitize_report_user_id``.

    Returns:
        ReportCleanupResult with deleted count (and skipped=True when disabled).
    """
    effective = ttl_days if ttl_days is not None and ttl_days > 0 else None
    if effective is None:
        return ReportCleanupResult(deleted=0, skipped=True)

    root = Path(report_directory)
    if not root.exists() or not root.is_dir():
        return ReportCleanupResult(deleted=0)

    clock = now or datetime.now(timezone.utc)
    if clock.tzinfo is None:
        cutoff_ts = clock.timestamp() - effective * SECONDS_PER_DAY
    else:
        cutoff_ts = clock.timestamp() - effective * SECONDS_PER_DAY

    deleted = 0
    errors = 0

    if user_id is not None:
        try:
            safe_uid = sanitize_report_user_id(user_id)
        except ValueError:
            return ReportCleanupResult(deleted=0, errors=1)
        user_dirs = [root / safe_uid]
    else:
        user_dirs = []
        try:
            children = list(root.iterdir())
        except OSError as exc:
            log(f"Report TTL cleanup: cannot list {root}: {exc}")
            return ReportCleanupResult(deleted=0, errors=1)
        for child in children:
            if not _is_dir_no_follow(child):
                continue
            try:
                sanitize_report_user_id(child.name)
            except ValueError:
                continue
            user_dirs.append(child)

    for user_dir in user_dirs:
        if not _is_dir_no_follow(user_dir):
            continue
        try:
            entries = list(user_dir.iterdir())
        except OSError as exc:
            log(f"Report TTL cleanup: cannot list {user_dir}: {exc}")
            errors += 1
            continue

        try:
            user_dir_resolved = user_dir.resolve()
        except OSError as exc:
            log(f"Report TTL cleanup: cannot resolve {user_dir}: {exc}")
            errors += 1
            continue

        for entry in entries:
            try:
                if not _is_file_no_follow(entry):
                    continue
                resolved = entry.resolve()
                try:
                    resolved.relative_to(user_dir_resolved)
                except ValueError:
                    log(f"Report TTL cleanup: skip path escaping user dir: {entry}")
                    errors += 1
                    continue
                if not resolved.is_file():
                    continue
                if resolved.stat().st_mtime < cutoff_ts:
                    resolved.unlink(missing_ok=True)
                    deleted += 1
            except OSError as exc:
                log(f"Report TTL cleanup: failed on {entry}: {exc}")
                errors += 1

    if deleted or errors:
        log(f"Report TTL cleanup: deleted={deleted} errors={errors} ttl_days={effective} root={root}")
    return ReportCleanupResult(deleted=deleted, errors=errors)


def run_report_ttl_cleanup_from_config() -> ReportCleanupResult:
    """Run cleanup using loaded app config (+ optional ``REPORT_TTL_DAYS`` env)."""
    from openchatbi import config as app_config

    try:
        cfg = app_config.get()
    except ValueError:
        log("Report TTL cleanup: config not loaded; skipping")
        return ReportCleanupResult(skipped=True)

    ttl = resolve_report_ttl_days(getattr(cfg, "report_ttl_days", 30))
    return cleanup_expired_reports(cfg.report_directory, ttl)
