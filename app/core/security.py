from fastapi import Header, HTTPException, status

from app.core.config import settings


async def verify_api_key(x_api_key: str = Header(default="")) -> None:
    """
    Dependency for routes that require an API key.
    Compares against settings.api_key (populated from the API_KEY env var,
    which comes from the `api-auth` Secret in Kubernetes — see
    k8s/deploy.yaml and the kubectl create secret command below).
    """
    if not settings.api_key:
        # Fail loudly if the key was never configured, rather than silently
        # accepting every request — a misconfigured deployment should be
        # obvious, not "accidentally open".
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API_KEY is not configured on the server.",
        )

    if x_api_key != settings.api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid API key.",
        )