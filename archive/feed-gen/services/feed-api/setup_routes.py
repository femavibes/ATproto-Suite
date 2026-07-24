"""Startup preflight checks and simple setup page."""

from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import HTMLResponse
import httpx

from config import (
    ALLOWED_HANDLES,
    HOSTED_MODE,
    LOCAL_BETA_MODE,
    OWNER_HANDLE,
    PUBLIC_URL,
    SESSION_SECRET,
    public_url_health,
)
from database import get_db

router = APIRouter(prefix="/api/setup", tags=["setup"])


@router.get("/preflight")
async def preflight():
    checks = []

    url_check = public_url_health()
    checks.append(
        {
            "id": "public_url",
            "ok": url_check["ok"],
            "value": url_check["value"],
            "reason": url_check["reason"],
        }
    )

    secret_ok = SESSION_SECRET not in {"", "change-me-in-production", "dev-change-me"}
    checks.append(
        {
            "id": "session_secret",
            "ok": secret_ok,
            "reason": "session secret configured"
            if secret_ok
            else "SESSION_SECRET is default/weak; set a long random value",
        }
    )

    db_ok = False
    db_reason = "database unavailable"
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        db_ok = True
        db_reason = "database connected"
    except Exception as exc:  # pragma: no cover - best effort reporting
        db_reason = f"database connection failed: {exc}"
    checks.append({"id": "database", "ok": db_ok, "reason": db_reason})
    checks.append(
        {
            "id": "deployment_mode",
            "ok": True,
            "reason": "HOSTED_MODE=true (single web app entrypoint on this deployment)"
            if HOSTED_MODE
            else "HOSTED_MODE=false (strict self-host mode)",
        }
    )
    checks.append(
        {
            "id": "local_beta_mode",
            "ok": True,
            "reason": "LOCAL_BETA_MODE=true (domain optional for local beta)"
            if LOCAL_BETA_MODE
            else "LOCAL_BETA_MODE=false",
        }
    )
    checks.append(
        {
            "id": "owner_handle_lock",
            "ok": bool(OWNER_HANDLE or ALLOWED_HANDLES),
            "reason": (
                f"allowed handles: {', '.join('@' + h for h in ALLOWED_HANDLES)}"
                if ALLOWED_HANDLES
                else (f"OWNER_HANDLE set to @{OWNER_HANDLE}" if OWNER_HANDLE else "No handle whitelist set (instance allows any Bluesky user)")
            ),
        }
    )

    overall_ok = all(c["ok"] for c in checks)
    return {"ok": overall_ok, "checks": checks}


@router.get("/beta-readiness")
async def beta_readiness():
    checks = []
    pf = await preflight()
    checks.extend(pf["checks"])

    public_base = (PUBLIC_URL or "").rstrip("/")
    if public_base:
        did_url = f"{public_base}/.well-known/did.json"
        skeleton_url = f"{public_base}/xrpc/app.bsky.feed.getFeedSkeleton"
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            try:
                did_res = await client.get(did_url)
                checks.append(
                    {
                        "id": "public_did_json",
                        "ok": did_res.status_code == 200,
                        "reason": f"{did_url} -> HTTP {did_res.status_code}",
                    }
                )
            except Exception as exc:
                checks.append(
                    {
                        "id": "public_did_json",
                        "ok": False,
                        "reason": f"request failed: {exc}",
                    }
                )

            try:
                skel_res = await client.get(skeleton_url)
                # 422 without required query params means endpoint is reachable.
                ok = skel_res.status_code in {200, 400, 404, 422}
                checks.append(
                    {
                        "id": "public_skeleton_endpoint",
                        "ok": ok,
                        "reason": f"{skeleton_url} -> HTTP {skel_res.status_code}",
                    }
                )
            except Exception as exc:
                checks.append(
                    {
                        "id": "public_skeleton_endpoint",
                        "ok": False,
                        "reason": f"request failed: {exc}",
                    }
                )
    else:
        checks.append(
            {
                "id": "public_did_json",
                "ok": False,
                "reason": "PUBLIC_URL is not configured",
            }
        )
        checks.append(
            {
                "id": "public_skeleton_endpoint",
                "ok": False,
                "reason": "PUBLIC_URL is not configured",
            }
        )

    # DB-side readiness for testing publish path.
    try:
        pool = await get_db()
        async with pool.acquire() as conn:
            feed_count = await conn.fetchval("SELECT COUNT(*)::int FROM feeds")
            assigned_count = await conn.fetchval("SELECT COUNT(*)::int FROM feed_posts")
        checks.append(
            {
                "id": "feeds_exist",
                "ok": feed_count > 0,
                "reason": f"feeds rows: {feed_count}",
            }
        )
        checks.append(
            {
                "id": "assigned_posts_exist",
                "ok": assigned_count > 0,
                "reason": f"feed_posts rows: {assigned_count}",
            }
        )
    except Exception as exc:
        checks.append({"id": "feeds_exist", "ok": False, "reason": f"db check failed: {exc}"})
        checks.append(
            {"id": "assigned_posts_exist", "ok": False, "reason": f"db check failed: {exc}"}
        )

    overall_ok = all(c["ok"] for c in checks)
    return {"ok": overall_ok, "checks": checks}


@router.get("/page", response_class=HTMLResponse, include_in_schema=False)
async def preflight_page():
    return """
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Feed Setup Checks</title>
  <style>
    body { font-family: sans-serif; margin: 2rem; max-width: 800px; }
    .ok { color: #0a7f2e; }
    .bad { color: #b00020; }
    li { margin: .4rem 0; }
    code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; }
    .box { background: #f8f8f8; border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin: 12px 0; }
  </style>
</head>
<body>
  <h1>Feed App Setup Checks</h1>
  <p>This page verifies core startup requirements and deployment mode choices.</p>
  <p><a href="/">Open app</a> | <a href="/docs">API docs</a></p>
  <p><a href="/api/setup/beta-readiness">Beta readiness JSON</a></p>
  <div class="box">
    <h3>Deployment modes</h3>
    <ul>
      <li><strong>Docker onboarding default:</strong> installer can auto-set <code>PUBLIC_URL</code> to <code>https://&lt;public-ip&gt;.sslip.io</code> so users can log in and start building without manual DNS steps.</li>
      <li><strong>Custom domain (advanced):</strong> operator can later replace <code>PUBLIC_URL</code> with their own domain.</li>
    </ul>
    <p>Runtime remains self-hosted on the user's machine/VPS in both paths.</p>
  </div>
  <div id="status">Loading checks...</div>
  <script>
    async function run() {
      const root = document.getElementById('status');
      try {
        const res = await fetch('/api/setup/preflight');
        const data = await res.json();
        const summary = data.ok ? '<p class="ok"><strong>All checks passed.</strong></p>' :
                                  '<p class="bad"><strong>Some checks failed.</strong></p>';
        const items = data.checks.map(c =>
          `<li class="${c.ok ? 'ok' : 'bad'}">${c.ok ? 'PASS' : 'FAIL'} <code>${c.id}</code> - ${c.reason}${c.value ? ` (${c.value})` : ''}</li>`
        ).join('');
        root.innerHTML = summary + `<ul>${items}</ul>`;
      } catch (e) {
        root.innerHTML = `<p class="bad">Failed to run checks: ${e}</p>`;
      }
    }
    run();
  </script>
</body>
</html>
"""
