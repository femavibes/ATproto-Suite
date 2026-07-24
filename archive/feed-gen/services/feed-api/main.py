"""Main entry point for feed-api service."""

import uvicorn
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from auth_routes import router as auth_router
from config import SERVICE_NAME, HOST, PORT, cors_allow_origins, ui_static_dir
from database import init_db, close_db
from feed import router as feed_router
from health import router as health_router
from oauth_client import router as oauth_client_router
from projects import router as projects_router
from setup_routes import router as setup_router
from startup_migrations import run_startup_migrations
from well_known import router as well_known_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup/shutdown."""
    # Startup
    applied = await run_startup_migrations()
    if applied:
        print(f"startup migrations complete: applied={applied}")
    await init_db()
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title=SERVICE_NAME,
    lifespan=lifespan
)

_origins = cors_allow_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health_router)
app.include_router(feed_router)
app.include_router(auth_router)
app.include_router(oauth_client_router)
app.include_router(projects_router)
app.include_router(setup_router)
app.include_router(well_known_router)


_ui_root = ui_static_dir()


def _safe_file_under(root: Path, rel: str) -> Optional[Path]:
    if not rel or rel.startswith(("/", "\\")):
        return None
    parts = rel.replace("\\", "/").split("/")
    if ".." in parts:
        return None
    candidate = (root.joinpath(*parts)).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


if _ui_root is not None:
    _assets = _ui_root / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="ui_assets")

    @app.get("/")
    async def root_ui():
        return FileResponse(_ui_root / "index.html")

    @app.get("/setup", include_in_schema=False)
    async def setup_ui():
        return RedirectResponse(url="/api/setup/page")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def root_ui_spa(full_path: str):
        f = _safe_file_under(_ui_root, full_path)
        if f is not None:
            return FileResponse(f)
        return FileResponse(_ui_root / "index.html")
else:

    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "service": SERVICE_NAME,
            "status": "running",
            "endpoints": {
                "health": "/health",
                "feed_skeleton": "/xrpc/app.bsky.feed.getFeedSkeleton",
                "did_document": "/.well-known/did.json",
            }
        }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=True
    )
