# Memory Leak Investigation Notes

## Scope

This document tracks the ongoing memory leak/churn investigation in the visual editor (`services/visual-editor`), including experiments, outcomes, and current temporary toggles.

Date: 2026-04-21 (updated 2026-04-22)

## Symptoms Observed

- Chrome memory grows over time even while idle (no user actions).
- Running Debug significantly amplifies memory growth.
- Earlier behavior could ramp into multi-GB memory and eventual tab instability/crash.

### User-reported checkpoints (approximate)

- Idle alone can reach **~600MB+** and keep climbing.
- After Debug, often **~1GB+**; long sessions have reached **~2.5GB**.
- User observation: **memory still climbs even without ever opening Debug** — Debug is an amplifier, not the only source.

## Telemetry Setup Used

- Local client stats: `window.__debugMemStats` (from `Canvas.jsx`).
- Server-side sampling endpoint:
  - `POST /api/debug/memory-sample`
  - `GET /api/debug/memory-samples`
- During diagnosis, server logging was temporarily enhanced to print each sample:
  - `debug-mem-sample did=... used=... trend10=... panelOpen=...`
- Remote POST telemetry can be disabled in code (`REMOTE_MEM_TELEMETRY_ENABLED`) to rule out network/diagnostics overhead.

## What Was Tested

### 1) Remove large graph payload injection into nodes

- Stopped passing edge arrays into node data broadly.
- Removed additional edge injection that was reintroduced for handle glow logic.
- Also removed N-of node reliance on full `edges` / `nodes` arrays in its `data`.

Result: reduced churn; did not fully eliminate growth.

### 2) Freeze debug panel inputs

- Debug panel now receives a compact graph snapshot captured at debug execution time.
- Avoids repeated recomputation against live mutable graph objects while panel is open.

Result: improved debug behavior; leak still present.

### 3) Reduce debug panel rerender churn

- Wrapped `DebugResultsPanel` in `React.memo`.
- Stabilized callback props passed from `Canvas`.

Result: helped, but not sufficient alone.

### 4) Remove canvas-level debug styling churn

- Stopped injecting `evaluationResult` into each node's data for rendering.
- Stopped per-edge debug dash style recomputation in `edgesForRender`.
- Debug information remains in the panel.

Result: meaningful improvement in debug amplification.

### 5) History and parent sync isolation

- Added temporary flags to disable:
  - history snapshot capture
  - parent state sync callback
- Goal: rule out undo/redo and parent sync loops as primary source.

Result: baseline idle climb persisted even with both disabled.

### 6) Minimal canvas isolation mode

- Added URL toggle `?minimalCanvas=1` to bypass ReactFlow rendering and show placeholder.

Result: memory spikes still occurred in some windows, so not solely "ReactFlow on canvas" — but ReactFlow + minimap + graph size remain prime suspects for steady climb.

### 7) Disable remote telemetry POST loop

- Added temporary toggle to disable browser POSTs of memory samples.
- Local `window.__debugMemStats` still updates.

Result: removes telemetry overhead as a confounder during tests.

### 8) Remove continuous `fitView` on `<ReactFlow />`

- Dropped the `fitView` boolean prop so React Flow does not keep re-fitting the viewport on churny rerenders.

Result: user-reported climb still serious; likely helps but not a full fix.

### 9) Handler factory double-call (per node, per render)

- Many `switch` branches called `nodeHandlers.createXHandler(node)` **twice** (object spread + `.data` spread).
- Consolidated with `withConfiguredHandler(factory)` (single call per case).
- Fixed `nof` branch which still double-called `createNOfHandler`.

Result: fewer allocations per render.

### 10) Logic `childCount` — O(n²) → O(n)

- Previously: for each logic node, `nodes.filter(...)` over the full graph.
- Now: one `useMemo` builds `Map<parentId, count>`; each logic node reads O(1).

Result: cheaper `nodesWithHandlers` rebuilds on large graphs.

## Mitigations Shipped (current `Canvas.jsx`)

| Change | Purpose |
|--------|---------|
| `onlyRenderVisibleElements` on `<ReactFlow />` | Only mount DOM for nodes/edges in viewport when possible. |
| **MiniMap off by default** + "Show minimap" / "Hide minimap" | MiniMap mirrors the graph to another surface — common memory/GPU cost on large graphs. |
| History re-enabled with **signature gate** + `HISTORY_LIMIT = 8` | Undo without snapshotting identical graph state. |
| Parent `onStateChange` sync re-enabled | Tree / parent features need it; ruled out as sole leak. |
| `REMOTE_MEM_TELEMETRY_ENABLED = false` | Avoid background `fetch` unless we turn it on for a profiling session. |

## Root-Cause Status

**Major bug fixed (2026-04-21):** `createNodeHandlers(setModalState)` was invoked on **every** `Canvas` render, producing a new `nodeHandlers` object each time. Because `nodesWithHandlers` depends on `nodeHandlers`, React recomputed the **entire node list** (new objects + new closures in `data`) on every parent re-render. That is extreme allocation churn and matches "idle memory keeps climbing" even without Debug.

- Fix: `const nodeHandlers = useMemo(() => createNodeHandlers(setModalState), [setModalState])`
- Same pattern for `createModalHandlers(setNodes)` → `useMemo`.

**Second bug fixed (2026-04-21):** `useEffect` syncing the project toolbar depended on **`props`** (`[projects, projectId, props]`). The `props` object is a **new reference on every parent render**, so the effect ran constantly, called `onProjectStateChange` with a **new object every time**, and tended to keep `App` + `Canvas` in a tight re-render / state-update loop. That amplifies heap growth even when the graph is unchanged.

- Fix: depend only on `props.onProjectStateChange` (stable `useCallback` from `App.jsx`), not `props`.

**Third fix (2026-04-21):** `handleToggleLogicMode` listed `nodes` and `edges` in its `useCallback` deps, so its identity changed on **every graph change** — and more importantly, any unrelated churn that touched `nodes`/`edges` forced `nodesWithHandlers` to rebuild. Refactored to use only functional `setNodes` / `setEdges` updates and **`[setNodes, setEdges]`** deps.

Working theory (multi-factor):

1. ~~Handler factory recreated every render~~ (fixed — was likely dominant).
2. ~~React render cascade from `nodes` captured in deps~~ (fixed 2026-04-22 — see below).
3. **Large React Flow graphs** (many custom nodes) + **MiniMap** + **full-graph work** on each meaningful render.
4. **Heap growth vs true leak**: Chrome can show high "JS heap" while holding allocated graphs and devtools; still, sustained climb without user action is abnormal and we keep tightening.
5. Debug path adds **large evaluation maps** and **debug tree** work — reduced but not eliminated.

---

## 2026-04-22: Root Cause Found and Fixed — Continuous Re-render Cascade

**Status: RESOLVED.** Memory is now stable at idle (~800MB baseline, not climbing). The leak was a self-sustaining re-render cascade driven by `nodes` being captured as a reactive dependency in the wrong places.

### What was happening

Six separate bugs compounded into a continuous allocation loop:

**Bug 1: `nodesWithHandlers` useMemo depended on `nodes` directly**

The `'end'` node case in `nodesWithHandlers` closed over `nodes` to find other bound END nodes:
```js
nodes.filter((n) => n.type === 'end' && n.id !== nodeWithDelete.id && n.data?.feedId)
```
This meant `nodesWithHandlers` recomputed on **every single node change** (position from dragging, data updates, dimension measurement). Since `nodesWithHandlers` creates new objects and closures for all visible nodes, this was the dominant allocation source.

**Bug 2: `handleCenterView` captured `nodes` → triggered a HistoryContext cascade**

`handleCenterView` had `nodes` in its `useCallback` deps. This caused a continuous loop:
- `nodes` changes → `handleCenterView` gets new identity
- The HistoryContext registration `useEffect` fires (it depended on `handleCenterView`)
- `historyContext.registerCenterView(handleCenterView)` called `setCenterViewFn()` in HistoryContext
- HistoryContext stored registered callbacks in **`useState`**, so every registration triggered a state update
- HistoryContext re-renders → new context value object (inline `{}` literal) → all consumers re-render
- Canvas re-renders → `historyContext` is a new reference → registration effect fires **again**
- Second registration: same function reference → React bails out, but by then `saveToHistory` / `handleUndo` / `handleRedo` had also rebuilt (they depended on `historyContext`)

This cascade fired on **every `nodes` change** — including ReactFlow's internal dimension measurements on startup.

**Bug 3: HistoryContext stored callbacks in `useState`**

Each call to `registerUndo/registerRedo/registerClear/registerZoomToFit/registerCenterView` triggered a state update, re-rendering HistoryContext and producing a new inline context value object. All context consumers (Canvas, Sidebar, Breadcrumb) re-rendered on every registration.

**Bug 4: `onNodesChange` captured `nodes`**

`nodes.find(...)` inside `onNodesChange` put `nodes` in its deps array. ReactFlow received a new `onNodesChange` function reference on every node mutation.

**Bug 5: Auto-create START→Junction→END effect depended on `nodes`**

The effect that auto-creates the mini-flow when entering a group container had `nodes` in its deps. It ran O(n) filter work on every node mutation to check if a START node already existed — even when not inside any container.

**Bug 6: `saveToHistory`/`handleUndo`/`handleRedo`/`handleClearCanvas` depended on `historyContext`**

Since `historyContext` is the memoized context value object, it changed whenever `canUndo`/`canRedo` changed. This caused all those callbacks to rebuild and re-register into the HistoryContext cascade described in Bug 2.

### Fixes applied (commit `9261b65`)

**`Canvas.jsx`:**

- Added `nodesRef` — a `useRef` updated synchronously each render (`nodesRef.current = nodes`). Used inside closures and effects that need the latest nodes value without it being a reactive dependency.
- `nodesWithHandlers` `'end'` case: `nodes.filter(...)` → `nodesRef.current.filter(...)` — removed `nodes` from the useMemo deps array.
- `handleCenterView`: `nodes.map(...)` → `nodesRef.current.map(...)` — stable identity across node changes, breaking the HistoryContext cascade entirely.
- `onNodesChange`: `nodes.find(...)` → `nodesRef.current.find(...)` — removed `nodes` from deps.
- Auto-create effect: `nodes.filter(...)` → `nodesRef.current.filter(...)` — removed `nodes` from deps; effect now only fires on navigation changes (`currentContainer`, `path`).
- Destructured `historySetCanUndo` / `historySetCanRedo` from `historyContext` — these are stable React state setters used directly in deps arrays instead of the whole `historyContext` object.
- Registration effect now uses destructured stable `register*` functions — no longer depends on `historyContext` object reference.

**`HistoryContext.jsx`:**

- Changed callback storage from `useState` to `useRef`. Registering a handler now has zero cost — no state update, no re-render.
- All `handle*` functions are `useCallback(() => { ref.current?.() }, [])` — permanently stable identity.
- Context `value` wrapped in `useMemo` so consumers only re-render when `canUndo`/`canRedo` actually change, not on every registration.

### Result

Memory is **stable at idle** (~800MB). Not climbing. The cascade is gone.

---

## Temporary / URL Flags

In `Canvas.jsx`:

- `MINIMAL_CANVAS_ISOLATION_MODE` — `?minimalCanvas=1` bypasses ReactFlow (diagnostics only).
- `REMOTE_MEM_TELEMETRY_ENABLED` — set `true` only when you want server-side sample logs.

## Known Remaining Optimizations (not leaks — reduce baseline memory)

The ~800MB stable baseline could be brought down further with the following. None are urgent, but they're well-scoped if you want to revisit:

| Optimization | What it does | Effort |
|---|---|---|
| Wrap `Canvas` in `React.memo` | Stops App re-renders from cascading into Canvas unnecessarily | Low |
| Stabilize `onConnectStart`/`onConnectEnd` inline arrows in `<ReactFlow>` JSX | They're new function refs every render; ReactFlow sees prop changes and updates its internal store | Low |
| `hasEndPipelineModuleInSlot` + 3 similar `useCallback([nodes, currentContainer])` → use `nodesRef` | 4 callbacks that rebuild on every node change even though they only matter in end-pipeline view | Low |
| `endPipelineSlotCount` + 3 similar `useMemo([nodes, ...])` → use `nodesRef` | 4 memos that recompute at root level even though they only produce meaningful values in end-pipeline view | Low |
| Lazy-load heavy modal components | Reduces initial bundle parse cost and V8 heap from closed modals being fully compiled | Medium |
| Cap or virtualize large graphs | Hard ceiling on per-canvas node count to bound all O(n) work | High |
