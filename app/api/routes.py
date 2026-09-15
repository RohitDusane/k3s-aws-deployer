import logging
import time
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import settings
from app.core.security import verify_api_key
from app.metrics import (
    FRAUD_PROBABILITY,
    HIGH_RISK_PREDICTIONS_TOTAL,
    PREDICTION_ERRORS_TOTAL,
    PREDICTION_LATENCY,
    PREDICTION_RESULTS_TOTAL,
    PREDICTIONS_TOTAL,
)
from app.schemas.transaction2 import (
    HealthResponse,
    PredictionResponse,
    ReadinessResponse,
    TransactionRequest,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Application health check",
)
def health() -> HealthResponse:
    """
    Liveness endpoint.

    Used by Kubernetes/load balancers to determine whether
    the application process is alive.
    """
    return HealthResponse(status="healthy")


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Application readiness check",
)
def readiness(request: Request) -> ReadinessResponse:
    """
    Readiness endpoint.

    Returns whether the ML model has been successfully loaded.
    """
    model_service = request.app.state.model_service

    if not model_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model is not loaded",
        )

    return ReadinessResponse(
        status="ready",
        model_loaded=True,
    )


@router.get(
    "/",
    summary="API information",
)
def root() -> dict:
    return {
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
    }


@router.post(
    "/predict",
    # dependencies=[Depends(verify_api_key)],
    response_model=PredictionResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict fraud risk",
)
def predict(
    payload: TransactionRequest,
    request: Request,
) -> PredictionResponse:
    model_service = request.app.state.model_service

    if not model_service.is_loaded:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model is not available",
        )

    input_data = {
        "transaction_id": payload.transaction_id,
        "user_id": payload.user_id,
        "amount": payload.amount,
        "transaction_type": payload.transaction_type,
        "merchant_category": payload.merchant_category,
        "country": payload.country,
        "hour": payload.hour,
        "device_risk_score": payload.device_risk_score,
        "ip_risk_score": payload.ip_risk_score,
    }

    model_name = settings.model_name
    model_version = settings.model_version

    start_time = time.perf_counter()

    try:
        # -----------------------------
        # ML MODEL INFERENCE
        # -----------------------------
        prediction, probability = model_service.predict(input_data)
        # Make sure probability is a normal float
        probability = float(probability)

        # -----------------------------
        # TOTAL PREDICTION COUNTER
        # -----------------------------
        PREDICTIONS_TOTAL.labels(
            model_name=model_name,
            model_version=model_version,
        ).inc()

        # -----------------------------
        # FRAUD PROBABILITY
        # -----------------------------
        FRAUD_PROBABILITY.observe(probability)

        # -----------------------------
        # PREDICTION RESULT
        # -----------------------------
        result = "fraud" if prediction == 1 else "non_fraud"

        PREDICTION_RESULTS_TOTAL.labels(
            model_name=model_name,
            model_version=model_version,
            result=result,
        ).inc()

        # =====================================================
        # HIGH-RISK PREDICTIONS
        # =====================================================
        HIGH_RISK_THRESHOLD = 0.80

        if probability >= HIGH_RISK_THRESHOLD:
            HIGH_RISK_PREDICTIONS_TOTAL.inc()

    except Exception as err:
        # -----------------------------
        # PREDICTION ERROR
        # -----------------------------
        PREDICTION_ERRORS_TOTAL.labels(
            model_name=model_name,
            model_version=model_version,
        ).inc()

        logger.exception("Model inference failed")

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Model inference failed",
        ) from err
    finally:
        # -----------------------------
        # INFERENCE LATENCY
        # -----------------------------
        PREDICTION_LATENCY.labels(
            model_name=model_name,
            model_version=model_version,
        ).observe(time.perf_counter() - start_time)

    return PredictionResponse(
        is_fraud=prediction,
        fraud_probability=probability,
        model_name=model_name,
        model_version=model_version,
    )

@router.get(
    "/model/metrics",
    summary="Latest offline evaluation metrics",
)
def model_metrics() -> dict:
    """
    Returns the most recent offline evaluation run (accuracy, precision,
    recall, F1, ROC-AUC), produced by `python -m src.evaluate`.

    Distinct from the Prometheus /metrics endpoint, which reflects live
    serving volume, not evaluated model quality.
    """
    metrics_path = Path(settings.metrics_path)

    if not metrics_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No evaluation run found yet.",
        )

    with metrics_path.open() as f:
        summary = json.load(f)

    return {
        "evaluated_at": summary.get("evaluated_at"),
        "metrics": summary.get("headline_metrics", {}),
    }
