"""
label-ops config UI — sync label defs from the labeler service record,
configure per-label actions, write overlays for the three worker apps.
"""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

BASE = Path(__file__).resolve().parent.parent
CONFIG_PATH = Path(os.environ.get("LABEL_OPS_CONFIG", BASE / "config" / "labels.json"))
OVERLAY_DIR = Path(os.environ.get("LABEL_OPS_OVERLAYS", BASE / "config" / "overlays"))
ENV_PATH = Path(os.environ.get("LABEL_OPS_ENV", BASE / ".env"))
APP_PASSWORD = os.environ.get("CONFIG_UI_PASSWORD", "").strip()
COMPOSE_DIR = Path(os.environ.get("LABEL_OPS_COMPOSE_DIR", str(BASE)))
WORKER_SERVICES = ("label-watcher", "graze-post-remover", "autolabel")
_reload_timer: threading.Timer | None = None
_reload_lock = threading.Lock()
_last_reload: dict = {"at": None, "ok": None, "detail": None}

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "label-ops-dev-secret")

# Modern tools.ozone.report.defs reasons (RFC 0009).
REPORT_REASON_CATEGORIES = [
    {"id": "misleading", "label": "Misleading"},
    {"id": "harassment", "label": "Harassment or hate"},
    {"id": "sexual", "label": "Sexual / adult"},
    {"id": "violence", "label": "Violence / physical harm"},
    {"id": "selfharm", "label": "Self-harm / dangerous"},
    {"id": "child", "label": "Child safety"},
    {"id": "rule", "label": "Network rules"},
    {"id": "other", "label": "Other / appeal"},
]

REPORT_REASONS = [
    {"id": "misleadingBot", "label": "Fake account or bot", "category": "misleading"},
    {"id": "misleadingImpersonation", "label": "Impersonation", "category": "misleading"},
    {"id": "misleadingSpam", "label": "Spam", "category": "misleading"},
    {"id": "misleadingScam", "label": "Scam", "category": "misleading"},
    {"id": "misleadingElections", "label": "Election misinfo", "category": "misleading"},
    {"id": "misleadingOther", "label": "Other misleading", "category": "misleading"},
    {"id": "harassmentTroll", "label": "Trolling", "category": "harassment"},
    {"id": "harassmentTargeted", "label": "Targeted harassment", "category": "harassment"},
    {"id": "harassmentHateSpeech", "label": "Hate speech", "category": "harassment"},
    {"id": "harassmentDoxxing", "label": "Doxxing", "category": "harassment"},
    {"id": "harassmentOther", "label": "Other harassment", "category": "harassment"},
    {"id": "sexualUnlabeled", "label": "Unlabelled adult content", "category": "sexual"},
    {"id": "sexualNCII", "label": "Non-consensual intimate imagery", "category": "sexual"},
    {"id": "sexualDeepfake", "label": "Deepfake adult content", "category": "sexual"},
    {"id": "sexualAbuseContent", "label": "Adult sexual abuse", "category": "sexual"},
    {"id": "sexualAnimal", "label": "Animal sexual abuse", "category": "sexual"},
    {"id": "sexualOther", "label": "Other sexual", "category": "sexual"},
    {"id": "violenceThreats", "label": "Threats or incitement", "category": "violence"},
    {"id": "violenceGraphicContent", "label": "Graphic violence", "category": "violence"},
    {"id": "violenceGlorification", "label": "Glorification of violence", "category": "violence"},
    {"id": "violenceAnimal", "label": "Animal welfare", "category": "violence"},
    {"id": "violenceTrafficking", "label": "Human trafficking", "category": "violence"},
    {"id": "violenceExtremistContent", "label": "Extremist content", "category": "violence", "authorityOnly": True},
    {"id": "violenceOther", "label": "Other violent content", "category": "violence"},
    {"id": "selfHarmContent", "label": "Self-harm content", "category": "selfharm"},
    {"id": "selfHarmED", "label": "Eating disorders", "category": "selfharm"},
    {"id": "selfHarmStunts", "label": "Dangerous challenges", "category": "selfharm"},
    {"id": "selfHarmSubstances", "label": "Dangerous substances", "category": "selfharm"},
    {"id": "selfHarmOther", "label": "Other dangerous content", "category": "selfharm"},
    {"id": "childSafetyPrivacy", "label": "Minor privacy violation", "category": "child"},
    {"id": "childSafetyHarassment", "label": "Minor harassment / bullying", "category": "child"},
    {"id": "childSafetyCSAM", "label": "CSAM", "category": "child", "authorityOnly": True},
    {"id": "childSafetyGroom", "label": "Grooming", "category": "child", "authorityOnly": True},
    {"id": "childSafetyOther", "label": "Other child safety", "category": "child", "authorityOnly": True},
    {"id": "ruleSiteSecurity", "label": "Hacking / system attacks", "category": "rule"},
    {"id": "ruleProhibitedSales", "label": "Prohibited sales", "category": "rule"},
    {"id": "ruleBanEvasion", "label": "Ban evasion", "category": "rule"},
    {"id": "ruleOther", "label": "Other rule break", "category": "rule"},
    {"id": "other", "label": "Other", "category": "other"},
    {"id": "appeal", "label": "Appeal", "category": "other"},
]

REPORT_REASON_IDS = {r["id"] for r in REPORT_REASONS}

# Old UI keys → modern reason ids (Bluesky preferred migration targets)
LEGACY_REPORT_TYPE_IDS = {
    "spam": "misleadingSpam",
    "violation": "ruleOther",
    "misleading": "misleadingOther",
    "sexual": "sexualUnlabeled",
    "rude": "harassmentOther",
    "other": "other",
}

# Template back-compat: non-authority reasons as (id, env_key, label)
REPORT_TYPES = [
    (r["id"], f"REPORT_REASON_{r['id']}", r["label"])
    for r in REPORT_REASONS
    if not r.get("authorityOnly")
]


def migrate_report_types(raw: list | None) -> list[str]:
    """Normalize stored reportTypes to modern reason ids."""
    out: list[str] = []
    for item in raw or []:
        key = str(item).strip()
        if not key:
            continue
        if key in LEGACY_REPORT_TYPE_IDS:
            key = LEGACY_REPORT_TYPE_IDS[key]
        if key in REPORT_REASON_IDS and key not in out:
            out.append(key)
    return out


# Stack env keys the UI can write.
SECRET_KEYS = {
    "LABELER_DID",
    "LABELER_HANDLE",
    "LABELER_APP_PASSWORD",
    "LABELER_SOCKET_URL",
    "OZONE_URL",
    "WHITELISTED_MODERATORS",
    "BSKY_HANDLE",
    "BSKY_APP_PASSWORD",
    "BSKY_DM_USERNAME",
    "BSKY_DM_PASSWORD",
    "BSKY_DM_ACCOUNT",
    "CONFIG_UI_PASSWORD",
    "LABEL_SYNC_INTERVAL_MINUTES",
    "LIST_ACCOUNT_DID",
    "LIST_ACCOUNT_APP_PASSWORD",
    # Worker knobs (Config → Settings)
    "POLLING_SECONDS",
    "OZONE_POLLING_SECONDS",
    "BSKY_SERVICE",
    "LOG_LEVEL",
    "ADMIN_API_KEY",
    "MODERATOR_NOTIFICATIONS",
}
PASSWORD_KEYS = {
    "LABELER_APP_PASSWORD",
    "BSKY_APP_PASSWORD",
    "BSKY_DM_PASSWORD",
    "CONFIG_UI_PASSWORD",
    "LIST_ACCOUNT_APP_PASSWORD",
    "ADMIN_API_KEY",
}

# Little settings shown under Config → Settings (grouped by app).
SETTINGS_FIELDS = [
    {
        "key": "POLLING_SECONDS",
        "label": "Ozone poll interval (seconds)",
        "app": "autolabel",
        "hint": "How often to poll Ozone for new reports.",
        "default": "30",
        "type": "number",
    },
    {
        "key": "OZONE_POLLING_SECONDS",
        "label": "Ozone poll interval (seconds)",
        "app": "graze-post-remover",
        "hint": "How often to poll Ozone for removal-related events.",
        "default": "30",
        "type": "number",
    },
    {
        "key": "BSKY_SERVICE",
        "label": "Bluesky PDS / entryway URL",
        "app": "label-watcher",
        "hint": "Usually https://bsky.social",
        "default": "https://bsky.social",
        "type": "text",
    },
    {
        "key": "LOG_LEVEL",
        "label": "Log level",
        "app": "label-watcher, graze-post-remover",
        "hint": "Worker process logging verbosity.",
        "default": "INFO",
        "type": "select",
        "choices": ["DEBUG", "INFO", "WARNING", "ERROR"],
    },
    {
        "key": "ADMIN_API_KEY",
        "label": "Admin API key",
        "app": "label-watcher",
        "hint": "Protects the label-watcher admin HTTP endpoints.",
        "default": "",
        "type": "password",
        "secret": True,
    },
    {
        "key": "CONFIG_UI_PASSWORD",
        "label": "Config UI password",
        "app": "config-ui",
        "hint": "Blank = open on your LAN. Leave blank when saving to keep.",
        "default": "",
        "type": "password",
        "secret": True,
    },
    {
        "key": "LABELER_SOCKET_URL",
        "label": "Label firehose override",
        "app": "label-watcher, graze-post-remover",
        "hint": "Usually auto-derived from Ozone URL. Only set if subscribeLabels is on another host.",
        "default": "",
        "type": "text",
    },
]

_PLACEHOLDER_MARKERS = (
    "example.com",
    "your-labeler",
    "your-handle",
    "your-feeds-account",
    "did:plc:your-",
    "did:plc:moderator1",
)
_EXACT_PLACEHOLDERS = {
    "xxxx-xxxx-xxxx-xxxx",
    "your-labeler.bsky.social",
    "your-feeds-account.bsky.social",
    "did:plc:your-labeler-did",
    "did:plc:moderator1",
}


def is_placeholder(value: str | None) -> bool:
    v = (value or "").strip()
    if not v:
        return True
    if v.lower() in _EXACT_PLACEHOLDERS or v in _EXACT_PLACEHOLDERS:
        return True
    low = v.lower()
    return any(m in low for m in _PLACEHOLDER_MARKERS)


def clean_secret(value: str | None) -> str:
    v = (value or "").strip()
    return "" if is_placeholder(v) else v


def socket_url_from_ozone(ozone_url: str | None) -> str:
    """
    Derive label subscribe WebSocket from Ozone (or labeler) HTTPS base URL.
    https://labeler.example.com/ → wss://labeler.example.com/xrpc/com.atproto.label.subscribeLabels
    """
    raw = clean_secret(ozone_url)
    if not raw:
        return ""
    # Allow pasting a full wss URL unchanged
    if raw.startswith("wss://") or raw.startswith("ws://"):
        if "/xrpc/" in raw:
            return raw.rstrip("/")
        return raw.rstrip("/") + "/xrpc/com.atproto.label.subscribeLabels"
    # Strip path/query; keep host
    if "://" not in raw:
        raw = "https://" + raw
    parsed = urllib.parse.urlparse(raw)
    host = parsed.netloc or parsed.path.split("/")[0]
    if not host:
        return ""
    scheme = "wss" if parsed.scheme in ("https", "wss", "") else "ws"
    return f"{scheme}://{host}/xrpc/com.atproto.label.subscribeLabels"


_sync_lock = threading.Lock()
_last_sync_error: str | None = None


def utcnow() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def default_state() -> dict:
    return {
        "version": 1,
        "labelerDid": os.environ.get("LABELER_DID", "").strip(),
        "labelerHandle": os.environ.get("LABELER_HANDLE", "").strip(),
        "syncedAt": None,
        "syncIntervalMinutes": int(os.environ.get("LABEL_SYNC_INTERVAL_MINUTES", "15") or 15),
        "discovered": {},
        "actions": {},
        "newLabelIds": [],
        "grazeFeeds": [],
        "grazeFeedsFetchedAt": None,
        "listAccount": "labeler",  # labeler | graze — which acct owns Bluesky lists
        "ozoneTeam": [],
        "ozoneTeamFetchedAt": None,
        "blueskyLists": {},  # labelId -> { uri, name, purpose, url, listItemCount }
        "blueskyListsCatalog": [],  # raw getLists rows for rematch without refetch
        "blueskyListsFetchedAt": None,
        "blueskyListsActorDid": None,
        "blueskyListsActorHandle": None,
    }


def parse_env_file(path: Path) -> dict[str, str]:
    """Parse KEY=VALUE lines; keep values as stored (no shell expansion)."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
            val = val[1:-1]
        out[key] = val
    return out


def write_env_updates(path: Path, updates: dict[str, str]) -> None:
    """
    Update keys in an .env file in place. Preserves comments/unknown keys.
    Empty-string values clear the key. Missing keys are appended.

    Writes directly into `path` (no rename). Docker file bind-mounts reject
    os.replace() onto the mount point with EBUSY.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    if path.exists():
        lines = path.read_text(encoding="utf-8").splitlines()

    seen: set[str] = set()
    out: list[str] = []
    for raw in lines:
        stripped = raw.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            out.append(raw)
            continue
        key = stripped.split("=", 1)[0].strip()
        if key in updates:
            out.append(f"{key}={updates[key]}")
            seen.add(key)
        else:
            out.append(raw)

    for key, val in updates.items():
        if key not in seen:
            out.append(f"{key}={val}")

    text = "\n".join(out)
    if text and not text.endswith("\n"):
        text += "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    # Clean leftover temp from older rename-based writes
    tmp = path.with_suffix(path.suffix + ".tmp")
    if tmp.exists():
        try:
            tmp.unlink()
        except OSError:
            pass


def load_secrets() -> dict[str, str]:
    """Prefer on-disk .env (UI-writable), fall back to process env. No cross-account fallbacks."""
    file_vals = parse_env_file(ENV_PATH)
    out: dict[str, str] = {}
    for key in SECRET_KEYS:
        if key in file_vals:
            out[key] = clean_secret(file_vals[key]) if key not in PASSWORD_KEYS else (file_vals[key] or "").strip()
        else:
            raw = os.environ.get(key, "") or ""
            out[key] = clean_secret(raw) if key not in PASSWORD_KEYS else raw.strip()
        # Strip placeholder passwords too
        if key in PASSWORD_KEYS and is_placeholder(out.get(key, "")):
            out[key] = ""
    return out


def apply_env_updates(updates: dict[str, str], *, reload_workers: bool = True) -> None:
    """Write .env and mirror into process env for this UI process."""
    global APP_PASSWORD
    if not updates:
        return
    write_env_updates(ENV_PATH, updates)
    for k, v in updates.items():
        os.environ[k] = v
        if k == "CONFIG_UI_PASSWORD":
            APP_PASSWORD = v
    if reload_workers and any(k != "CONFIG_UI_PASSWORD" for k in updates):
        schedule_worker_reload(f"env:{','.join(sorted(updates)[:6])}")


def auto_reload_enabled() -> bool:
    return os.environ.get("LABEL_OPS_AUTO_RELOAD", "1").strip().lower() not in (
        "0",
        "false",
        "no",
        "off",
    )


def schedule_worker_reload(reason: str = "") -> None:
    """Debounce recreate so rapid UI saves coalesce into one reload."""
    global _reload_timer
    if not auto_reload_enabled():
        return

    def _fire():
        run_worker_reload(reason)

    with _reload_lock:
        if _reload_timer is not None:
            _reload_timer.cancel()
        _reload_timer = threading.Timer(1.5, _fire)
        _reload_timer.daemon = True
        _reload_timer.start()


def run_worker_reload(reason: str = "") -> dict:
    """
    Force-recreate running workers so they re-read .env + overlays.
    Docker env_file is snapshot-at-create; recreate is how UI changes go live.
    """
    global _last_reload
    result: dict = {
        "ok": False,
        "reason": reason,
        "at": datetime.now(timezone.utc).isoformat(),
        "recreated": [],
        "skipped": [],
    }
    if not auto_reload_enabled():
        result["ok"] = True
        result["skipped"] = list(WORKER_SERVICES)
        result["detail"] = "LABEL_OPS_AUTO_RELOAD disabled"
        _last_reload = result
        return result

    compose_dir = COMPOSE_DIR
    if not (compose_dir / "docker-compose.yml").exists():
        result["detail"] = f"compose file not found in {compose_dir}"
        _last_reload = result
        return result

    try:
        # Recreate all workers so UI saves apply even if a worker was down/crash-looping.
        cmd = [
            "docker",
            "compose",
            "up",
            "-d",
            "--force-recreate",
            "--no-deps",
            *WORKER_SERVICES,
        ]
        proc = subprocess.run(
            cmd,
            cwd=str(compose_dir),
            capture_output=True,
            text=True,
            timeout=180,
        )
        result["recreated"] = list(WORKER_SERVICES)
        result["skipped"] = []
        result["ok"] = proc.returncode == 0
        detail = (proc.stderr or proc.stdout or "").strip()
        result["detail"] = detail[-2000:] if detail else ("ok" if result["ok"] else "compose failed")
        if proc.returncode != 0:
            result["returncode"] = proc.returncode
    except FileNotFoundError:
        result["detail"] = "docker CLI not available in config-ui container"
    except subprocess.TimeoutExpired:
        result["detail"] = "docker compose timed out"
    except Exception as e:
        result["detail"] = str(e)

    _last_reload = result
    return result


def worker_reload_status() -> dict:
    return dict(_last_reload)

def accounts_public_view(state: dict | None = None) -> dict:
    """UI-facing account model: one labeler, one Graze feeds account."""
    secrets = load_secrets()
    state = state or load_state()

    did = clean_secret(state.get("labelerDid")) or clean_secret(secrets.get("LABELER_DID"))
    handle = clean_secret(state.get("labelerHandle")) or clean_secret(secrets.get("LABELER_HANDLE"))
    identity = handle or did

    graze_handle = clean_secret(secrets.get("BSKY_HANDLE"))
    labeler_pw = secrets.get("LABELER_APP_PASSWORD") or ""
    graze_pw = secrets.get("BSKY_APP_PASSWORD") or ""

    sync_raw = secrets.get("LABEL_SYNC_INTERVAL_MINUTES") or str(state.get("syncIntervalMinutes") or 15)
    try:
        sync_mins = max(1, int(sync_raw))
    except ValueError:
        sync_mins = 15

    return {
        "labeler": {
            "identity": identity,
            "did": did,
            "handle": handle,
            "passwordSet": bool(labeler_pw),
            "passwordHint": "Password saved" if labeler_pw else "",
            "socketUrl": clean_secret(secrets.get("LABELER_SOCKET_URL"))
            or socket_url_from_ozone(secrets.get("OZONE_URL")),
            "ozoneUrl": clean_secret(secrets.get("OZONE_URL")),
            "whitelistedModerators": clean_secret(secrets.get("WHITELISTED_MODERATORS")),
            "moderatorNotifications": clean_secret(secrets.get("MODERATOR_NOTIFICATIONS")),
            "syncIntervalMinutes": sync_mins,
            "usedBy": ["label-watcher", "autolabel", "graze-post-remover"],
        },
        "graze": {
            "handle": graze_handle,
            "passwordSet": bool(graze_pw),
            "passwordHint": "Password saved" if graze_pw else "",
            "ready": bool(graze_handle and graze_pw),
            "usedBy": ["graze-post-remover"],
        },
        "optional": {
            "dmAccount": (secrets.get("BSKY_DM_ACCOUNT") or "labeler").strip().lower() or "labeler",
            "dmUsername": clean_secret(secrets.get("BSKY_DM_USERNAME")),
            "dmPasswordSet": bool(secrets.get("BSKY_DM_PASSWORD")),
            "dmPasswordHint": "Password saved" if secrets.get("BSKY_DM_PASSWORD") else "",
            "uiPasswordSet": bool(secrets.get("CONFIG_UI_PASSWORD")),
        },
        "settings": settings_public_view(secrets),
    }


def settings_public_view(secrets: dict[str, str] | None = None) -> dict:
    secrets = secrets or load_secrets()
    fields = []
    for meta in SETTINGS_FIELDS:
        key = meta["key"]
        raw = secrets.get(key, "") or ""

        if key == "LABELER_SOCKET_URL":
            ozone = clean_secret(secrets.get("OZONE_URL"))
            derived = socket_url_from_ozone(ozone)
            stored = clean_secret(raw)
            # Only expose as an override when it differs from Ozone-derived
            display = stored if stored and stored != derived else ""
            is_set = bool(display)
        elif meta.get("secret"):
            display = ""
            is_set = bool(raw) and not is_placeholder(raw)
        else:
            display = clean_secret(raw)
            is_set = bool(display)

        item = {
            **meta,
            "value": display,
            "set": is_set,
            "hintSaved": "Saved" if (meta.get("secret") and is_set) else "",
        }
        fields.append(item)
    return {"fields": fields}



# Back-compat alias used by a couple callers during transition
def secrets_public_view(secrets: dict[str, str] | None = None) -> dict:
    view = accounts_public_view()
    return {
        "envPath": str(ENV_PATH),
        "grazeReady": view["graze"]["ready"],
        "accounts": view,
    }


def graze_login(handle: str, app_password: str) -> str:
    """Login to Graze; return session_cookie value."""
    import http.cookiejar

    payload = json.dumps({"username": handle, "password": app_password}).encode()
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    req = urllib.request.Request(
        "https://api.graze.social/app/login",
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Origin": "https://www.graze.social",
            "Referer": "https://www.graze.social/login",
            "User-Agent": "label-ops-config-ui/1.0",
        },
    )
    try:
        with opener.open(req, timeout=30) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:200]
        raise RuntimeError(f"Graze login failed ({e.code}): {body or e.reason}") from e

    for c in jar:
        if c.name == "session_cookie" and c.value:
            return c.value
    raise RuntimeError("Graze login succeeded but no session_cookie")


def fetch_graze_published_feeds(handle: str, app_password: str) -> list[dict]:
    """
    List the account's Graze algos that are published to Bluesky
    (have an algorithm_uri), excluding deleted.
    """
    import http.cookiejar

    cookie = graze_login(handle, app_password)
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    headers = {
        "Cookie": f"session_cookie={cookie}",
        "Origin": "https://www.graze.social",
        "User-Agent": "label-ops-config-ui/1.0",
        "Accept": "application/json",
    }
    feeds: list[dict] = []
    page = 1
    total_pages = 1
    while page <= total_pages:
        url = f"https://api.graze.social/app/my_feeds?page={page}&page_size=100"
        req = urllib.request.Request(url, headers=headers)
        with opener.open(req, timeout=45) as resp:
            data = json.load(resp)
        total_pages = max(1, int(data.get("total_pages") or 1))
        for algo in data.get("user_algos") or []:
            if algo.get("deleted"):
                continue
            uri = (algo.get("algorithm_uri") or "").strip()
            if not uri:
                continue
            if algo.get("active") is False:
                continue
            feeds.append(
                {
                    "id": int(algo["id"]),
                    "name": (algo.get("display_name") or algo.get("record_name") or str(algo["id"])).strip(),
                    "recordName": algo.get("record_name") or "",
                    "uri": uri,
                    "public": bool(algo.get("public")),
                }
            )
        page += 1

    feeds.sort(key=lambda f: (f["name"].lower(), f["id"]))
    return feeds


def load_state() -> dict:
    if not CONFIG_PATH.exists():
        state = default_state()
        save_state(state)
        return state
    with open(CONFIG_PATH, encoding="utf-8") as f:
        state = json.load(f)
    base = default_state()
    base.update(state)
    if not base.get("labelerDid"):
        base["labelerDid"] = os.environ.get("LABELER_DID", "").strip()
    # Migrate legacy report-type keys → modern reason ids
    actions = base.get("actions") or {}
    dirty = False
    for ident, act in actions.items():
        if not isinstance(act, dict):
            continue
        migrated = migrate_report_types(act.get("reportTypes"))
        if migrated != list(act.get("reportTypes") or []):
            act["reportTypes"] = migrated
            dirty = True
    # One-shot: enroll all labels for comment commands (old default was opt-in / false)
    if not base.get("commandsEnrolledByDefault"):
        for ident, act in actions.items():
            if isinstance(act, dict):
                act["commandable"] = True
        base["commandsEnrolledByDefault"] = True
        dirty = True
    if dirty:
        base["actions"] = actions
        save_state(base)
        try:
            write_overlays(base, reload_workers=True)
        except Exception:
            pass
    return base


def save_state(state: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = CONFIG_PATH.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)
        f.write("\n")
    tmp.replace(CONFIG_PATH)


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if APP_PASSWORD and not session.get("authed"):
            if request.path.startswith("/api/"):
                return jsonify({"error": "unauthorized"}), 401
            return redirect(url_for("login", next=request.path))
        return fn(*args, **kwargs)

    return wrapper


def http_json(url: str, timeout: int = 30) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "label-ops-config-ui/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.load(resp)


def normalize_handle(value: str) -> str:
    h = (value or "").strip()
    if h.startswith("@"):
        h = h[1:]
    return h.lower()


def resolve_handle_to_did(handle: str) -> str:
    """Resolve Bluesky handle → DID via public AppView."""
    handle = normalize_handle(handle)
    if not handle or "." not in handle:
        raise RuntimeError(f"Invalid handle: {handle!r}")
    q = urllib.parse.urlencode({"handle": handle})
    try:
        data = http_json(
            f"https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?{q}"
        )
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Could not resolve handle @{handle} ({e.code})") from e
    did = (data.get("did") or "").strip()
    if not did.startswith("did:"):
        raise RuntimeError(f"Handle @{handle} did not resolve to a DID")
    return did


def resolve_did_to_handle(did: str) -> str | None:
    """Best-effort profile lookup for display; None if unavailable."""
    try:
        q = urllib.parse.urlencode({"actor": did})
        prof = http_json(f"https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?{q}")
        return normalize_handle(prof.get("handle") or "") or None
    except Exception:
        return None


def resolve_labeler_identity(value: str | None = None, *, did: str | None = None, handle: str | None = None) -> tuple[str, str | None]:
    """
    Accept DID and/or handle (or a single value that is either).
    Returns (did, handle_or_none). Always persists a DID when possible.

    If `value` is provided, it wins over stale did/handle kwargs.
    """
    value = (value or "").strip()
    explicit_did = (did or "").strip()
    explicit_handle = normalize_handle(handle or "")

    if value.startswith("did:"):
        explicit_did = value
        # keep handle kwargs only as a hint; refresh from profile below
    elif value:
        explicit_handle = normalize_handle(value)
        # user typed a handle — don't keep an old DID from kwargs
        if not (did and str(did).strip() == value):
            explicit_did = ""

    if explicit_did.startswith("did:"):
        resolved_handle = explicit_handle or resolve_did_to_handle(explicit_did)
        return explicit_did, resolved_handle

    if explicit_handle:
        resolved_did = resolve_handle_to_did(explicit_handle)
        return resolved_did, explicit_handle

    raise RuntimeError("Provide a labeler DID (did:plc:…) or handle (e.g. mylabeler.bsky.social)")


def resolve_pds(did: str) -> str:
    doc = http_json(f"https://plc.directory/{did}")
    for svc in doc.get("service") or []:
        if svc.get("id") == "#atproto_pds":
            return svc["serviceEndpoint"].rstrip("/")
    raise RuntimeError("No PDS endpoint in PLC doc")


def bsky_create_session(identifier: str, app_password: str) -> dict:
    """Login via Bluesky entryway; returns session JSON with accessJwt + did."""
    payload = json.dumps({"identifier": identifier, "password": app_password}).encode()
    req = urllib.request.Request(
        "https://bsky.social/xrpc/com.atproto.server.createSession",
        data=payload,
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "label-ops-config-ui/1.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:200]
        raise RuntimeError(f"Bluesky login failed ({e.code}): {body or e.reason}") from e


def resolve_dm_sender_creds(
    secrets: dict[str, str] | None = None,
    *,
    dm_account: str | None = None,
    custom_handle: str | None = None,
    custom_password: str | None = None,
) -> tuple[str, str, str]:
    """
    Return (handle, password, source_label) for the configured DM sender.
    source_label is labeler|graze|custom.
    """
    secrets = secrets or load_secrets()
    mode = (dm_account or secrets.get("BSKY_DM_ACCOUNT") or "labeler").strip().lower()
    if mode not in ("labeler", "graze", "custom"):
        mode = "labeler"

    if mode == "graze":
        handle = clean_secret(secrets.get("BSKY_HANDLE"))
        password = (secrets.get("BSKY_APP_PASSWORD") or "").strip()
        if not handle or not password or is_placeholder(password):
            raise RuntimeError("Graze feeds account handle + app password required for DMs")
        return handle, password, "graze"

    if mode == "custom":
        handle = normalize_handle(custom_handle) if custom_handle else clean_secret(secrets.get("BSKY_DM_USERNAME"))
        password = (custom_password or "").strip() or (secrets.get("BSKY_DM_PASSWORD") or "").strip()
        if not handle:
            raise RuntimeError("Custom DM account handle required")
        if not password or is_placeholder(password):
            raise RuntimeError("Custom DM account app password required")
        return handle, password, "custom"

    handle = clean_secret(secrets.get("LABELER_HANDLE")) or clean_secret(secrets.get("LABELER_DID"))
    password = (secrets.get("LABELER_APP_PASSWORD") or "").strip()
    if not handle or not password or is_placeholder(password):
        raise RuntimeError("Labeler handle + app password required for DMs")
    return handle, password, "labeler"


def bsky_chat_request(method: str, path: str, access_jwt: str, body: dict | None = None) -> dict:
    url = f"https://api.bsky.chat/xrpc/{path}"
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {access_jwt}",
            "Content-Type": "application/json",
            "User-Agent": "label-ops-config-ui/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Chat API {path} failed ({e.code}): {err or e.reason}") from e


def send_test_dm(*, sender_handle: str, sender_password: str, recipient: str) -> dict:
    """Send a short test DM from sender to recipient (handle or DID)."""
    recipient = (recipient or "").strip()
    if not recipient:
        raise RuntimeError("Pick a recipient")
    if recipient.startswith("did:"):
        recipient_did = recipient
        recipient_handle = resolve_did_to_handle(recipient_did) or recipient_did
    else:
        recipient_handle = normalize_handle(recipient)
        recipient_did = resolve_handle_to_did(recipient_handle)

    sess = bsky_create_session(sender_handle, sender_password)
    jwt = sess.get("accessJwt") or ""
    sender_did = sess.get("did") or ""
    if not jwt:
        raise RuntimeError("Login succeeded but no accessJwt returned")
    if sender_did and sender_did == recipient_did:
        raise RuntimeError("Pick a different account — can't DM yourself")

    # Prefer PDS + atproto-proxy (correct chat routing); fall back to api.bsky.chat.
    pds = ""
    try:
        pds = resolve_pds(sender_did) if sender_did else ""
    except Exception:
        pds = ""

    def chat_call(method: str, path: str, body: dict | None = None) -> dict:
        if pds:
            return bsky_chat_via_pds(method, path, jwt, pds, body)
        return bsky_chat_request(method, path, jwt, body)

    try:
        chat_call("GET", "chat.bsky.convo.listConvos?limit=1")
    except RuntimeError as e:
        msg = str(e)
        if "Bad token scope" in msg or "InvalidToken" in msg:
            raise RuntimeError(
                "This app password can't use Bluesky chat. In Bluesky Settings → "
                "Privacy and security → App passwords, create a new password with "
                "“Allow access to your direct messages” checked, then save it on "
                "the DM sender account here."
            ) from e
        raise RuntimeError(f"{e}. The sender app password likely needs chat permission.") from e

    convo = chat_call(
        "GET",
        f"chat.bsky.convo.getConvoForMembers?members={urllib.parse.quote(recipient_did)}",
    )
    convo_id = ((convo.get("convo") or {}).get("id")) or ""
    if not convo_id:
        raise RuntimeError("Could not open a chat conversation with that account")

    text = (
        "label-ops test DM — if you got this, error notifications from this sender can reach you."
    )
    chat_call(
        "POST",
        "chat.bsky.convo.sendMessage",
        {"convoId": convo_id, "message": {"text": text}},
    )
    return {
        "fromHandle": sess.get("handle") or sender_handle,
        "fromDid": sender_did,
        "toHandle": recipient_handle,
        "toDid": recipient_did,
    }


def bsky_chat_via_pds(
    method: str, path: str, access_jwt: str, pds: str, body: dict | None = None
) -> dict:
    """Chat calls proxied through the account PDS (required routing for chat.bsky)."""
    url = f"{pds.rstrip('/')}/xrpc/{path}"
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {access_jwt}",
            "Content-Type": "application/json",
            "Atproto-Proxy": "did:web:api.bsky.chat#bsky_chat",
            "User-Agent": "label-ops-config-ui/1.0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")[:300]
        raise RuntimeError(f"Chat API {path} failed ({e.code}): {err or e.reason}") from e


OZONE_TEAM_ROLES = {
    "tools.ozone.team.defs#roleAdmin": "Admin",
    "tools.ozone.team.defs#roleModerator": "Moderator",
    "tools.ozone.team.defs#roleTriage": "Triage",
    "tools.ozone.team.defs#roleVerifier": "Verifier",
}
# Roles that make sense for autolabel report whitelist
OZONE_WHITELIST_ROLES = {
    "tools.ozone.team.defs#roleAdmin",
    "tools.ozone.team.defs#roleModerator",
    "tools.ozone.team.defs#roleTriage",
}


def fetch_ozone_team_members(
    *,
    labeler_did: str,
    labeler_handle: str,
    app_password: str,
) -> list[dict]:
    """
    List Ozone team members via tools.ozone.team.listMembers
    (proxied through the labeler's PDS with atproto-proxy).
    """
    if not labeler_did.startswith("did:"):
        raise RuntimeError("Labeler DID required to query Ozone team")
    if not labeler_handle or not app_password or is_placeholder(app_password):
        raise RuntimeError("Save a real labeler app password first")

    sess = bsky_create_session(labeler_handle, app_password)
    jwt = sess.get("accessJwt") or ""
    if not jwt:
        raise RuntimeError("Login succeeded but no accessJwt returned")

    members: list[dict] = []
    cursor = None
    proxy = f"{labeler_did}#atproto_labeler"
    pds = resolve_pds(sess.get("did") or labeler_did)

    while True:
        params: dict[str, str] = {"limit": "100"}
        if cursor:
            params["cursor"] = cursor
        url = f"{pds}/xrpc/tools.ozone.team.listMembers?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(
            url,
            headers={
                "Authorization": f"Bearer {jwt}",
                "atproto-proxy": proxy,
                "User-Agent": "label-ops-config-ui/1.0",
                "Accept": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.load(resp)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            raise RuntimeError(f"Ozone listMembers failed ({e.code}): {body or e.reason}") from e

        for m in data.get("members") or []:
            if m.get("disabled"):
                continue
            did = (m.get("did") or "").strip()
            if not did.startswith("did:"):
                continue
            role_id = m.get("role") or ""
            profile = m.get("profile") or {}
            members.append(
                {
                    "did": did,
                    "handle": profile.get("handle") or "",
                    "displayName": profile.get("displayName") or "",
                    "role": OZONE_TEAM_ROLES.get(role_id) or (role_id.split("#")[-1] if role_id else "Member"),
                    "roleId": role_id,
                    "whitelistable": role_id in OZONE_WHITELIST_ROLES,
                }
            )
        cursor = data.get("cursor")
        if not cursor:
            break

    role_order = {"Admin": 0, "Moderator": 1, "Triage": 2, "Verifier": 3}
    seen: set[str] = set()
    out: list[dict] = []
    for m in sorted(
        members,
        key=lambda x: (role_order.get(x["role"], 9), (x.get("handle") or x["did"]).lower()),
    ):
        if m["did"] in seen:
            continue
        seen.add(m["did"])
        out.append(m)
    return out


def fetch_defs_from_pds(did: str) -> list[dict]:
    pds = resolve_pds(did)
    q = urllib.parse.urlencode(
        {"repo": did, "collection": "app.bsky.labeler.service", "rkey": "self"}
    )
    rec = http_json(f"{pds}/xrpc/com.atproto.repo.getRecord?{q}")
    policies = (rec.get("value") or {}).get("policies") or {}
    return normalize_policies(policies)


def fetch_defs_from_appview(did: str) -> list[dict]:
    q = urllib.parse.urlencode([("dids", did), ("detailed", "true")])
    data = http_json(f"https://public.api.bsky.app/xrpc/app.bsky.labeler.getServices?{q}")
    views = data.get("views") or []
    if not views:
        raise RuntimeError("AppView returned no labeler views for this DID")
    policies = views[0].get("policies") or {}
    return normalize_policies(policies)


def normalize_policies(policies: dict) -> list[dict]:
    """Merge labelValues + labelValueDefinitions into a flat catalog."""
    defs = {d.get("identifier"): d for d in (policies.get("labelValueDefinitions") or []) if d.get("identifier")}
    values = list(policies.get("labelValues") or [])
    # Ensure every defined label appears even if missing from labelValues
    for ident in defs:
        if ident not in values:
            values.append(ident)
    out = []
    for ident in values:
        if not ident or str(ident).startswith("!"):
            # skip global operator labels like !hide unless also custom-defined
            if ident not in defs:
                continue
        d = defs.get(ident) or {}
        locales = d.get("locales") or [{}]
        en = next((x for x in locales if x.get("lang", "").startswith("en")), locales[0])
        out.append(
            {
                "identifier": ident,
                "name": en.get("name") or ident,
                "description": en.get("description") or "",
                "severity": d.get("severity") or "",
                "blurs": d.get("blurs") or "",
                "adultOnly": bool(d.get("adultOnly")),
            }
        )
    return out


def fetch_label_catalog(did: str) -> tuple[list[dict], str]:
    """Prefer PDS (fresher); fall back to AppView."""
    try:
        return fetch_defs_from_pds(did), "pds"
    except Exception as pds_err:
        try:
            return fetch_defs_from_appview(did), "appview"
        except Exception as av_err:
            raise RuntimeError(f"PDS failed ({pds_err}); AppView failed ({av_err})") from av_err


def merge_discovery(state: dict, catalog: list[dict]) -> dict:
    now = utcnow()
    prev_ids = set(state.get("discovered") or {})
    actions = state.setdefault("actions", {})
    discovered = {}
    seen = set()
    newly = []

    for item in catalog:
        ident = item["identifier"]
        seen.add(ident)
        prev = (state.get("discovered") or {}).get(ident) or {}
        discovered[ident] = {
            **item,
            "firstSeenAt": prev.get("firstSeenAt") or now,
            "lastSeenAt": now,
        }
        if ident not in actions:
            actions[ident] = default_action()
            if ident not in prev_ids:
                newly.append(ident)
            elif ident not in state.get("newLabelIds", []):
                # existed in discovery gap with no actions — treat as needs config
                newly.append(ident)

    # Mark missing as stale but keep actions
    for ident, prev in (state.get("discovered") or {}).items():
        if ident not in seen:
            discovered[ident] = {**prev, "stale": True, "lastSeenAt": prev.get("lastSeenAt")}

    # newLabelIds = labels with no meaningful config yet OR freshly discovered
    pending = set(state.get("newLabelIds") or [])
    pending.update(newly)
    # drop from pending if user has configured something beyond defaults? keep until dismissed
    # Auto-clear pending only when action is "touched" — handled on save via configured flag
    state["discovered"] = discovered
    state["actions"] = actions
    state["newLabelIds"] = sorted(i for i in pending if i in discovered)
    state["syncedAt"] = now
    return state


def default_action() -> dict:
    return {
        "list": "off",  # off | curate | mod
        "grazeFeeds": "",  # "" | "all" | "123,456"
        # Comment commands: enrolled by default; set False to opt out of VALID_LABELS
        "commandable": True,
        "reportTypes": [],
        "autoban": "",  # e.g. "5:2" or ""
        "configured": False,
    }


def resolve_list_account_identity(state: dict) -> tuple[str, str]:
    """
    Return (did, handle) for the account that owns Bluesky lists.
    Public AppView reads don't need the app password.
    """
    secrets = load_secrets()
    mode = (state.get("listAccount") or "labeler").strip().lower()
    if mode == "graze":
        handle = clean_secret(secrets.get("BSKY_HANDLE"))
        if not handle:
            raise RuntimeError(
                "Lists are set to Graze feeds account, but that handle is not configured"
            )
        did, resolved = resolve_labeler_identity(handle)
        return did, resolved or handle

    did = clean_secret(state.get("labelerDid")) or clean_secret(secrets.get("LABELER_DID"))
    handle = clean_secret(state.get("labelerHandle")) or clean_secret(secrets.get("LABELER_HANDLE"))
    if not did and handle:
        did, handle = resolve_labeler_identity(handle)
    if not did:
        raise RuntimeError("Set the labeler account before viewing lists")
    if not handle:
        handle = resolve_did_to_handle(did) or ""
    return did, handle


def list_web_url(uri: str, handle: str | None = None) -> str:
    """at://did/.../app.bsky.graph.list/rkey → https://bsky.app/profile/.../lists/rkey"""
    raw = (uri or "").strip()
    if not raw.startswith("at://"):
        return ""
    rest = raw[5:]
    parts = rest.split("/")
    if len(parts) < 3:
        return ""
    did, _coll, rkey = parts[0], parts[1], parts[2]
    actor = (handle or "").strip() or did
    return f"https://bsky.app/profile/{urllib.parse.quote(actor)}/lists/{urllib.parse.quote(rkey)}"


def fetch_actor_lists(actor: str) -> list[dict]:
    """Paginate app.bsky.graph.getLists for an actor (DID or handle)."""
    out: list[dict] = []
    cursor = ""
    for _ in range(20):  # safety cap (~2000 lists)
        params: dict[str, str] = {"actor": actor, "limit": "100"}
        if cursor:
            params["cursor"] = cursor
        q = urllib.parse.urlencode(params)
        data = http_json(
            f"https://public.api.bsky.app/xrpc/app.bsky.graph.getLists?{q}"
        )
        for item in data.get("lists") or []:
            purpose = item.get("purpose") or ""
            if "modlist" in purpose:
                purpose_kind = "mod"
            elif "curatelist" in purpose:
                purpose_kind = "curate"
            else:
                purpose_kind = "other"
            out.append(
                {
                    "uri": item.get("uri") or "",
                    "name": (item.get("name") or "").strip(),
                    "purpose": purpose,
                    "purposeKind": purpose_kind,
                    "listItemCount": item.get("listItemCount"),
                    "description": (item.get("description") or "").strip(),
                }
            )
        cursor = data.get("cursor") or ""
        if not cursor:
            break
    return out


def match_lists_to_labels(state: dict, lists: list[dict], actor_handle: str) -> dict[str, dict]:
    """
    Match Bluesky lists to labels the same way label-watcher does:
    list.name == label display name (locales[0].name).

    Includes labels with list sync off when a same-named list already exists,
    so the UI can still show open/copy links.
    """
    by_name: dict[str, dict] = {}
    for lst in lists:
        name = lst.get("name") or ""
        if name and name not in by_name:
            by_name[name] = lst

    matched: dict[str, dict] = {}
    discovered = state.get("discovered") or {}
    actions = state.get("actions") or {}
    for ident, meta in discovered.items():
        if meta.get("stale"):
            continue
        act = actions.get(ident) or {}
        mode = (act.get("list") or "off").strip()
        if mode not in ("curate", "mod", "off"):
            mode = "off"
        display = (meta.get("name") or ident or "").strip()
        lst = by_name.get(display)
        if not lst:
            if mode not in ("curate", "mod"):
                continue
            matched[ident] = {
                "labelId": ident,
                "labelName": display,
                "listMode": mode,
                "found": False,
                "uri": "",
                "url": "",
                "name": "",
                "purposeKind": mode,
                "listItemCount": None,
            }
            continue
        uri = lst.get("uri") or ""
        matched[ident] = {
            "labelId": ident,
            "labelName": display,
            "listMode": mode,
            "found": True,
            "uri": uri,
            "url": list_web_url(uri, actor_handle),
            "name": lst.get("name") or display,
            "purposeKind": lst.get("purposeKind") or mode,
            "listItemCount": lst.get("listItemCount"),
            "description": lst.get("description") or "",
        }
    return matched


def rematch_bluesky_lists(state: dict) -> dict:
    """Re-run label→list matching against the last catalog (no network)."""
    catalog = state.get("blueskyListsCatalog") or []
    handle = state.get("blueskyListsActorHandle") or ""
    if not catalog:
        state["blueskyLists"] = {}
        return {
            "lists": {},
            "allCount": 0,
            "matchedCount": 0,
            "configuredCount": 0,
            "fetchedAt": state.get("blueskyListsFetchedAt"),
            "actorDid": state.get("blueskyListsActorDid"),
            "actorHandle": handle,
        }
    matched = match_lists_to_labels(state, catalog, handle)
    state["blueskyLists"] = matched
    return {
        "lists": matched,
        "allCount": len(catalog),
        "matchedCount": sum(1 for v in matched.values() if v.get("found")),
        "configuredCount": len(matched),
        "fetchedAt": state.get("blueskyListsFetchedAt"),
        "actorDid": state.get("blueskyListsActorDid"),
        "actorHandle": handle,
    }


def refresh_bluesky_lists(state: dict | None = None, *, persist: bool = True) -> dict:
    state = state or load_state()
    did, handle = resolve_list_account_identity(state)
    lists = fetch_actor_lists(did)
    matched = match_lists_to_labels(state, lists, handle)
    state["blueskyLists"] = matched
    state["blueskyListsCatalog"] = lists
    state["blueskyListsFetchedAt"] = utcnow()
    state["blueskyListsActorDid"] = did
    state["blueskyListsActorHandle"] = handle
    if persist:
        save_state(state)
    return {
        "lists": matched,
        "allCount": len(lists),
        "matchedCount": sum(1 for v in matched.values() if v.get("found")),
        "configuredCount": len(matched),
        "fetchedAt": state["blueskyListsFetchedAt"],
        "actorDid": did,
        "actorHandle": handle,
    }


def resolve_list_account_creds(state: dict) -> tuple[str, str]:
    """
    Return (did, app_password) for the account that should own Bluesky lists.
    listAccount: labeler (default) | graze
    """
    secrets = load_secrets()
    mode = (state.get("listAccount") or "labeler").strip().lower()
    if mode == "graze":
        handle = clean_secret(secrets.get("BSKY_HANDLE"))
        password = (secrets.get("BSKY_APP_PASSWORD") or "").strip()
        if not handle or not password or is_placeholder(password):
            raise RuntimeError(
                "Lists are set to Graze feeds account, but that handle/app password is not configured"
            )
        did, _ = resolve_labeler_identity(handle)
        return did, password

    did = clean_secret(state.get("labelerDid")) or clean_secret(secrets.get("LABELER_DID"))
    password = (secrets.get("LABELER_APP_PASSWORD") or "").strip()
    if not did:
        raise RuntimeError("Set the labeler account before configuring lists")
    if not password or is_placeholder(password):
        raise RuntimeError("Set the labeler app password before configuring lists")
    return did, password


def sync_list_account_env(state: dict) -> None:
    """Write LIST_ACCOUNT_* into .env from listAccount setting (labeler | graze)."""
    did, password = resolve_list_account_creds(state)
    apply_env_updates(
        {
            "LIST_ACCOUNT_DID": did,
            "LIST_ACCOUNT_APP_PASSWORD": password,
        }
    )


def write_overlays(state: dict, *, reload_workers: bool = True) -> dict[str, str]:
    """Generate env overlays the three worker containers can env_file."""
    OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
    actions = state.get("actions") or {}
    discovered = state.get("discovered") or {}

    list_parts = []
    graze_parts = []
    valid = []
    report_map = {r["id"]: [] for r in REPORT_REASONS}
    autoban_parts = []
    modlabels = []

    for ident, act in sorted(actions.items()):
        if ident not in discovered:
            continue
        if discovered.get(ident, {}).get("stale"):
            continue

        list_mode = (act.get("list") or "off").strip()
        if list_mode in ("curate", "mod"):
            list_parts.append(f"{ident}:{list_mode}")

        feeds = (act.get("grazeFeeds") or "").strip()
        if feeds:
            graze_parts.append(f"{ident}:{feeds}")

        if act.get("commandable", True):
            valid.append(ident)

        for rt in migrate_report_types(act.get("reportTypes")):
            if rt in report_map:
                report_map[rt].append(ident)

        ab = (act.get("autoban") or "").strip()
        if ab:
            # format label:threshold:otherCap — if user only gave "5:2", prefix label
            if ab.count(":") == 1 and not ab.startswith(ident):
                ab = f"{ident}:{ab}"
            elif ":" not in ab:
                ab = f"{ident}:{ab}:0"
            autoban_parts.append(ab)
            modlabels.append(ident)

    # Ensure every non-stale discovered label is commandable by default in VALID_LABELS,
    # even if it has no actions row yet. Report-type / autoban targets must stay valid too.
    for ident, meta in discovered.items():
        if meta.get("stale"):
            continue
        act = actions.get(ident) or {}
        if ident in valid:
            continue
        if act.get("commandable", True):
            valid.append(ident)
        elif migrate_report_types(act.get("reportTypes")) or (act.get("autoban") or "").strip():
            valid.append(ident)

    watcher_lines = [f"LABELS_TO_LIST={','.join(list_parts)}"]
    watcher = "\n".join(watcher_lines) + "\n"
    graze = f"GRAZE_REMOVAL_LABELS={','.join(graze_parts)}\n"
    auto_lines = [f"VALID_LABELS={','.join(valid)}"]
    for reason in REPORT_REASONS:
        rid = reason["id"]
        auto_lines.append(f"REPORT_REASON_{rid}={','.join(report_map[rid])}")
    # Legacy REPORT_TYPE_* for older autolabel images (preferred modern equivalents)
    legacy_env = {
        "REPORT_TYPE_SPAM": "misleadingSpam",
        "REPORT_TYPE_VIOLATION": "ruleOther",
        "REPORT_TYPE_MISLEADING": "misleadingOther",
        "REPORT_TYPE_SEXUAL": "sexualUnlabeled",
        "REPORT_TYPE_RUDE": "harassmentOther",
        "REPORT_TYPE_OTHER": "other",
    }
    for env_name, rid in legacy_env.items():
        auto_lines.append(f"{env_name}={','.join(report_map.get(rid) or [])}")
    auto_lines.append(f"MODLABELS={','.join(sorted(set(modlabels)))}")
    auto_lines.append(f"AUTOBAN={','.join(autoban_parts)}")
    autolabel = "\n".join(auto_lines) + "\n"

    files = {
        "label-watcher.env": watcher,
        "graze-post-remover.env": graze,
        "autolabel.env": autolabel,
    }
    changed = False
    for name, body in files.items():
        path = OVERLAY_DIR / name
        prev = path.read_text(encoding="utf-8") if path.exists() else None
        if prev != body:
            changed = True
        path.write_text(body, encoding="utf-8")
    if changed and reload_workers:
        schedule_worker_reload("overlays")
    return files


def sync_now(
    identity: str | None = None,
    *,
    did: str | None = None,
    handle: str | None = None,
) -> dict:
    global _last_sync_error
    with _sync_lock:
        state = load_state()
        candidate = (
            identity
            or did
            or handle
            or state.get("labelerDid")
            or state.get("labelerHandle")
            or os.environ.get("LABELER_DID", "")
            or os.environ.get("LABELER_HANDLE", "")
        )
        if not str(candidate).strip():
            raise RuntimeError("Set a labeler DID or handle in the UI (or .env)")
        # Prefer the explicit identity string; only fall back to stored fields when absent
        if identity or did or handle:
            resolved_did, resolved_handle = resolve_labeler_identity(
                identity or did or handle,
            )
        else:
            resolved_did, resolved_handle = resolve_labeler_identity(
                did=state.get("labelerDid"),
                handle=state.get("labelerHandle"),
            )
        state["labelerDid"] = resolved_did
        if resolved_handle:
            state["labelerHandle"] = resolved_handle
        catalog, source = fetch_label_catalog(resolved_did)
        state = merge_discovery(state, catalog)
        state["lastSyncSource"] = source
        write_overlays(state)
        save_state(state)
        _last_sync_error = None
        return state


def background_sync_loop():
    while True:
        try:
            state = load_state()
            minutes = max(1, int(state.get("syncIntervalMinutes") or 15))
            did = (state.get("labelerDid") or "").strip()
            if did:
                sync_now(did)
        except Exception as e:
            global _last_sync_error
            _last_sync_error = str(e)
        try:
            state = load_state()
            minutes = max(1, int(state.get("syncIntervalMinutes") or 15))
        except Exception:
            minutes = 15
        time.sleep(minutes * 60)


@app.route("/login", methods=["GET", "POST"])
def login():
    if not APP_PASSWORD:
        return redirect(url_for("index"))
    err = None
    if request.method == "POST":
        if request.form.get("password") == APP_PASSWORD:
            session["authed"] = True
            return redirect(request.args.get("next") or url_for("index"))
        err = "Wrong password"
    return render_template("login.html", error=err)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login" if APP_PASSWORD else "index"))


@app.get("/")
@require_auth
def index():
    state = load_state()
    return render_template(
        "index.html",
        state=state,
        report_types=REPORT_TYPES,
        report_reasons=REPORT_REASONS,
        report_reason_categories=REPORT_REASON_CATEGORIES,
        sync_error=_last_sync_error,
        password_enabled=bool(APP_PASSWORD),
        accounts=accounts_public_view(state),
    )


@app.get("/api/state")
@require_auth
def api_state():
    state = load_state()
    state = {**state, "lastSyncError": _last_sync_error}
    return jsonify(state)


@app.post("/api/ozone/moderators/fetch")
@require_auth
def api_ozone_moderators_fetch():
    """Pull Ozone team (admin/moderator/triage) DIDs for the whitelist field."""
    data = request.get_json(silent=True) or {}
    labeler_patch = data.get("labeler") or {}
    if isinstance(labeler_patch, dict) and labeler_patch:
        updates: dict[str, str] = {}
        state = load_state()
        identity = (labeler_patch.get("identity") or "").strip()
        if identity:
            try:
                did, handle = resolve_labeler_identity(identity)
                updates["LABELER_DID"] = did
                if handle:
                    updates["LABELER_HANDLE"] = handle
                state["labelerDid"] = did
                if handle:
                    state["labelerHandle"] = handle
            except Exception as e:
                return jsonify({"ok": False, "error": str(e)}), 400
        if str(labeler_patch.get("password") or "").strip():
            updates["LABELER_APP_PASSWORD"] = str(labeler_patch["password"]).strip()
        if "ozoneUrl" in labeler_patch:
            ozone = clean_secret(labeler_patch.get("ozoneUrl"))
            updates["OZONE_URL"] = ozone
            derived = socket_url_from_ozone(ozone)
            if derived:
                updates["LABELER_SOCKET_URL"] = derived
        if updates:
            apply_env_updates(updates)
            save_state(state)

    secrets = load_secrets()
    state = load_state()
    did = clean_secret(state.get("labelerDid")) or clean_secret(secrets.get("LABELER_DID"))
    handle = clean_secret(state.get("labelerHandle")) or clean_secret(secrets.get("LABELER_HANDLE"))
    password = (secrets.get("LABELER_APP_PASSWORD") or "").strip()

    try:
        members = fetch_ozone_team_members(
            labeler_did=did,
            labeler_handle=handle,
            app_password=password,
        )
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    dids = [
        m["did"]
        for m in members
        if m.get("whitelistable")
    ]
    # Preserve prior whitelist choices when re-fetching; default = whitelistable roles
    prev = {
        d.strip()
        for d in (secrets.get("WHITELISTED_MODERATORS") or "").split(",")
        if d.strip().startswith("did:")
    }
    if prev:
        selected = [m["did"] for m in members if m["did"] in prev]
        # If previous selection empty after filter, fall back to whitelistable
        if not selected:
            selected = dids
    else:
        selected = dids

    apply_env_updates({"WHITELISTED_MODERATORS": ",".join(selected)})

    state = load_state()
    state["ozoneTeam"] = members
    state["ozoneTeamFetchedAt"] = utcnow()
    save_state(state)

    return jsonify({
        "ok": True,
        "members": members,
        "dids": selected,
        "whitelistedModerators": ",".join(selected),
        "count": len(members),
        "selectedCount": len(selected),
        "fetchedAt": state["ozoneTeamFetchedAt"],
        "state": state,
        "accounts": accounts_public_view(state),
    })


@app.get("/api/accounts")
@require_auth
def api_accounts_get():
    return jsonify({"ok": True, **accounts_public_view()})


@app.post("/api/accounts")
@require_auth
def api_accounts_post():
    """
    Save account config once.
    Body may include labeler / graze / optional sections.
    Labeler identity is resolved to DID+handle and written for all workers.
    """
    data = request.get_json(force=True) or {}
    updates: dict[str, str] = {}
    state = load_state()
    errors: list[str] = []

    labeler = data.get("labeler") or {}
    if isinstance(labeler, dict) and labeler:
        identity = (labeler.get("identity") or labeler.get("handle") or labeler.get("did") or "").strip()
        if identity:
            try:
                did, handle = resolve_labeler_identity(identity)
                updates["LABELER_DID"] = did
                if handle:
                    updates["LABELER_HANDLE"] = handle
                state["labelerDid"] = did
                if handle:
                    state["labelerHandle"] = handle
            except Exception as e:
                errors.append(str(e))
        if "password" in labeler and str(labeler.get("password") or "").strip():
            updates["LABELER_APP_PASSWORD"] = str(labeler["password"]).strip()
        if "ozoneUrl" in labeler:
            secrets_now = load_secrets()
            ozone = clean_secret(labeler.get("ozoneUrl"))
            updates["OZONE_URL"] = ozone
            derived = socket_url_from_ozone(ozone)
            current_socket = clean_secret(secrets_now.get("LABELER_SOCKET_URL"))
            old_derived = socket_url_from_ozone(secrets_now.get("OZONE_URL"))
            # Keep a Settings override; otherwise refresh auto firehose from Ozone
            has_override = bool(current_socket and current_socket != old_derived)
            if not has_override and derived:
                updates["LABELER_SOCKET_URL"] = derived
        if "socketUrl" in labeler and str(labeler.get("socketUrl") or "").strip():
            # Optional override (advanced) — wins over derived
            override = clean_secret(labeler.get("socketUrl"))
            if override:
                updates["LABELER_SOCKET_URL"] = (
                    override
                    if override.startswith("ws")
                    else socket_url_from_ozone(override)
                )
        if "whitelistedModerators" in labeler:
            updates["WHITELISTED_MODERATORS"] = str(labeler.get("whitelistedModerators") or "").strip()
        if "moderatorNotifications" in labeler:
            # Explicit list (did:dm,…), "none", or "default" (legacy: all whitelisted)
            raw = str(labeler.get("moderatorNotifications") or "").strip()
            updates["MODERATOR_NOTIFICATIONS"] = raw
        if "syncIntervalMinutes" in labeler:
            try:
                mins = max(1, int(labeler["syncIntervalMinutes"]))
                updates["LABEL_SYNC_INTERVAL_MINUTES"] = str(mins)
                state["syncIntervalMinutes"] = mins
            except (TypeError, ValueError):
                errors.append("syncIntervalMinutes must be an integer")

    graze = data.get("graze") or {}
    if isinstance(graze, dict) and graze:
        if "handle" in graze:
            updates["BSKY_HANDLE"] = normalize_handle(graze.get("handle") or "")
        if "password" in graze and str(graze.get("password") or "").strip():
            updates["BSKY_APP_PASSWORD"] = str(graze["password"]).strip()

    optional = data.get("optional") or {}
    if isinstance(optional, dict) and optional:
        secrets_now = load_secrets()
        mode = str(
            optional.get("dmAccount")
            if "dmAccount" in optional
            else (secrets_now.get("BSKY_DM_ACCOUNT") or "labeler")
        ).strip().lower() or "labeler"

        if "dmAccount" in optional:
            if mode not in ("labeler", "graze", "custom"):
                errors.append("dmAccount must be labeler, graze, or custom")
                mode = "labeler"
            updates["BSKY_DM_ACCOUNT"] = mode
            if mode in ("labeler", "graze"):
                updates["BSKY_DM_USERNAME"] = ""
                updates["BSKY_DM_PASSWORD"] = ""

        if mode == "custom":
            if "dmUsername" in optional:
                updates["BSKY_DM_USERNAME"] = normalize_handle(optional.get("dmUsername") or "")
            if "dmPassword" in optional and str(optional.get("dmPassword") or "").strip():
                updates["BSKY_DM_PASSWORD"] = str(optional["dmPassword"]).strip()

        if "uiPassword" in optional:
            updates["CONFIG_UI_PASSWORD"] = str(optional.get("uiPassword") or "").strip()

    settings = data.get("settings") or {}
    if isinstance(settings, dict) and settings:
        allowed = {f["key"]: f for f in SETTINGS_FIELDS}
        for key, val in settings.items():
            if key not in allowed:
                continue
            if val is None:
                continue
            val = str(val).strip()
            meta = allowed[key]
            if key in PASSWORD_KEYS and val == "":
                continue
            if key == "LABELER_SOCKET_URL":
                if not val:
                    # blank = re-derive from Ozone
                    ozone = updates.get("OZONE_URL") or load_secrets().get("OZONE_URL") or ""
                    derived = socket_url_from_ozone(ozone)
                    if derived:
                        updates[key] = derived
                    continue
                updates[key] = val if val.startswith("ws") else socket_url_from_ozone(val)
                continue
            # Empty + default → write default (except free-text fields meant to clear)
            clearable = {"MODERATOR_NOTIFICATIONS", "BSKY_DM_USERNAME"}
            if not val and meta.get("default") and key not in clearable:
                val = str(meta["default"])
            if key in ("POLLING_SECONDS", "OZONE_POLLING_SECONDS"):
                try:
                    val = str(max(1, int(val or "30")))
                except ValueError:
                    errors.append(f"{key} must be an integer")
                    continue
            if key == "LOG_LEVEL":
                val = (val or "INFO").upper()
            if key not in PASSWORD_KEYS:
                val = clean_secret(val) if key != "BSKY_SERVICE" else val
            updates[key] = val

    if errors and not updates:
        return jsonify({"ok": False, "error": "; ".join(errors)}), 400

    apply_env_updates(updates)
    save_state(state)

    resp = {"ok": True, **accounts_public_view(state), "updated": sorted(updates), "state": state}
    if errors:
        resp["warnings"] = errors
    if updates:
        resp["workersReload"] = "scheduled" if auto_reload_enabled() else "disabled"
    return jsonify(resp)


@app.get("/api/secrets")
@require_auth
def api_secrets_get():
    return jsonify({"ok": True, **secrets_public_view()})


@app.post("/api/secrets")
@require_auth
def api_secrets_post():
    """Legacy flat-key saver — prefer /api/accounts."""
    data = request.get_json(force=True) or {}
    incoming = data.get("secrets") or data
    if not isinstance(incoming, dict):
        return jsonify({"ok": False, "error": "Expected secrets object"}), 400

    # Map flat keys into accounts shape when possible
    labeler: dict = {}
    graze: dict = {}
    optional: dict = {}
    if incoming.get("LABELER_DID") or incoming.get("LABELER_HANDLE"):
        labeler["identity"] = incoming.get("LABELER_HANDLE") or incoming.get("LABELER_DID")
    if incoming.get("LABELER_APP_PASSWORD"):
        labeler["password"] = incoming["LABELER_APP_PASSWORD"]
    if "LABELER_SOCKET_URL" in incoming:
        labeler["socketUrl"] = incoming["LABELER_SOCKET_URL"]
    if "OZONE_URL" in incoming:
        labeler["ozoneUrl"] = incoming["OZONE_URL"]
    if "WHITELISTED_MODERATORS" in incoming:
        labeler["whitelistedModerators"] = incoming["WHITELISTED_MODERATORS"]
    if "BSKY_HANDLE" in incoming:
        graze["handle"] = incoming["BSKY_HANDLE"]
    if incoming.get("BSKY_APP_PASSWORD"):
        graze["password"] = incoming["BSKY_APP_PASSWORD"]
    if "BSKY_DM_USERNAME" in incoming:
        optional["dmUsername"] = incoming["BSKY_DM_USERNAME"]
    if incoming.get("BSKY_DM_PASSWORD"):
        optional["dmPassword"] = incoming["BSKY_DM_PASSWORD"]
    if "CONFIG_UI_PASSWORD" in incoming:
        optional["uiPassword"] = incoming["CONFIG_UI_PASSWORD"]

    # Reuse accounts endpoint logic via internal call
    with app.test_request_context(
        "/api/accounts",
        method="POST",
        json={"labeler": labeler, "graze": graze, "optional": optional},
    ):
        # Fall through: write directly instead of nested request
        pass

    updates: dict[str, str] = {}
    for key, val in incoming.items():
        if key not in SECRET_KEYS:
            continue
        if val is None:
            continue
        val = str(val).strip()
        if key in PASSWORD_KEYS and val == "":
            continue
        if key not in PASSWORD_KEYS:
            val = clean_secret(val)
        updates[key] = val

    state = load_state()
    if "LABELER_DID" in updates or "LABELER_HANDLE" in updates:
        try:
            did, handle = resolve_labeler_identity(
                updates.get("LABELER_DID") or updates.get("LABELER_HANDLE") or "",
            )
            updates["LABELER_DID"] = did
            if handle:
                updates["LABELER_HANDLE"] = handle
            state["labelerDid"] = did
            if handle:
                state["labelerHandle"] = handle
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400

    apply_env_updates(updates)
    save_state(state)
    return jsonify({"ok": True, **secrets_public_view(), "updated": sorted(updates)})


@app.post("/api/dm/test")
@require_auth
def api_dm_test():
    """Send a one-off test DM using the configured (or form) DM sender account."""
    data = request.get_json(force=True) or {}
    recipient = (data.get("to") or data.get("recipient") or "").strip()
    try:
        handle, password, source = resolve_dm_sender_creds(
            dm_account=data.get("dmAccount"),
            custom_handle=data.get("dmUsername"),
            custom_password=data.get("dmPassword"),
        )
        result = send_test_dm(
            sender_handle=handle,
            sender_password=password,
            recipient=recipient,
        )
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    return jsonify({"ok": True, "source": source, **result})


@app.get("/api/lists")
@require_auth
def api_lists_get():
    state = load_state()
    lists = state.get("blueskyLists") or {}
    return jsonify(
        {
            "ok": True,
            "lists": lists,
            "allCount": len(state.get("blueskyListsCatalog") or []),
            "matchedCount": sum(1 for v in lists.values() if v.get("found")),
            "configuredCount": len(lists),
            "fetchedAt": state.get("blueskyListsFetchedAt"),
            "actorDid": state.get("blueskyListsActorDid"),
            "actorHandle": state.get("blueskyListsActorHandle"),
            "listAccount": state.get("listAccount") or "labeler",
        }
    )


@app.post("/api/lists/refresh")
@require_auth
def api_lists_refresh():
    state = load_state()
    data = request.get_json(silent=True) or {}
    if "listAccount" in data:
        mode = str(data.get("listAccount") or "labeler").strip().lower()
        if mode not in ("labeler", "graze"):
            return jsonify({"ok": False, "error": "listAccount must be labeler or graze"}), 400
        prev_mode = (state.get("listAccount") or "labeler").strip().lower()
        state["listAccount"] = mode
        if mode != prev_mode:
            state["blueskyLists"] = {}
            state["blueskyListsCatalog"] = []
            state["blueskyListsFetchedAt"] = None
            state["blueskyListsActorDid"] = None
            state["blueskyListsActorHandle"] = None
        save_state(state)
    try:
        result = refresh_bluesky_lists(state)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    return jsonify({"ok": True, **result})


@app.get("/api/graze/feeds")
@require_auth
def api_graze_feeds_get():
    state = load_state()
    return jsonify(
        {
            "ok": True,
            "feeds": state.get("grazeFeeds") or [],
            "fetchedAt": state.get("grazeFeedsFetchedAt"),
            "grazeReady": accounts_public_view(state)["graze"]["ready"],
        }
    )


@app.post("/api/graze/feeds/refresh")
@require_auth
def api_graze_feeds_refresh():
    secrets = load_secrets()
    handle = clean_secret(secrets.get("BSKY_HANDLE"))
    password = (secrets.get("BSKY_APP_PASSWORD") or "").strip()
    data = request.get_json(silent=True) or {}
    if clean_secret(data.get("handle")):
        handle = normalize_handle(data["handle"])
    if (data.get("password") or "").strip():
        password = data["password"].strip()

    if not handle or not password:
        return jsonify({
            "ok": False,
            "error": "Set the Graze feeds account handle + app password first",
        }), 400

    try:
        feeds = fetch_graze_published_feeds(handle, password)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    state = load_state()
    state["grazeFeeds"] = feeds
    state["grazeFeedsFetchedAt"] = utcnow()
    save_state(state)
    return jsonify({
        "ok": True,
        "feeds": feeds,
        "fetchedAt": state["grazeFeedsFetchedAt"],
        "count": len(feeds),
    })


@app.post("/api/settings")
@require_auth
def api_settings():
    """Back-compat: map Connection-panel saves into /api/accounts labeler section."""
    data = request.get_json(force=True) or {}
    labeler = {
        "identity": (data.get("labeler") or data.get("labelerDid") or data.get("labelerHandle") or "").strip(),
    }
    if "syncIntervalMinutes" in data:
        labeler["syncIntervalMinutes"] = data["syncIntervalMinutes"]
    # Delegate
    request_json = {"labeler": {k: v for k, v in labeler.items() if v != "" and v is not None}}
    # Inline the accounts save
    updates: dict[str, str] = {}
    state = load_state()
    identity = labeler.get("identity") or ""
    if identity:
        try:
            resolved_did, resolved_handle = resolve_labeler_identity(identity)
            updates["LABELER_DID"] = resolved_did
            if resolved_handle:
                updates["LABELER_HANDLE"] = resolved_handle
            state["labelerDid"] = resolved_did
            if resolved_handle:
                state["labelerHandle"] = resolved_handle
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400
    if "syncIntervalMinutes" in data:
        state["syncIntervalMinutes"] = max(1, int(data["syncIntervalMinutes"]))
        updates["LABEL_SYNC_INTERVAL_MINUTES"] = str(state["syncIntervalMinutes"])
    apply_env_updates(updates)
    save_state(state)
    return jsonify({"ok": True, "state": state, "accounts": accounts_public_view(state)})


@app.post("/api/resolve")
@require_auth
def api_resolve():
    """Resolve handle↔DID without saving (for UI preview)."""
    data = request.get_json(force=True) or {}
    try:
        did, handle = resolve_labeler_identity(
            data.get("labeler") or data.get("value"),
            did=data.get("labelerDid") or data.get("did"),
            handle=data.get("labelerHandle") or data.get("handle"),
        )
        return jsonify({"ok": True, "labelerDid": did, "labelerHandle": handle})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.post("/api/sync")
@require_auth
def api_sync():
    try:
        data = request.get_json(silent=True) or {}
        state = sync_now(
            data.get("labeler") or data.get("labelerDid") or data.get("labelerHandle"),
            did=data.get("labelerDid"),
            handle=data.get("labelerHandle"),
        )
        return jsonify({"ok": True, "state": state, "newLabelIds": state.get("newLabelIds")})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400


@app.post("/api/actions")
@require_auth
def api_actions():
    data = request.get_json(force=True) or {}
    state = load_state()
    actions = state.setdefault("actions", {})
    updates = data.get("actions") or {}

    if "listAccount" in data:
        mode = str(data.get("listAccount") or "labeler").strip().lower()
        if mode not in ("labeler", "graze"):
            return jsonify({"ok": False, "error": "listAccount must be labeler or graze"}), 400
        prev_mode = (state.get("listAccount") or "labeler").strip().lower()
        state["listAccount"] = mode
        if mode != prev_mode:
            # Catalog belongs to the previous owner account.
            state["blueskyLists"] = {}
            state["blueskyListsCatalog"] = []
            state["blueskyListsFetchedAt"] = None
            state["blueskyListsActorDid"] = None
            state["blueskyListsActorHandle"] = None

    for ident, patch in updates.items():
        cur = actions.get(ident) or default_action()
        if "list" in patch:
            cur["list"] = patch["list"] if patch["list"] in ("off", "curate", "mod") else "off"
        if "grazeFeeds" in patch:
            cur["grazeFeeds"] = str(patch["grazeFeeds"]).strip()
        if "commandable" in patch:
            cur["commandable"] = bool(patch["commandable"])
        if "reportTypes" in patch:
            cur["reportTypes"] = migrate_report_types(patch["reportTypes"])
        if "autoban" in patch:
            cur["autoban"] = str(patch["autoban"]).strip()
        if "configured" in patch:
            cur["configured"] = bool(patch["configured"])
        else:
            # any save marks configured
            cur["configured"] = True
        actions[ident] = cur
        # dismiss from new queue when configured
        if cur.get("configured") and ident in state.get("newLabelIds", []):
            state["newLabelIds"] = [x for x in state["newLabelIds"] if x != ident]

    if data.get("dismissNew"):
        for ident in data["dismissNew"]:
            state["newLabelIds"] = [x for x in state.get("newLabelIds", []) if x != ident]

    # Sync list-owning account into .env whenever any list action is on (or mode changed)
    any_lists = any(
        (act.get("list") or "off") in ("curate", "mod")
        for ident, act in actions.items()
        if ident in (state.get("discovered") or {}) and not (state["discovered"][ident].get("stale"))
    )
    if any_lists or "listAccount" in data:
        try:
            sync_list_account_env(state)
        except Exception as e:
            if any_lists:
                return jsonify({"ok": False, "error": str(e)}), 400

    # Keep list link panel in sync with latest list modes (uses cached catalog).
    if state.get("blueskyListsCatalog"):
        rematch_bluesky_lists(state)

    write_overlays(state)
    save_state(state)
    return jsonify({
        "ok": True,
        "state": state,
        "overlays": [p.name for p in sorted(OVERLAY_DIR.glob("*.env"))],
        "workersReload": "scheduled" if auto_reload_enabled() else "disabled",
        "workersReloadStatus": worker_reload_status(),
    })


@app.get("/api/workers/reload")
@require_auth
def api_workers_reload_status():
    return jsonify({"ok": True, "autoReload": auto_reload_enabled(), **worker_reload_status()})


@app.post("/api/workers/reload")
@require_auth
def api_workers_reload_now():
    result = run_worker_reload("manual")
    return jsonify({"ok": result.get("ok", False), **result}), (200 if result.get("ok") else 500)


@app.get("/api/overlays")
@require_auth
def api_overlays():
    OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
    out = {}
    for p in sorted(OVERLAY_DIR.glob("*.env")):
        out[p.name] = p.read_text(encoding="utf-8")
    return jsonify(out)


@app.get("/health")
def health():
    return jsonify({"ok": True, "syncedAt": load_state().get("syncedAt")})


def main():
    OVERLAY_DIR.mkdir(parents=True, exist_ok=True)
    if not CONFIG_PATH.exists():
        save_state(default_state())
    t = threading.Thread(target=background_sync_loop, daemon=True)
    t.start()
    port = int(os.environ.get("CONFIG_UI_PORT", "8787"))
    app.run(host="0.0.0.0", port=port, debug=False)


if __name__ == "__main__":
    main()
