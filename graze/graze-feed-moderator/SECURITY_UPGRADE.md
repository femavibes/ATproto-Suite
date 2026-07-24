# Security Upgrade - No Password Reset Required

## Key Rotation Strategy

Your app now supports **multiple encryption keys** so you can upgrade security without breaking existing users.

### How It Works
- **New passwords**: Encrypted with `ENCRYPTION_KEY` 
- **Existing passwords**: Still work with `LEGACY_ENCRYPTION_KEY`
- **Gradual migration**: Users get re-encrypted when they update passwords

### Safe Upgrade Process

1. **Keep current key as legacy**:
```bash
# In .env - keep your current key
LEGACY_ENCRYPTION_KEY=your_current_key_here
ENCRYPTION_KEY=new_secure_key_here
```

2. **Generate new key**:
```bash
node scripts/generate-keys.js
```

3. **Deploy**: Existing users continue working, new passwords use new key

### What Changed
- ✅ Multi-key decryption support
- ✅ New passwords use current key
- ✅ Old passwords still work
- ✅ No user disruption

### About Storing Keys in .env

**Current approach is fine for most apps**:
- Keys in `.env` are standard practice
- Not committed to git (in `.gitignore`)
- Environment variables are secure on most platforms

**For high-security production**, consider:
- AWS Secrets Manager
- HashiCorp Vault  
- Kubernetes secrets

But `.env` is perfectly acceptable for your use case.

### Next Steps
1. Add new `ENCRYPTION_KEY` to `.env`
2. Keep old key as `LEGACY_ENCRYPTION_KEY` 
3. Deploy - zero downtime
4. Users gradually migrate to new key when they update passwords