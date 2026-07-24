import express from 'express';
import { Database } from '../services/database.js';
import { GrazeService } from '../services/graze.js';
import { CommunalModerationService } from '../services/communalModeration.js';

const router = express.Router();
const db = Database.getInstance();
const grazeService = new GrazeService();
const communalService = new CommunalModerationService(db, grazeService);

// Process a communal report (called by Ozone integration)
router.post('/report', async (req, res) => {
  try {
    const { postUri, reportType, reporterDid } = req.body;
    
    if (!postUri || !reportType || !reporterDid) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    await communalService.processReport(postUri, reportType, reporterDid);
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Communal report processing error:', error);
    res.status(500).json({ error: 'Failed to process report' });
  }
});

export default router;