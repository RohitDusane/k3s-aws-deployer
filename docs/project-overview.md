# Project Overview

## 1. What this is

RiskGuard is a fraud-risk scoring service — a FastAPI application serving
a Random Forest model — built to demonstrate the complete lifecycle
around a production ML system: not just training a model, but packaging
it, deploying it under Kubernetes, monitoring it, alerting on it, and
automating its delivery, all under a real cost budget.

## 2. The problem it addresses

Financial applications need to evaluate transactions in real time and
flag ones that look risky. A trained model that only exists as a
`.joblib` file on someone's laptop doesn't do that — it needs to be
wrapped in an API, containerized, kept running reliably, observed for
failure, and deployable without a human manually SSHing in and copying
files around. This project builds that surrounding system.

## 3. The story — how this was actually built

This is the real sequence, including the parts that didn't work on the
first try — those are usually the more interesting parts to talk about
in an interview than the parts that went smoothly.

**It started as a plain FastAPI app.** A `ModelService` class loading a
`fraud_pipeline.joblib` file at startup, one `/predict` endpoint, run
with `uvicorn` on a laptop. That's enough to prove a model works. It's
not enough to call it a system.

**Docker came next**, to make the environment reproducible — but the
first working container run raised the obvious next question: what
happens if this process dies at 2am? `docker-compose` added Prometheus
and Grafana alongside the API, which answered "is it running" but not
"will it restart itself."

**That's what pulled in Kubernetes** — specifically K3s, running inside
WSL2 on Windows, because a full multi-node cluster wasn't the point;
learning real orchestration patterns (Deployments, Services, probes,
self-healing) was. The first deployment attempt inside WSL2 hit an
immediate wall: `docker` wasn't found inside the Ubuntu shell even
though Docker Desktop was clearly running. The fix was WSL integration
being disabled for that specific distro in Docker Desktop's settings —
a small thing, but the kind of environment-configuration problem that
eats an afternoon if you don't know to look for it.

**Once the container built, two real bugs showed up during review, not
by accident — by walking through the manifests line by line:**

1. The Dockerfile created a non-root user with `--uid 10001`, but the
   Kubernetes `securityContext` specified `runAsUser: 1000`. Kubernetes'
   setting wins, which means the pod would have started as UID 1000
   trying to read files owned by UID 10001 — a permission-denied crash
   loop that would only show up once actually deployed, not in local
   `docker run` testing.
2. `livenessProbe` and `readinessProbe` were both pointed at
   `/api/v1/health`. Once local testing confirmed the app actually
   exposes a separate `/api/v1/ready` endpoint that reports
   `model_loaded: true`, it became clear the original setup meant
   Kubernetes could route traffic to a pod before its model finished
   loading — readiness and liveness were doing the same cheap check
   instead of the different jobs they're meant to do.

Both were fixed by comparing the actual Dockerfile and real
`/api/v1/ready` response against the Kubernetes manifests, rather than
assuming they matched.

**Local K3s testing then deliberately tried to break things**: deleting
a running pod to confirm Kubernetes replaced it automatically (it did —
`0/1 Running` to `1/1 Running` within seconds), and load-testing the
`/predict` endpoint to confirm Prometheus metrics
(`risk_predictions_total`, latency histograms) actually incremented
under real traffic.

**AWS came next, and the first real design decision was what *not* to
use.** EKS's control plane costs roughly $73/month before a single
worker node runs — for a project at this traffic scale, that's paying
for availability guarantees that aren't needed yet. The chosen
architecture instead: one EC2 `t4g.small` (Graviton/ARM, cheaper than
x86 for the same specs) running K3s, with Traefik (bundled with K3s)
handling TLS via Let's Encrypt instead of paying for an Application Load
Balancer, and no NAT Gateway at all (a single line item that alone runs
~$33/month if you're not careful). Total: **~$16-18/month**.

**CI/CD was built to avoid the most common AWS security mistake** —
long-lived access keys pasted into GitHub secrets. Instead, GitHub
Actions assumes an AWS IAM role via OIDC, scoped to this repository's
`main` branch specifically, so a compromised workflow in a fork can't
touch this AWS account. The pipeline builds for `arm64` (matching the
Graviton instance) using `buildx` and QEMU emulation on GitHub's x86
runners, scans the image with Trivy before it's allowed to ship, and
deploys via AWS Systems Manager `send-command` rather than SSH — no open
port 22 needed for automated deploys.

**Observability came last, and it exposed the project's own honesty
gap.** Building the alert rules (18 of them, covering everything from
"API is down" to "model accuracy below 70%") required checking what
metrics those rules actually depend on — three of them
(`RiskAPIDeploymentUnavailable`, `RiskAPIPodRestartingFrequently`,
`RiskAPIOOMKilled`) query `kube_state_metrics`-family metrics that
Prometheus doesn't produce by itself. Without deploying kube-state-metrics
separately, those three alerts would have silently never fired — not
errored, just quietly done nothing, which is worse than a visible
failure. It was added, scoped narrowly to just the two resource types
those alerts actually need (`deployments`, `pods`) rather than the full
default set kube-state-metrics watches out of the box.

**The same honesty check applies to the model itself.** The Prometheus
metrics for model accuracy, precision, and drift all currently read
`0.0` — not because the model is bad, but because no evaluation job has
ever run to populate them. That's documented as an open gap in
`docs/model.md` rather than glossed over, and the frontend's dashboard
deliberately labels those numbers as static demo placeholders rather
than presenting them as validated results.

**A frontend was added last** — a small dashboard (RiskGuard UI) for
submitting transactions and seeing the model's response, with a
Transactions page that persists every prediction to the browser and
supports CSV export, and a Model Monitor page that visually separates
"live serving activity" (computed from real local traffic) from
"offline evaluation metrics" (the placeholder numbers above) — the same
honesty principle applied to a UI decision, not just documentation.

## 4. What this demonstrates

- Full-stack ownership: model → API → container → orchestration →
  cloud → CI/CD → monitoring → frontend, not just one layer.
- Real debugging, not tutorial-following: two Kubernetes bugs caught by
  cross-checking manifests against actual application behavior, one
  environment issue (WSL2/Docker Desktop integration) resolved, one
  monitoring gap (kube-state-metrics) discovered by tracing what alert
  rules actually depend on.
- Deliberate cost engineering: specific, justified decisions to skip
  EKS, NAT Gateway, and ALB, with the dollar cost of each explained
  rather than just asserted.
- Security-conscious CI/CD: OIDC over static keys, SSM over open SSH,
  image scanning before deployment.
- Honesty about limitations: model evaluation gaps and single-node
  availability limits are documented as open items, not hidden.

## 5. What's next

See `docs/architecture.md` § 7-8 and `docs/model.md` § 6 for the
concrete, prioritized list — a scheduled model evaluation job, an ECR
token-refresh CronJob, and (if traffic ever justifies the cost) the
multi-AZ high-availability architecture.

## 6. Disclaimer

This is an educational and portfolio project. Predictions generated by
this system should not be used for real financial, credit, lending, or
fraud decisions without proper validation, governance, security
controls, and regulatory review.
