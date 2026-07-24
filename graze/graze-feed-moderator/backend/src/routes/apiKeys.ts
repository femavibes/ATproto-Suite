import express from 'express';
import { authenticateToken } from './auth.js';
import { ApiKeyService } from '../services/apiKeyService.js';

const router = express.Router();

// Get user's API keys
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const apiKeyService = ApiKeyService.getInstance();
    const keys = await apiKeyService.getUserApiKeys(req.user.userId);
    
    res.json({ keys });
  } catch (error) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to retrieve API keys' });
  }
});

// Create new API key
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { name, expiresInDays } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    if (name.length > 100) {
      return res.status(400).json({ error: 'API key name must be 100 characters or less' });
    }

    // Validate expiration days if provided
    if (expiresInDays !== undefined) {
      if (!Number.isInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 365) {
        return res.status(400).json({ error: 'Expiration must be between 1 and 365 days' });
      }
    }

    const apiKeyService = ApiKeyService.getInstance();
    const result = await apiKeyService.createApiKey(req.user.userId, name.trim(), expiresInDays);
    
    res.json({
      message: 'API key created successfully',
      key: result.key,
      keyInfo: result.keyInfo
    });
  } catch (error) {
    console.error('Create API key error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Revoke API key
router.patch('/:keyId/revoke', authenticateToken, async (req: any, res) => {
  try {
    const keyId = parseInt(req.params.keyId);
    
    if (isNaN(keyId)) {
      return res.status(400).json({ error: 'Invalid key ID' });
    }

    const apiKeyService = ApiKeyService.getInstance();
    await apiKeyService.revokeApiKey(req.user.userId, keyId);
    
    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

// Delete API key
router.delete('/:keyId', authenticateToken, async (req: any, res) => {
  try {
    const keyId = parseInt(req.params.keyId);
    
    if (isNaN(keyId)) {
      return res.status(400).json({ error: 'Invalid key ID' });
    }

    const apiKeyService = ApiKeyService.getInstance();
    await apiKeyService.deleteApiKey(req.user.userId, keyId);
    
    res.json({ message: 'API key deleted successfully' });
  } catch (error) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

export default router;