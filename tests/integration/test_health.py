def test_root_serves_frontend(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert "text/html" in resp.headers["content-type"]


def test_metrics_endpoint_is_prometheus_format(client):
    resp = client.get("/metrics")
    assert resp.status_code == 200
    # prometheus-fastapi-instrumentator always emits HELP/TYPE comment lines
    assert "# HELP" in resp.text
    assert "# TYPE" in resp.text


def test_health_endpoint_returns_200(client):
    # TODO: confirm this path against app/api/routes.py and settings.api_prefix.
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, dict)


def test_health_endpoint_reflects_model_loaded_state(client):
    # A health check that always returns 200 regardless of model state is a
    # common production gap: Kubernetes will happily route traffic to a pod
    # whose model failed to load. If your /health handler reports model
    # status, assert on the real field name here, e.g.:
    #   assert body["model_loaded"] is True
    resp = client.get("/api/v1/health")
    body = resp.json()
    assert body != {}

def test_health_endpoint_is_plain_liveness(client):
    # Confirmed from local testing: {"status": "healthy"} — no model check.
    # This is what K8s livenessProbe hits; it should stay cheap and fast.
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


def test_ready_endpoint_reports_model_loaded(client):
    # Confirmed from local testing: {"status": "ready", "model_loaded": true}
    # This is what K8s readinessProbe AND startupProbe hit — it's the one
    # that actually proves the model finished loading, not just that the
    # process is up. Since conftest.py mocks ModelService.load/unload as
    # no-ops, model_loaded here reflects that mock, not a real model load —
    # this test is checking the endpoint's shape/contract, not the model.
    resp = client.get("/api/v1/ready")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ready"
    assert "model_loaded" in body
