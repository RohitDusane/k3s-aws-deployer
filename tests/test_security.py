import pytest
from fastapi import HTTPException

from app.core import security


@pytest.mark.anyio
async def test_verify_api_key_server_key_not_configured(monkeypatch):
    monkeypatch.setattr(security.settings, "api_key", "")

    with pytest.raises(HTTPException) as exc_info:
        await security.verify_api_key("anything")

    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "API_KEY is not configured on the server."


@pytest.mark.anyio
async def test_verify_api_key_invalid(monkeypatch):
    monkeypatch.setattr(security.settings, "api_key", "correct-secret")

    with pytest.raises(HTTPException) as exc_info:
        await security.verify_api_key("wrong-secret")

    assert exc_info.value.status_code == 401
    assert exc_info.value.detail == "Missing or invalid API key."


@pytest.mark.anyio
async def test_verify_api_key_valid(monkeypatch):
    monkeypatch.setattr(security.settings, "api_key", "correct-secret")

    result = await security.verify_api_key("correct-secret")

    assert result is None
