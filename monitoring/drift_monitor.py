import numpy as np
from app.metrics import (MODEL_PREDICTION_DRIFT, MODEL_PREDICTION_DRIFT_STATUS)

def calculate_psi(expected, actual, bins=10):

    expected = np.asarray(expected, dtype=float)
    actual = np.asarray(actual, dtype=float)

    expected = expected[np.isfinite(expected)]
    actual = actual[np.isfinite(actual)]

    expected = np.clip(expected, 0, 1)
    actual = np.clip(actual, 0, 1)

    breakpoints = np.linspace(0, 1, bins + 1)

    expected_counts, _ = np.histogram(
        expected,
        bins=breakpoints
    )

    actual_counts, _ = np.histogram(
        actual,
        bins=breakpoints
    )

    expected_pct = expected_counts / max(expected_counts.sum(), 1)
    actual_pct = actual_counts / max(actual_counts.sum(), 1)

    expected_pct = np.clip(
        expected_pct,
        0.0001,
        None
    )

    actual_pct = np.clip(
        actual_pct,
        0.0001,
        None
    )

    psi = np.sum(
        (actual_pct - expected_pct)
        * np.log(actual_pct / expected_pct)
    )

    return float(psi)


def update_prediction_drift(
    reference_predictions,
    current_predictions,
):
    psi = calculate_psi(
        reference_predictions,
        current_predictions,
    )

    MODEL_PREDICTION_DRIFT.set(psi)

    if psi < 0.10:
        status = 0
    elif psi < 0.25:
        status = 1
    else:
        status = 2
    MODEL_PREDICTION_DRIFT_STATUS.set(status)
    return psi