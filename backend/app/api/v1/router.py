"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1 import dashboard, data, features, health, prediction, research, training

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(dashboard.router)
api_router.include_router(data.router)
api_router.include_router(features.router)
api_router.include_router(training.router)
api_router.include_router(prediction.router)
api_router.include_router(research.router)
