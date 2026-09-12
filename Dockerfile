# syntax=docker/dockerfile:1

# ============================================================
# Stage 1: Build dependencies
# ============================================================
FROM python:3.12-slim-trixie AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

# Build tools — needed only if a dependency has no prebuilt wheel for the
# target architecture (this bites you specifically on arm64/Graviton).
# Stays in this stage only; never copied into the runtime image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv

COPY requirements-serving.txt .

RUN /opt/venv/bin/pip install --no-cache-dir -r requirements-serving.txt

# pip is needed to build/install dependencies, but not to run the application.
RUN rm -rf \
    /opt/venv/bin/pip \
    /opt/venv/bin/pip3 \
    /opt/venv/bin/pip3.12 \
    /opt/venv/lib/python3.12/site-packages/pip \
    /opt/venv/lib/python3.12/site-packages/pip-*.dist-info

# ============================================================
# Stage 2: Runtime
# ============================================================
FROM python:3.12-slim-trixie AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

COPY app/ /app/
COPY models/ /app/models/


# Non-root user — UID 10001 must match runAsUser in k8s/deploy.yaml exactly,
# or Kubernetes' securityContext will override this and you'll get
# permission-denied errors reading /app at pod startup.
RUN useradd --create-home --uid 10001 appuser && \
    chown -R appuser:appuser /app

USER appuser

EXPOSE 8000

# Container-level healthcheck — used by `docker run` and docker-compose.
# Kubernetes ignores this and uses the probes in deploy.yaml instead, but
# it's what makes `docker ps` and compose show real health status locally.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]