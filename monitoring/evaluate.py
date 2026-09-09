from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
)

from app.metrics import (
    MODEL_ACCURACY,
    MODEL_PRECISION,
    MODEL_RECALL,
    MODEL_F1_SCORE,
    MODEL_EVALUATION_SAMPLES,
    MODEL_EVALUATION_TIMESTAMP,
)

import time


def evaluate_model(
    y_true,
    y_pred,
):
    accuracy = accuracy_score(
        y_true,
        y_pred,
    )

    precision = precision_score(
        y_true,
        y_pred,
        zero_division=0,
    )

    recall = recall_score(
        y_true,
        y_pred,
        zero_division=0,
    )

    f1 = f1_score(
        y_true,
        y_pred,
        zero_division=0,
    )

    MODEL_ACCURACY.set(accuracy)
    MODEL_PRECISION.set(precision)
    MODEL_RECALL.set(recall)
    MODEL_F1_SCORE.set(f1)
    MODEL_EVALUATION_SAMPLES.set(len(y_true))
    MODEL_EVALUATION_TIMESTAMP.set(time.time())

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "samples": len(y_true),
    }
