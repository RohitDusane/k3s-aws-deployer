"""
Shared fixtures for API contract tests.

The ML model is mocked so API tests remain fast and deterministic.
These tests validate HTTP/API behavior, not model quality.
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client():
    def fake_load(self):
        # Simulate a successfully loaded model for API tests.
        self.model = object()

    with (
        patch(
            "app.services.model_service.ModelService.load",
            new=fake_load,
        ),
        patch(
            "app.services.model_service.ModelService.unload",
            return_value=None,
        ),
        patch(
            "app.services.model_service.ModelService.predict",
            return_value=(0, 0.0234),
        ),
    ):
        from app.main import app

        with TestClient(app) as test_client:
            yield test_client
