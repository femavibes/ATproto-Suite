# Feed Moderator Security Overview

## Current Security Implementation

### Encryption Standards
- **Password Encryption**: AES-256-CBC with IV and scrypt key derivation
- **Session Token Encryption**: AES-256-CBC with IV and scrypt key derivation  
- **Key Management**: Cryptographically secure random keys (64-char hex)

### What's Encrypted
1. **User Bluesky app passwords** (`users.bsky_password`)
2. **Monitored account app passwords** (`monitored_accounts.app_password`)
3. **Session tokens** (`access_jwt`, `refresh_jwt` in both tables)

### Authentication & Sessions
- **Persistent sessions** - Tokens stored encrypted, reused for hours
- **Automatic token refresh** - Uses refresh tokens to avoid re-authentication
- **Rate limit protection** - Reduced API calls by 99% (from 2,880/day to ~2/day per account)

## Current Security Level: **HIGH**

### Strengths ✅
- **Industry-standard encryption** (AES-256-CBC)
- **Proper key derivation** (scrypt with salt)
- **Unique IVs** for each encrypted value
- **Session management** reduces attack surface
- **Unified encryption** across all sensitive data
- **Backward compatibility** with legacy encrypted data

### Vulnerabilities ⚠️
- **Single point of failure** - `.env` file contains master keys
- **Plaintext database password** in `DATABASE_URL`
- **No database connection encryption** (no SSL specified)
- **Limited audit logging** of sensitive operations
- **No secrets rotation** mechanism

## Risk Assessment

### High Risk
- **`.env` file compromise** = Complete system breach
- **Database access** = All encrypted data accessible with keys

### Medium Risk  
- **Container compromise** = Access to decrypted data in memory
- **Network interception** = Database traffic not encrypted

### Low Risk
- **Database-only breach** = Data encrypted, keys separate
- **Session hijacking** = Tokens encrypted at rest

## Planned Security Improvements

### Phase 1: Secrets Management
**Goal**: Remove sensitive keys from `.env` files

**Options**:
1. **Docker Secrets** (Swarm mode required)
   - Encrypted at rest
   - Access control per service
   - No plaintext in containers
   
2. **Environment Variables** (Server-level)
   - Set directly on host system
   - Not stored in files
   - Process-level isolation

3. **External Secrets Management**
   - AWS Secrets Manager
   - Azure Key Vault
   - HashiCorp Vault

**Implementation**: Docker Secrets (requires swarm mode migration)

### Phase 2: Database Security
**Goal**: Encrypt database connections and credentials

**Improvements**:
- Enable PostgreSQL SSL/TLS
- Use connection certificates
- Separate database credentials from application config
- Connection pooling with encryption

### Phase 3: Enhanced Monitoring
**Goal**: Detect and log security events

**Features**:
- Audit logging for password changes
- Failed authentication tracking
- Session anomaly detection
- Brute force protection
- Security event alerting

### Phase 4: Key Rotation
**Goal**: Regular key rotation without downtime

**Implementation**:
- Dual-key system (old + new)
- Gradual migration process
- Automated rotation schedule
- Key versioning system

## Development vs Production

### Current Setup (Development)
- `.env` file with all secrets
- No SSL database connections
- Basic logging
- Single encryption key

### Production Recommendations
- **Secrets management** (Docker Secrets/Cloud)
- **Database SSL** with certificates
- **Comprehensive logging** and monitoring
- **Key rotation** schedule
- **Network segmentation**
- **Regular security audits**

## Implementation Priority

### Immediate (High Impact, Low Effort)
1. ✅ **Strong encryption keys** - COMPLETED
2. ✅ **Session token encryption** - COMPLETED
3. **Database SSL** - Enable PostgreSQL SSL connections

### Short Term (High Impact, Medium Effort)
1. **Docker Secrets** - Migrate to swarm mode
2. **Audit logging** - Log sensitive operations
3. **Input validation** - Stricter validation on all inputs

### Long Term (Medium Impact, High Effort)
1. **External secrets management** - Cloud-based solution
2. **Key rotation** - Automated rotation system
3. **Security monitoring** - Comprehensive threat detection

## Security Best Practices

### File Permissions
```bash
chmod 600 .env                    # Restrict .env access
chmod 700 /app/secrets/           # Restrict secrets directory
```

### Git Security
```bash
# .gitignore
.env
.env.local
.env.production
secrets/
*.key
*.pem
```

### Container Security
- Run as non-root user
- Minimal base images
- Regular security updates
- Network isolation

### Backup Security
- Encrypt backups
- Separate backup encryption keys
- Secure backup storage
- Regular restore testing

## Compliance Considerations

### Data Protection
- **GDPR**: Right to erasure (encrypted data deletion)
- **CCPA**: Data access and deletion rights
- **SOC 2**: Security controls and monitoring

### Industry Standards
- **OWASP Top 10**: Address common vulnerabilities
- **NIST Framework**: Comprehensive security framework
- **ISO 27001**: Information security management

## Emergency Procedures

### Key Compromise Response
1. **Immediate**: Rotate all encryption keys
2. **Short-term**: Force re-authentication for all users
3. **Long-term**: Security audit and system hardening

### Data Breach Response
1. **Assess scope** of compromised data
2. **Notify users** if personal data affected
3. **Implement fixes** to prevent recurrence
4. **Document incident** for compliance

---

**Last Updated**: December 2024  
**Security Level**: HIGH  
**Next Review**: Q1 2025