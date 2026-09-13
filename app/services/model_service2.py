from pathlib import Path
from typing import Any

import joblib
import pandas as pd


class ModelService:
    """
    Handles loading and inference for the fraud detection model.
    """

    def __init__(self, model_path: str):
        self.model_path = Path(model_path)
        self.model: Any | None = None

    def load(self) -> None:
        """
        Load the trained model from disk.

        IMPORTANT:
        The joblib artifact must come from a trusted source.
        """
        if not self.model_path.exists():
            raise FileNotFoundError(f"Model file not found: {self.model_path}")

        # IMPORTANT:
        # Only load trusted model artifacts.
        self.model = joblib.load(self.model_path)

        # Validate model interface during startup.
        if not hasattr(self.model, "predict"):
            raise TypeError("Loaded model does not implement predict()")

        if not hasattr(self.model, "predict_proba"):
            raise TypeError("Loaded model does not implement predict_proba()")

    def unload(self) -> None:
        self.model = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def predict(self, data: dict[str, Any]) -> tuple[int, float]:
        """
        Run inference against the loaded model.
        """
        if self.model is None:
            raise RuntimeError("ML model is not loaded")

        input_data = pd.DataFrame([data])
        prediction = int(self.model.predict(input_data)[0])

        if not hasattr(self.model, "predict_proba"):
            raise RuntimeError("Loaded model does not support probability prediction")

        probabilities = self.model.predict_proba(input_data)[0]

        classes = list(self.model.classes_)

        if 1 not in classes:
            raise RuntimeError("Fraud class '1' was not found in model classes")

        fraud_index = classes.index(1)
        fraud_probability = float(probabilities[fraud_index])

        return prediction, fraud_probability
