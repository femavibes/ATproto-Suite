# Master Admin App Roadmap (Planned)

This is a planned control plane for the service operator (you), separate from regular feed-builder user flows.

## Goals

- Curate and manage a module repository used by the React app.
- Operate shared-host safety controls without blocking user autonomy.
- Provide visibility into usage and abuse patterns.

## Planned capabilities

1. **Module curation**
   - Approve/reject module submissions.
   - Versioned module publishing.
   - Trusted/verified module labels.

2. **Policy and limits**
   - Per-user and per-feed rate limits.
   - Quotas (feed count, API usage, storage budgets).
   - Emergency disable/suspend controls.

3. **Operations**
   - Dashboard for feed traffic, assignment throughput, errors.
   - Alerting hooks and audit trail.
   - Manual remediation tooling.

## Non-goals for current phase

- No hard multi-tenant admin app implementation in this phase.
- Current focus remains feed creation, publishing readiness, and deployment onboarding.
