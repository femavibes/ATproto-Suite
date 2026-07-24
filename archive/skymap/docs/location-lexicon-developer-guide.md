# ATlas Location Lexicon — Developer Guide

## Overview

ATlas stores user location data on their PDS using a custom lexicon that wraps the community-standard address format. This allows any AT Protocol app to read (and optionally write) a user's geographic location.

**Record location:** `at://<did>/city.atlas.actor.location/self`

**Public read (no auth needed):**
```
GET https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=<did>&collection=city.atlas.actor.location&rkey=self
```

---

## Schema

### `city.atlas.actor.location`

Singleton record (`rkey: self`) containing up to 3 location entries.

```json
{
  "$type": "city.atlas.actor.location",
  "locations": [
    {
      "address": {
        "$type": "community.lexicon.location.address",
        "country": "US",
        "region": "Oregon",
        "locality": "Portland",
        "name": "Portland, Oregon"
      },
      "atlasKey": "US-OR-Portland",
      "osmId": 1666626393,
      "osmType": "node",
      "isPrimary": true,
      "addedAt": "2025-06-01T18:30:00.000Z"
    },
    {
      "address": {
        "$type": "community.lexicon.location.address",
        "country": "US",
        "region": "Texas",
        "locality": "Austin",
        "name": "Austin, Texas"
      },
      "atlasKey": "US-TX-Austin",
      "osmId": 113314,
      "osmType": "relation",
      "isPrimary": false,
      "addedAt": "2025-06-15T12:00:00.000Z"
    }
  ],
  "updatedAt": "2025-06-15T12:00:00.000Z"
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `locations` | array | yes | Up to 3 location entries |
| `updatedAt` | datetime | yes | Last modification timestamp |

### Location Entry

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `address` | object | yes | `community.lexicon.location.address` object |
| `atlasKey` | string | no | ATlas canonical location key (e.g. `US-OR-Portland`). **Strongly recommended** — ensures exact matching. |
| `osmId` | integer | no | OpenStreetMap node/relation ID. Globally unique geographic identifier. |
| `osmType` | string | no | OSM element type: `node`, `way`, or `relation` |
| `isPrimary` | boolean | yes | Whether this is the user's primary location |
| `addedAt` | datetime | no | When this location was added |

### Address (community.lexicon.location.address)

This is the [Lexicon Community](https://lexicon.community) standard address format. Using it means your app is already compatible with other apps that understand this schema (e.g., calendar events on Smoke Signal).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `country` | string | yes | ISO 3166 country code (2-letter preferred) |
| `region` | string | no | State, province, prefecture, etc. |
| `locality` | string | no | City, town, village |
| `street` | string | no | Street address (not used by ATlas) |
| `postalCode` | string | no | Postal/zip code (not used by ATlas) |
| `name` | string | no | Human-readable display name |

---

## Resolving Location Keys

Before writing a location, look up the canonical `atlasKey` using the public API:

```
GET https://atls.city/api/locations/lookup?q=portland&country=US
```

Response:
```json
{
  "results": [
    {
      "atlas_key": "US-OR-Portland",
      "locality": "Portland",
      "region": "Oregon",
      "country": "US",
      "display_name": "Portland, Oregon",
      "population": 652503,
      "location_type": "city"
    },
    {
      "atlas_key": "US-ME-Portland",
      "locality": "Portland",
      "region": "Maine",
      "country": "US",
      "display_name": "Portland, Maine",
      "population": 68408,
      "location_type": "city"
    }
  ],
  "usage": "Include atlas_key in the atlasKey field when writing city.atlas.actor.location records for exact matching."
}
```

Parameters:
- `q` (required) — city name search (min 2 chars)
- `country` (optional) — ISO 3166 country code filter
- `region` (optional) — region/state name filter

This endpoint has CORS enabled and requires no authentication.

---

## Writing to a User's PDS

To write location data on behalf of a user:

1. Request OAuth scope: `repo:city.atlas.actor.location`
2. Use `com.atproto.repo.putRecord` with `rkey: self`

```javascript
await oauthSession.fetchHandler('/xrpc/com.atproto.repo.putRecord', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    repo: did,
    collection: 'city.atlas.actor.location',
    rkey: 'self',
    record: {
      $type: 'city.atlas.actor.location',
      locations: [
        {
          address: {
            $type: 'community.lexicon.location.address',
            country: 'US',
            region: 'Oregon',
            locality: 'Portland',
            name: 'Portland, Oregon'
          },
          isPrimary: true,
          addedAt: new Date().toISOString()
        }
      ],
      updatedAt: new Date().toISOString()
    }
  })
});
```

---

## Best Practices

- **Read before write.** If the user already has locations, merge rather than overwrite.
- **Max 3 locations.** ATlas enforces a limit of 3 location entries per user.
- **Exactly one primary.** One entry should have `isPrimary: true`.
- **Use ISO 3166 country codes.** 2-letter codes preferred (US, GB, DE, JP, etc.).
- **Include `atlasKey` when possible.** This is the most reliable way to ensure ATlas recognizes the location. Without it, ATlas falls back to fuzzy text matching on locality/region/country which can fail for ambiguous city names.
- **Look up keys first.** Call `https://atls.city/api/locations/lookup?q=<city>` to get the canonical `atlasKey` before writing.
- **Region = administrative division.** State (US), province (CA), prefecture (JP), Bundesland (DE), etc.
- **Locality = city/town.** The most specific named place.

---

## Coordination with ATlas

ATlas (https://atls.city) is currently the primary app managing this lexicon. When a user tags their location on ATlas, the record is written to their PDS automatically.

ATlas also monitors the AT Protocol firehose for any writes to `city.atlas.actor.location`. If your app writes a location record to a user's PDS, ATlas will automatically:

1. Match using `osmId` if present (OpenStreetMap ID — most reliable)
2. Match using `atlasKey` if present (exact match against ATlas location database)
3. Fall back to matching address fields (locality + region + country) if neither key is present
4. Add the user to ATlas with the matched location(s)
5. Apply the corresponding Ozone label(s)

This means users who set their location in *your* app will show up on ATlas without any extra work.

**Important notes for writing apps:**

- ATlas can only match locations that exist in its database (cities it tracks). If you write a location ATlas doesn't recognize, it will be skipped.
- Use the exact city name in `locality` (e.g. "Portland", not "Portland metro area")
- Use the full region name in `region` (e.g. "Oregon", not "OR")
- Use the 2-letter ISO country code in `country` (e.g. "US", not "United States")
- Read before write — merge with existing locations rather than overwriting

If you're building an app that wants to write user locations, reach out: [@atlas.bsky.social](https://bsky.app/profile/atlas.bsky.social)

---

## Location Dataset

ATlas location data is sourced from **Geoapify OSM Locality Extracts** — curated country-level datasets of cities, towns, and villages derived from OpenStreetMap.

- **Source:** https://www.geoapify.com
- **Underlying data:** OpenStreetMap (each location has a stable `osm_id`)
- **Format:** NDJSON files with coordinates, bounding boxes, multilingual names, address metadata, and population
- **Coverage:** Global (200+ countries), filtered to cities with population data
- **License:** Open Database License (ODbL) — © OpenStreetMap contributors
- **US population data:** Supplemented with US Census Bureau SUB-IP-EST2024-POP estimates

The dataset is organized by ISO 3166 country code (e.g. `us.zip`, `gb.zip`, `de.zip`). Each archive contains `place_city.ndjson` with one locality per line.

ATlas keys follow the format `{COUNTRY}-{REGION}-{City}` (e.g. `US-OR-Portland`, `GB-ENG-London`, `DE-BY-Munich`). Each location also has an OpenStreetMap ID (`osm_id`) which is a globally unique, language-independent identifier usable by any geo-aware application.

---

## Links

- **Lexicon JSON:** https://github.com/YOUR_REPO/lexicons/city.atlas.actor.location.json
- **community.lexicon.location.address spec:** https://github.com/lexicon-community/lexicon/blob/main/community/lexicon/location/address.json
- **Lexicon Community:** https://lexicon.community
- **ATlas:** https://atls.city
- **PDSls (browse PDS records):** https://pdsls.dev
