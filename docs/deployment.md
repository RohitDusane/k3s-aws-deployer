# Deployment Guide

For the complete, step-by-step walkthrough (local WSL2/K3s → AWS
production, with both console and CLI instructions), see
[`RUNBOOK.md`](../RUNBOOK.md) at the repo root. This file is the quick
reference.

## 1. Deployment path

```
Local (uvicorn)
   |
   v
Docker (docker compose up)
   |
   v
Local K3s (WSL2)
   |
   v
AWS EC2 + K3s (production)
```

## 2. Local

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 3. Docker

```bash
docker build -t risk-mlops-api:1.0.0 .
docker run --rm -p 8000:8000 -e APP_ENV=production risk-mlops-api:1.0.0
```

Or the full local stack (API + Prometheus + Grafana):

```bash
docker compose up --build
```

## 4. Local K3s

```bash
sudo k3s kubectl apply -f k8s/namespace.yaml
sudo k3s kubectl apply -f k8s/configmap.yaml

kubectl create secret docker-registry ecr-pull-secret \
  --docker-server=<ecr-uri> --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password) -n risk-mlops

sudo k3s kubectl apply -f k8s/deploy.yaml
sudo k3s kubectl apply -f k8s/service.yaml

sudo k3s kubectl get pods -n risk-mlops
```

## 5. Monitoring stack (local or AWS — same manifests)

Apply order matters (kube-state-metrics and Alertmanager before
Prometheus, so it isn't scraping/alerting against nothing):

```bash
kubectl apply -f k8s/monitoring-kube-state-metrics.yaml

kubectl create secret generic grafana-admin --from-literal=password='<real-password>' -n risk-mlops
kubectl create secret generic alertmanager-config \
  --from-file=alertmanager.yml=./monitoring/alertmanager/alertmanager.yml -n risk-mlops
kubectl apply -f k8s/monitoring-alertmanager.yaml

kubectl apply -f k8s/monitoring-prometheus-config.yaml
kubectl apply -f k8s/monitoring-prometheus.yaml

kubectl create configmap grafana-dashboard-files \
  --from-file=./monitoring/grafana/dashboards -n risk-mlops
kubectl apply -f k8s/monitoring-grafana-datasource.yaml
kubectl apply -f k8s/monitoring-grafana-dashboard-provider.yaml
kubectl apply -f k8s/monitoring-grafana.yaml
```

## 6. AWS production (summary — see RUNBOOK.md for full detail)

1. Billing alarm, ECR repo, GitHub Actions OIDC role (Phase 1)
2. Launch EC2 t4g.small, Elastic IP, install K3s (Phase 2)
3. Push image to ECR — manually once, then via CI on every merge (Phase 3)
4. Apply the same `k8s/` manifests as local, pointed at the ECR image (Phase 4)
5. Apply the monitoring stack (Phase 5)
6. Re-run every local test against the public endpoint (Phase 6)

## 7. Verification commands (same at every stage)

```bash
kubectl -n risk-mlops get pods
kubectl -n risk-mlops port-forward svc/risk-mlops-api 8888:8000
curl http://localhost:8888/api/v1/health
curl http://localhost:8888/api/v1/ready
```

## 8. Self-healing check

```bash
kubectl delete pod -n risk-mlops <pod-name>
kubectl -n risk-mlops get pods -w   # watch it come back to 1/1 Running
```

## 9. CI/CD

```
Push to main
   |
   v
GitHub Actions
   |
   +-- lint-and-test (ruff, pytest)
   +-- validate-k8s-manifests (kubeconform)
   +-- build-scan-push (buildx arm64, Trivy, push to ECR) [main only]
   +-- deploy (SSM: kubectl set image + rollout status)
```

No AWS credentials are stored in GitHub — the workflow assumes an IAM
role via OIDC, scoped to this repo's `main` branch only.

## 10. Known operational gap

ECR pull secrets expire after 12 hours (`docker login` tokens). Existing
running pods are unaffected, but the next `kubectl set image` or pod
restart after expiry will fail with `ImagePullBackOff`. See
`RUNBOOK.md` Phase 7 for the planned CronJob fix.
