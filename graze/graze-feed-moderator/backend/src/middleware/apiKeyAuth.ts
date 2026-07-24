import { Request, Response, NextFunction } from 'express';
import { ApiKeyService } from '../services/apiKeyService.js';
import { Database } from '../services/database.js';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    keyId: number;
    did?: string;
    handle?: string;
  };
}

export async function authenticateApiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'API key required' });
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    const apiKeyService = ApiKeyService.getInstance();
    const validation = await apiKeyService.validateApiKey(apiKey);
    
    if (!validation) {
      return res.status(401).json({ error: 'Invalid or expired API key' });
    }

    // Get user details
    const db = Database.getInstance();
    const user = await db.getUserById(validation.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Attach user info to request
    req.user = {
      userId: validation.userId,
      keyId: validation.keyId,
      did: user.did,
      handle: user.handle
    };

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}