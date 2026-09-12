"""
API contract tests for the fraud-risk prediction endpoint.
Stubs for the request/response contract of your scoring endpoint. Fill in
the real path and payload from app/api/routes.py, then remove the
pytest.mark.skip lines — as written these describe the shape a real
contract-test suite should have, not working tests yet.
"""

import pytest

VALID_PAYLOAD = {
    "transaction_id": "TX10001",
    "user_id": "USER001",
    "amount": 1500.50,
    "transaction_type": "TRANSFER",
    "merchant_category": "electronics",
    "country": "US",
    "hour": 14,
    "device_risk_score": 0.25,
    "ip_risk_score": 0.18,
}


@pytest.mark.skip(reason="Fill in the real predict path + payload from routes.py")
def test_predict_rejects_malformed_payload(client):
    response = client.post("/api/v1/predict", json={})
    assert response.status_code == 422


@pytest.mark.skip(reason="Fill in the real predict path + payload from routes.py")
def test_predict_accepts_valid_payload(client):
    response = client.post("/api/v1/predict", json=VALID_PAYLOAD)
    assert response.status_code == 200

    body = response.json()

    assert body["is_fraud"] == 0
    assert body["fraud_probability"] == 0.0234
    assert body["model_name"] == "fraud_pipeline"
    assert body["model_version"] == "1.0.0"


@pytest.mark.skip(reason="Fill in the real predict path + payload from routes.py")
def test_predict_response_schema_is_stable(client):
    response = client.post("/api/v1/predict", json=VALID_PAYLOAD)
    assert response.status_code == 200
    body = response.json()
    expected_keys = {"is_fraud", "fraud_probability", "model_name", "model_version"}
    # assert expected_keys == set(body.keys())
    assert expected_keys.issubset(body.keys())
