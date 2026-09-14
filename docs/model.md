# Machine Learning Model Documentation

## 1. Overview

The production artifact is a scikit-learn `RandomForestClassifier`
pipeline, serialized with joblib:

```
models/fraud_pipeline.joblib
```

Registered name/version in API responses: `fraud_pipeline` / `1.0.0`.

## 2. Loading lifecycle

The model is loaded **once**, at application startup, via FastAPI's
`lifespan` context manager in `app/main.py` — not per-request:

```
App startup
   |
   v
ModelService(model_path=settings.model_path)
   |
   v
model_service.load()
   |
   v
app.state.model_service  (available to all requests)
   |
   v
[serves requests until shutdown]
   |
   v
model_service.unload()  (on shutdown)
```

This is why `/api/v1/ready` exists separately from `/api/v1/health` —
readiness reflects whether `load()` actually completed successfully,
which liveness deliberately does not check (see `docs/api.md` § 3-4).

## 3. Inference

```
Request (JSON)
   |
   v
Pydantic schema validation
   |
   v
ModelService.predict(...)
   |
   v
fraud_probability (float), is_fraud (0 or 1)
   |
   v
JSON response
```

Confirmed real example: a transaction with `amount=111500.50`,
`device_risk_score=0.5`, `ip_risk_score=0.8` produced
`fraud_probability=0.6213`, `is_fraud=1` — average inference latency
across a small local test batch (3 requests) was ~225ms. That sample
size is far too small to be a real latency SLA claim; it's an observed
data point from initial testing, included here because it's genuinely
measured rather than invented.

## 4. Evaluation status — read this before quoting any metric

**This is the most important section in this file.** The application
exposes these Prometheus metrics:

```
model_accuracy
model_precision
model_recall
model_f1_score
model_evaluation_samples
model_prediction_drift
data_drift_score
feature_drift_score
```

As of this writing, **all of these read 0.0** — not because the model
performs at 0% accuracy, but because no scheduled evaluation job has
ever run to populate them. A metric reading `0.0` here means "no
evaluation has been reported," not "accuracy is zero." Do not present a
specific accuracy/precision/F1 number for this model anywhere (resume,
portfolio, documentation) until a real evaluation job has produced one —
the frontend's Model Monitor page deliberately labels its
Accuracy/Precision/Recall/F1 card as static demo placeholder data for
exactly this reason.

Alert rules already exist for when real values do start flowing
(`LowModelAccuracy`, `LowModelF1`, `ModelEvaluationStale`,
`ModelAccuracyMetricMissing` — see `monitoring/prometheus/alerts.yml`),
so the instrumentation and alerting *around* evaluation is real and
complete; only the evaluation job itself is missing.

## 5. Risk classification bands (as implemented in the frontend)

```
0.00 -------- 0.30   Low Risk    (safe)
0.30 -------- (isFraud=false)    Moderate Risk
is_fraud == 1                     High Risk / Fraud
```

The exact business threshold for `is_fraud` is determined by the trained
model's decision boundary, not a fixed probability cutoff configurable
from outside the model artifact.

## 6. What's needed to close the evaluation gap

1. A held-out, labeled evaluation dataset (separate from training data).
2. A scheduled job (cron, or a K8s `CronJob`) that runs the model against
   it and pushes results into the `model_*` Prometheus gauges.
3. A drift job comparing live feature/prediction distributions against
   the training-time distribution, populating `data_drift_score` /
   `model_prediction_drift`.

Both are legitimate next-phase work, separate from the deployment
engineering this repository currently demonstrates.

## 7. Future ML improvements

- Model registry (MLflow or similar) instead of a single `.joblib` file
- Automated retraining pipeline
- SHAP-based explainability for individual predictions
- A/B or shadow deployment for new model versions
