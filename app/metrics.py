from prometheus_client import Counter, Gauge, Histogram

# ============================================================
# MODEL PREDICTIONS
# ============================================================
PREDICTIONS_TOTAL = Counter(
    "risk_predictions_total",
    "Total number of risk predictions",
    ["model_name", "model_version"],
)

PREDICTION_RESULTS_TOTAL = Counter(
    "risk_prediction_results_total",
    "Total number of predictions by fraud result",
    ["model_name", "model_version", "result"],
)

PREDICTION_ERRORS_TOTAL = Counter(
    "risk_prediction_errors_total",
    "Total number of ML prediction errors",
    ["model_name", "model_version"],
)

PREDICTION_LATENCY = Histogram(
    "risk_prediction_latency_seconds",
    "ML model inference latency in seconds",
    ["model_name", "model_version"],
)

MODEL_INFO = Gauge(
    "risk_model_info",
    "Information about the loaded ML model",
    ["model_name", "model_version"],
)

# ============================================================
# FRAUD RISK
# ============================================================
HIGH_RISK_THRESHOLD = 0.80

HIGH_RISK_PREDICTIONS_TOTAL = Counter(
    "high_risk_predictions_total",
    "Number of high-risk fraud predictions",
)

FRAUD_PROBABILITY = Histogram(
    "fraud_probability",
    "Distribution of fraud prediction probabilities",
    buckets=[
        0.0,
        0.1,
        0.2,
        0.3,
        0.4,
        0.5,
        0.6,
        0.7,
        0.8,
        0.9,
        1.0,
    ],
)

HIGH_RISK_RATE = Gauge(
    "high_risk_rate",
    "Current percentage of predictions classified as high risk",
    ["model_name", "model_version"],
)

# ============================================================
# DRIFT MONITORING
# ============================================================
MODEL_PREDICTION_DRIFT = Gauge(
    "model_prediction_drift",
    "Population Stability Index for model predictions",
)

DATA_DRIFT_SCORE = Gauge(
    "data_drift_score",
    "Overall data drift score",
)

FEATURE_DRIFT_SCORE = Gauge(
    "feature_drift_score",
    "Feature drift score",
    ["feature"],
)

MODEL_PREDICTION_DRIFT_STATUS = Gauge(
    "model_prediction_drift_status",
    "Prediction drift status: 0=normal, 1=moderate, 2=significant",
)

# ============================================================
# AUTOMATED MODEL EVALUATION
# ============================================================
MODEL_ACCURACY = Gauge(
    "model_accuracy",
    "Model accuracy based on latest labeled evaluation",
)

MODEL_PRECISION = Gauge(
    "model_precision",
    "Model precision based on latest labeled evaluation",
)

MODEL_RECALL = Gauge(
    "model_recall",
    "Model recall based on latest labeled evaluation",
)

MODEL_F1_SCORE = Gauge(
    "model_f1_score",
    "Model F1 score based on latest labeled evaluation",
)

MODEL_EVALUATION_SAMPLES = Gauge(
    "model_evaluation_samples",
    "Number of samples used in latest model evaluation",
)

MODEL_EVALUATION_TIMESTAMP = Gauge(
    "model_evaluation_timestamp",
    "Unix timestamp of latest model evaluation",
)
