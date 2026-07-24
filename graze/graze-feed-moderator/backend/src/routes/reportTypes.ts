import { Router } from 'express';

const router = Router();

// Hierarchical report types structure
const HIERARCHICAL_REPORT_TYPES = {
  misleading: {
    name: 'Misleading',
    subcategories: {
      'misleading-spam': 'Spam',
      'misleading-scam': 'Scam',
      'misleading-bot': 'Fake account or bot',
      'misleading-impersonation': 'Impersonation',
      'misleading-elections': 'False information about elections',
      'misleading-other': 'Other misleading content'
    }
  },
  harassment: {
    name: 'Harassment',
    subcategories: {
      'harassment-troll': 'Trolling',
      'harassment-targeted': 'Targeted harassment',
      'harassment-hate-speech': 'Hate speech',
      'harassment-doxxing': 'Doxxing',
      'harassment-other': 'Other harassing or hateful content'
    }
  },
  violence: {
    name: 'Violence',
    subcategories: {
      'violence-animal': 'Animal welfare',
      'violence-threats': 'Threats or incitement',
      'violence-graphic-content': 'Graphic violent content',
      'violence-glorification': 'Glorification of violence',
      'violence-trafficking': 'Human trafficking',
      'violence-other': 'Other violent content'
    }
  },
  sexual: {
    name: 'Sexual',
    subcategories: {
      'sexual-unlabeled': 'Unlabeled adult content',
      'sexual-abuse-content': 'Adult sexual abuse content',
      'sexual-ncii': 'Non-consensual intimate imagery',
      'sexual-deepfake': 'Deepfake adult content',
      'sexual-animal': 'Animal sexual abuse',
      'sexual-other': 'Other sexual violence content'
    }
  },
  'child-safety': {
    name: 'Child Safety',
    subcategories: {
      'child-safety-privacy': 'Privacy violation of a minor',
      'child-safety-harassment': 'Minor harassment or bullying'
    }
  },
  'self-harm': {
    name: 'Self Harm',
    subcategories: {
      'self-harm-content': 'Content promoting or depicting self-harm',
      'self-harm-ed': 'Eating disorders',
      'self-harm-stunts': 'Dangerous challenges or activities',
      'self-harm-substances': 'Dangerous substances or drug abuse',
      'self-harm-other': 'Other dangerous content'
    }
  },
  rule: {
    name: 'Rule Breaking',
    subcategories: {
      'rule-site-security': 'Hacking or system attacks',
      'rule-prohibited-sales': 'Promoting or selling prohibited items or services',
      'rule-ban-evasion': 'Banned user returning',
      'rule-other': 'Other network rule-breaking'
    }
  },
  other: {
    name: 'Other',
    subcategories: {
      'other': 'Other'
    }
  }
};

// Legacy report types mapping
const LEGACY_REPORT_TYPES = {
  spam: 'misleading-spam',
  misleading: 'misleading-other', 
  sexual: 'sexual-other',
  harassment: 'harassment-other',
  illegal: 'rule-other',
  other: 'other'
};

// Get hierarchical report types structure
router.get('/hierarchical', (req, res) => {
  res.json({
    reportTypes: HIERARCHICAL_REPORT_TYPES,
    legacyMapping: LEGACY_REPORT_TYPES
  });
});

// Get flat list of all subcategories for dropdowns
router.get('/subcategories', (req, res) => {
  const subcategories: { key: string; name: string; category: string }[] = [];
  
  Object.entries(HIERARCHICAL_REPORT_TYPES).forEach(([categoryKey, category]) => {
    Object.entries(category.subcategories).forEach(([subKey, subName]) => {
      subcategories.push({
        key: subKey,
        name: subName,
        category: categoryKey
      });
    });
  });
  
  res.json(subcategories);
});

export default router;