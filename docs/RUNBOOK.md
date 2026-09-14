# Risk MLOps — Complete Deployment Runbook
### WSL2/K3s (local) → AWS (production), cost-optimized

This assumes you're working through this top to bottom in order. Every AWS
step gives you **Manual (Console)** and **CLI** — pick whichever you're
more comfortable with; you don't need to do both.

Region used throughout: **ap-south-1** (Mumbai). Swap it everywhere if you
pick a different one.

---

## Phase 0 — Confirm local WSL2/K3s still works (do this first, every time)

Don't build on top of a cluster you haven't just re-verified. Five minutes now
saves an hour of debugging "is this an AWS problem or was it already broken."

```bash
# From WSL2 Ubuntu
sudo k3s kubectl get nodes                          # should show Ready
sudo k3s kubectl -n risk-mlops get pods              # should show your pods 1/1 Running

sudo k3s kubectl -n risk-mlops port-forward svc/risk-mlops-api 8888:8000 &
curl http://localhost:8888/api/v1/health             # {"status":"healthy"}
curl http://localhost:8888/api/v1/ready               # {"status":"ready","model_loaded":true}

curl -s -X POST http://localhost:8888/api/v1/predict \
  -H "Content-Type: application/json" \
  -d '{"transaction_id":"TX_SMOKE","user_id":"USER_SMOKE","amount":100.0,
       "transaction_type":"TRANSFER","merchant_category":"electronics",
       "country":"US","hour":14,"device_risk_score":0.5,"ip_risk_score":0.5}'

kubectl delete pod -n risk-mlops -l app.kubernetes.io/name=risk-mlops-api --field-selector=status.phase=Running -o name | head -1 | xargs kubectl delete
# watch it come back:
kubectl -n risk-mlops get pods -w
```

If all of that works, you're building on solid ground. Kill the
port-forward (`kill %1`) before moving on.

---

## Phase 1 — AWS account foundation

### 1.1 Billing alarm (do this before anything else can generate a bill)

**Manual:** Billing console → Budgets → Create budget → Cost budget →
$10-15/month → Alert at 80%.

**CLI:**
```bash
aws budgets create-budget --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{"BudgetName":"risk-mlops-monthly","BudgetLimit":{"Amount":"15","Unit":"USD"},"TimeUnit":"MONTHLY","BudgetType":"COST"}' \
  --notifications-with-subscribers '[{"Notification":{"NotificationType":"ACTUAL","ComparisonOperator":"GREATER_THAN","Threshold":80},"Subscribers":[{"SubscriptionType":"EMAIL","Address":"you@example.com"}]}]'
```

### 1.2 ECR repository

**Manual:** ECR console → Create repository → name `risk-mlops-api` → private → Create.

**CLI:**
```bash
aws ecr create-repository --repository-name risk-mlops-api --region ap-south-1
```
Save the `repositoryUri` it returns — you'll need it in Phase 3.

### 1.3 GitHub Actions OIDC role (lets CI push/deploy with no stored AWS keys)

**Manual:**
1. IAM → Identity providers → Add provider → OpenID Connect
   - Provider URL: `https://token.actions.githubusercontent.com`
   - Audience: `sts.amazonaws.com`
2. IAM → Roles → Create role → Web identity → select the provider above
   - Condition: restrict to `repo:<your-org>/<your-repo>:ref:refs/heads/main`
3. Attach an inline policy granting: `ecr:GetAuthorizationToken`,
   `ecr:BatchCheckLayerAvailability`, `ecr:PutImage`, `ecr:InitiateLayerUpload`,
   `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ssm:SendCommand`,
   `ssm:GetCommandInvocation`, `ssm:ListCommandInvocations`.
4. Copy the role ARN.

**CLI:** (trust policy as a file first)
```bash
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {"Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"},
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {"StringEquals": {"token.actions.githubusercontent.com:sub": "repo:<your-org>/<your-repo>:ref:refs/heads/main"}}
  }]
}
EOF

aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

aws iam create-role --role-name risk-mlops-github-actions --assume-role-policy-document file://trust-policy.json
# attach the permissions above via `aws iam put-role-policy` with a policy JSON of your own
```

**GitHub side:** repo Settings → Secrets and variables → Actions → Variables
→ add `AWS_DEPLOY_ROLE_ARN` = the role ARN.

---

## Phase 2 — EC2 instance + K3s

### 2.1 Launch the instance

**Manual:** EC2 console → Launch instance
- AMI: Amazon Linux 2023 (arm64)
- Instance type: `t4g.small`
- Key pair: create/select one
- Network: default VPC, a **public** subnet (no NAT Gateway anywhere in this setup)
- Storage: 30GB gp3
- IAM instance profile: create one with `AmazonSSMManagedInstanceCore` + an
  inline ECR pull policy (`ecr:GetAuthorizationToken`, `ecr:BatchGetImage`,
  `ecr:GetDownloadUrlForLayer`)
- Security group: inbound 22 (your IP only), 80, 443 (0.0.0.0/0)
- **Tag:** `Name = risk-mlops-node` — your CI's SSM deploy step targets this exact tag

**CLI:**
```bash
aws ec2 run-instances \
  --image-id ami-0xxxxxxxx \
  --instance-type t4g.small \
  --key-name your-keypair \
  --iam-instance-profile Name=risk-mlops-instance-profile \
  --security-group-ids sg-xxxxxxxx \
  --subnet-id subnet-xxxxxxxx \
  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=risk-mlops-node}]' \
  --region ap-south-1
```

### 2.2 Elastic IP

**Manual:** EC2 → Elastic IPs → Allocate → Associate with the instance.

**CLI:**
```bash
ALLOC_ID=$(aws ec2 allocate-address --domain vpc --query AllocationId --output text)
aws ec2 associate-address --instance-id <instance-id> --allocation-id $ALLOC_ID
```

### 2.3 Install K3s

SSH in once (`ssh -i your-key.pem ec2-user@<elastic-ip>`), then:
```bash
curl -sfL https://get.k3s.io | sh -
sudo k3s kubectl get nodes
```

---

## Phase 3 — Get your image into ECR

### 3.1 Manual push (do this once to prove it works before trusting CI with it)

```bash
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.ap-south-1.amazonaws.com

docker buildx create --use --name multiarch-builder
docker buildx build --platform linux/arm64 \
  -t <account-id>.dkr.ecr.ap-south-1.amazonaws.com/risk-mlops-api:1.0.0 \
  --push .
```

### 3.2 Automated push (already built — `.github/workflows/ci.yml` in the deliverables zip)

Merge to `main` and watch the Actions tab. It lints, tests, validates the
k8s manifests, builds arm64, Trivy-scans, pushes to ECR, then SSMs into the
instance to roll out the new image. Nothing manual needed here once
`AWS_DEPLOY_ROLE_ARN` is set (Phase 1.3).

---

## Phase 4 — Deploy the application manifests

All files referenced below are in the deliverables zip's `k8s/` folder.
Copy the whole `k8s/` folder to the instance (`scp -r k8s ec2-user@<ip>:~/`)
or clone your repo there.

```bash
# Update this one field first: image: in deploy.yaml -> your ECR URI
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# ECR pull secret (12h token — see Phase 7.2 for the permanent fix)
kubectl create secret docker-registry ecr-pull-secret \
  --docker-server=<account-id>.dkr.ecr.ap-south-1.amazonaws.com \
  --docker-username=AWS \
  --docker-password=$(aws ecr get-login-password --region ap-south-1) \
  -n risk-mlops

kubectl apply -f k8s/deploy.yaml
kubectl apply -f k8s/service.yaml   # includes the Traefik Ingress

kubectl -n risk-mlops get pods -w   # wait for 2/2... err, 1/1 x2 Running
```

**Verify exactly like Phase 0, but from outside the VPC now:**
```bash
curl http://<elastic-ip-or-domain>/api/v1/health
curl http://<elastic-ip-or-domain>/api/v1/ready
```

---

## Phase 5 — Deploy the monitoring stack

Apply order matters here — kube-state-metrics and Alertmanager first, so
Prometheus doesn't come up scraping nothing:

```bash
kubectl apply -f k8s/monitoring-kube-state-metrics.yaml

# Grafana admin password — never commit this
kubectl create secret generic grafana-admin \
  --from-literal=password='<pick-a-real-password>' -n risk-mlops

# Alertmanager — fill the template first (see monitoring/alertmanager/alertmanager.yml.template)
kubectl create secret generic alertmanager-config \
  --from-file=alertmanager.yml=./monitoring/alertmanager/alertmanager.yml \
  -n risk-mlops
kubectl apply -f k8s/monitoring-alertmanager.yaml

kubectl apply -f k8s/monitoring-prometheus-config.yaml
kubectl apply -f k8s/monitoring-prometheus.yaml

kubectl create configmap grafana-dashboard-files \
  --from-file=./monitoring/grafana/dashboards -n risk-mlops
kubectl apply -f k8s/monitoring-grafana-datasource.yaml
kubectl apply -f k8s/monitoring-grafana-dashboard-provider.yaml
kubectl apply -f k8s/monitoring-grafana.yaml

kubectl -n risk-mlops get pods   # everything 1/1 Running
```

---

## Phase 6 — Full production test pass

Repeat every test from Phase 0, now against the public endpoint, plus the
monitoring-specific checks:

| Test | Command | Expect |
|---|---|---|
| Health/ready | `curl http://<domain>/api/v1/health` and `/ready` | 200, `model_loaded: true` |
| Prediction | same POST as Phase 0, against `<domain>/api/v1/predict` | 200 with `fraud_probability` |
| Self-healing | delete one pod, watch it recover | back to 2/2 Running within seconds |
| Load test | `locust -f tests/locustfile.py --host http://<domain> --headless -u 20 -r 5 -t 1m` | no failed requests, latency reasonable |
| Prometheus scraping | port-forward 9090, check Status → Targets | `risk-mlops-api` and `kube-state-metrics` both UP |
| Alert rules loaded | Prometheus → Alerts tab | all 18 rules listed |
| Grafana dashboards | port-forward 3000 or `/grafana` via Ingress, log in | dashboards under "MLOps" folder show live data |
| Real alert fires | `kubectl scale deployment/risk-mlops-api --replicas=0 -n risk-mlops`, wait 2-3 min | Slack message in your configured channel; scale back to 2 and confirm a "resolved" message |

---

## Phase 7 — What's still not "done" (be honest about these)

1. **Single node, no HA.** True high availability needs an ASG + ALB across
   multiple AZs — roughly doubles the monthly cost. Fine for a portfolio
   project or early-stage product; know the upgrade path before you need it
   under real load.
2. **ECR pull secret expires every 12 hours.** Existing running pods are
   unaffected, but the next `kubectl set image` or pod restart after
   expiry will fail with `ImagePullBackOff`. Fix: a `CronJob` in-cluster
   that refreshes the secret every ~10h using the instance's IAM role — ask
   if you want this manifest built next.
3. **Model-quality metrics are still zero.** `model_accuracy`,
   `model_prediction_drift`, etc. read 0.0 because no evaluation job has
   ever populated them — this is a real gap, not evidence the model is
   bad. A scheduled evaluation job against labeled data is a separate
   project phase from everything in this runbook.
4. **Alertmanager is single-instance.** Fine at this scale; real HA needs
   peer clustering (multiple replicas that gossip), not just more pods.

---

## Cost recap (ap-south-1, on-demand, no free-tier credit applied)

| Item | ~Monthly |
|---|---|
| EC2 t4g.small (24/7) | $12 |
| EBS 30GB gp3 | $2.50 |
| ECR + S3 storage | <$0.50 |
| Data transfer out | $1-3 |
| **Total** | **~$16-18/month** |

No ALB, no NAT Gateway, no RDS — those are the three line items that would
each add $15-35/month for capability this project doesn't need yet.
