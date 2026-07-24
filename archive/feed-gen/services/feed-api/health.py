"""Health check endpoint for feed-api service."""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from database import get_db

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Check database connection
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "status": "healthy",
                "service": "feed-api",
                "database": "connected"
            }
        )
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "feed-api",
                "error": str(e)
            }
        )
