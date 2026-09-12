import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from prometheus_fastapi_instrumentator import Instrumentator

from app.api.routes import router
from app.core.config import settings
from app.core.logging import configure_logging
from app.services.model_service import ModelService

# =====================================================
# PATHS
# =====================================================
APP_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = APP_DIR / "frontend"

print("APP_DIR =", APP_DIR)
print("FRONTEND_DIR =", FRONTEND_DIR)
print("CSS EXISTS =", (FRONTEND_DIR / "style.css").exists())


configure_logging(settings.log_level)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup/shutdown lifecycle.

    Startup:
        - Create model service
        - Load ML model
        - Make it available to API routes

    Shutdown:
        - Release model resources
    """
    logger.info(
        "Starting %s v%s",
        settings.app_name,
        settings.app_version,
    )

    logger.info(
        "Loading model: %s",
        settings.model_path,
    )

    model_service = ModelService(model_path=settings.model_path)
    try:
        model_service.load()
    except Exception:
        logger.exception("Failed to load ML model")
        raise

    app.state.model_service = model_service
    logger.info("ML model loaded successfully: %s", settings.model_name)

    yield
    logger.info("Shutting down application")

    model_service.unload()
    logger.info("ML model unloaded")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=("Production-oriented REST API for " "financial transaction fraud-risk scoring."),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
Instrumentator().instrument(app).expose(
    app,
    endpoint="/metrics",
)


# API routes
app.include_router(
    router,
    prefix=settings.api_prefix,
)


# =====================================================
# FRONTEND STATIC FILES
# =====================================================
# app.mount(
#     "/static",
#     StaticFiles(directory=FRONTEND_DIR),
#     name="static",
# )

app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend",
)


# =====================================================
# FRONTEND HOME PAGE
# =====================================================
@app.get("/", include_in_schema=False)
def frontend():
    return FileResponse(FRONTEND_DIR / "index.html")
