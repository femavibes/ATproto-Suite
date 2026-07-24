# Feed Moderator - Planned Features

## PWA Share Target for Post Removal
**Status:** Planned  
**Integration:** Add to graze-post-remover app

### Description
Build a Progressive Web App (PWA) that can receive shared Bluesky posts and remove them from specified feeds.

### Technical Approach
- PWA with web app manifest registered as share target for bsky.app URLs
- Cross-platform: works on iOS (Add to Home Screen) and Android (Install app)
- User shares post from Bluesky app → PWA opens → select feeds → remove post
- Integrates with existing graze-post-remover API

### User Flow
1. See unwanted post in Bluesky mobile app
2. Tap share button
3. Select "Feed Remover" PWA from share menu
4. Choose which feeds to remove post from
5. Confirmation and done

### Benefits
- Non-invasive (no public replies/interactions)
- Works on both mobile platforms
- Native app-like experience
- Single codebase for all platforms
- Integrates with existing graze tooling

---

## Feed Moderator Service (SaaS)
**Status:** Planned  
**Description:** Moderation-as-a-Service for feed creators

### Core Service
- Single "Feed Moderator" labeler serving multiple feeds
- Feed creators pay to register feeds and get moderation access
- Uses Ozone + simplified command structure
- Commands: `remove feedname`, `remove all`, `ban feedname`

### Advanced Moderation Features

#### Threshold-Based Removal
- Track report counts per post across all feeds
- Auto-remove posts after X reports (configurable per feed)
- Feed owners can still instantly remove with single report

#### Report Type Integration
Leverages Bluesky's native report categories with communal moderation:

**Cross-Feed Categories (opt-in per feed):**
- **Misleading Post** - Impersonation, misinformation, false claims
- **Spam** - Excessive mentions or replies  
- **Unwanted Sexual Content** - Unlabeled nudity/adult content
- **Anti-Social Behavior** - Harassment, trolling, intolerance
- **Illegal and Urgent** - Law/ToS violations

**Feed-Specific Category:**
- **Other** - Custom commands for feed-specific removals (off-topic, etc.)

#### How It Works
- **Standard Reports:** Feed creators select report type → applies to all their feeds + opts into communal removal
- **Custom Commands:** Feed creators use "Other" with text commands for specific feeds
- **Opt-in Control:** Each feed can choose which communal categories to participate in
- **Threshold System:** Posts get communal removal after X reports of same type across participating feeds

#### Report Sources
- **Registered Feed Creators:** Can remove from their specific feeds + contribute to communal counts
- **General Users:** Reports count toward communal thresholds but can't target specific feeds
- **Anonymous Contribution:** All valid reports help build communal intelligence regardless of reporter status

#### Community Moderation
- Trusted moderator network across feeds
- Reputation system for reporters
- Shared blocklists for known bad actors

#### Analytics & Insights
- Feed health metrics
- Common removal reasons
- Moderation workload tracking
- Cross-feed spam patterns

### Technical Architecture

#### Report Processing (Based on ozone-report-to-autolabel)
- Multi-tenant Ozone instance monitoring reports via `queryEvents()` API
- Whitelist system: registered feed creators + general users (different permissions)
- Report type mapping:
  - **Standard reports** (Spam, Misleading, etc.) → communal labels + feed-specific removal
  - **"Other" reports** → custom commands for feed-specific removal only
- Command parsing from report comments (reuse CommandParser.ts logic)

#### Label Application & Monitoring
- **Label formats:**
  - Communal: `feedmod-spam`, `feedmod-misleading`, etc.
  - Feed-specific: `feedmod-remove-{feedid}`
  - Threshold-based: `feedmod-threshold-spam` (applied after X reports)
- **Real-time processing** via WebSocket label subscription (like graze-post-remover)
- **Cross-feed intelligence** tracks report counts per post across all participating feeds

#### Feed Management (Based on graze-post-remover)
- Automatic Graze authentication using feed creator's Bluesky credentials
- Real-time post removal via Graze web interface endpoints
- Support for "remove from all feeds" vs specific feed targeting
- Hot config reload for feed settings

#### User Management
- **Vue.js web dashboard** for feed creator registration and configuration
- **PostgreSQL database** storing:
  - User accounts (DIDs, credentials, subscription tier)
  - Feed registrations (feed IDs, removal settings, communal opt-ins)
  - Report aggregation data (post URIs, report counts by type)
  - Audit logs (who removed what, when)
- **Permission system** tied to feed ownership verification

#### Multi-Tenant Design
- Single labeler instance serving all customers
- Per-customer feed isolation and permission boundaries
- Shared communal intelligence with opt-in participation
- Tiered service levels (free vs paid features)

---

## Technical Implementation Plan

### Phase 1: Core Service (MVP)
1. **New labeler setup** - Deploy dedicated "Feed Moderator" labeler
2. **Multi-tenant Ozone** - Extend ozone-report-to-autolabel for multiple users
3. **Vue dashboard** - User registration, feed management, settings
4. **PostgreSQL schema** - Users, feeds, settings, audit logs
5. **Basic removal system** - Adapt graze-post-remover for multi-feed support

### Phase 2: Advanced Features
1. **Cross-feed intelligence** - Report aggregation and threshold system
2. **Communal moderation** - Opt-in shared removal for spam/harassment
3. **Analytics dashboard** - Feed health metrics, removal statistics
4. **Subscription system** - Free tier limits, paid tier features

### Phase 3: Scale & Polish
1. **Performance optimization** - Handle high report volumes
2. **Advanced moderation tools** - Bulk operations, appeals system
3. **API access** - Allow programmatic feed management
4. **Mobile PWA** - Share target for in-app post removal

---

## Block-Based Moderation Integration
**Status:** Future consideration  
**Description:** Integrate blocking behavior into feed moderation

### Potential Features
- **Auto-remove from blocked users:** If someone blocks a feed creator, remove their posts from that creator's feeds
- **Community block intelligence:** Shared blocklist where multiple blocks trigger cross-feed removal
- **Block threshold system:** Auto-remove users who get blocked by X+ feed creators

### Technical Considerations
- Privacy implications of block relationship data
- AT Protocol limitations for detecting blocks
- Could integrate via shared labeling with existing block-countermod tool
- Might be better as separate complementary service

---

## Future Ideas
*Add other feed moderation ideas here*