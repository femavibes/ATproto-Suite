# Zero-Trust Authentication Architecture for Feed-Moderator

## The Problem
Currently, feed-moderator stores encrypted Bluesky app passwords on our servers. While secure, this still requires users to trust us with their credentials. Some users want **zero-trust** - where we literally cannot access their Bluesky account even if we wanted to.

## The Solution: User-Hosted Authentication Proxy

Extend the existing user-decryption-service to become a **full authentication proxy** that handles ALL Bluesky operations on the user's behalf.

## Architecture Overview

### Traditional Flow (Current - Remains Default)
```
User → Feed-Moderator → Decrypt Password → Graze/Bluesky APIs
```

### Zero-Trust Flow (New - Optional)
```
User → Feed-Moderator → User's Auth Proxy → Graze/Bluesky APIs
                    ↑
            (Never sees Bluesky credentials)
```

## Two Authentication Modes (User Choice)

### Mode 1: Traditional (Default - Keeps Current System)
- User provides Bluesky app password to feed-moderator
- We store encrypted password on our servers
- Direct API calls to Graze/Bluesky from our backend
- **For most users**: Simple, works immediately, no technical setup
- **Trust model**: User trusts feed-moderator with encrypted credentials

### Mode 2: Zero-Trust Proxy (Optional - For Advanced Users)
- User creates regular password for feed-moderator account (no Bluesky credentials)
- User deploys authentication proxy on their infrastructure
- User configures proxy with their Bluesky app password (stays on their server)
- Feed-moderator routes all Bluesky operations through user's proxy
- **For technical users**: Maximum security, complete control, audit trail
- **Trust model**: Zero-trust - feed-moderator never sees Bluesky credentials

## User-Hosted Authentication Proxy Features

### Core Services
1. **Graze Operations**
   - Post removal from feeds
   - Post restoration
   - Session management

2. **Bluesky Operations**
   - List management (add/remove users)
   - Profile fetching
   - Authentication handling

3. **Security Features**
   - API key authentication
   - Request logging and auditing
   - Rate limiting
   - Operation validation

### API Endpoints
```
POST /graze/remove-post
POST /graze/restore-post
POST /bluesky/list/add-user
POST /bluesky/list/remove-user
GET /bluesky/profile/{did}
GET /audit/logs
```

## Implementation Plan

### Phase 1: Extend Current Service
- Add Graze operation endpoints to user-decryption-service
- Add Bluesky list management endpoints
- Implement request routing and validation

### Phase 2: Feed-Moderator Integration
- Add "Zero-Trust Mode" toggle in settings
- Implement proxy client in feed-moderator backend
- Route operations through user's proxy when enabled

### Phase 3: Enhanced Security
- Advanced audit logging
- Request signing/verification
- Automatic failover handling

## User Experience

### Traditional Mode (Default)
1. **Register normally**: Provide handle + Bluesky app password
2. **Immediate access**: All features work instantly
3. **No setup required**: Perfect for non-technical users
4. **Current security**: AES-256 encrypted password storage

### Zero-Trust Mode (Optional)
1. **Register with toggle**: Check "I will set up zero-trust mode later"
2. **Use any password**: Not your Bluesky app password
3. **Deploy proxy service**: `docker run feedmoderator/auth-proxy`
4. **Configure proxy**: Set Bluesky credentials on your server only
5. **Connect in Settings**: Enter proxy URL + API key
6. **Complete setup**: System validates and enables zero-trust mode

### Benefits by Mode

**Traditional Benefits:**
- Zero technical knowledge required
- Instant setup and access
- All features work immediately
- Reliable and tested

**Zero-Trust Benefits:**
- Complete credential control
- Real-time operation audit trail
- Instant access revocation (stop Docker container)
- Feed-moderator admin cannot access Bluesky account
- Self-hosted on user's infrastructure

### Benefits for Feed-Moderator
- **Reduced liability**: No stored user credentials
- **Enhanced security**: Distributed authentication model
- **User choice**: Traditional vs zero-trust options
- **Scalability**: Offload authentication to user infrastructure

## Technical Considerations

### Reliability
- Proxy must be online for operations to work
- Implement graceful degradation when proxy unavailable
- Clear error messages and notifications

### Security
- Mutual authentication between feed-moderator and proxy
- Request signing to prevent tampering
- Rate limiting to prevent abuse

### Performance
- Caching strategies for frequently accessed data
- Connection pooling and keep-alive
- Timeout handling and retries

## Implementation Strategy

### Preserve Current System
- **No breaking changes**: All existing users continue unchanged
- **Default behavior**: New users get traditional mode by default
- **Optional upgrade**: Users can switch to zero-trust if desired
- **Seamless experience**: Non-technical users never see complexity

### User Interface Design
**Registration Page**:
- Default flow unchanged for most users
- Optional checkbox: "I will set up zero-trust mode later (advanced)"
- Clear warning about skipping credential validation

**Settings Page**:
- Current mode indicator: "Traditional" or "Zero-Trust"
- Migration options with clear warnings
- Proxy status monitoring
- Operation queue status when proxy offline

**Dashboard**:
- Proxy health indicator for zero-trust users
- Notification center for proxy issues
- Queued operations counter

### Rollout Plan
1. **Extend current proxy**: Add Graze/Bluesky operations to existing service
2. **Backend integration**: Add proxy client to feed-moderator
3. **UI updates**: Add zero-trust toggle and setup flow
4. **Documentation**: Clear guides for both modes
5. **Beta testing**: Technical users test zero-trust mode
6. **Full release**: Both modes available, traditional as default

## Success Metrics

### Security
- Zero stored Bluesky credentials for zero-trust users
- Complete audit trails for all operations
- User-controlled access revocation

### Usability
- Simple setup process (< 5 minutes)
- Clear documentation and tutorials
- Reliable operation with good error handling

### Adoption
- Percentage of users choosing zero-trust mode
- User satisfaction with security and control
- Reduced support requests about credential security

## Implementation Decisions

### 1. Proxy Architecture: Authentication Provider (Recommended)
**Decision**: User's proxy provides authentication tokens, feed-moderator executes operations

**Why This Approach**:
- No code duplication - all business logic stays in main app
- Simpler proxy service - just authentication provider
- Easier maintenance and updates
- Same security benefit with less complexity

**Zero-Trust Proxy Contains**:
- Bluesky credentials storage
- Graze session management
- Token/session generation
- Authentication audit logging

**Simple Proxy API Design**:
```
POST /auth/graze-session
  Body: { reason: "POST_REMOVAL" }
  Returns: { sessionCookie: "graze_session_abc123" }
  
POST /auth/bluesky-token
  Body: { reason: "LIST_MANAGEMENT" }
  Returns: { accessToken: "bsky_token_xyz789", refreshToken: "..." }
  
GET /auth/status
  Returns: { graze_healthy: true, bluesky_healthy: true }
```

**Feed-Moderator Changes**:
- Detect if user is in zero-trust mode
- Request auth tokens from user's proxy when needed
- Use existing business logic with proxy-provided auth
- Cache tokens temporarily (not permanently)
- Handle proxy offline scenarios with queuing

**Operation Flow**:
```
User clicks "Remove Post" in Feed-Moderator UI
  ↓
Feed-Moderator checks: Zero-trust mode?
  ↓ (Yes)
Request Graze session from user's proxy
  ↓
Proxy returns session cookie (logs the request)
  ↓
Feed-Moderator uses existing graze.ts logic with proxy session
  ↓
Post removed using same business logic as traditional mode
```

### 2. Registration Flow: Zero-Trust Toggle
**Current Registration**: Handle + Bluesky App Password + Credential Validation
**New Registration**: Add "I will set up zero-trust mode later" checkbox

**When Zero-Trust Toggle Checked**:
- Skip Bluesky credential validation
- User provides any password for feed-moderator account
- Account created with `zero_trust_pending` flag
- User completes setup in Settings later

**Registration UI**:
```
☐ I will set up zero-trust authentication (advanced users)
  Skip Bluesky credential validation - configure your proxy later
```

### 3. Offline Handling: Graceful Degradation + Backfill
**When Proxy Offline**:
- Operations fail with clear error messages
- Create notification: "Your authentication proxy is offline"
- Queue failed operations for retry (with limits)
- Show proxy status in dashboard

**Backfill Limits**:
- **Free users**: 24 hours of queued operations
- **Premium users**: 7 days of queued operations
- **Auto-retry**: Every 15 minutes when proxy comes back online

### 4. Mode Switching: Settings Migration
**Traditional → Zero-Trust**:
1. User enables zero-trust mode in Settings
2. Warning: "Change your password to a non-Bluesky app password"
3. User sets up proxy service
4. User configures proxy URL + API key
5. System tests connection and migrates
6. Old encrypted password deleted

**Zero-Trust → Traditional**:
1. User provides Bluesky app password
2. System validates credentials
3. Encrypts and stores password
4. Proxy configuration cleared

### Security Model
**Traditional Mode**:
- Bluesky credentials encrypted on feed-moderator servers
- Feed-moderator admin can decrypt (with database + encryption key access)
- Standard for most users

**Zero-Trust Mode**:
- Bluesky credentials only on user's server
- Feed-moderator admin cannot access Bluesky account
- User controls all access via proxy
- Complete operation audit trail

## Conclusion

## Additional Considerations

### Performance & Reliability
- **Latency**: Zero-trust operations slower (extra network hop)
- **Timeout Handling**: What if user's proxy is slow to respond?
- **Rate Limiting**: How to handle rate limits at proxy level?
- **Connection Pooling**: Maintain persistent connections to user proxies?

### Operational Complexity
- **Support Burden**: Zero-trust users need more technical support
- **Debugging**: Troubleshooting when operations happen on user's server
- **Documentation**: Comprehensive setup guides needed
- **Monitoring**: Should feed-moderator monitor proxy health?

### Business Model
- **Premium Feature**: Should zero-trust be premium-only?
- **Resource Usage**: Zero-trust users use less server resources
- **Support Costs**: May require more customer support

### Edge Cases
- **Proxy Updates**: Users pull new Docker image, restart container (config persists in volume)
- **Code Sync**: How to keep proxy business logic in sync with main app updates?
- **Multiple Accounts**: Can one proxy handle multiple feed-moderator accounts?
- **Backup Proxies**: Failover proxy configuration?
- **Network Attacks**: MITM between feed-moderator and proxy?
- **Logic Divergence**: What if proxy and main app business logic get out of sync?

### Migration Scenarios
- **Bulk Migration**: Many users switching simultaneously?
- **Emergency Fallback**: Proxy fails permanently?
- **Data Export**: Users export operation history?

## Recommended Implementation Plan

### Phase 1: Foundation
1. Database columns for zero-trust tracking
2. Registration toggle (skip validation)
3. Basic proxy client in backend
4. Mode switching in Settings

### Phase 2: Proxy Service Enhancement
1. **Copy Graze Logic**: Port graze.ts service to proxy with session management
2. **Add Bluesky Operations**: List management, profile fetching, authentication
3. **Business Logic Migration**: Copy relevant operation logic from main app
4. **Comprehensive Logging**: Every operation logged with timestamp, reason, result
5. **Error Handling**: Proper error responses for feed-moderator to handle

**Code to Port to Proxy**:
- `services/graze.ts` - Session management and post operations
- Bluesky list management functions
- Authentication helpers
- Error handling patterns
- Retry logic for failed operations

### Phase 3: Integration
1. Route operations through proxy
2. Graceful fallback handling
3. Health monitoring and notifications
4. Setup documentation

### Phase 4: Polish
1. Beta testing
2. Performance optimization
3. Enhanced error handling
4. Security audit

## Conclusion

This architecture provides **user choice**: convenience (traditional) or maximum security (zero-trust). Most users get the simple experience, while security-conscious users get complete control.

The user-hosted proxy becomes a **personal API gateway** for those who want it.

## Architecture Decision: Proxy Contains Business Logic

**Feed-Moderator Role**:
- UI and user management
- Operation orchestration and queuing
- Routing decisions (proxy vs direct)
- Dashboard and monitoring

**Zero-Trust Proxy Role**:
- All Bluesky credential handling
- Graze session management
- Direct API calls to external services
- Operation execution and logging
- Business logic for post removal and list management

**Operation Flow**:
```
User clicks "Remove Post" in Feed-Moderator UI
  ↓
Feed-Moderator checks: Zero-trust mode?
  ↓ (Yes)
POST to user's proxy: /operations/graze/remove-post
  ↓
Proxy authenticates with Graze using stored credentials
  ↓
Proxy executes post removal
  ↓
Proxy logs operation and returns result
  ↓
Feed-Moderator displays result to user
```

**Benefits of This Approach**:
- Complete credential isolation
- User controls all external API access
- Full audit trail on user's server
- Feed-moderator becomes pure orchestration layer

**Challenges**:
- Need to duplicate some business logic in proxy
- Proxy updates require user action
- More complex debugging when issues occur
- Network dependency for all operations

**Biggest Risk**: Code duplication between main app and proxy
**Biggest Benefit**: True zero-trust - you cannot access user credentials
**Success Metric**: 10-20% of technical users adopt zero-trust mode