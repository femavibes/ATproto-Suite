# ATproto Suite

A collection of tools and apps built around the AT Protocol / Bluesky ecosystem.

## Structure

```
ATproto-Suite/
  feed-tools/
    feed-compare/               — A/B compare two Bluesky feed generators, with snapshot and session tracking

  graze/
    graze-feed-moderator/       — Feed moderation tooling for Bluesky, includes browser extension and zero-trust auth proxy
    graze-post-remover/         — Bulk post removal tool for Bluesky accounts
    graze-custom-node-manager/  — Custom node manager for Graze feed infrastructure

  ozone/
    ozone-label-master/         — Label management tooling for Ozone moderation service
    ozone-report-to-autolabel/  — Automatically converts Ozone reports into labels

  bots/
    daily-content-bot/          — Automated daily content posting bot for Bluesky

  archive/
    feed-gen/                   — Original feed generator (superseded by fema-feeds)
```

Each app is self-contained with its own package.json and runs independently.

## Related

- [fema-feeds](https://github.com/femavibes/fema-feeds) — Bluesky feed generator platform
- [ATlas](https://github.com/femavibes/ATlas) — Interactive map of Bluesky users and communities
- [fema.monster](https://fema.monster) — Project index
