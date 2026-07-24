# Incident Log - 2026-04-26

## Scope

This document records all major operational and code changes made today to restore Near You / ATlas feed availability and reduce repeated `Upstream service unreachable` failures.

## Initial Symptoms Reported

- Near You feed not loading.
- User-visible error: `could not resolve identity: did:web:nearyou.atls.city`.
- Later user-visible error: `Upstream service unreachable`.

## Environment and Service Topology Confirmed

- Nginx serves `nearyou.atls.city`.
- Nginx routes:
  - `/.well-known/*` and `/xrpc/*` -> `127.0.0.1:4000` (Near You feed service).
  - `/` -> `127.0.0.1:4002` (Near You user site).
- PM2 processes:
  - `near-you-feed` (feed service expected on `:4000`)
  - `near-you-admin` (`:4001`)
  - `near-you-user` (`:4002`)
- Postgres ports observed:
  - `:5435` (Near You / ATlas data path used by Near You runtime)
  - `:5432` (separate postgres listener)

## Root Causes Identified

### 1) Disk Exhaustion on Host

- Root filesystem hit 100% usage.
- Observed errors:
  - Docker mount failures: `no space left on device`
  - Postgres write failures
  - Nginx log write failures
- Effect:
  - Services intermittently failed to start, bind, or serve.
  - Identity and feed endpoints returned 502 / upstream failures.

### 2) Feed Service Process Instability

- `near-you-feed` repeatedly unavailable on `127.0.0.1:4000`.
- Nginx error log showed:
  - `connect() failed (111: Connection refused)` to upstream `:4000`
  - `upstream timed out` for `getFeedSkeleton`
  - `upstream prematurely closed connection`
- PM2 showed repeated restarts and high memory usage spikes.

### 3) Runtime Compatibility and Process Drift

- Confirmed dependency remained `@skyware/jetstream@0.2.5`.
- During troubleshooting, process startup and runtime path exhibited `ERR_REQUIRE_ESM` history in logs.
- Also detected stale/orphaned process state where PM2 PID and actual listener behavior were inconsistent at times.

### 4) High Query/Scoring Load for Feed Requests

- `near-you` algorithm path performed expensive per-request work.
- Candidate selection and historical interaction reads could create heavy memory/latency pressure under active traffic.

## Data Safety Constraints and Decisions

- Explicit user requirement: **Do not lose Atlas Postgres data**.
- No Atlas Postgres data volumes were deleted.
- No destructive resets performed on Atlas DB.

## Storage and Database Actions Performed

### Feed-gen Postgres Data Wipe (User Requested)

- Measured `feed-gen_postgres_data` volume at ~18.13 GB.
- Deleted only `feed-gen_postgres_data` volume.
- Confirmed substantial disk recovery afterward.

### Safe Docker Cleanup

- Ran safe image/build-cache cleanup (no Atlas volume deletion).
- Did **not** run Atlas data-destructive volume prune against active Atlas DB volume.
- Verified `atlas_postgres_data` volume remained present.

### Feed-gen Shutdown (User Requested)

- Stopped and removed PM2 `feed-gen-ui`.
- Stopped `feedgen-api.service` and `feedgen-assignment-worker.service`.
- Verified feed-gen services inactive.

## Service Restart and Validation Steps

### ATlas Stack

- Restarted ATlas compose services.
- Confirmed container/service health for core Atlas services.

### Near You Feed

- Restarted `near-you-feed` multiple times while correlating:
  - PM2 process state
  - listener binding on `:4000`
  - external endpoint responses
  - nginx upstream errors

### Endpoint Probes Repeatedly Executed

- `https://nearyou.atls.city/.well-known/did.json`
- `https://nearyou.atls.city/xrpc/app.bsky.feed.getFeedSkeleton?...`
- Local upstream direct checks on `http://127.0.0.1:4000/...`

## Code Changes Applied Today

All code changes were made in `Near-You` code to reduce startup/runtime breakage and request load.

### 1) Jetstream Import Handling in `subscription.ts`

- Adjusted import strategy for `@skyware/jetstream` runtime compatibility.
- Rebuilt project after changes.
- Confirmed dependency version remained unchanged (`0.2.5`).

### 2) Candidate Query Cap in `near-you.ts`

- Added bounded candidate cap to reduce memory pressure during scoring.
- Introduced/used config key: `max_candidate_posts`.
- Current default set to `1000` in code path via fallback.

### 3) Bounded User Interaction History Reads in `near-you.ts`

- Added time-window cap for served/like/repost history reads.
- Introduced/used config key: `interaction_history_days`.
- Current default set to `30` days in code path via fallback.

### 4) Runtime Heap Increase for Feed Process

- Relaunched feed process via PM2 with:
  - `--max-old-space-size=8192`

## Operational Findings During Incident

- A restart window can still produce temporary 502 until `:4000` is actually bound.
- Historically, startup sequence includes label drain/cache setup work before steady state.
- Heavy authenticated feed requests (`limit=30`) were a key trigger for upstream timeouts during instability phases.

## Current State at End of Session

- Feed process currently online under PM2 as `near-you-feed`.
- No new fatal error lines in latest process error log snapshot at the end.
- Nginx historical logs still contain many timeout/refused events from earlier incident windows.
- Feed availability improved after code caps and process cleanup, but intermittent behavior has occurred across the day and should be considered high-risk until monitored over longer uptime.

## Recommended Follow-up (Next Actions)

1. **Startup order hardening**
   - Bind HTTP listener earlier, then warm labels/cache in background to avoid restart-gap 502s.
2. **Add request timeout budgeting and query telemetry**
   - Log per-request query timings and candidate counts in feed handler.
3. **Add circuit-breaker style degradation**
   - If heavy scoring path exceeds budget, return reduced candidate mode instead of timing out.
4. **Set persistent PM2 ecosystem config**
   - Lock interpreter, node args, restart delay, max memory restart thresholds, and env in one source of truth.
5. **Create metrics dashboard**
   - Track:
     - `:4000` bind uptime
     - feed request latency p95/p99
     - timeout count
     - OOM/restart events
     - candidate count distribution

## Quick Timeline Summary

- Identified initial DID resolution failures and 502 responses.
- Found host disk full condition and Docker/storage pressure.
- Cleared requested feed-gen Postgres volume and safe Docker artifacts.
- Preserved Atlas Postgres data per requirement.
- Restarted app services and validated partial recovery.
- Diagnosed recurring upstream failures under feed load.
- Applied code caps in feed algorithm to reduce workload.
- Rebuilt and redeployed Near You feed process with higher heap and cleaned PM2 state.
- Revalidated endpoints and process health repeatedly.

---

Generated by operational debugging session on 2026-04-26.


## Post-Incident Addendum (Later Same Day)

This section documents additional emergency changes made after repeated user reports that the feed was still down (including around 1:30 PM and 1:37 PM Pacific).

### Additional Findings

- Failures were not only startup bind gaps.
- Nginx showed repeated `upstream timed out` events for authenticated feed calls (`near-you` and `near-you-live`).
- Feed process memory repeatedly climbed to multi-GB and then degraded into timeout/restart behavior.
- Memory growth occurred even during low external request load, indicating background/runtime pressure in addition to request-path cost.

### Additional Emergency Changes Applied

1. **Tighter runtime defaults**
   - `max_candidate_posts` fallback reduced to `300`.
   - `interaction_history_max_rows` fallback set to `1000`.

2. **Global feed limit clamp**
   - Added `xrpc_max_limit` (fallback `30`) to clamp `getFeedSkeleton` limit values.

3. **`near-you-live` hard query caps**
   - Added effective request limit clamp.
   - Added `live_max_query_rows` (fallback `500`).
   - Added `live_max_post_age_hours` (fallback `72`).

4. **Startup behavior hardening**
   - Refactored feed startup so HTTP listener binds earlier.
   - Heavy init tasks moved behind listener bind.

5. **Label reconnect fix**
   - Label subscription reconnect now resumes from last seen cursor instead of replaying from `cursor=0`.

6. **In-memory cache pressure mitigation**
   - Pagination cache now stores URI lists (not full scored objects).
   - Added safety toggles defaulted off:
     - `pagination_cache_enabled` fallback `false`
     - `candidate_cache_enabled` fallback `false`

7. **Emergency isolation toggle for service recovery**
   - Added `realtime_ingestion_enabled` (fallback `false`).
   - When false, feed server skips label websocket + jetstream startup.
   - This was the key emergency stabilization to keep feed online while leak/source investigation is deferred.

### Current Operational Tradeoff

- **Status:** feed reachable and user-confirmed working.
- **Tradeoff:** with realtime ingestion disabled, feed freshness may be reduced versus normal operation because live ingest is paused.
- This mode is intentional for outage containment and can be revisited once deeper profiling is done.

### Suggested Revert / Re-enable Sequence (Controlled)

To review quality impact safely after the incident, apply changes one at a time with observation windows:

1. Keep:
   - startup bind-first behavior
   - request limit clamp (`xrpc_max_limit`)
   - interaction-history bounds
2. Carefully tune:
   - `max_candidate_posts` upward in steps (`500` then `800`) while tracking p95/p99 and RSS
3. Evaluate cache re-enables one-by-one:
   - `candidate_cache_enabled`
   - `pagination_cache_enabled`
4. Re-enable realtime last:
   - set `realtime_ingestion_enabled=true`
   - monitor RSS growth, restart count, nginx timeouts for multiple hours

### Why This Was Done During Incident

These changes were applied under active outage pressure to restore availability first and preserve Atlas data safety requirements. They should now be reviewed as a set, with selective rollback/tuning based on measured feed quality and stability.
