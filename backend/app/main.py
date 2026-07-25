"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.db.session import AsyncSessionLocal
from app.repositories import StockRepository, TrainingRepository
from app.services.etl_service import EtlService

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    setup_logging("DEBUG" if settings.debug else "INFO")
    Path(settings.models_dir).mkdir(parents=True, exist_ok=True)
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)

    try:
        async with AsyncSessionLocal() as session:
            orphaned = await TrainingRepository(session).fail_orphaned_jobs()
            if orphaned:
                await session.commit()
                logger.warning(
                    "Marked orphaned training job(s) as failed after restart: %s",
                    orphaned,
                )

            count = await StockRepository(session).count()
            if count == 0:
                logger.info("No stocks found — running automatic dataset import")
                result = await EtlService(session).import_dataset(force=False)
                logger.info("Auto-import complete: %s", result)
            else:
                logger.info("Dataset present (%d stocks)", count)
    except Exception:
        logger.exception("Startup housekeeping skipped due to error")

    yield
    logger.info("Shutting down API")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix=settings.api_prefix)
    return app


app = create_app()
