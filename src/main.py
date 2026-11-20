from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os
from sqlalchemy import text

from src.core.config import get_settings
from src.core.logger import get_logger, setup_logging
from src.core.database import init_db, get_session_maker
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

    # Enable CORS for frontend integration (supporting Vercel edge deployment & localhost)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Register API routes under /api/v1
    app.include_router(api_v1_router, prefix=settings.API_V1_STR)

    @app.get("/health", tags=["System"])
    async def health_check():
        """
        Health check endpoint for Docker containers, load balancers, and keep-alive cron.
        Queries database with 'SELECT 1' to keep Supabase projects continuously active.
        """
        db_status = "unconfigured"
        try:
            session_factory = get_session_maker()
            async with session_factory() as session:
                await session.execute(text("SELECT 1"))
                db_status = "connected"
        except Exception as e:
            db_status = f"error: {str(e)}"

        return {
            "status": "healthy",
            "service": settings.PROJECT_NAME,
            "environment": settings.APP_ENV,
            "database": db_status,
        }

    frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
    index_html = os.path.join(frontend_dist, "index.html")
    has_frontend = os.path.exists(frontend_dist) and os.path.exists(index_html)

    if has_frontend:
        assets_dir = os.path.join(frontend_dist, "assets")
        if os.path.exists(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", tags=["System"])
    async def root(request: Request):
        """Root API information or React Frontend Single Page Application."""
        accept = request.headers.get("accept", "")
        if has_frontend and "text/html" in accept:
            return FileResponse(index_html)
        return {
            "message": "ClauseGuard AI is operational. Visit /docs for interactive Swagger UI.",
            "docs": "/docs",
        }

    if has_frontend:
        # Fallback SPA handler for React client-side routing
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str):
            candidate = os.path.join(frontend_dist, full_path)
            if full_path and os.path.exists(candidate) and os.path.isfile(candidate):
                return FileResponse(candidate)
            return FileResponse(index_html)

    return app


app = create_application()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
