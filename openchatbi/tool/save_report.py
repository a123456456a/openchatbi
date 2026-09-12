"""Tool for saving reports to files."""

import datetime
from typing import Annotated

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import InjectedToolArg, tool
from pydantic import BaseModel, Field

from openchatbi import config as app_config
from openchatbi.observability.context import get_run_context
from openchatbi.tool.report_writers import write_docx, write_xlsx
from openchatbi.report_cleanup import cleanup_expired_reports, resolve_report_ttl_days
from openchatbi.utils import get_user_report_directory, log, sanitize_report_user_id

TEXT_FORMATS = {"md", "csv", "txt", "json", "html", "xml"}
OFFICE_FORMATS = {"docx", "xlsx"}
ALLOWED_FORMATS = TEXT_FORMATS | OFFICE_FORMATS


class SaveReportInput(BaseModel):
    content: str = Field(description="The content of the report to save")
    title: str = Field(description="The title of the report (will be used in filename)")
    file_format: str = Field(
        description=(
            "The file format/extension, only support 'md', 'csv', 'txt', 'json', 'html', 'xml' "
            "(written verbatim), or 'docx'/'xlsx' (the markdown-ish `content` — headings, lists, "
            "tables, JSON, or CSV — is converted into a Word document or Excel workbook)"
        )
    )


def _resolve_report_user_id(run_config: RunnableConfig | None) -> str | None:
    """Prefer run-context user_id; fall back to LangGraph configurable.user_id."""
    user_id, _ = get_run_context()
    if user_id:
        return user_id
    if run_config:
        configurable = run_config.get("configurable") or {}
        cfg_uid = configurable.get("user_id")
        if isinstance(cfg_uid, str) and cfg_uid:
            return cfg_uid
    return None


@tool("save_report", args_schema=SaveReportInput, return_direct=False, infer_schema=True)
def save_report(
    content: str,
    title: str,
    file_format: str = "md",
    *,
    config: Annotated[RunnableConfig, InjectedToolArg],
) -> str:
    """Save a report to a file with timestamp and title in filename.

    Args:
        content: The content of the report to save. For 'docx'/'xlsx', write it as markdown
            (headings, bullet/numbered lists, `**bold**`/`*italic*`/`` `code` ``, and pipe
            tables) or as CSV/JSON tabular data — it will be converted automatically.
        title: The title of the report (will be used in filename)
        file_format: The file format/extension. Supported: 'md', 'csv', 'txt', 'json', 'html',
            'xml' (saved as-is), or 'docx'/'xlsx' (converted from the markdown/CSV/JSON content
            into an Office document) — use these when the user asks for a Word or Excel file.

    Returns:
        str: Success message with download link or error message
    """
    if file_format not in ALLOWED_FORMATS:
        raise ValueError(f"Unsupported file format: {file_format}")

    try:
        raw_user_id = _resolve_report_user_id(config)
        if not raw_user_id:
            error_msg = "Failed to save report: missing user context (user_id)"
            log(error_msg)
            return error_msg
        try:
            user_id = sanitize_report_user_id(raw_user_id)
        except ValueError:
            error_msg = "Failed to save report: invalid user_id for report isolation"
            log(error_msg)
            return error_msg

        # Per-user directory under the configured report root
        report_dir = get_user_report_directory(app_config.get().report_directory, user_id)
        report_dir.mkdir(parents=True, exist_ok=True)

        # Generate timestamp for filename
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")

        # Clean title for filename (remove invalid characters)
        clean_title = "".join(c for c in title if c.isalnum() or c in (" ", "-")).rstrip()
        clean_title = clean_title.replace(" ", "_")

        # Create filename
        filename = f"{timestamp}_{clean_title}.{file_format}"
        file_path = report_dir / filename

        if file_format == "docx":
            write_docx(file_path, title, content)
        elif file_format == "xlsx":
            write_xlsx(file_path, title, content)
        else:
            # Write content to file
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)

        log(f"Report saved: {file_path}")

        # Best-effort TTL cleanup for this user's report directory (root DBs untouched).
        try:
            ttl = resolve_report_ttl_days(getattr(app_config.get(), "report_ttl_days", 30))
            cleanup_expired_reports(app_config.get().report_directory, ttl, user_id=user_id)
        except Exception as cleanup_exc:
            log(f"Report TTL cleanup after save failed: {cleanup_exc}")

        # Download URL stays basename-only; ownership is enforced via auth on download
        download_url = f"/api/download/report/{filename}"
        return f"Report saved successfully! Download link: {download_url}"

    except Exception as e:
        error_msg = f"Failed to save report: {str(e)}"
        log(error_msg)
        return error_msg
