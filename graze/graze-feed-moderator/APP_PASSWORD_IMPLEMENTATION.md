# App Password & Zero-Trust Improvements

## Summary

Implemented comprehensive authentication improvements including:
1. **Disable Zero-Trust** - Users can now disable zero-trust mode from settings
2. **App Password Requirement** - All users must create an app password during registration
3. **Password Type Detection** - System detects and tracks whether users are using Bluesky app passwords or basic passwords
4. **Security Warning** - Users are warned when using both zero-trust and Bluesky app passwords

## Changes Made

### Database Schema
- Added `app_password` column to `user_profiles` table
- Added `password_type` column to track 'basic' or 'app' password types
- Migration file: `add_app_password_columns.sql`

### Backend Changes

#### `/backend/src/routes/auth.ts`
- Updated registration to require `appPassword` parameter
- Added password type detection (Bluesky app passwords match pattern: `xxxx-xxxx-xxxx-xxxx`)
- Store both app password and Bluesky password when provided
- Update password type when users change their password

#### `/backend/src/routes/user.ts`
- Added `POST /api/user/disable-zero-trust` endpoint
- Updated `GET /api/user/zero-trust-settings` to include `passwordType`
- Disable endpoint clears zero-trust mode and proxy settings

### Frontend Changes

#### `/frontend/src/views/Login.vue`
- Added `appPassword` field to registration form
- App password is now required for all registrations
- Clarified that app password is separate from Bluesky password
- Zero-trust checkbox is now an option, not a replacement for app password

#### `/frontend/src/components/settings/CredentialsTab.vue`
- Added "Disable Zero-Trust" button in status indicator
- Shows warning when using both zero-trust and Bluesky app password
- Displays password type (basic vs app) in the form
- Recommends switching to basic password when using zero-trust

#### `/frontend/src/stores/auth.ts`
- Updated `register()` method to accept `appPassword` parameter
- Passes app password to backend during registration

## User Flow

### Registration
1. User enters Bluesky handle
2. User creates an app password (required for all users)
3. User optionally checks "Zero-Trust Mode"
4. If NOT using zero-trust, user enters Bluesky app password
5. System stores app password and detects password type

### Settings - Credentials Tab
1. **Zero-Trust Section**
   - If enabled: Shows status with "Disable Zero-Trust" button
   - If disabled: Shows setup instructions
   
2. **Traditional Mode Section**
   - Shows current password type (basic or app)
   - If using zero-trust + app password: Shows warning to switch to basic password
   - User can update their password anytime

### Password Type Detection
- Bluesky app passwords follow pattern: `xxxx-xxxx-xxxx-xxxx` (4 groups of 4 characters)
- System automatically detects and stores password type
- Used to provide appropriate warnings and guidance

## Security Considerations

1. **App Password Purpose**: Provides authentication layer for the app itself, separate from Bluesky credentials
2. **Zero-Trust + App Password**: While allowed, users are warned this reduces zero-trust benefits
3. **Password Type Tracking**: Helps system provide context-appropriate guidance
4. **Disable Zero-Trust**: Allows users to switch authentication methods without re-registering

## API Endpoints

### New Endpoints
- `POST /api/user/disable-zero-trust` - Disable zero-trust mode for current user

### Modified Endpoints
- `POST /api/auth/register` - Now requires `appPassword` parameter
- `POST /api/auth/update-password` - Now detects and stores password type
- `GET /api/user/zero-trust-settings` - Now includes `passwordType` in response

## Testing Recommendations

1. Test registration with zero-trust mode enabled
2. Test registration with traditional mode
3. Test disabling zero-trust from settings
4. Test password update with Bluesky app password format
5. Test password update with basic password
6. Verify warning appears when using both zero-trust and app password
7. Test switching between authentication modes
