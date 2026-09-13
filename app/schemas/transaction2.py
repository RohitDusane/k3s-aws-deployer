from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

TransactionType = Literal[
    "CASH_IN",
    "CASH_OUT",
    "DEBIT",
    "PAYMENT",
    "TRANSFER",
]


class TransactionRequest(BaseModel):
    """
    Input schema for fintech fraud-risk prediction.
    """

    model_config = ConfigDict(
        extra="forbid",
        str_strip_whitespace=True,
    )

    transaction_id: str = Field(
        ...,
        description="Unique transaction identifier",
        examples=["TX10001"],
    )

    user_id: str = Field(
        ...,
        description="Unique user identifier",
        examples=["USER001"],
    )

    amount: float = Field(
        ...,
        gt=0,
        description="Transaction amount",
        examples=[1500.50],
    )

    transaction_type: TransactionType = Field(
        ...,
        description="Transaction type",
        examples=["TRANSFER"],
    )

    merchant_category: str = Field(
        ...,
        description="Merchant category",
        examples=["electronics"],
    )

    country: str = Field(
        ...,
        description="Transaction country",
        examples=["US"],
    )

    hour: int = Field(
        ...,
        ge=0,
        le=23,
        description="Hour of transaction",
        examples=[14],
    )

    device_risk_score: float = Field(
        ...,
        ge=0,
        le=1,
        description="Device risk score",
        examples=[0.25],
    )

    ip_risk_score: float = Field(
        ...,
        ge=0,
        le=1,
        description="IP risk score",
        examples=[0.18],
    )


class PredictionResponse(BaseModel):
    """
    Output returned by the fraud prediction API.
    """

    is_fraud: int = Field(
        ...,
        description="1 if fraudulent, otherwise 0",
        examples=[0],
    )

    fraud_probability: float = Field(
        ...,
        ge=0,
        le=1,
        description="Probability of fraud",
        examples=[0.0234],
    )

    model_name: str = Field(
        ...,
        examples=["fraud_pipeline"],
    )
    model_version: str = Field(
        ...,
        examples=["1.0.0"],
    )


class HealthResponse(BaseModel):
    status: str


class ReadinessResponse(BaseModel):
    status: str
    model_loaded: bool
