"""Product/example configs ship with fail-closed SQL guard + confidence gate on."""

from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]


def _load_yaml(relative: str) -> dict:
    path = REPO_ROOT / relative
    with path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    assert isinstance(data, dict), f"{relative} did not parse to a mapping"
    return data


def test_example_config_enables_sql_guard_and_confidence_gate():
    cfg = _load_yaml("example/config.yaml")
    assert cfg.get("enable_fail_closed_sql_guard") is True
    assert cfg.get("enable_confidence_gate") is True
    assert float(cfg.get("sql_confidence_threshold", 0)) > 0


def test_config_template_enables_sql_guard_and_confidence_gate():
    cfg = _load_yaml("openchatbi/config.yaml.template")
    assert cfg.get("enable_fail_closed_sql_guard") is True
    assert cfg.get("enable_confidence_gate") is True
    assert float(cfg.get("sql_confidence_threshold", 0)) > 0
