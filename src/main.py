from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from src.core.config import get_settings
from src.core.logger import get_logger, setup_logging
from src.core.database import init_db
from src.api.routes import router as api_v1_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle management."""
    settings = get_settings()
    setup_logging(level="DEBUG" if settings.DEBUG else "INFO", json_format=True)
    await init_db()
    logger.info(
        "ClauseGuard AI API microservice starting up",
        extra={"env": settings.APP_ENV, "qdrant_mode": settings.QDRANT_MODE, "redis_mode": settings.REDIS_MODE}
    )
    yield
    logger.info("ClauseGuard AI API microservice shutting down")


def create_application() -> FastAPI:
    """FastAPI application factory."""
    settings = get_settings()

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        description="Autonomous Legal Contract Risk Intelligence Microservice.",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Enable CORS for frontend integration
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routes under /api/v1
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    @app.get("/health", tags=["System"])
    async def health_check():
        """Health check endpoint for Docker container orchestrators and load balancers."""
        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "environment": settings.APP_ENV,
        }

    @app.get("/", tags=["System"])
    async def root():
        """Root API information."""
        return {
            "message": "ClauseGuard AI is operational. Visit /docs for interactive Swagger UI.",
            "docs": "/docs",
        }

    # Mount frontend static distribution if built
    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
    if os.path.exists(frontend_dist) and os.path.exists(os.path.join(frontend_dist, "index.html")):
        from fastapi.staticfiles import StaticFiles
        app.mount("/app", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app


app = create_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
