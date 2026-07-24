# Monitored Accounts with Zero Trust

## Overview
You can configure your monitored accounts (alt accounts for autoblock) to use zero trust authentication instead of storing app passwords in the Feed Moderator database.

## Configuration

Add all monitored accounts to a single `MONITORED_ACCOUNTS` environment variable in your `.env` file:

```bash
# Format: identifier:password,identifier:password
# Identifier can be either handle or DID
MONITORED_ACCOUNTS=alt1.bsky.social:xxxx-xxxx-xxxx-xxxx,alt2.bsky.social:yyyy-yyyy-yyyy-yyyy
```

## Using Handles or DIDs

You can use either the handle or DID for each account:

```bash
# Using handles (easier)
MONITORED_ACCOUNTS=myalt.bsky.social:xxxx-xxxx-xxxx-xxxx,another.bsky.social:yyyy-yyyy-yyyy-yyyy

# Using DIDs (more permanent if handle changes)
MONITORED_ACCOUNTS=did:plc:abc123xyz:xxxx-xxxx-xxxx-xxxx,did:plc:def456uvw:yyyy-yyyy-yyyy-yyyy

# Mix and match
MONITORED_ACCOUNTS=myalt.bsky.social:xxxx-xxxx-xxxx-xxxx,did:plc:def456uvw:yyyy-yyyy-yyyy-yyyy
```

## Complete Example

```bash
# Main account
BLUESKY_HANDLE=fema.monster
BLUESKY_PASSWORD=main-app-password

# Monitored accounts
MONITORED_ACCOUNTS=alt1.bsky.social:xxxx-xxxx-xxxx-xxxx,alt2.bsky.social:yyyy-yyyy-yyyy-yyyy,alt3.bsky.social:zzzz-zzzz-zzzz-zzzz
```

## Enabling in Feed Moderator

1. Go to Auto-Block settings
2. Add your monitored account (with or without password)
3. Toggle "Use Zero Trust" ON
4. The account will now authenticate through your zero trust proxy

## Security Benefits

- ✅ No app passwords stored in Feed Moderator database
- ✅ All authentication happens through your controlled proxy
- ✅ Can revoke access by stopping the proxy or removing from MONITORED_ACCOUNTS
- ✅ Full audit log of all authentication requests
- ✅ Simple configuration - one line for all accounts

## Troubleshooting

**Error: "Monitored account not configured in proxy"**
- Check that the account is in your `MONITORED_ACCOUNTS` variable
- Verify the format: `identifier:password,identifier:password`
- Restart the zero trust proxy after adding accounts

**Error: "Bluesky auth failed for monitored account"**
- Verify the handle/DID and app password are correct
- Generate a new app password in Bluesky settings if needed
- Check the proxy logs for detailed error messages
