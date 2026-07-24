"""Configuration for feed-api service."""

import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

# Database configuration
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://feedgen:feedgen@postgres:5432/feedgen"
)

# Redis configuration (optional)
REDIS_URL: Optional[str] = os.getenv("REDIS_URL", "redis://redis:6379/0")

# Service configuration
SERVICE_NAME: str = "feed-api"
HOST: str = os.getenv("HOST", "0.0.0.0")
PORT: int = int(os.getenv("PORT", "8000"))

# Health check
HEALTH_CHECK_PATH: str = "/health"

# Public URL users open in browser. Single-source default for self-hosted Docker.
# Advanced users can still override APP_PUBLIC_ORIGIN / PUBLIC_BASE_URL directly.
PUBLIC_URL: Optional[str] = os.getenv("PUBLIC_URL", "").strip() or None
if PUBLIC_URL:
    PUBLIC_URL = PUBLIC_URL.rstrip("/")

# Public HTTPS origin of feed-api (used for did:web at /.well-known/did.json).
PUBLIC_BASE_URL: Optional[str] = os.getenv("PUBLIC_BASE_URL", "").strip() or None
if not PUBLIC_BASE_URL and PUBLIC_URL:
    PUBLIC_BASE_URL = PUBLIC_URL
if PUBLIC_BASE_URL:
    PUBLIC_BASE_URL = PUBLIC_BASE_URL.rstrip("/")

# Browser-facing origin for OAuth client metadata.
APP_PUBLIC_ORIGIN: Optional[str] = os.getenv("APP_PUBLIC_ORIGIN", "").strip() or None
if not APP_PUBLIC_ORIGIN and PUBLIC_URL:
    APP_PUBLIC_ORIGIN = PUBLIC_URL
if APP_PUBLIC_ORIGIN:
    APP_PUBLIC_ORIGIN = APP_PUBLIC_ORIGIN.rstrip("/")

# Signed session cookie after Bluesky OAuth (HS256).
SESSION_SECRET: str = os.getenv("SESSION_SECRET", "change-me-in-production")
SESSION_COOKIE_MAX_AGE: int = int(os.getenv("SESSION_COOKIE_MAX_AGE", str(7 * 24 * 3600)))
# Set false for plain HTTP local dev (cookies won't be Secure).
FORCE_SECURE_COOKIES: bool = os.getenv("FORCE_SECURE_COOKIES", "false").lower() in (
    "1",
    "true",
    "yes",
)

# Optional beta lock: only this Bluesky handle can log in.
OWNER_HANDLE: Optional[str] = os.getenv("OWNER_HANDLE", "").strip().lstrip("@").lower() or None
ALLOWED_HANDLES_RAW: str = os.getenv("ALLOWED_HANDLES", "").strip()
ALLOWED_HANDLES: list[str] = [h.strip().lstrip("@").lower() for h in ALLOWED_HANDLES_RAW.split(",") if h.strip()]
HOSTED_MODE: bool = os.getenv("HOSTED_MODE", "true").lower() in ("1", "true", "yes")
LOCAL_BETA_MODE: bool = os.getenv("LOCAL_BETA_MODE", "false").lower() in ("1", "true", "yes")


def cors_allow_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", "").strip()
    if raw:
        return [x.strip() for x in raw.split(",") if x.strip()]
    if APP_PUBLIC_ORIGIN:
        return [APP_PUBLIC_ORIGIN.rstrip("/")]
    return ["*"]


def ui_static_dir() -> Optional[Path]:
    """
    If set to a directory containing index.html, feed-api serves the built visual editor
    (same origin as API, OAuth, and did.json). Typical Docker path: /app/ui
    """
    raw = os.getenv("UI_STATIC_ROOT", "").strip()
    if not raw:
        return None
    p = Path(raw).expanduser().resolve()
    if p.is_dir() and (p / "index.html").is_file():
        return p
    return None


def public_url_health() -> dict:
    url = PUBLIC_URL or APP_PUBLIC_ORIGIN or PUBLIC_BASE_URL
    if not url:
        if LOCAL_BETA_MODE:
            return {"ok": True, "value": None, "reason": "LOCAL_BETA_MODE=true (public URL not required for local testing)"}
        return {"ok": False, "value": None, "reason": "PUBLIC_URL is not set"}
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return {"ok": False, "value": url, "reason": "PUBLIC_URL must be absolute (http/https)"}
    if parsed.hostname in {"localhost", "127.0.0.1"}:
        if LOCAL_BETA_MODE:
            return {"ok": True, "value": url, "reason": "local PUBLIC_URL accepted in LOCAL_BETA_MODE"}
        return {"ok": False, "value": url, "reason": "PUBLIC_URL is local-only; set your public domain"}
    if parsed.scheme != "https":
        if LOCAL_BETA_MODE:
            return {"ok": True, "value": url, "reason": "http URL accepted in LOCAL_BETA_MODE"}
        return {"ok": False, "value": url, "reason": "PUBLIC_URL should use https in production"}
    return {"ok": True, "value": url, "reason": "public url looks valid"}
