import crypto from 'crypto';
import { Database } from './database.js';

export class ApiKeyService {
  private static instance: ApiKeyService;
  private db: Database;

  private constructor() {
    this.db = Database.getInstance();
  }

  public static getInstance(): ApiKeyService {
    if (!ApiKeyService.instance) {
      ApiKeyService.instance = new ApiKeyService();
    }
    return ApiKeyService.instance;
  }

  /**
   * Generate a new API key
   * Format: fm_live_[32 random chars] for production
   */
  generateApiKey(): string {
    const randomBytes = crypto.randomBytes(24);
    const keyBody = randomBytes.toString('base64url');
    return `fm_live_${keyBody}`;
  }

  /**
   * Hash an API key for secure storage
   */
  hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  /**
   * Create a new API key for a user
   */
  async createApiKey(userId: number, name: string, expiresInDays?: number): Promise<{key: string, keyInfo: any}> {
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);
    
    let expiresAt: Date | undefined;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    const keyInfo = await this.db.createApiKey(userId, keyHash, name, expiresAt);
    
    return {
      key: apiKey,
      keyInfo: {
        ...keyInfo,
        keyPreview: `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 4)}`
      }
    };
  }

  /**
   * Validate an API key and return user info
   */
  async validateApiKey(apiKey: string): Promise<{userId: number, keyId: number} | null> {
    if (!apiKey.startsWith('fm_live_')) {
      return null;
    }

    const keyHash = this.hashApiKey(apiKey);
    return await this.db.validateApiKey(keyHash);
  }

  /**
   * Get all API keys for a user (without the actual key values)
   */
  async getUserApiKeys(userId: number): Promise<any[]> {
    const keys = await this.db.getUserApiKeys(userId);
    return keys.map(key => ({
      ...key,
      keyPreview: `fm_live_****...****`
    }));
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(userId: number, keyId: number): Promise<void> {
    await this.db.revokeApiKey(userId, keyId);
  }

  /**
   * Delete an API key permanently
   */
  async deleteApiKey(userId: number, keyId: number): Promise<void> {
    await this.db.deleteApiKey(userId, keyId);
  }
}