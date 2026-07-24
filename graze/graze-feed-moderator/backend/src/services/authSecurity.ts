import { AtpAgent } from '@atproto/api';
import crypto from 'crypto';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export class AuthSecurity {
  private static rateLimits = new Map<string, RateLimitEntry>();
  private static readonly RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
  private static readonly RATE_LIMIT_MAX = 10; // 10 requests per window
  private static failedAttempts = new Map<string, { count: number; lastAttempt: Date }>();
  private static readonly MAX_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
   * Validate Bluesky credentials by attempting login
   */
  static async validateBlueskyCredentials(handle: string, password: string): Promise<boolean> {
    try {
      const agent = new AtpAgent({ service: 'https://bsky.social' });
      await agent.login({ identifier: handle, password });
      return true;
    } catch (error) {
      console.error('Credential validation failed:', error);
      return false;
    }
  }

  /**
   * Check if account is locked due to failed attempts
   */
  static isAccountLocked(identifier: string): boolean {
    const attempts = this.failedAttempts.get(identifier);
    if (!attempts) return false;

    const timeSinceLastAttempt = Date.now() - attempts.lastAttempt.getTime();
    if (timeSinceLastAttempt > this.LOCKOUT_DURATION) {
      this.failedAttempts.delete(identifier);
      return false;
    }

    return attempts.count >= this.MAX_ATTEMPTS;
  }

  /**
   * Record failed authentication attempt
   */
  static recordFailedAttempt(identifier: string): void {
    const current = this.failedAttempts.get(identifier) || { count: 0, lastAttempt: new Date() };
    current.count++;
    current.lastAttempt = new Date();
    this.failedAttempts.set(identifier, current);
  }

  /**
   * Clear failed attempts on successful login
   */
  static clearFailedAttempts(identifier: string): void {
    this.failedAttempts.delete(identifier);
  }

  /**
   * Generate secure encryption key
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate encryption key format
   */
  static validateEncryptionKey(key: string): boolean {
    return key.length === 64 && /^[0-9a-f]+$/i.test(key);
  }

  /**
   * Secure password encryption with proper key validation
   */
  static async encryptPassword(password: string): Promise<string> {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (!this.validateEncryptionKey(key)) {
      throw new Error('Invalid encryption key format');
    }

    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Secure password decryption with proper error handling
   */
  static async decryptPassword(encrypted: string): Promise<string> {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    if (!this.validateEncryptionKey(key)) {
      throw new Error('Invalid encryption key format');
    }

    const parts = encrypted.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted password format');
    }

    try {
      const keyBuffer = crypto.scryptSync(key, 'salt', 32);
      const iv = Buffer.from(parts[0], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
      let decrypted = decipher.update(parts[1], 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error('Password decryption failed - please re-enter your credentials');
    }
  }

  /**
   * Generate secure JWT secret
   */
  static generateJWTSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Rate limiting for auth endpoints
   */
  static checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = this.rateLimits.get(ip);
    
    if (!entry || now - entry.windowStart > this.RATE_LIMIT_WINDOW) {
      this.rateLimits.set(ip, { count: 1, windowStart: now });
      return true;
    }
    
    if (entry.count >= this.RATE_LIMIT_MAX) {
      return false;
    }
    
    entry.count++;
    return true;
  }

  /**
   * Sanitize handle for logging (prevent log injection)
   */
  static sanitizeHandle(handle: string): string {
    return handle.replace(/[^\w.-]/g, '');
  }
}