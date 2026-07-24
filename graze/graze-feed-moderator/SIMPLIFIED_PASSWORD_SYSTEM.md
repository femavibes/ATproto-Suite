# Simplified Password System

## Overview

The app now uses **ONE password field** that serves different purposes based on zero-trust configuration:

- **Zero-Trust Enabled**: Password is for logging into this app only
- **Zero-Trust Disabled**: Password should be a Bluesky app password (used for Graze/API operations)

## Password Type Detection

The system automatically detects password type:
- **App Password**: Matches format `xxxx-xxxx-xxxx-xxxx` (Bluesky app password)
- **Basic Password**: Any other format

## Smart Recommendations

### When Zero-Trust is Enabled + Using App Password
⚠️ **Warning**: "You're using zero-trust mode with a Bluesky app password. Change to a regular password since zero-trust handles Bluesky authentication."

### When Zero-Trust is Disabled + Using Basic Password
⚠️ **Warning**: "You should use a Bluesky app password for feed operations. Create one in your Bluesky settings (required for DM support in autoblock)."

## Registration Flow

1. User enters Bluesky handle
2. User optionally checks "Zero-Trust Mode"
3. User enters password:
   - **If zero-trust checked**: Label shows "App Password" - create any password
   - **If zero-trust unchecked**: Label shows "Bluesky App Password" - use Bluesky app password

## Settings Flow

### Password Section
- Title changes based on zero-trust status
- Shows current password type (app or basic)
- Displays context-appropriate warning if mismatch detected
- Single "Update Password" button

### Zero-Trust Section
- Configure or disable zero-trust proxy
- Shows current status
- "Disable Zero-Trust" button when active

## Database Schema

```sql
user_profiles:
  - bsky_password: TEXT (encrypted password - serves dual purpose)
  - password_type: VARCHAR(10) ('app' or 'basic')
  - zero_trust_mode: BOOLEAN
  - zero_trust_status: VARCHAR(20)
  - zero_trust_proxy_url: TEXT
  - zero_trust_api_key: TEXT
```

## API Changes

### Registration
```typescript
POST /api/auth/register
{
  handle: string,
  password: string,  // Single password field
  zeroTrustMode?: boolean,
  userDecryptUrl?: string,
  userApiKey?: string
}
```

### Password Update
```typescript
POST /api/auth/update-password
{
  bskyPassword: string  // Detects type automatically
}
```

### Zero-Trust Settings
```typescript
GET /api/user/zero-trust-settings
Response: {
  enabled: boolean,
  proxyUrl: string | null,
  status: string,
  passwordType: 'app' | 'basic' | null
}
```

## User Experience

### Scenario 1: User with Zero-Trust
- Registers with zero-trust enabled
- Creates simple password like "mypassword123"
- System detects: `passwordType = 'basic'` ✓ Correct
- No warnings shown

### Scenario 2: User without Zero-Trust
- Registers without zero-trust
- Enters Bluesky app password like "abcd-efgh-ijkl-mnop"
- System detects: `passwordType = 'app'` ✓ Correct
- No warnings shown

### Scenario 3: Mismatch - Zero-Trust + App Password
- User has zero-trust enabled
- But password is "abcd-efgh-ijkl-mnop" (Bluesky format)
- System detects: `passwordType = 'app'` ⚠️ Mismatch
- Warning shown: Recommends changing to basic password

### Scenario 4: Mismatch - No Zero-Trust + Basic Password
- User has zero-trust disabled
- But password is "mypassword123" (basic format)
- System detects: `passwordType = 'basic'` ⚠️ Mismatch
- Warning shown: Recommends using Bluesky app password

## Benefits

1. **Simpler UX**: One password field instead of two
2. **Context-Aware**: Labels and hints change based on zero-trust status
3. **Smart Detection**: Automatically identifies password type
4. **Helpful Warnings**: Guides users to optimal configuration
5. **Flexible**: Users can use any configuration, but get recommendations
