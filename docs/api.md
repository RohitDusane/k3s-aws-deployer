# API Documentation

## 1. Overview

The RiskGuard API exposes a fraud-risk scoring model through a REST
interface built with FastAPI. Interactive docs are auto-generated:

```
http://localhost:8000/docs           # Swagger UI
http://localhost:8000/openapi.json   # OpenAPI schema
```

All endpoints below are confirmed against real requests made during
local K3s testing, not assumed.

## 2. Base URLs

| Environment | URL |
|---|---|
| Local | `http://localhost:8000` |
| Local K3s (port-forward) | `http://localhost:8888` |
| Production | `http://<ec2-elastic-ip-or-domain>` |

All application routes are under the `/api/v1` prefix
(`settings.api_prefix`).

## 3. `GET /api/v1/health` — liveness

Plain process-alive check. Does **not** verify the model is loaded —
that's intentional, so a slow model reload doesn't get the pod killed
and restarted in a loop by Kubernetes' liveness probe.

```json
{ "status": "healthy" }
```

## 4. `GET /api/v1/ready` — readiness

Reports whether the model has actually finished loading. This is what
Kubernetes' `readinessProbe` and `startupProbe` check — a pod won't
receive traffic until this returns `model_loaded: true`.

```json
{ "status": "ready", "model_loaded": true }
```

## 5. `POST /api/v1/predict` — fraud scoring

Request body (confirmed from real test traffic):

```json
{
  "transaction_id": "TX10148",
  "user_id": "USER171",
  "amount": 111500.50,
  "transaction_type": "TRANSFER",
  "merchant_category": "electronics",
  "country": "US",
  "hour": 14,
  "device_risk_score": 0.5,
  "ip_risk_score": 0.8
}
```

Response:

```json
{
  "is_fraud": 1,
  "fraud_probability": 0.6212896879629656,
  "model_name": "fraud_pipeline",
  "model_version": "1.0.0"
}
```

`transaction_type` accepts `TRANSFER`, `PAYMENT`, `WITHDRAWAL`,
`PURCHASE`, `DEPOSIT` (per the frontend's dropdown, which should match
the backend's enum/schema exactly — verify against `app/schemas/` if the
two ever drift).

## 6. `GET /metrics` — Prometheus metrics

Exposed via `prometheus-fastapi-instrumentator`, mounted directly on the
FastAPI app (same port as the API, not a separate service). Includes
standard HTTP metrics (`http_requests_total`,
`http_request_duration_seconds_bucket`) plus custom business metrics:

```
risk_predictions_total
risk_prediction_results_total{result="fraud"|"non_fraud"}
risk_prediction_latency_seconds_bucket
model_accuracy, model_precision, model_recall, model_f1_score      # currently 0.0 — see docs/model.md
model_prediction_drift, data_drift_score, feature_drift_score      # currently 0.0 — see docs/model.md
```

## 7. Error handling

| Status | Meaning |
|---|---|
| 200 | Successful request |
| 422 | Pydantic validation error (malformed/missing fields) |
| 500 | Internal server error (e.g., model inference failure) |
| 503 | Not currently implemented — would indicate model not loaded |

`tests/test_api.py` has stub contract tests for 422 on malformed payloads
and a stable-response-shape test — currently marked `pytest.mark.skip`
pending confirmation of the exact Pydantic schema field names.

## 8. Testing the API

```bash
curl http://localhost:8888/api/v1/health
curl http://localhost:8888/api/v1/ready

curl -X POST http://localhost:8888/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"TX_TEST","user_id":"USER_TEST","amount":100.0,
       "transaction_type":"TRANSFER","merchant_category":"electronics",
       "country":"US","hour":14,"device_risk_score":0.5,"ip_risk_score":0.5}'
```

## 9. Security (not yet implemented)

No authentication, rate limiting, or HTTPS termination exists at the
application layer today — TLS is handled by Traefik at the ingress
level in production. Before any real (non-demo) use: add auth, rate
limiting, and request size limits. See `docs/project-overview.md` §
"Production Considerations."
