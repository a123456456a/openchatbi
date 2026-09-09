from unittest.mock import MagicMock

from openchatbi.llm.llm import (
    get_analysis_llm,
    get_default_llm,
    get_llm,
    get_text2sql_llm,
    reset_llm_override,
    set_llm_override,
)


def test_override_wins():
    fake = MagicMock(name="UserLLM")
    token = set_llm_override(fake)
    try:
        assert get_llm() is fake
        assert get_llm("openai") is fake
        assert get_default_llm() is fake
        assert get_text2sql_llm() is fake
        assert get_analysis_llm() is fake
    finally:
        reset_llm_override(token)
