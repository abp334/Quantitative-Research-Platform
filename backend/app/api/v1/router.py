"""API v1 router aggregation."""

from fastapi import APIRouter

from app.api.v1 import data, forecast, health

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(data.router)
api_router.include_router(forecast.router)
