# Publishing feeds on Bluesky

End-to-end, a custom feed needs three pieces:

1. **This service** exposes `GET /xrpc/app.bsky.feed.getFeedSkeleton` and hosts a **`did:web`** document so Bluesky can find your feed generator.
2. A Bluesky account creates an **`app.bsky.feed.generator`** record that points at this service.
   - **Default/simple mode**: use a service publisher account (recommended, e.g. `@Branch`).
   - **Advanced mode**: use the logged-in user's own account.
3. **Posts in `feed_posts`** (from your assignment worker / ingestion) so the skeleton returns real URIs.

## 1. Configure the public URL

Set the same value on the **feed-api** process:

- `PUBLIC_BASE_URL` — HTTPS origin only, no path, e.g. `https://feeds.example.com`

Then verify:

- `GET https://feeds.example.com/.well-known/did.json` returns JSON with `id: "did:web:feeds.example.com"` and a `BskyFeedGenerator` service pointing at that origin.

## 2. Register the generator record (CLI)

From `services/feed-api` (with dependencies installed), using a **feed UUID** from your database:

```bash
export DATABASE_URL="postgresql://..."
export PUBLIC_BASE_URL="https://feeds.example.com"

# Simple/default onboarding mode (service-owned publisher account):
export PUBLISH_IDENTIFIER="Branch"
export PUBLISH_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"

# Optional advanced override (publish with user account):
# export BSKY_IDENTIFIER="user.handle.bsky.social"
# export BSKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"

python scripts/register_bluesky_feed.py "<feed-uuid>"
```

The script:

- Logs into Bluesky with configured publisher account app password (treat like a password; do not commit it).
- Creates `app.bsky.feed.generator` with rkey = UUID **without hyphens** (32 hex characters).
- Saves the resulting AT URI into `feeds.bluesky_feed_uri` when successful.

Your feed’s AT URI will look like:

`at://<your-did>/app.bsky.feed.generator/<32-hex-rkey>`

That URI is what people paste into Bluesky to follow the feed.

## 3. Populate posts

`getFeedSkeleton` reads from `feed_posts` joined to `posts`. Until the assignment worker (or manual SQL) inserts rows, the feed will be empty.

## Troubleshooting

- **404 Feed not found** — Last path segment must match feed `id` (UUID, with or without dashes) or `slug`.
- **503 did.json** — Set `PUBLIC_BASE_URL` on feed-api.
- **Generator rejected** — Confirm HTTPS, DID doc is reachable, and `PUBLIC_BASE_URL` matches the hostname in `did:web`.
