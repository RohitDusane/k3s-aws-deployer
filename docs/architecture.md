# System Architecture

## 1. Overview

```
CLIENT
  |
  v
FastAPI (Uvicorn)
  |
  +--> Pydantic request validation
  |
  +--> ModelService (loaded once at startup, via lifespan handler)
  |
  +--> RandomForestClassifier inference
  |
  v
JSON response (fraud_probability, is_fraud, model_name, model_version)
```

The model is loaded once when the application starts (`app/main.py`'s
`lifespan` context manager), not per-request — this is why `/api/v1/ready`
exists as a distinct endpoint from `/api/v1/health`: readiness reports
whether the model actually finished loading, liveness only reports
whether the process is alive.

---

## 2. Full deployment architecture (as actually running)

```
Developer
   |
   v
Git push to main
   |
   v
GitHub Actions
   |
   +---- lint-and-test (ruff + pytest, no AWS access)
   +---- validate-k8s-manifests (kubeconform)
   +---- build-scan-push:
   |        - assume AWS role via OIDC (no stored keys)
   |        - docker buildx build --platform linux/arm64
   |        - Trivy scan (fails on CRITICAL/HIGH CVEs)
   |        - push to Amazon ECR
   +---- deploy:
            - aws ssm send-command to the EC2 instance
            - kubectl set image + rollout status
   |
   v
AWS EC2 (t4g.small, arm64, ap-south-1, tagged Name=risk-mlops-node)
   |
   v
K3s (single node, Traefik built-in for ingress + TLS)
   |
   +-------------------------+-------------------------+
   |                                                    |
   v                                                    v
risk-mlops-api Deployment (2 replicas)          Monitoring stack
   |                                             (same namespace, same node)
   v                                                    |
Random Forest model (fraud_pipeline.joblib)      Prometheus + kube-state-metrics
                                                         |
                                                  Alertmanager -> Slack
                                                         |
                                                     Grafana
```

---

## 3. Why K3s on EC2, not EKS

EKS's managed control plane costs ~$73/month by itself, before any worker
node. For a project at this traffic scale, that cost buys availability
guarantees that aren't needed yet. K3s gives the same Kubernetes API,
manifests, and operational patterns (Deployments, Services, probes, HPA,
ConfigMaps, Secrets) on a single EC2 instance — the manifests in `k8s/`
would need no rewrite to move to EKS later, only a different node group
underneath them.

## 4. Why no NAT Gateway, ALB, or RDS

- **No NAT Gateway** — the instance sits in a public subnet with a
  security group instead; a NAT Gateway costs ~$33/month just for existing.
- **No ALB** — Traefik (bundled with K3s) provides ingress and free
  Let's Encrypt TLS directly on the instance; an ALB would cost $16-25/month
  to do the same job.
- **No RDS** — the API is stateless (loads a model file, scores requests);
  there's no data to persist server-side yet.

## 5. Probes — the bug we actually hit

The first version of `deploy.yaml` pointed both `livenessProbe` and
`readinessProbe` at `/api/v1/health`. That's wrong: it means Kubernetes
would route traffic to a pod the instant the process started, even if the
model hadn't finished loading. The corrected version:

```
startupProbe   -> /api/v1/ready   (up to 150s to allow model load)
readinessProbe -> /api/v1/ready   (model_loaded: true required for traffic)
livenessProbe  -> /api/v1/health  (cheap process-alive check only)
```

## 6. Observability architecture

```
FastAPI /metrics (prometheus-fastapi-instrumentator)
   |
   v
Prometheus  <---- kube-state-metrics (scoped to deployments+pods only)
   |
   +--> 18 alert rules (monitoring/prometheus/alerts.yml)
   |        - RiskAPIInstanceDown / RiskAPITotallyDown
   |        - HighHTTP5xxRate, HighAPIP95Latency, HighModelP95Latency
   |        - SignificantPredictionDrift / SignificantDataDrift (+ *MetricMissing variants)
   |        - LowModelAccuracy / LowModelF1 / ModelEvaluationStale
   |        - RiskAPIDeploymentUnavailable / RiskAPIPodRestartingFrequently / RiskAPIOOMKilled
   |
   v
Alertmanager (routes severity=critical -> #incidents, else -> #alerts)
   |
   v
Slack
   +
Grafana (dashboards provisioned from monitoring/grafana/, folder "MLOps")
```

kube-state-metrics is deployed with a deliberately narrow ClusterRole
(`deployments` + `pods` only, via `--resources=deployments,pods`) rather
than the full upstream default of ~15 watched resource types — three
alert rules need it; nothing else does.

## 7. Known architectural gaps (tracked, not hidden)

1. **Single node** — no multi-AZ failover. `PodDisruptionBudget` and
   `HorizontalPodAutoscaler` are configured, but neither helps if the
   single EC2 instance itself goes down.
2. **ECR pull secret expires every 12 hours** — a `kubectl create secret
   docker-registry` token isn't renewed automatically outside of EKS's
   IRSA-style credential provider. Planned fix: a `CronJob` that refreshes
   it using the instance's IAM role.
3. **Model evaluation metrics are wired but unpopulated** —
   `model_accuracy`, `model_prediction_drift`, etc. exist as Prometheus
   metrics and have alert thresholds, but no scheduled evaluation job has
   run to produce real values yet.

## 8. Future high-availability path

```
AWS
 |
 v
Application Load Balancer
 |
 +---- EC2/EKS node (AZ 1) -- API replica
 +---- EC2/EKS node (AZ 2) -- API replica
 |
 v
RDS (if/when persistence is needed) + Monitoring stack
```

This is a real upgrade path, not a rewrite — the same Deployment/Service
manifests apply; only the node topology and load balancing layer change.


## 9. Future improvements — application layer
 
These are reasonable next steps, explicitly **not implemented today** —
listed here so they're tracked as intentions rather than accidentally
implied as current state elsewhere in the docs:
 
- **A database layer** (`app/db/` — connection handling, ORM models,
  repositories) for persisting prediction history and audit events
  server-side, replacing the frontend's `localStorage`-only history.
  PostgreSQL in production, SQLite for local development is the standard
  pattern if/when this is built.
- **Structured middleware** (`app/middleware/`) for request IDs,
  correlation IDs, and request timing — useful once there's more than
  one service and you need to trace a request across logs.
- **Static type checking** (`mypy`) as a CI step alongside the existing
  `ruff` lint — not currently configured; would need a `mypy.ini` and
  `mypy` added to `requirements-dev.txt` before it could run in
  `.github/workflows/ci.yml`.
None of these three exist in the codebase yet — they're documented here
specifically so a future contributor (including future-you) evaluates
them deliberately rather than assuming they're already handled.
 
This is a real upgrade path, not a rewrite — the same Deployment/Service
manifests apply; only the node topology and load balancing layer change.
 