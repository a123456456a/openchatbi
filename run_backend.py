"""Start the OpenChatBI FastAPI backend (product UI path).

Local demo JWT: set a strong JWT_SECRET, or explicitly opt into insecure defaults:

  export ALLOW_INSECURE_DEFAULTS=true   # demo only — never in production
  # or: export APP_ENV=development

See README «Run Demo» for details.
"""

from __future__ import annotations

import sys

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass


def main() -> None:
    try:
        from pydantic import ValidationError

        from backend.config import get_settings

        get_settings.cache_clear()
        get_settings()
    except (ValueError, ValidationError) as exc:
        print(f"Configuration error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc

    import uvicorn

    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=False)


if __name__ == "__main__":
    main()
