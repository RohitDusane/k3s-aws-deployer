import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

configure_logging(settings.log_level)

logger = logging.getLogger(__name__)

logger.debug("APP_DIR=%s FRONTEND_DIR=%s css_exists=%s", APP_DIR, FRONTEND_DIR, (FRONTEND_DIR / "style.css").exists())


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
        "https://riskguard.abc-ops.co.in",
        # Same-origin requests (browser loading the frontend from this same
        # FastAPI app) don't need CORS at all — this list only matters if
        # something calls the API from a genuinely different origin
        # (a separate admin tool, a different subdomain, etc.). The old
        # localhost:3000/5173 entries were Vite/React dev-server ports this
        # project never used (the frontend is plain static HTML/JS) —
        # removed rather than left as an unexplained open door.
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

# Mounting at "/" already serves index.html for "/" itself (html=True) and
# every other static asset — a separate explicit @app.get("/") route below
# this would be unreachable dead code, since this Mount, once matched,
# never falls through to routes registered after it. Removed for that
# reason, not just for tidiness.
app.mount(
    "/",
    StaticFiles(directory=FRONTEND_DIR, html=True),
    name="frontend",
)
