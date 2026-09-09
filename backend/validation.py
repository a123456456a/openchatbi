from typing import Any

SENSITIVE_FIELD_NAMES = frozenset({"api_key", "password"})


def redact_sensitive_fields(data: Any) -> Any:
    """Recursively redact values for keys named api_key or password."""
    if isinstance(data, dict):
        return {
            key: ("***REDACTED***" if key in SENSITIVE_FIELD_NAMES else redact_sensitive_fields(value))
            for key, value in data.items()
        }
    if isinstance(data, list):
        return [redact_sensitive_fields(item) for item in data]
    return data
