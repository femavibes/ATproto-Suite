// Bluesky Quote-of-the-Day Bot (Fully Configurable)

const fs = require('fs');

// Manually load .env file
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join('=').trim();
    }
  });
}

require('dotenv').config();
const { BskyAgent, RichText } = require('@atproto/api');
const cron = require('node-cron');
const archiver = require('archiver');
const multer = require('multer');
const yauzl = require('yauzl');

const fetch = require('node-fetch');
const express = require('express');
const { Storage } = require('@google-cloud/storage');
const sharp = require('sharp');

// Load credentials and settings from .env
let BLUESKY_HANDLE = process.env.BLUESKY_HANDLE;
let BLUESKY_DID = process.env.BLUESKY_DID;
let BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;
let QUOTE_TIME_CRON = process.env.QUOTE_TIME_CRON || '0 12 * * *'; // Default 12 PM
let WORD_TIME_CRON = process.env.WORD_TIME_CRON || '0 15 * * *'; // Default 3 PM
let TIMEZONE = process.env.TIMEZONE || undefined;
let QUOTE_TAG = process.env.QUOTE_TAG || '#QuoteOfTheDay';
let WORD_TAG = process.env.WORD_TAG || '#WordOfTheDay';
let QUOTE_SOURCE = process.env.QUOTE_SOURCE || 'text'; // 'text' or 'api'
const QUOTE_FILE = './data/quotes.json';
const WORD_FILE = './data/words.json';
const USED_QUOTES_FILE = './data/used_quotes.json';
const USED_WORDS_FILE = './data/used_words.json';
const QUOTE_CATEGORIES_FILE = './data/quote_categories.json';
const WORD_CATEGORIES_FILE = './data/word_categories.json';
const QUOTE_SEASONAL_PERIODS_FILE = './data/quote_seasonal_periods.json';
const WORD_SEASONAL_PERIODS_FILE = './data/word_seasonal_periods.json';
let QUOTE_API = process.env.QUOTE_API;
let RANDOMIZE_QUOTES = process.env.RANDOMIZE_QUOTES !== 'false';
let DRY_RUN = process.env.DRY_RUN === 'true';
let LOG_LEVEL = process.env.LOG_LEVEL || 'debug';

// Weighting settings
let COOLDOWN_DAYS = parseInt(process.env.COOLDOWN_DAYS) || 90;
let OUT_OF_SEASON_PENALTY = parseFloat(process.env.OUT_OF_SEASON_PENALTY) || 0.3;
let SEASONAL_WEIGHT_1 = parseInt(process.env.SEASONAL_WEIGHT_1) || 3;
let SEASONAL_WEIGHT_2 = parseInt(process.env.SEASONAL_WEIGHT_2) || 4;
let SEASONAL_WEIGHT_3 = parseInt(process.env.SEASONAL_WEIGHT_3) || 5;
// Recovery curve: [days after cooldown, percentage of full weight]
let RECOVERY_CURVE = JSON.parse(process.env.RECOVERY_CURVE || '[[0, 0.2], [90, 0.5], [180, 0.8], [365, 1.0]]');

// Cloud backup settings
let GCS_PROJECT_ID = process.env.GCS_PROJECT_ID;
let GCS_KEY_FILE = process.env.GCS_KEY_FILE;
let GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
let BACKUP_SCHEDULE = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Default 2 AM daily
let BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
let BACKUP_ENABLED = process.env.BACKUP_ENABLED === 'true';

function reloadEnvironment() {
  // Manually reload .env file
  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    });
  }
  
  require('dotenv').config();
  BLUESKY_HANDLE = process.env.BLUESKY_HANDLE;
  BLUESKY_DID = process.env.BLUESKY_DID;
  BLUESKY_PASSWORD = process.env.BLUESKY_PASSWORD;
  QUOTE_TIME_CRON = process.env.QUOTE_TIME_CRON || '0 9 * * *';
  WORD_TIME_CRON = process.env.WORD_TIME_CRON || '0 12 * * *';
  TIMEZONE = process.env.TIMEZONE || undefined;
  QUOTE_TAG = process.env.QUOTE_TAG || '#QuoteOfTheDay';
  WORD_TAG = process.env.WORD_TAG || '#WordOfTheDay';
  QUOTE_SOURCE = process.env.QUOTE_SOURCE || 'text';

  QUOTE_API = process.env.QUOTE_API;
  RANDOMIZE_QUOTES = process.env.RANDOMIZE_QUOTES !== 'false';
  DRY_RUN = process.env.DRY_RUN === 'true';
  LOG_LEVEL = process.env.LOG_LEVEL || 'debug';
  COOLDOWN_DAYS = parseInt(process.env.COOLDOWN_DAYS) || 90;
  OUT_OF_SEASON_PENALTY = parseFloat(process.env.OUT_OF_SEASON_PENALTY) || 0.3;
  SEASONAL_WEIGHT_1 = parseInt(process.env.SEASONAL_WEIGHT_1) || 3;
  SEASONAL_WEIGHT_2 = parseInt(process.env.SEASONAL_WEIGHT_2) || 4;
  SEASONAL_WEIGHT_3 = parseInt(process.env.SEASONAL_WEIGHT_3) || 5;
  RECOVERY_CURVE = JSON.parse(process.env.RECOVERY_CURVE || '[[0, 0.2], [90, 0.5], [180, 0.8], [365, 1.0]]');
  GCS_PROJECT_ID = process.env.GCS_PROJECT_ID;
  GCS_KEY_FILE = process.env.GCS_KEY_FILE;
  GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
  BACKUP_SCHEDULE = process.env.BACKUP_SCHEDULE || '0 2 * * *';
  BACKUP_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
  BACKUP_ENABLED = process.env.BACKUP_ENABLED === 'true';
}

const agent = new BskyAgent({ service: 'https://bsky.social' });

let quotes = [];
let words = [];
let usedQuotes = new Set();
let usedWords = new Set();
let quoteSeasonalPeriods = {};
let wordSeasonalPeriods = {};
let nextQuoteOverride = null;
let nextWordOverride = null;
let skipNextQuote = false;
let skipNextWord = false;
let quoteJob = null;
let wordJob = null;
let backupJob = null;
let gcsStorage = null;

function log(message, level = 'info') {
  const levels = ['debug', 'info', 'warn', 'error'];
  if (levels.indexOf(level) >= levels.indexOf(LOG_LEVEL)) {
    console.log(`[${level.toUpperCase()}] ${message}`);
  }
}

function validateAndTruncateQuote(quote) {
  const tag = QUOTE_TAG.length > 25 ? QUOTE_TAG.substring(0, 25) : QUOTE_TAG;
  const maxContentLength = 270;
  
  let text = quote.text || '';
  let author = quote.author || '';
  
  const totalLength = text.length + (author ? author.length + 1 : 0); // +1 for newline
  
  if (totalLength > maxContentLength) {
    const availableLength = maxContentLength - 3; // Reserve 3 chars for "..."
    
    if (author) {
      const authorWithNewline = author.length + 1;
      if (authorWithNewline >= availableLength) {
        // Author too long, truncate author only
        author = author.substring(0, availableLength - 1) + '...';
        text = '';
      } else {
        // Truncate quote text
        const maxTextLength = availableLength - authorWithNewline;
        text = text.substring(0, maxTextLength) + '...';
      }
    } else {
      // No author, just truncate text
      text = text.substring(0, availableLength) + '...';
    }
  }
  
  return { ...quote, text, author, tag };
}

function validateAndTruncateWord(word) {
  const tag = WORD_TAG.length > 25 ? WORD_TAG.substring(0, 25) : WORD_TAG;
  const maxContentLength = 270;
  
  let wordText = word.word || '';
  let definition = word.definition || '';
  
  const totalLength = wordText.length + (definition ? definition.length + 2 : 0); // +2 for double newline
  
  if (totalLength > maxContentLength) {
    const availableLength = maxContentLength - 3; // Reserve 3 chars for "..."
    
    if (definition) {
      const definitionWithNewlines = definition.length + 2;
      if (definitionWithNewlines >= availableLength) {
        // Definition too long, truncate definition only
        definition = definition.substring(0, availableLength - 2) + '...';
        wordText = '';
      } else {
        // Truncate word text
        const maxWordLength = availableLength - definitionWithNewlines;
        wordText = wordText.substring(0, maxWordLength) + '...';
      }
    } else {
      // No definition, just truncate word
      wordText = wordText.substring(0, availableLength) + '...';
    }
  }
  
  return { ...word, word: wordText, definition, tag };
}

function initializeCloudStorage() {
  if (!GCS_PROJECT_ID || !GCS_KEY_FILE || !GCS_BUCKET_NAME) {
    log('Cloud backup not configured - missing GCS credentials', 'info');
    return false;
  }
  
  try {
    gcsStorage = new Storage({
      projectId: GCS_PROJECT_ID,
      keyFilename: GCS_KEY_FILE
    });
    log('Google Cloud Storage initialized', 'info');
    return true;
  } catch (err) {
    log('Failed to initialize Google Cloud Storage: ' + err.message, 'error');
    return false;
  }
}

async function createBackup() {
  if (!gcsStorage || !BACKUP_ENABLED) {
    log('Cloud backup disabled or not configured', 'debug');
    return;
  }
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.zip`;
    
    // Create backup zip in memory
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    
    archive.on('data', chunk => chunks.push(chunk));
    archive.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const bucket = gcsStorage.bucket(GCS_BUCKET_NAME);
        const file = bucket.file(filename);
        
        await file.save(buffer, {
          metadata: {
            contentType: 'application/zip',
            metadata: {
              created: new Date().toISOString(),
              type: 'automated-backup'
            }
          }
        });
        
        log(`Backup uploaded to GCS: ${filename}`, 'info');
        await cleanupOldBackups();
      } catch (err) {
        log('Failed to upload backup: ' + err.message, 'error');
      }
    });
    
    // Add files to archive
    archive.append(JSON.stringify(quotes, null, 2), { name: 'quotes.json' });
    archive.append(JSON.stringify(words, null, 2), { name: 'words.json' });
    
    let usedQuotesData = [];
    if (fs.existsSync(USED_QUOTES_FILE)) {
      usedQuotesData = JSON.parse(fs.readFileSync(USED_QUOTES_FILE, 'utf-8'));
    }
    archive.append(JSON.stringify(usedQuotesData, null, 2), { name: 'used_quotes.json' });
    
    let usedWordsData = [];
    if (fs.existsSync(USED_WORDS_FILE)) {
      usedWordsData = JSON.parse(fs.readFileSync(USED_WORDS_FILE, 'utf-8'));
    }
    archive.append(JSON.stringify(usedWordsData, null, 2), { name: 'used_words.json' });
    
    const weightingData = {
      cooldownDays: COOLDOWN_DAYS,
      outOfSeasonPenalty: OUT_OF_SEASON_PENALTY,
      seasonalWeight1: SEASONAL_WEIGHT_1,
      seasonalWeight2: SEASONAL_WEIGHT_2,
      seasonalWeight3: SEASONAL_WEIGHT_3,
      recoveryCurve: RECOVERY_CURVE
    };
    archive.append(JSON.stringify(weightingData, null, 2), { name: 'weighting_settings.json' });
    
    archive.finalize();
  } catch (err) {
    log('Failed to create backup: ' + err.message, 'error');
  }
}

async function cleanupOldBackups() {
  if (!gcsStorage) return;
  
  try {
    const bucket = gcsStorage.bucket(GCS_BUCKET_NAME);
    const [files] = await bucket.getFiles({ prefix: 'backup-' });
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - BACKUP_RETENTION_DAYS);
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const fileDate = new Date(metadata.timeCreated);
      
      if (fileDate < cutoffDate) {
        await file.delete();
        log(`Deleted old backup: ${file.name}`, 'debug');
      }
    }
  } catch (err) {
    log('Failed to cleanup old backups: ' + err.message, 'error');
  }
}

async function listBackups() {
  if (!gcsStorage) return [];
  
  try {
    const bucket = gcsStorage.bucket(GCS_BUCKET_NAME);
    const [files] = await bucket.getFiles({ prefix: 'backup-' });
    
    const backups = [];
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      backups.push({
        name: file.name,
        created: metadata.timeCreated,
        size: metadata.size
      });
    }
    
    return backups.sort((a, b) => new Date(b.created) - new Date(a.created));
  } catch (err) {
    log('Failed to list backups: ' + err.message, 'error');
    return [];
  }
}

async function restoreFromBackup(filename) {
  if (!gcsStorage) throw new Error('Cloud storage not configured');
  
  try {
    const bucket = gcsStorage.bucket(GCS_BUCKET_NAME);
    const file = bucket.file(filename);
    
    const [buffer] = await file.download();
    
    // Create temporary file
    const tempPath = `./temp-restore-${Date.now()}.zip`;
    fs.writeFileSync(tempPath, buffer);
    
    // Extract and restore
    const yauzl = require('yauzl');
    
    return new Promise((resolve, reject) => {
      yauzl.open(tempPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) {
          fs.unlinkSync(tempPath);
          return reject(err);
        }
        
        const extractedFiles = {};
        let pendingEntries = 0;
        
        zipfile.readEntry();
        
        zipfile.on('entry', (entry) => {
          if (/\/$/.test(entry.fileName)) {
            zipfile.readEntry();
            return;
          }
          
          pendingEntries++;
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              pendingEntries--;
              if (pendingEntries === 0) processRestore();
              return;
            }
            
            let data = '';
            readStream.on('data', (chunk) => data += chunk);
            readStream.on('end', () => {
              extractedFiles[entry.fileName] = data;
              pendingEntries--;
              if (pendingEntries === 0) processRestore();
              zipfile.readEntry();
            });
          });
        });
        
        zipfile.on('end', () => {
          if (pendingEntries === 0) processRestore();
        });
        
        function processRestore() {
          try {
            let restored = { quotes: 0, words: 0, usedQuotes: 0, usedWords: 0, settings: false };
            
            if (extractedFiles['quotes.json']) {
              const quotesData = JSON.parse(extractedFiles['quotes.json']);
              fs.writeFileSync(QUOTE_FILE, JSON.stringify(quotesData, null, 2));
              quotes = quotesData;
              restored.quotes = quotesData.length;
            }
            
            if (extractedFiles['words.json']) {
              const wordsData = JSON.parse(extractedFiles['words.json']);
              fs.writeFileSync(WORD_FILE, JSON.stringify(wordsData, null, 2));
              words = wordsData;
              restored.words = wordsData.length;
            }
            
            if (extractedFiles['used_quotes.json']) {
              const usedQuotesData = JSON.parse(extractedFiles['used_quotes.json']);
              fs.writeFileSync(USED_QUOTES_FILE, JSON.stringify(usedQuotesData, null, 2));
              restored.usedQuotes = usedQuotesData.length;
            }
            
            if (extractedFiles['used_words.json']) {
              const usedWordsData = JSON.parse(extractedFiles['used_words.json']);
              fs.writeFileSync(USED_WORDS_FILE, JSON.stringify(usedWordsData, null, 2));
              restored.usedWords = usedWordsData.length;
            }
            
            fs.unlinkSync(tempPath);
            resolve(restored);
          } catch (error) {
            fs.unlinkSync(tempPath);
            reject(error);
          }
        }
      });
    });
  } catch (err) {
    throw new Error('Failed to restore backup: ' + err.message);
  }
}

function addIdsToContent() {
  let updated = false;
  
  // Add IDs and seasonal_tags to quotes if missing
  quotes = quotes.map(quote => {
    let needsUpdate = false;
    const updatedQuote = { ...quote };
    
    if (!quote.id) {
      updatedQuote.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      needsUpdate = true;
    }
    
    if (!quote.seasonal_tags) {
      updatedQuote.seasonal_tags = [];
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      updated = true;
      return updatedQuote;
    }
    return quote;
  });
  
  // Add IDs and seasonal_tags to words if missing
  words = words.map(word => {
    let needsUpdate = false;
    const updatedWord = { ...word };
    
    if (!word.id) {
      updatedWord.id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      needsUpdate = true;
    }
    
    if (!word.seasonal_tags) {
      updatedWord.seasonal_tags = [];
      needsUpdate = true;
    }
    
    if (needsUpdate) {
      updated = true;
      return updatedWord;
    }
    return word;
  });
  
  if (updated) {
    try {
      fs.writeFileSync(QUOTE_FILE, JSON.stringify(quotes, null, 2));
      fs.writeFileSync(WORD_FILE, JSON.stringify(words, null, 2));
      log('Added IDs and seasonal_tags to existing content', 'info');
    } catch (err) {
      log('Failed to update content with IDs and seasonal_tags: ' + err.message, 'error');
    }
  }
}

function initializeFiles() {
  // Create directories if they don't exist
  const dirs = ['uploads', 'data'];
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`Created directory: ${dir}`, 'info');
    }
  });
  
  // Create .env in root directory if it doesn't exist
  const envPath = './.env';
  if (!fs.existsSync(envPath)) {
    const envContent = `BLUESKY_HANDLE=
BLUESKY_DID=
BLUESKY_PASSWORD=
QUOTE_TIME_CRON=0 9 * * *
WORD_TIME_CRON=0 12 * * *
TIMEZONE=America/New_York
QUOTE_TAG=#QuoteOfTheDay
WORD_TAG=#WordOfTheDay
QUOTE_SOURCE=text
QUOTE_API=https://example.com/api/quote
RANDOMIZE_QUOTES=true
DRY_RUN=false
LOG_LEVEL=info
COOLDOWN_DAYS=90
OUT_OF_SEASON_PENALTY=0.3
SEASONAL_WEIGHT_1=3
SEASONAL_WEIGHT_2=4
SEASONAL_WEIGHT_3=5
RECOVERY_CURVE=[[0,0.2],[90,0.5],[180,0.8],[365,1]]
GCS_PROJECT_ID=
GCS_KEY_FILE=
GCS_BUCKET_NAME=
BACKUP_ENABLED=false
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30`;
    fs.writeFileSync(envPath, envContent, 'utf-8');
    log('Created .env file with default settings', 'info');
    
    // Reload environment variables after creating .env file
    require('dotenv').config();
    

  }
  
  // Create data files if they don't exist
  const files = [
    { path: QUOTE_FILE, content: '[]' },
    { path: WORD_FILE, content: '[]' },
    { path: USED_QUOTES_FILE, content: '[]' },
    { path: USED_WORDS_FILE, content: '[]' },
    { path: QUOTE_CATEGORIES_FILE, content: '[]' },
    { path: WORD_CATEGORIES_FILE, content: '[]' },
    { path: QUOTE_SEASONAL_PERIODS_FILE, content: '{}' },
    { path: WORD_SEASONAL_PERIODS_FILE, content: '{}' }
  ];
  
  files.forEach(file => {
    if (!fs.existsSync(file.path)) {
      fs.writeFileSync(file.path, file.content, 'utf-8');
      log(`Created ${file.path}`, 'info');
    }
  });
}

function loadContent() {
  // Initialize files and directories
  initializeFiles();
  
  // Load seasonal periods
  try {
    const data = fs.readFileSync(QUOTE_SEASONAL_PERIODS_FILE, 'utf-8');
    quoteSeasonalPeriods = JSON.parse(data);
    log(`Loaded ${Object.keys(quoteSeasonalPeriods).length} quote seasonal periods.`, 'info');
  } catch (err) {
    log('Failed to load quote seasonal periods file: ' + err.message, 'error');
    quoteSeasonalPeriods = {};
  }
  
  try {
    const data = fs.readFileSync(WORD_SEASONAL_PERIODS_FILE, 'utf-8');
    wordSeasonalPeriods = JSON.parse(data);
    log(`Loaded ${Object.keys(wordSeasonalPeriods).length} word seasonal periods.`, 'info');
  } catch (err) {
    log('Failed to load word seasonal periods file: ' + err.message, 'error');
    wordSeasonalPeriods = {};
  }

  // Load quotes
  if (QUOTE_SOURCE === 'text') {
    try {
      const data = fs.readFileSync(QUOTE_FILE, 'utf-8');
      try {
        // Try to parse as JSON first
        quotes = JSON.parse(data);
        if (!Array.isArray(quotes)) {
          quotes = [quotes];
        }
      } catch {
        // If not JSON, treat as legacy text format
        quotes = data
          .split(/\r?\n/)
          .map(line => line.trim())
          .filter(line => line)
          .map(text => ({ text, author: 'Unknown' }));
      }
      log(`Loaded ${quotes.length} quotes.`, 'info');
    } catch (err) {
      log('Failed to load quotes file: ' + err.message, 'error');
      quotes = [];
    }
  }

  // Load words
  try {
    const data = fs.readFileSync(WORD_FILE, 'utf-8');
    words = JSON.parse(data);
    if (!Array.isArray(words)) {
      words = [];
    }
    log(`Loaded ${words.length} words.`, 'info');
  } catch (err) {
    log('Failed to load words file: ' + err.message, 'error');
    words = [];
  }

  // Add IDs to existing content
  addIdsToContent();

  // Load used quotes history
  try {
    if (fs.existsSync(USED_QUOTES_FILE)) {
      usedQuotes = new Set(JSON.parse(fs.readFileSync(USED_QUOTES_FILE, 'utf-8')));
    }
  } catch (err) {
    log('Failed to load used quotes file: ' + err.message, 'warn');
  }

  // Load used words history
  try {
    if (fs.existsSync(USED_WORDS_FILE)) {
      usedWords = new Set(JSON.parse(fs.readFileSync(USED_WORDS_FILE, 'utf-8')));
    }
  } catch (err) {
    log('Failed to load used words file: ' + err.message, 'warn');
  }
}

function saveUsedContent() {
  try {
    fs.writeFileSync(USED_QUOTES_FILE, JSON.stringify([...usedQuotes]), 'utf-8');
    fs.writeFileSync(USED_WORDS_FILE, JSON.stringify([...usedWords]), 'utf-8');
  } catch (err) {
    log('Failed to save used content: ' + err.message, 'error');
  }
}

function markAsUsed(content, type) {
  const timestamp = new Date().toISOString();
  
  if (type === 'quote') {
    usedQuotes.add(content);
  } else {
    usedWords.add(content);
  }
  
  // Track usage count
  const usedFile = type === 'quote' ? USED_QUOTES_FILE : USED_WORDS_FILE;
  try {
    let usedList = [];
    if (fs.existsSync(usedFile)) {
      const data = fs.readFileSync(usedFile, 'utf-8');
      usedList = JSON.parse(data);
    }
    
    // Find existing entry by ID
    const existingIndex = usedList.findIndex(item => item.id === content.id);
    if (existingIndex >= 0) {
      // Update existing entry - preserve original ID and firstUsed
      const existing = usedList[existingIndex];
      usedList[existingIndex] = { 
        ...content, 
        usageCount: (existing.usageCount || 0) + 1, 
        firstUsed: existing.firstUsed || timestamp,
        lastUsed: timestamp 
      };
    } else {
      // Add new entry
      usedList.push({ 
        ...content, 
        usageCount: 1, 
        firstUsed: timestamp,
        lastUsed: timestamp 
      });
    }
    
    fs.writeFileSync(usedFile, JSON.stringify(usedList, null, 2));
  } catch (err) {
    log('Failed to save used content: ' + err.message, 'error');
  }
}

function getActiveTags(type = 'quote') {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentDay = now.getDate();
  const activeTags = [];
  const periods = type === 'quote' ? quoteSeasonalPeriods : wordSeasonalPeriods;
  
  for (const [tag, period] of Object.entries(periods)) {
    const [startMonth, startDay] = period.start.split('-').map(Number);
    const [endMonth, endDay] = period.end.split('-').map(Number);
    
    let isActive = false;
    
    if (startMonth <= endMonth) {
      // Same year period (e.g., 03-01 to 05-31)
      isActive = (currentMonth > startMonth || (currentMonth === startMonth && currentDay >= startDay)) &&
                 (currentMonth < endMonth || (currentMonth === endMonth && currentDay <= endDay));
    } else {
      // Cross-year period (e.g., 12-01 to 02-28)
      isActive = (currentMonth > startMonth || (currentMonth === startMonth && currentDay >= startDay)) ||
                 (currentMonth < endMonth || (currentMonth === endMonth && currentDay <= endDay));
    }
    
    if (isActive) {
      activeTags.push(tag);
    }
  }
  
  return activeTags;
}

function calculateWeight(content, activeTags, type) {
  // Get usage data
  const usageData = getUsageData(content.id, type);
  const usageCount = usageData.count;
  const lastUsed = usageData.lastUsed;
  
  // Calculate full seasonal weight (what we'll return to)
  let fullSeasonalWeight = 1;
  if (content.seasonal_tags && Array.isArray(content.seasonal_tags)) {
    const matchingTags = content.seasonal_tags.filter(tag => activeTags.includes(tag)).length;
    if (matchingTags === 1) fullSeasonalWeight = SEASONAL_WEIGHT_1;
    else if (matchingTags === 2) fullSeasonalWeight = SEASONAL_WEIGHT_2;
    else if (matchingTags >= 3) fullSeasonalWeight = SEASONAL_WEIGHT_3;
    
    // Apply out-of-season penalty if no active tags match
    if (matchingTags === 0 && content.seasonal_tags.length > 0) {
      fullSeasonalWeight = OUT_OF_SEASON_PENALTY;
    }
  }
  
  // If never used, return full weight
  if (!lastUsed || usageCount === 0) {
    return fullSeasonalWeight;
  }
  
  const daysSinceUsed = (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24);
  
  // Check if still in cooldown
  if (daysSinceUsed < COOLDOWN_DAYS) {
    return 0; // Blocked by cooldown
  }
  
  // Calculate recovery based on curve
  const daysSinceCooldown = daysSinceUsed - COOLDOWN_DAYS;
  let recoveryPercentage = 1.0; // Default to full recovery
  
  // Find position on recovery curve
  for (let i = 0; i < RECOVERY_CURVE.length - 1; i++) {
    const [days1, percent1] = RECOVERY_CURVE[i];
    const [days2, percent2] = RECOVERY_CURVE[i + 1];
    
    if (daysSinceCooldown >= days1 && daysSinceCooldown <= days2) {
      // Interpolate between curve points
      const progress = (daysSinceCooldown - days1) / (days2 - days1);
      recoveryPercentage = percent1 + (percent2 - percent1) * progress;
      break;
    }
  }
  
  // If beyond last curve point, use full recovery
  if (daysSinceCooldown >= RECOVERY_CURVE[RECOVERY_CURVE.length - 1][0]) {
    recoveryPercentage = RECOVERY_CURVE[RECOVERY_CURVE.length - 1][1];
  }
  
  return fullSeasonalWeight * recoveryPercentage;
}

function getUsageCount(contentId, type) {
  const usageData = getUsageData(contentId, type);
  return usageData.count;
}

function getUsageData(contentId, type) {
  const usedFile = type === 'quote' ? USED_QUOTES_FILE : USED_WORDS_FILE;
  try {
    if (fs.existsSync(usedFile)) {
      const data = fs.readFileSync(usedFile, 'utf-8');
      const usedList = JSON.parse(data);
      const item = usedList.find(item => item.id === contentId);
      return {
        count: item ? (item.usageCount || 0) : 0,
        lastUsed: item ? item.lastUsed : null
      };
    }
  } catch (err) {
    log('Failed to read usage data: ' + err.message, 'warn');
  }
  return { count: 0, lastUsed: null };
}

function getRandomContent(contentArray, usedSet, override = null, type = null) {
  let content;
  
  if (override !== null) {
    content = contentArray[override];
    if (content) {
      if (type) markAsUsed(content, type);
      else usedSet.add(content);
      return content;
    }
  }
  
  const availableContent = contentArray.filter(item => !usedSet.has(item));
  if (availableContent.length === 0) {
    log('All content used. Resetting history.', 'info');
    usedSet.clear();
    return getRandomContent(contentArray, usedSet, null, type);
  }
  
  if (!RANDOMIZE_QUOTES) {
    content = availableContent[0];
  } else {
    // Apply seasonal weighting
    const activeTags = getActiveTags(type);
    if (activeTags.length > 0) {
      log(`Active ${type} seasonal tags: ${activeTags.join(', ')}`, 'debug');
    }
    
    // Create weighted array
    const weightedContent = [];
    for (const item of availableContent) {
      const weight = calculateWeight(item, activeTags, type);
      const roundedWeight = Math.max(1, Math.round(weight * 10)); // Scale and ensure minimum 1
      for (let i = 0; i < roundedWeight; i++) {
        weightedContent.push(item);
      }
    }
    
    content = weightedContent[Math.floor(Math.random() * weightedContent.length)];
  }
    
  if (type) markAsUsed(content, type);
  else usedSet.add(content);
  return content;
}

async function fetchQuoteFromAPI() {
  if (!QUOTE_API) {
    log('QUOTE_API not set for API source.', 'error');
    return null;
  }
  try {
    const res = await fetch(QUOTE_API);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.quote || JSON.stringify(data);
  } catch (err) {
    log('Error fetching quote from API: ' + err.message, 'error');
    return null;
  }
}

async function getQuote(overrideIndex = null) {
  if (QUOTE_SOURCE === 'api') {
    return await fetchQuoteFromAPI();
  } else {
    const quote = getRandomContent(quotes, usedQuotes, overrideIndex, 'quote');
    if (!quote) return null;
    
    // Validate and truncate if necessary
    const validatedQuote = validateAndTruncateQuote(quote);
    
    // Format quote for posting
    let text = validatedQuote.text;
    // Only include author in post text if not using generated_image (since author is in the image)
    if (validatedQuote.author && quote.display_type !== 'generated_image') {
      text += `\n— ${validatedQuote.author}`;
    }
    
    return {
      text,
      quote: validatedQuote,
      embedUrl: quote.source || null,
      imagePath: quote.image_path || null,
      altText: quote.alt_text || null,
      displayType: quote.display_type || 'link',
      hiddenTags: quote.hidden_tags || [],
      imageGenerationText: quote.image_generation_text || null,
      backgroundType: quote.background_type || 'basic'
    };
  }
}

function getWord(overrideIndex = null) {
  const word = getRandomContent(words, usedWords, overrideIndex, 'word');
  if (!word) return null;

  // Validate and truncate if necessary
  const validatedWord = validateAndTruncateWord(word);

  // Format word post with all fields
  let text = `${validatedWord.word}`;
  if (validatedWord.definition) text += `\n\n${validatedWord.definition}`;
  
  return {
    text,
    word: validatedWord,
    embedUrl: word.url || null,
    imagePath: word.image_path || null,
    altText: word.alt_text || null,
    displayType: word.display_type || 'link',
    hiddenTags: word.hidden_tags || [],
    imageGenerationText: word.image_generation_text || null,
    backgroundType: word.background_type || 'basic'
  };
}

async function fetchLinkMetadata(url) {
  log(`Fetching metadata for: ${url}`, 'debug');
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; UrbanismBot/1.0)'
  ];
  
  for (const userAgent of userAgents) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const html = await response.text();
      log(`Successfully fetched ${url} with User-Agent: ${userAgent.substring(0, 50)}...`, 'debug');
      log(`HTML length: ${html.length}, contains title tag: ${html.includes('<title')}, contains og:title: ${html.includes('og:title')}`, 'debug');
    
    // Helper function to decode HTML entities
    const decodeHtml = (text) => {
      return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(parseInt(dec, 10)));
    };
    
    // Extract title - prioritize og:title over page title
    let title = '';
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
    if (ogTitleMatch) {
      title = decodeHtml(ogTitleMatch[1].trim());
    } else {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) title = decodeHtml(titleMatch[1].trim());
    }
    
    // Extract description - prioritize og:description over meta description
    let description = '';
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    if (ogDescMatch) {
      description = decodeHtml(ogDescMatch[1].trim());
    } else {
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (descMatch) description = decodeHtml(descMatch[1].trim());
    }
    
    // Extract thumbnail - prioritize og:image
    let thumbnail = '';
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch) {
      thumbnail = ogImageMatch[1].trim();
    }
    
    // Special handling for YouTube
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
      let videoId = '';
      if (url.includes('youtube.com/watch')) {
        const match = url.match(/[?&]v=([^&]+)/);
        if (match) videoId = match[1];
      } else if (url.includes('youtu.be/')) {
        const match = url.match(/youtu\.be\/([^?]+)/);
        if (match) videoId = match[1];
      }
      
      if (videoId) {
        // Use oEmbed API for YouTube metadata
        try {
          const oembedResponse = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
          if (oembedResponse.ok) {
            const oembedData = await oembedResponse.json();
            if (oembedData.title) title = oembedData.title;
            if (oembedData.author_name) {
              description = `By ${oembedData.author_name}`;
            }
            log(`YouTube oEmbed data: ${JSON.stringify(oembedData)}`, 'debug');
          }
        } catch (err) {
          log(`YouTube oEmbed failed: ${err.message}`, 'debug');
        }
        
        if (!thumbnail) {
          thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      }
    }
    
    // Special handling for Wikipedia
    if (url.includes('wikipedia.org')) {
      // Extract first paragraph if no description
      if (!description) {
        const paragraphs = html.match(/<p[^>]*>.*?<\/p>/gs);
        if (paragraphs) {
          for (const para of paragraphs) {
            let text = para
              .replace(/<[^>]*>/g, '') // Remove HTML tags
              .replace(/\[[^\]]*\]/g, '') // Remove Wikipedia references [1]
              .trim();
            
            text = decodeHtml(text); // Decode HTML entities
            
            if (text.length > 50) { // Skip short paragraphs
              description = text.substring(0, 200);
              if (description.length === 200) description += '...';
              break;
            }
          }
        }
      }
      
      // Extract first image if no thumbnail
      if (!thumbnail) {
        const imgMatch = html.match(/<img[^>]*src=["']([^"']*upload\.wikimedia\.org[^"']+)["'][^>]*>/i);
        if (imgMatch) {
          thumbnail = imgMatch[1].startsWith('//') ? 'https:' + imgMatch[1] : imgMatch[1];
        }
      }
    }
    
      log(`Fetched metadata for ${url}: title="${title}", desc="${description}", thumb="${thumbnail}"`, 'info');
      return { title, description, thumbnail };
    } catch (error) {
      log(`Failed with User-Agent ${userAgent.substring(0, 30)}...: ${error.message}`, 'debug');
      continue;
    }
  }
  
  // If all User-Agents failed, return fallback data
  log('All User-Agents failed, using fallback metadata for: ' + url, 'warn');
  
  // For YouTube, provide fallback data
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) {
    let videoId = '';
    if (url.includes('youtube.com/watch')) {
      const match = url.match(/[?&]v=([^&]+)/);
      if (match) videoId = match[1];
    } else if (url.includes('youtu.be/')) {
      const match = url.match(/youtu\.be\/([^?]+)/);
      if (match) videoId = match[1];
    }
    
    if (videoId) {
      return {
        title: 'YouTube Video',
        description: 'Watch this video on YouTube',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      };
    }
  }
  
  return { title: '', description: '', thumbnail: '' };
}

async function uploadImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const imageBuffer = await response.buffer();
    const uploadResponse = await agent.uploadBlob(imageBuffer, {
      encoding: response.headers.get('content-type') || 'image/jpeg'
    });
    
    return uploadResponse.data.blob;
  } catch (error) {
    log('Error uploading image: ' + error.message, 'error');
    return null;
  }
}

async function generateImageFromText(text, author = '', hashtag = '', backgroundImagePath = null) {
  try {
    const { createCanvas, loadImage } = require('canvas');
    
    const width = 800;
    const height = 600;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Background - either uploaded image or gradient
    if (backgroundImagePath && fs.existsSync(backgroundImagePath)) {
      try {
        // Use Sharp to convert image to PNG buffer for reliable Canvas loading
        const imageBuffer = await sharp(backgroundImagePath)
          .png()
          .toBuffer();
        const backgroundImage = await loadImage(imageBuffer);
        // Draw background image to fill canvas
        ctx.drawImage(backgroundImage, 0, 0, width, height);
        // Add semi-transparent overlay for better text readability
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);
      } catch (err) {
        log('Failed to load background image, using gradient: ' + err.message, 'warn');
        // Fallback to gradient background
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      // Gradient background
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    
    // Text styling
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    
    // Word wrap function
    const wrapText = (context, text, maxWidth, font) => {
      context.font = font;
      const words = text.split(' ');
      let line = '';
      let lines = [];
      
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());
      
      return lines;
    };
    
    const maxWidth = width - 100;
    
    // Check if this is a word (has author parameter for word name) or quote (no author means it's a quote)
    const isWord = author && hashtag && hashtag.includes('Word');
    
    if (isWord) {
      // Word layout: hashtag at top, word and definition centered together between hashtag and bottom
      const hashtagY = 60;
      const bottomMargin = 40;
      const availableHeight = height - hashtagY - bottomMargin;
      
      // Draw hashtag at top in light blue
      if (hashtag) {
        ctx.fillStyle = '#87ceeb'; // Sky blue color for hashtag
        ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
        ctx.fillText(hashtag, width / 2, hashtagY);
      }
      
      // Calculate optimal font size for definition text
      let fontSize = 28;
      let lines = [];
      do {
        ctx.font = `${fontSize}px "DejaVu Sans", sans-serif`;
        lines = wrapText(ctx, text, maxWidth, ctx.font);
        const wordHeight = 36 * 1.2; // Word font size with line height
        const gapHeight = fontSize * 1.2; // One line gap
        const textBlockHeight = lines.length * fontSize * 1.2;
        const totalContentHeight = wordHeight + gapHeight + textBlockHeight;
        
        if (totalContentHeight > availableHeight && fontSize > 16) {
          fontSize -= 2;
        } else {
          break;
        }
      } while (fontSize > 16);
      
      // Calculate positions to center word + definition block
      const wordHeight = 36 * 1.2;
      const gapHeight = fontSize * 1.2;
      const textBlockHeight = lines.length * fontSize * 1.2;
      const totalContentHeight = wordHeight + gapHeight + textBlockHeight;
      const startY = hashtagY + (availableHeight - totalContentHeight) / 2;
      
      // Draw word in light yellow
      ctx.fillStyle = '#ffeb9c'; // Light yellow color for word
      ctx.font = 'bold 36px "DejaVu Sans", sans-serif';
      ctx.fillText(author, width / 2, startY + wordHeight);
      
      // Draw definition in white
      ctx.fillStyle = '#ffffff';
      ctx.font = `${fontSize}px "DejaVu Sans", sans-serif`;
      const lineHeight = fontSize * 1.2;
      const definitionStartY = startY + wordHeight + gapHeight + lineHeight;
      
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], width / 2, definitionStartY + i * lineHeight);
      }
    } else {
      // Quote layout: hashtag at top, quote text centered, author at bottom
      const hashtagY = 60;
      const authorY = height - 60;
      const availableHeight = authorY - hashtagY - 80;
      
      // Draw hashtag at top in light blue
      if (hashtag) {
        ctx.fillStyle = '#87ceeb'; // Sky blue color for hashtag
        ctx.font = 'bold 24px "DejaVu Sans", sans-serif';
        ctx.fillText(hashtag, width / 2, hashtagY);
      }
      
      // Reset to white for quote text
      ctx.fillStyle = '#ffffff';
      
      // Calculate optimal font size for quote text
      let fontSize = 48;
      let lines = [];
      do {
        ctx.font = `bold ${fontSize}px "DejaVu Sans", sans-serif`;
        lines = wrapText(ctx, text, maxWidth, ctx.font);
        if (lines.length * fontSize * 1.2 > availableHeight) {
          fontSize -= 2;
        }
      } while (lines.length * fontSize * 1.2 > availableHeight && fontSize > 16);
      
      // Draw quote text centered between hashtag and author
      const lineHeight = fontSize * 1.2;
      const textBlockHeight = lines.length * lineHeight;
      const centerY = hashtagY + 40 + (availableHeight - textBlockHeight) / 2 + lineHeight;
      
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], width / 2, centerY + i * lineHeight);
      }
      
      // Draw author at bottom in light yellow
      if (author) {
        ctx.fillStyle = '#ffeb9c'; // Light yellow color for author
        ctx.font = 'italic 24px "DejaVu Sans", sans-serif';
        ctx.fillText(`— ${author}`, width / 2, authorY);
      }
    }
    
    return canvas.toBuffer('image/png');
  } catch (error) {
    log('Error generating image from text: ' + error.message, 'error');
    return null;
  }
}

async function login() {
  const handle = BLUESKY_HANDLE?.trim();
  const did = BLUESKY_DID?.trim();
  const password = BLUESKY_PASSWORD?.trim();
  
  if ((!handle && !did) || !password) {
    log('Bluesky credentials not configured - skipping login', 'warn');
    return false;
  }
  
  // Try handle first, then DID if handle fails
  const identifiers = [handle, did].filter(Boolean);
  
  for (const identifier of identifiers) {
    try {
      const session = await agent.login({ identifier, password });
      log('Logged in as ' + (session.data?.handle || identifier), 'info');
      log('Agent session active: ' + !!agent.session, 'debug');
      return true;
    } catch (err) {
      log(`Failed to log in with ${identifier}: ${err.message}`, 'error');
    }
  }
  
  return false;
}



async function postQuote() {
  console.log('POSTQUOTE FUNCTION CALLED');
  log('postQuote function started', 'info');
  if (skipNextQuote) {
    skipNextQuote = false;
    log('Skipped scheduled quote post', 'info');
    return;
  }
  
  const overrideIndex = nextQuoteOverride;
  nextQuoteOverride = null;
  
  const quoteData = await getQuote(overrideIndex);
  if (!quoteData) {
    log('No quote available to post.', 'warn');
    return;
  }

  const text = `${QUOTE_TAG}\n\n${quoteData.text}`;

  if (DRY_RUN) {
    log('[DRY RUN] Would post quote: ' + text, 'info');
    return;
  }

  try {
    log(`Processing text for facets: "${text}"`, 'info');
    log('Agent session status: ' + !!agent.session, 'debug');
    
    const rt = new RichText({ text });
    log('RichText created, calling detectFacets...', 'debug');
    await rt.detectFacets(agent);
    log('detectFacets completed', 'debug');
    
    const postData = { 
      text: rt.text,
      facets: rt.facets || []
    };
    
    log(`Detected facets: ${JSON.stringify(rt.facets)}`, 'debug');
    
    // Ensure hashtag facet is preserved
    const hashtagFacet = {
      index: { byteStart: 0, byteEnd: Buffer.byteLength(QUOTE_TAG, 'utf8') },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: QUOTE_TAG.slice(1) }]
    };
    
    // Add hashtag facet if not already detected
    const hasHashtagFacet = postData.facets.some(f => 
      f.index.byteStart === 0 && f.features.some(feat => feat.$type === 'app.bsky.richtext.facet#tag')
    );
    
    if (!hasHashtagFacet) {
      postData.facets.unshift(hashtagFacet);
    };
    
    // Add embed based on display type
    log(`Quote embedUrl: ${quoteData.embedUrl}, displayType: ${quoteData.displayType}`, 'info');
    if (quoteData.displayType === 'link' && quoteData.embedUrl) {
      log(`Creating embed for URL: ${quoteData.embedUrl}`, 'info');
      const metadata = await fetchLinkMetadata(quoteData.embedUrl);
      const external = {
        uri: quoteData.embedUrl,
        title: metadata.title || 'Source',
        description: metadata.description || ''
      };
      log(`Embed metadata: ${JSON.stringify(external)}`, 'info');
      
      // Add thumbnail if available
      if (metadata.thumbnail) {
        try {
          const thumbBlob = await uploadImage(metadata.thumbnail);
          if (thumbBlob) external.thumb = thumbBlob;
        } catch (err) {
          log('Failed to upload thumbnail: ' + err.message, 'warn');
        }
      }
      
      postData.embed = {
        $type: 'app.bsky.embed.external',
        external
      };
    }
    
    // Add image if exists and display type is image
    if (quoteData.displayType === 'image' && quoteData.imagePath && fs.existsSync(quoteData.imagePath)) {
      try {
        const imageBuffer = fs.readFileSync(quoteData.imagePath);
        const metadata = await sharp(imageBuffer).metadata();
        const uploadResponse = await agent.uploadBlob(imageBuffer, {
          encoding: 'image/jpeg' // You might want to detect actual MIME type
        });
        
        if (uploadResponse.success) {
          postData.embed = {
            $type: 'app.bsky.embed.images',
            images: [{
              alt: quoteData.altText || 'Quote image',
              image: uploadResponse.data.blob,
              aspectRatio: {
                width: metadata.width,
                height: metadata.height
              }
            }]
          };
        }
      } catch (err) {
        log('Failed to upload image: ' + err.message, 'warn');
      }
    }
    
    // Generate and add image if display type is generated_image
    if (quoteData.displayType === 'generated_image' && quoteData.imageGenerationText) {
      try {
        const backgroundImagePath = (quoteData.backgroundType === 'uploaded' && quoteData.imagePath) ? quoteData.imagePath : null;
        const generatedImageBuffer = await generateImageFromText(
          quoteData.imageGenerationText, 
          quoteData.quote.author, 
          QUOTE_TAG,
          backgroundImagePath
        );
        if (generatedImageBuffer) {
          const uploadResponse = await agent.uploadBlob(generatedImageBuffer, {
            encoding: 'image/png'
          });
          
          if (uploadResponse.success) {
            let altText = `${QUOTE_TAG} ${quoteData.imageGenerationText} — ${quoteData.quote.author}`;
            if (quoteData.altText) {
              altText += `\n${quoteData.altText}`;
            }
            postData.embed = {
              $type: 'app.bsky.embed.images',
              images: [{
                alt: altText,
                image: uploadResponse.data.blob,
                aspectRatio: {
                  width: 800,
                  height: 600
                }
              }]
            };
          }
        }
      } catch (err) {
        log('Failed to generate and upload image: ' + err.message, 'warn');
      }
    }
    
    // Hidden tags feature not yet implemented

    log(`Quote background type: ${quoteData.backgroundType}, imagePath: ${quoteData.imagePath}`, 'info');
    log(`Final post data: ${JSON.stringify(postData, null, 2)}`, 'info');
    const post = await agent.post(postData);
    log('Posted quote: ' + post.uri, 'info');
  } catch (err) {
    log('Error posting quote to Bluesky: ' + err.message, 'error');
  }
}

async function postWord() {
  if (skipNextWord) {
    skipNextWord = false;
    log('Skipped scheduled word post', 'info');
    return;
  }
  
  const overrideIndex = nextWordOverride;
  nextWordOverride = null;
  
  const wordData = getWord(overrideIndex);
  if (!wordData) {
    log('No word available to post.', 'warn');
    return;
  }

  let text = `${WORD_TAG}\n\n${wordData.text}`;

  if (DRY_RUN) {
    log('[DRY RUN] Would post word: ' + text, 'info');
    return;
  }

  try {
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    
    // Add hashtag facet
    const hashtagFacet = {
      index: { byteStart: 0, byteEnd: Buffer.byteLength(WORD_TAG, 'utf8') },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: WORD_TAG.slice(1) }]
    };
    
    const postData = { 
      text: rt.text,
      facets: [hashtagFacet, ...(rt.facets || [])]
    };
    
    // Add embed if URL exists and display type is link
    if (wordData.displayType === 'link' && wordData.embedUrl) {
      const metadata = await fetchLinkMetadata(wordData.embedUrl);
      const external = {
        uri: wordData.embedUrl,
        title: metadata.title || 'Learn more',
        description: metadata.description || ''
      };
      
      // Add thumbnail if available
      if (metadata.thumbnail) {
        try {
          const thumbBlob = await uploadImage(metadata.thumbnail);
          if (thumbBlob) external.thumb = thumbBlob;
        } catch (err) {
          log('Failed to upload thumbnail: ' + err.message, 'warn');
        }
      }
      
      postData.embed = {
        $type: 'app.bsky.embed.external',
        external
      };
    }
    
    // Add image if exists and display type is image
    if (wordData.displayType === 'image' && wordData.imagePath && fs.existsSync(wordData.imagePath)) {
      try {
        const imageBuffer = fs.readFileSync(wordData.imagePath);
        const metadata = await sharp(imageBuffer).metadata();
        const uploadResponse = await agent.uploadBlob(imageBuffer, {
          encoding: 'image/jpeg'
        });
        
        if (uploadResponse.success) {
          postData.embed = {
            $type: 'app.bsky.embed.images',
            images: [{
              alt: wordData.altText || 'Word image',
              image: uploadResponse.data.blob,
              aspectRatio: {
                width: metadata.width,
                height: metadata.height
              }
            }]
          };
        }
      } catch (err) {
        log('Failed to upload image: ' + err.message, 'warn');
      }
    }
    
    // Generate and add image if display type is generated_image
    if (wordData.displayType === 'generated_image' && wordData.imageGenerationText) {
      try {
        const backgroundImagePath = (wordData.backgroundType === 'uploaded' && wordData.imagePath) ? wordData.imagePath : null;
        const generatedImageBuffer = await generateImageFromText(
          wordData.imageGenerationText, 
          wordData.word.word, 
          WORD_TAG,
          backgroundImagePath
        );
        if (generatedImageBuffer) {
          const uploadResponse = await agent.uploadBlob(generatedImageBuffer, {
            encoding: 'image/png'
          });
          
          if (uploadResponse.success) {
            let altText = `${WORD_TAG} ${wordData.imageGenerationText}`;
            if (wordData.altText) {
              altText += `\n${wordData.altText}`;
            }
            postData.embed = {
              $type: 'app.bsky.embed.images',
              images: [{
                alt: altText,
                image: uploadResponse.data.blob,
                aspectRatio: {
                  width: 800,
                  height: 600
                }
              }]
            };
          }
        }
      } catch (err) {
        log('Failed to generate and upload image: ' + err.message, 'warn');
      }
    }

    // Hidden tags feature not yet implemented

    const post = await agent.post(postData);
    log('Posted word: ' + post.uri, 'info');
  } catch (err) {
    log('Error posting word to Bluesky: ' + err.message, 'error');
  }
}

// Setup express server for manual triggers
const app = express();
const PORT = process.env.PORT || 3000;

// Add body parsing for content endpoints
app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve static files from public directory
app.use(express.static('public'));
// Serve uploaded images
app.use('/uploads', express.static('uploads'));

// Status endpoint
app.get('/status', (req, res) => {
  const quoteCron = global.QUOTE_TIME_CRON || QUOTE_TIME_CRON;
  const wordCron = global.WORD_TIME_CRON || WORD_TIME_CRON;
  
  const nextQuoteTime = skipNextQuote ? null : getNextScheduledTime(quoteCron);
  const nextWordTime = skipNextWord ? null : getNextScheduledTime(wordCron);
  
  res.json({
    quoteSchedule: quoteCron,
    wordSchedule: wordCron,
    quoteHour: cronToHour(quoteCron),
    wordHour: cronToHour(wordCron),
    timezone: TIMEZONE || 'System default',
    nextQuoteTime: nextQuoteTime ? nextQuoteTime.toLocaleString() : (skipNextQuote ? 'Skipped' : 'Unknown'),
    nextWordTime: nextWordTime ? nextWordTime.toLocaleString() : (skipNextWord ? 'Skipped' : 'Unknown')
  });
});

// Content management endpoints
app.get('/content/quotes', (req, res) => {
  try {
    const data = fs.readFileSync(QUOTE_FILE, 'utf-8');
    try {
      // Try to parse as JSON first
      const quotes = JSON.parse(data);
      res.json(quotes);
    } catch {
      // If not JSON, treat as legacy text format
      const quotes = data
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line)
        .map(text => ({ text, author: 'Unknown' }));
      res.json(quotes);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/content/words', (req, res) => {
  try {
    const data = fs.readFileSync(WORD_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/content/used-quotes', (req, res) => {
  try {
    if (fs.existsSync(USED_QUOTES_FILE)) {
      const data = fs.readFileSync(USED_QUOTES_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/content/used-words', (req, res) => {
  try {
    if (fs.existsSync(USED_WORDS_FILE)) {
      const data = fs.readFileSync(USED_WORDS_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/content/quotes', (req, res) => {
  try {
    // Validate required fields
    const quotesData = Array.isArray(req.body) ? req.body : [req.body];
    for (const quote of quotesData) {
      if (!quote.text || typeof quote.text !== 'string') {
        throw new Error('Each quote must have a text field');
      }
      if (!quote.author || typeof quote.author !== 'string') {
        throw new Error('Each quote must have an author field');
      }
    }

    // Save quotes as JSON
    fs.writeFileSync(QUOTE_FILE, JSON.stringify(quotesData, null, 2));
    quotes = quotesData;
    log(`Updated quotes file with ${quotes.length} quotes`);
    res.json({ success: true, message: `Updated ${quotes.length} quotes` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/content/words', (req, res) => {
  try {
    // Handle JSON array of word objects
    const wordsData = Array.isArray(req.body) ? req.body : [req.body];
    fs.writeFileSync(WORD_FILE, JSON.stringify(wordsData, null, 2));
    words = wordsData;
    log(`Updated words file with ${words.length} words`);
    res.json({ success: true, message: `Updated ${words.length} words` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// File upload endpoint
app.post('/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }
    
    const imagePath = req.file.path;
    res.json({ success: true, imagePath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/trigger/quote', async (req, res) => {
  try {
    console.log('TRIGGER QUOTE ENDPOINT CALLED');
    log('Trigger quote endpoint called', 'info');
    await postQuote();
    res.json({ success: true, message: 'Quote posted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/trigger/word', async (req, res) => {
  try {
    await postWord();
    res.json({ success: true, message: 'Word posted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint for VPS troubleshooting
app.get('/debug/environment', async (req, res) => {
  try {
    const testText = 'Test @fema.monster mention';
    const rt = new RichText({ text: testText });
    
    let facetsResult = 'No agent session';
    if (agent.session) {
      await rt.detectFacets(agent);
      facetsResult = rt.facets;
    }
    
    // Test URL fetch
    let urlTest = 'Failed';
    let htmlSample = '';
    try {
      const testResponse = await fetch('https://www.youtube.com/watch?v=CTV-wwszGw8', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        timeout: 10000
      });
      const html = await testResponse.text();
      htmlSample = html.substring(0, 500) + '...';
      
      // Check for title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
      
      urlTest = `Status: ${testResponse.status}, Title: ${titleMatch ? titleMatch[1] : 'Not found'}, OG:Title: ${ogTitleMatch ? ogTitleMatch[1] : 'Not found'}`;
    } catch (err) {
      urlTest = `Error: ${err.message}`;
    }
    
    res.json({
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        timezone: process.env.TZ || 'Not set'
      },
      bluesky: {
        agentSession: !!agent.session,
        handle: BLUESKY_HANDLE || 'Not set',
        did: BLUESKY_DID || 'Not set'
      },
      richTextTest: {
        input: testText,
        facets: facetsResult
      },
      networkTest: {
        urlFetch: urlTest,
        htmlSample: htmlSample
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.post('/post/quote/:index', async (req, res) => {
  try {
    console.log('=== MANUAL POST ENDPOINT HIT ===');
    console.log(`Index: ${req.params.index}`);
    log(`Manual quote post called with index: ${req.params.index}`, 'info');
    const index = parseInt(req.params.index);
    if (index < 0 || index >= quotes.length) {
      return res.status(400).json({ success: false, error: 'Invalid quote index' });
    }
    
    const quoteData = await getQuote(index);
    if (!quoteData) {
      return res.status(400).json({ success: false, error: 'Quote not available' });
    }
    
    log(`Manual post - Quote data: ${JSON.stringify(quoteData, null, 2)}`, 'info');

    let text = `${QUOTE_TAG}\n\n${quoteData.text}`;

    if (DRY_RUN) {
      log('[DRY RUN] Would post specific quote: ' + text, 'info');
      return res.json({ success: true, message: '[DRY RUN] Would post quote' });
    }

    log(`Manual post - Starting RichText processing for text: "${text}"`, 'info');
    log('Agent session status: ' + !!agent.session, 'debug');
    
    const rt = new RichText({ text });
    log('Manual post - RichText object created', 'info');
    
    await rt.detectFacets(agent);
    log('Manual post - detectFacets completed', 'info');
    
    log(`Manual post - RichText facets detected: ${JSON.stringify(rt.facets)}`, 'info');
    log(`Manual post - RichText text: "${rt.text}"`, 'info');
    
    const postData = { 
      text: rt.text,
      facets: (rt.facets || []).filter(facet => 
        facet.features && facet.features.every(feature => 
          !feature.did || (feature.did && feature.did.length > 0)
        )
      )
    };
    
    // Ensure hashtag facet is preserved
    const hashtagFacet = {
      index: { byteStart: 0, byteEnd: Buffer.byteLength(QUOTE_TAG, 'utf8') },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: QUOTE_TAG.slice(1) }]
    };
    
    // Add hashtag facet if not already detected
    const hasHashtagFacet = postData.facets.some(f => 
      f.index.byteStart === 0 && f.features.some(feat => feat.$type === 'app.bsky.richtext.facet#tag')
    );
    
    if (!hasHashtagFacet) {
      postData.facets.unshift(hashtagFacet);
    }
    
    // Add embed based on display type
    if (quoteData.displayType === 'link' && quoteData.embedUrl) {
      log(`Manual post - Creating embed for URL: ${quoteData.embedUrl}`, 'info');
      const metadata = await fetchLinkMetadata(quoteData.embedUrl);
      log(`Manual post - Metadata received: ${JSON.stringify(metadata)}`, 'info');
      const external = {
        uri: quoteData.embedUrl,
        title: metadata.title || 'Source',
        description: metadata.description || ''
      };
      
      // Add thumbnail if available
      if (metadata.thumbnail) {
        log(`Manual post - Uploading thumbnail: ${metadata.thumbnail}`, 'info');
        try {
          const thumbBlob = await uploadImage(metadata.thumbnail);
          if (thumbBlob) {
            external.thumb = thumbBlob;
            log('Manual post - Thumbnail uploaded successfully', 'info');
          }
        } catch (err) {
          log('Failed to upload thumbnail: ' + err.message, 'warn');
        }
      } else {
        log('Manual post - No thumbnail found in metadata', 'info');
      }
      
      postData.embed = {
        $type: 'app.bsky.embed.external',
        external
      };
    }
    
    // Add image if exists and display type is image
    if (quoteData.displayType === 'image' && quoteData.imagePath && fs.existsSync(quoteData.imagePath)) {
      try {
        const imageBuffer = fs.readFileSync(quoteData.imagePath);
        const metadata = await sharp(imageBuffer).metadata();
        const uploadResponse = await agent.uploadBlob(imageBuffer, {
          encoding: 'image/jpeg'
        });
        
        if (uploadResponse.success) {
          postData.embed = {
            $type: 'app.bsky.embed.images',
            images: [{
              alt: quoteData.altText || 'Quote image',
              image: uploadResponse.data.blob,
              aspectRatio: {
                width: metadata.width,
                height: metadata.height
              }
            }]
          };
        }
      } catch (err) {
        log('Failed to upload image: ' + err.message, 'warn');
      }
    }
    
    // Generate and add image if display type is generated_image
    if (quoteData.displayType === 'generated_image' && quoteData.imageGenerationText) {
      try {
        const backgroundImagePath = (quoteData.backgroundType === 'uploaded' && quoteData.imagePath) ? quoteData.imagePath : null;
        const generatedImageBuffer = await generateImageFromText(
          quoteData.imageGenerationText, 
          quoteData.quote.author, 
          QUOTE_TAG,
          backgroundImagePath
        );
        if (generatedImageBuffer) {
          const uploadResponse = await agent.uploadBlob(generatedImageBuffer, {
            encoding: 'image/png'
          });
          
          if (uploadResponse.success) {
            let altText = `${QUOTE_TAG} ${quoteData.imageGenerationText} — ${quoteData.quote.author}`;
            if (quoteData.altText) {
              altText += `\n${quoteData.altText}`;
            }
            postData.embed = {
              $type: 'app.bsky.embed.images',
              images: [{
                alt: altText,
                image: uploadResponse.data.blob,
                aspectRatio: {
                  width: 800,
                  height: 600
                }
              }]
            };
          }
        }
      } catch (err) {
        log('Failed to generate and upload image: ' + err.message, 'warn');
      }
    }

    // Hidden tags feature not yet implemented

    log(`Manual post - Final post data: ${JSON.stringify(postData, null, 2)}`, 'info');
    const post = await agent.post(postData);
    log('Posted specific quote: ' + post.uri, 'info');
    res.json({ success: true, message: 'Quote posted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/post/word/:index', async (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (index < 0 || index >= words.length) {
      return res.status(400).json({ success: false, error: 'Invalid word index' });
    }
    
    const wordData = getWord(index);
    if (!wordData) {
      return res.status(400).json({ success: false, error: 'Word not available' });
    }

    let text = `${WORD_TAG}\n\n${wordData.text}`;

    if (DRY_RUN) {
      log('[DRY RUN] Would post specific word: ' + text, 'info');
      return res.json({ success: true, message: '[DRY RUN] Would post word' });
    }

    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    
    // Add hashtag facet
    const hashtagFacet = {
      index: { byteStart: 0, byteEnd: Buffer.byteLength(WORD_TAG, 'utf8') },
      features: [{ $type: 'app.bsky.richtext.facet#tag', tag: WORD_TAG.slice(1) }]
    };
    
    const postData = { 
      text: rt.text,
      facets: [hashtagFacet, ...(rt.facets || [])]
    };
    
    // Add embed if URL exists and display type is link
    if (wordData.displayType === 'link' && wordData.embedUrl) {
      const metadata = await fetchLinkMetadata(wordData.embedUrl);
      const external = {
        uri: wordData.embedUrl,
        title: metadata.title || 'Learn more',
        description: metadata.description || ''
      };
      
      // Add thumbnail if available
      if (metadata.thumbnail) {
        try {
          const thumbBlob = await uploadImage(metadata.thumbnail);
          if (thumbBlob) external.thumb = thumbBlob;
        } catch (err) {
          log('Failed to upload thumbnail: ' + err.message, 'warn');
        }
      }
      
      postData.embed = {
        $type: 'app.bsky.embed.external',
        external
      };
    }
    
    // Add image if exists and display type is image
    if (wordData.displayType === 'image' && wordData.imagePath && fs.existsSync(wordData.imagePath)) {
      try {
        const imageBuffer = fs.readFileSync(wordData.imagePath);
        const metadata = await sharp(imageBuffer).metadata();
        const uploadResponse = await agent.uploadBlob(imageBuffer, {
          encoding: 'image/jpeg'
        });
        
        if (uploadResponse.success) {
          postData.embed = {
            $type: 'app.bsky.embed.images',
            images: [{
              alt: wordData.altText || 'Word image',
              image: uploadResponse.data.blob,
              aspectRatio: {
                width: metadata.width,
                height: metadata.height
              }
            }]
          };
        }
      } catch (err) {
        log('Failed to upload image: ' + err.message, 'warn');
      }
    }
    
    // Generate and add image if display type is generated_image
    if (wordData.displayType === 'generated_image' && wordData.imageGenerationText) {
      try {
        const backgroundImagePath = (wordData.backgroundType === 'uploaded' && wordData.imagePath) ? wordData.imagePath : null;
        const generatedImageBuffer = await generateImageFromText(
          wordData.imageGenerationText, 
          wordData.word.word, 
          WORD_TAG,
          backgroundImagePath
        );
        if (generatedImageBuffer) {
          const uploadResponse = await agent.uploadBlob(generatedImageBuffer, {
            encoding: 'image/png'
          });
          
          if (uploadResponse.success) {
            let altText = `${WORD_TAG} ${wordData.imageGenerationText}`;
            if (wordData.altText) {
              altText += `\n${wordData.altText}`;
            }
            postData.embed = {
              $type: 'app.bsky.embed.images',
              images: [{
                alt: altText,
                image: uploadResponse.data.blob,
                aspectRatio: {
                  width: 800,
                  height: 600
                }
              }]
            };
          }
        }
      } catch (err) {
        log('Failed to generate and upload image: ' + err.message, 'warn');
      }
    }

    // Hidden tags feature not yet implemented

    const post = await agent.post(postData);
    log('Posted specific word: ' + post.uri, 'info');
    res.json({ success: true, message: 'Word posted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/schedule/quote/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (index < 0 || index >= quotes.length) {
      return res.status(400).json({ success: false, error: 'Invalid quote index' });
    }
    
    nextQuoteOverride = index;
    res.json({ success: true, message: 'Quote scheduled for next posting' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/schedule/word/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    if (index < 0 || index >= words.length) {
      return res.status(400).json({ success: false, error: 'Invalid word index' });
    }
    
    nextWordOverride = index;
    res.json({ success: true, message: 'Word scheduled for next posting' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/skip/quote', (req, res) => {
  try {
    skipNextQuote = true;
    res.json({ success: true, message: 'Next scheduled quote will be skipped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/skip/word', (req, res) => {
  try {
    skipNextWord = true;
    res.json({ success: true, message: 'Next scheduled word will be skipped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/remove-used/quote/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const usedFile = USED_QUOTES_FILE;
    
    if (!fs.existsSync(usedFile)) {
      return res.status(404).json({ success: false, error: 'Used quotes file not found' });
    }
    
    const usedList = JSON.parse(fs.readFileSync(usedFile, 'utf-8'));
    if (index < 0 || index >= usedList.length) {
      return res.status(400).json({ success: false, error: 'Invalid index' });
    }
    
    const removedQuote = usedList.splice(index, 1)[0];
    fs.writeFileSync(usedFile, JSON.stringify(usedList, null, 2));
    
    res.json({ success: true, message: `Quote "${removedQuote.text.substring(0, 30)}..." removed from used list` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/remove-used/word/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const usedFile = USED_WORDS_FILE;
    
    if (!fs.existsSync(usedFile)) {
      return res.status(404).json({ success: false, error: 'Used words file not found' });
    }
    
    const usedList = JSON.parse(fs.readFileSync(usedFile, 'utf-8'));
    if (index < 0 || index >= usedList.length) {
      return res.status(400).json({ success: false, error: 'Invalid index' });
    }
    
    const removedWord = usedList.splice(index, 1)[0];
    fs.writeFileSync(usedFile, JSON.stringify(usedList, null, 2));
    
    res.json({ success: true, message: `Word "${removedWord.word}" removed from used list` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/edit-usage/quote/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const { usageCount } = req.body;
    
    if (!fs.existsSync(USED_QUOTES_FILE)) {
      return res.status(404).json({ success: false, error: 'Used quotes file not found' });
    }
    
    const usedList = JSON.parse(fs.readFileSync(USED_QUOTES_FILE, 'utf-8'));
    if (index < 0 || index >= usedList.length) {
      return res.status(400).json({ success: false, error: 'Invalid index' });
    }
    
    if (typeof usageCount !== 'number' || usageCount < 0) {
      return res.status(400).json({ success: false, error: 'Usage count must be a non-negative number' });
    }
    
    usedList[index].usageCount = usageCount;
    fs.writeFileSync(USED_QUOTES_FILE, JSON.stringify(usedList, null, 2));
    
    res.json({ success: true, message: 'Usage count updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/edit-usage/word/:index', (req, res) => {
  try {
    const index = parseInt(req.params.index);
    const { usageCount } = req.body;
    
    if (!fs.existsSync(USED_WORDS_FILE)) {
      return res.status(404).json({ success: false, error: 'Used words file not found' });
    }
    
    const usedList = JSON.parse(fs.readFileSync(USED_WORDS_FILE, 'utf-8'));
    if (index < 0 || index >= usedList.length) {
      return res.status(400).json({ success: false, error: 'Invalid index' });
    }
    
    if (typeof usageCount !== 'number' || usageCount < 0) {
      return res.status(400).json({ success: false, error: 'Usage count must be a non-negative number' });
    }
    
    usedList[index].usageCount = usageCount;
    fs.writeFileSync(USED_WORDS_FILE, JSON.stringify(usedList, null, 2));
    
    res.json({ success: true, message: 'Usage count updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/categories/:type', (req, res) => {
  try {
    const type = req.params.type;
    const file = type === 'quote' ? QUOTE_CATEGORIES_FILE : WORD_CATEGORIES_FILE;
    
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, '[]');
    }
    const categories = JSON.parse(fs.readFileSync(file, 'utf-8'));
    res.json(categories);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/categories/:type', (req, res) => {
  try {
    const type = req.params.type;
    const file = type === 'quote' ? QUOTE_CATEGORIES_FILE : WORD_CATEGORIES_FILE;
    const categories = req.body;
    
    fs.writeFileSync(file, JSON.stringify(categories, null, 2));
    res.json({ success: true, message: `${type} categories updated successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/seasonal-periods/:type', (req, res) => {
  try {
    const type = req.params.type;
    const periods = type === 'quote' ? quoteSeasonalPeriods : wordSeasonalPeriods;
    res.json(periods);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/seasonal-periods/:type', (req, res) => {
  try {
    const type = req.params.type;
    const periods = req.body;
    
    if (type === 'quote') {
      quoteSeasonalPeriods = periods;
      fs.writeFileSync(QUOTE_SEASONAL_PERIODS_FILE, JSON.stringify(periods, null, 2));
    } else {
      wordSeasonalPeriods = periods;
      fs.writeFileSync(WORD_SEASONAL_PERIODS_FILE, JSON.stringify(periods, null, 2));
    }
    
    log(`Updated ${type} seasonal periods configuration`, 'info');
    res.json({ success: true, message: `${type} seasonal periods updated successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/active-tags/:type', (req, res) => {
  try {
    const type = req.params.type;
    const activeTags = getActiveTags(type);
    res.json({ activeTags, currentDate: new Date().toISOString().split('T')[0] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/weighting-info/:type', (req, res) => {
  try {
    const type = req.params.type;
    const content = type === 'quote' ? quotes : words;
    const activeTags = getActiveTags(type);
    
    const weightingInfo = content.map(item => {
      const usageData = getUsageData(item.id, type);
      const weight = calculateWeight(item, activeTags, type);
      const daysSinceUsed = usageData.lastUsed ? 
        (Date.now() - new Date(usageData.lastUsed).getTime()) / (1000 * 60 * 60 * 24) : null;
      const inCooldown = daysSinceUsed !== null && daysSinceUsed < COOLDOWN_DAYS;
      
      const matchingTags = item.seasonal_tags ? 
        item.seasonal_tags.filter(tag => activeTags.includes(tag)) : [];
      const isInSeason = matchingTags.length > 0;
      const hasSeasonalTags = item.seasonal_tags && item.seasonal_tags.length > 0;
      
      return {
        id: item.id,
        weight: weight,
        usageCount: usageData.count,
        daysSinceUsed: daysSinceUsed ? Math.floor(daysSinceUsed) : null,
        inCooldown: inCooldown,
        seasonalTags: item.seasonal_tags || [],
        matchingTags: matchingTags,
        isInSeason: isInSeason,
        hasSeasonalTags: hasSeasonalTags,
        lastUsed: usageData.lastUsed
      };
    });
    
    res.json({ weightingInfo, activeTags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/weighting-settings', (req, res) => {
  try {
    const {
      cooldownDays,
      outOfSeasonPenalty,
      seasonalWeight1,
      seasonalWeight2,
      seasonalWeight3,
      recoveryCurve
    } = req.body;
    
    // Update environment variables
    process.env.COOLDOWN_DAYS = cooldownDays.toString();
    process.env.OUT_OF_SEASON_PENALTY = outOfSeasonPenalty.toString();
    process.env.SEASONAL_WEIGHT_1 = seasonalWeight1.toString();
    process.env.SEASONAL_WEIGHT_2 = seasonalWeight2.toString();
    process.env.SEASONAL_WEIGHT_3 = seasonalWeight3.toString();
    process.env.RECOVERY_CURVE = JSON.stringify(recoveryCurve || [[0, 0.2], [90, 0.5], [180, 0.8], [365, 1.0]]);
    
    // Update .env file
    const envPath = './.env';
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    const updateEnvVar = (content, key, value) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + `\n${key}=${value}`;
      }
    };
    
    envContent = updateEnvVar(envContent, 'COOLDOWN_DAYS', cooldownDays);
    envContent = updateEnvVar(envContent, 'OUT_OF_SEASON_PENALTY', outOfSeasonPenalty);
    envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_1', seasonalWeight1);
    envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_2', seasonalWeight2);
    envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_3', seasonalWeight3);
    envContent = updateEnvVar(envContent, 'RECOVERY_CURVE', JSON.stringify(recoveryCurve || [[0, 0.2], [90, 0.5], [180, 0.8], [365, 1.0]]));
    
    fs.writeFileSync(envPath, envContent);
    
    log('Weighting settings updated', 'info');
    res.json({ success: true, message: 'Weighting settings updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/settings', (req, res) => {
  try {
    // Force reload .env file by reading it directly
    const fs = require('fs');
    const path = require('path');
    const envPath = path.resolve('./.env');
    
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      const envVars = {};
      
      envContent.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      });
      
      res.json({
        blueskyHandle: envVars.BLUESKY_HANDLE || '',
        blueskyDid: envVars.BLUESKY_DID || '',
        quoteTag: envVars.QUOTE_TAG || '#QuoteOfTheDay',
        wordTag: envVars.WORD_TAG || '#WordOfTheDay',
        timezone: envVars.TIMEZONE || '',
        randomizeQuotes: envVars.RANDOMIZE_QUOTES !== 'false',
        dryRun: envVars.DRY_RUN === 'true',
        logLevel: envVars.LOG_LEVEL || 'info',
        gcsProjectId: envVars.GCS_PROJECT_ID || '',
        gcsKeyFile: envVars.GCS_KEY_FILE || '',
        gcsBucketName: envVars.GCS_BUCKET_NAME || '',
        backupEnabled: envVars.BACKUP_ENABLED === 'true',
        backupSchedule: envVars.BACKUP_SCHEDULE || '0 2 * * *',
        backupRetentionDays: parseInt(envVars.BACKUP_RETENTION_DAYS) || 30
      });
    } else {
      res.json({
        blueskyHandle: '',
        blueskyDid: '',
        quoteTag: '#QuoteOfTheDay',
        wordTag: '#WordOfTheDay',
        timezone: '',
        randomizeQuotes: true,
        dryRun: false,
        logLevel: 'info',
        gcsProjectId: '',
        gcsKeyFile: '',
        gcsBucketName: '',
        backupEnabled: false,
        backupSchedule: '0 2 * * *',
        backupRetentionDays: 30
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/settings', (req, res) => {
  try {
    log('Settings POST request received', 'debug');
    log('Request body: ' + JSON.stringify(req.body), 'debug');
    
    const { 
      blueskyHandle, blueskyDid, blueskyPassword, quoteTag, wordTag, timezone, randomizeQuotes, dryRun, logLevel,
      gcsProjectId, gcsKeyFile, gcsBucketName, backupEnabled, backupSchedule, backupRetentionDays,
      cooldownDays, outOfSeasonPenalty, seasonalWeight1, seasonalWeight2, seasonalWeight3, recoveryCurve
    } = req.body;
    
    // Update environment variables
    if (blueskyHandle) process.env.BLUESKY_HANDLE = blueskyHandle;
    if (blueskyDid !== undefined) process.env.BLUESKY_DID = blueskyDid;
    if (blueskyPassword) process.env.BLUESKY_PASSWORD = blueskyPassword;
    if (quoteTag) {
      process.env.QUOTE_TAG = quoteTag;
      global.QUOTE_TAG = quoteTag;
    }
    if (wordTag) {
      process.env.WORD_TAG = wordTag;
      global.WORD_TAG = wordTag;
    }
    if (timezone) process.env.TIMEZONE = timezone;
    if (randomizeQuotes !== undefined) process.env.RANDOMIZE_QUOTES = randomizeQuotes.toString();
    if (dryRun !== undefined) process.env.DRY_RUN = dryRun.toString();
    if (logLevel) process.env.LOG_LEVEL = logLevel;
    if (gcsProjectId !== undefined) process.env.GCS_PROJECT_ID = gcsProjectId;
    if (gcsKeyFile !== undefined) process.env.GCS_KEY_FILE = gcsKeyFile;
    if (gcsBucketName !== undefined) process.env.GCS_BUCKET_NAME = gcsBucketName;
    if (backupEnabled !== undefined) process.env.BACKUP_ENABLED = backupEnabled.toString();
    if (backupSchedule) process.env.BACKUP_SCHEDULE = backupSchedule;
    if (backupRetentionDays !== undefined) process.env.BACKUP_RETENTION_DAYS = backupRetentionDays.toString();
    if (cooldownDays !== undefined) process.env.COOLDOWN_DAYS = cooldownDays.toString();
    if (outOfSeasonPenalty !== undefined) process.env.OUT_OF_SEASON_PENALTY = outOfSeasonPenalty.toString();
    if (seasonalWeight1 !== undefined) process.env.SEASONAL_WEIGHT_1 = seasonalWeight1.toString();
    if (seasonalWeight2 !== undefined) process.env.SEASONAL_WEIGHT_2 = seasonalWeight2.toString();
    if (seasonalWeight3 !== undefined) process.env.SEASONAL_WEIGHT_3 = seasonalWeight3.toString();
    if (recoveryCurve !== undefined) process.env.RECOVERY_CURVE = JSON.stringify(recoveryCurve);
    
    // Update .env file
    const envPath = './.env';
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    const updateEnvVar = (content, key, value) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + `\n${key}=${value}`;
      }
    };
    
    if (blueskyHandle) envContent = updateEnvVar(envContent, 'BLUESKY_HANDLE', blueskyHandle);
    if (blueskyDid !== undefined) envContent = updateEnvVar(envContent, 'BLUESKY_DID', blueskyDid);
    if (blueskyPassword) envContent = updateEnvVar(envContent, 'BLUESKY_PASSWORD', blueskyPassword);
    if (quoteTag) envContent = updateEnvVar(envContent, 'QUOTE_TAG', quoteTag);
    if (wordTag) envContent = updateEnvVar(envContent, 'WORD_TAG', wordTag);
    if (timezone) envContent = updateEnvVar(envContent, 'TIMEZONE', timezone);
    if (randomizeQuotes !== undefined) envContent = updateEnvVar(envContent, 'RANDOMIZE_QUOTES', randomizeQuotes.toString());
    if (dryRun !== undefined) envContent = updateEnvVar(envContent, 'DRY_RUN', dryRun.toString());
    if (logLevel) envContent = updateEnvVar(envContent, 'LOG_LEVEL', logLevel);
    if (gcsProjectId !== undefined) envContent = updateEnvVar(envContent, 'GCS_PROJECT_ID', gcsProjectId);
    if (gcsKeyFile !== undefined) envContent = updateEnvVar(envContent, 'GCS_KEY_FILE', gcsKeyFile);
    if (gcsBucketName !== undefined) envContent = updateEnvVar(envContent, 'GCS_BUCKET_NAME', gcsBucketName);
    if (backupEnabled !== undefined) envContent = updateEnvVar(envContent, 'BACKUP_ENABLED', backupEnabled.toString());
    if (backupSchedule) envContent = updateEnvVar(envContent, 'BACKUP_SCHEDULE', backupSchedule);
    if (backupRetentionDays !== undefined) envContent = updateEnvVar(envContent, 'BACKUP_RETENTION_DAYS', backupRetentionDays.toString());
    if (cooldownDays !== undefined) envContent = updateEnvVar(envContent, 'COOLDOWN_DAYS', cooldownDays.toString());
    if (outOfSeasonPenalty !== undefined) envContent = updateEnvVar(envContent, 'OUT_OF_SEASON_PENALTY', outOfSeasonPenalty.toString());
    if (seasonalWeight1 !== undefined) envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_1', seasonalWeight1.toString());
    if (seasonalWeight2 !== undefined) envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_2', seasonalWeight2.toString());
    if (seasonalWeight3 !== undefined) envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_3', seasonalWeight3.toString());
    if (recoveryCurve !== undefined) envContent = updateEnvVar(envContent, 'RECOVERY_CURVE', JSON.stringify(recoveryCurve));
    
    fs.writeFileSync(envPath, envContent);
    
    // Reload environment variables
    reloadEnvironment();
    
    // Update hashtag variables immediately
    if (quoteTag) QUOTE_TAG = quoteTag;
    if (wordTag) WORD_TAG = wordTag;
    
    // Reinitialize cloud storage if credentials changed
    if (gcsProjectId !== undefined || gcsKeyFile !== undefined || gcsBucketName !== undefined) {
      initializeCloudStorage();
      scheduleJobs(); // Reschedule to include backup job
    }
    
    res.json({ success: true, message: 'Settings updated successfully!' });
  } catch (error) {
    log('Settings save error: ' + error.message, 'error');
    log('Error stack: ' + error.stack, 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/schedule/update', (req, res) => {
  try {
    const { quoteHour, wordHour } = req.body;
    
    if (quoteHour !== undefined) {
      if (quoteHour < 0 || quoteHour > 23) {
        return res.status(400).json({ success: false, error: 'Quote hour must be between 0-23' });
      }
      const newQuoteCron = hourToCron(quoteHour);
      global.QUOTE_TIME_CRON = newQuoteCron;
      QUOTE_TIME_CRON = newQuoteCron;
      process.env.QUOTE_TIME_CRON = newQuoteCron;
    }
    
    if (wordHour !== undefined) {
      if (wordHour < 0 || wordHour > 23) {
        return res.status(400).json({ success: false, error: 'Word hour must be between 0-23' });
      }
      const newWordCron = hourToCron(wordHour);
      global.WORD_TIME_CRON = newWordCron;
      WORD_TIME_CRON = newWordCron;
      process.env.WORD_TIME_CRON = newWordCron;
    }
    
    // Update .env file
    const envPath = './.env';
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    const updateEnvVar = (content, key, value) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + `\n${key}=${value}`;
      }
    };
    
    if (quoteHour !== undefined) {
      envContent = updateEnvVar(envContent, 'QUOTE_TIME_CRON', hourToCron(quoteHour));
    }
    if (wordHour !== undefined) {
      envContent = updateEnvVar(envContent, 'WORD_TIME_CRON', hourToCron(wordHour));
    }
    
    fs.writeFileSync(envPath, envContent);
    
    scheduleJobs();
    res.json({ success: true, message: 'Schedule updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import/Export endpoints
app.get('/export-quote', (req, res) => {
  try {
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/export-word', (req, res) => {
  try {
    res.json(words);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/export-used-quotes', (req, res) => {
  try {
    if (fs.existsSync(USED_QUOTES_FILE)) {
      const data = fs.readFileSync(USED_QUOTES_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/export-used-words', (req, res) => {
  try {
    if (fs.existsSync(USED_WORDS_FILE)) {
      const data = fs.readFileSync(USED_WORDS_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/export-all', (req, res) => {
  try {
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.attachment('bot-data-export.zip');
    archive.pipe(res);
    
    // Add quotes.json
    archive.append(JSON.stringify(quotes, null, 2), { name: 'quotes.json' });
    
    // Add words.json
    archive.append(JSON.stringify(words, null, 2), { name: 'words.json' });
    
    // Add used_quotes.json
    let usedQuotesData = [];
    if (fs.existsSync(USED_QUOTES_FILE)) {
      const data = fs.readFileSync(USED_QUOTES_FILE, 'utf-8');
      usedQuotesData = JSON.parse(data);
    }
    archive.append(JSON.stringify(usedQuotesData, null, 2), { name: 'used_quotes.json' });
    
    // Add used_words.json
    let usedWordsData = [];
    if (fs.existsSync(USED_WORDS_FILE)) {
      const data = fs.readFileSync(USED_WORDS_FILE, 'utf-8');
      usedWordsData = JSON.parse(data);
    }
    archive.append(JSON.stringify(usedWordsData, null, 2), { name: 'used_words.json' });
    
    // Add weighting settings (current settings + custom profiles only)
    const weightingData = {
      cooldownDays: COOLDOWN_DAYS,
      outOfSeasonPenalty: OUT_OF_SEASON_PENALTY,
      seasonalWeight1: SEASONAL_WEIGHT_1,
      seasonalWeight2: SEASONAL_WEIGHT_2,
      seasonalWeight3: SEASONAL_WEIGHT_3,
      recoveryCurve: RECOVERY_CURVE,
      customProfiles: {} // Only custom profiles would be exported, built-in presets are not included
    };
    archive.append(JSON.stringify(weightingData, null, 2), { name: 'weighting_settings.json' });
    
    archive.finalize();
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/import-quote', (req, res) => {
  try {
    log('Import quote request received', 'debug');
    log('Request body: ' + JSON.stringify(req.body), 'debug');
    
    let importData;
    if (req.body.data) {
      importData = JSON.parse(req.body.data);
    } else {
      importData = req.body;
    }
    
    if (!Array.isArray(importData)) {
      return res.status(400).json({ success: false, error: 'Data must be an array' });
    }

    let imported = 0;
    let duplicates = 0;

    for (const item of importData) {
      if (!item.text) {
        log('Skipping item without text: ' + JSON.stringify(item), 'debug');
        continue;
      }
      
      // Check for duplicates by text
      const isDuplicate = quotes.some(existing => existing.text === item.text);
      if (isDuplicate) {
        duplicates++;
        log('Duplicate found: ' + item.text, 'debug');
        continue;
      }

      // Add new quote with ID if missing
      const newQuote = {
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
        text: item.text,
        author: item.author || '',
        source: item.source || '',
        image_url: item.image_url || '',
        link_url: item.link_url || '',
        category: item.category || '',
        seasonal_tags: item.seasonal_tags || []
      };
      
      // Validate and truncate if necessary
      const validatedQuote = validateAndTruncateQuote(newQuote);
      if (validatedQuote.text !== newQuote.text || validatedQuote.author !== newQuote.author) {
        log(`Quote truncated during import: "${item.text.substring(0, 30)}..."`, 'warn');
      }
      
      quotes.push(validatedQuote);
      imported++;
      log('Added quote: ' + validatedQuote.text, 'debug');
    }

    fs.writeFileSync(QUOTE_FILE, JSON.stringify(quotes, null, 2));
    
    // Auto-create new categories
    if (imported > 0) {
      try {
        let categories = [];
        if (fs.existsSync(QUOTE_CATEGORIES_FILE)) {
          categories = JSON.parse(fs.readFileSync(QUOTE_CATEGORIES_FILE, 'utf-8'));
        }
        
        const newCategories = [...new Set(importData
          .filter(item => item.category && item.category.trim())
          .map(item => item.category.trim())
          .filter(cat => !categories.includes(cat))
        )];
        
        if (newCategories.length > 0) {
          categories.push(...newCategories);
          fs.writeFileSync(QUOTE_CATEGORIES_FILE, JSON.stringify(categories, null, 2));
          log(`Added new quote categories: ${newCategories.join(', ')}`, 'info');
        }
      } catch (err) {
        log('Failed to update categories: ' + err.message, 'warn');
      }
    }
    
    log(`Import complete: ${imported} imported, ${duplicates} duplicates`, 'info');
    res.json({ success: true, imported, duplicates });
  } catch (error) {
    log('Import error: ' + error.message, 'error');
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/import-word', (req, res) => {
  try {
    const importData = JSON.parse(req.body.data);
    if (!Array.isArray(importData)) {
      return res.status(400).json({ success: false, error: 'Data must be an array' });
    }

    let imported = 0;
    let duplicates = 0;

    for (const item of importData) {
      if (!item.word || !item.definition) continue;
      
      // Check for duplicates by word
      const isDuplicate = words.some(existing => existing.word.toLowerCase() === item.word.toLowerCase());
      if (isDuplicate) {
        duplicates++;
        continue;
      }

      // Add new word with ID if missing
      const newWord = {
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9),
        word: item.word,
        definition: item.definition,
        example: item.example || '',
        image_url: item.image_url || '',
        url: item.url || item.link_url || '',
        category: item.category || '',
        seasonal_tags: item.seasonal_tags || []
      };
      
      // Validate and truncate if necessary
      const validatedWord = validateAndTruncateWord(newWord);
      if (validatedWord.word !== newWord.word || validatedWord.definition !== newWord.definition) {
        log(`Word truncated during import: "${item.word}"`, 'warn');
      }
      
      words.push(validatedWord);
      imported++;
    }

    fs.writeFileSync(WORD_FILE, JSON.stringify(words, null, 2));
    
    // Auto-create new categories
    if (imported > 0) {
      try {
        let categories = [];
        if (fs.existsSync(WORD_CATEGORIES_FILE)) {
          categories = JSON.parse(fs.readFileSync(WORD_CATEGORIES_FILE, 'utf-8'));
        }
        
        const newCategories = [...new Set(importData
          .filter(item => item.category && item.category.trim())
          .map(item => item.category.trim())
          .filter(cat => !categories.includes(cat))
        )];
        
        if (newCategories.length > 0) {
          categories.push(...newCategories);
          fs.writeFileSync(WORD_CATEGORIES_FILE, JSON.stringify(categories, null, 2));
          log(`Added new word categories: ${newCategories.join(', ')}`, 'info');
        }
      } catch (err) {
        log('Failed to update categories: ' + err.message, 'warn');
      }
    }
    
    // Reload the words array to ensure server has updated data
    loadContent();
    res.json({ success: true, imported, duplicates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Edit endpoints for updating existing content
app.post('/edit-quote/:id', upload.none(), (req, res) => {
  try {
    const quoteId = req.params.id;
    const { text, author, source, image_url, image_path, display_type, alt_text, link_url, category, seasonal_tags, image_generation_text, background_type } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).send('Quote text is required');
    }
    
    if (!author || author.trim() === '') {
      return res.status(400).send('Author is required');
    }

    // Load existing quotes
    let existingQuotes = [];
    try {
      if (fs.existsSync(QUOTE_FILE)) {
        const data = fs.readFileSync(QUOTE_FILE, 'utf-8');
        existingQuotes = JSON.parse(data);
      }
    } catch (err) {
      existingQuotes = [];
    }

    // Find the quote to edit
    const quoteIndex = existingQuotes.findIndex(q => q.id === quoteId);
    if (quoteIndex === -1) {
      return res.status(404).send('Quote not found');
    }

    // Parse seasonal_tags if it's a string
    let parsedSeasonalTags = [];
    if (seasonal_tags) {
      if (typeof seasonal_tags === 'string') {
        parsedSeasonalTags = seasonal_tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(seasonal_tags)) {
        parsedSeasonalTags = seasonal_tags;
      }
    }

    // Update the existing quote
    const updatedQuote = {
      ...existingQuotes[quoteIndex], // Keep existing fields like id
      text: text.trim(),
      author: author?.trim() || '',
      source: source?.trim() || '',
      image_url: image_url?.trim() || '',
      // Only update image_path if a new one is provided, otherwise keep existing
      image_path: image_path?.trim() || existingQuotes[quoteIndex].image_path || '',
      display_type: display_type?.trim() || 'link',
      alt_text: alt_text?.trim() || '',
      link_url: link_url?.trim() || '',
      category: category?.trim() || '',
      seasonal_tags: parsedSeasonalTags,
      image_generation_text: image_generation_text?.trim() || '',
      background_type: background_type?.trim() || 'basic'
    };
    
    const validatedQuote = validateAndTruncateQuote(updatedQuote);
    if (validatedQuote.text !== updatedQuote.text || validatedQuote.author !== updatedQuote.author) {
      log(`Quote truncated during edit: original length ${updatedQuote.text.length + (updatedQuote.author ? updatedQuote.author.length + 1 : 0)}`, 'warn');
    }

    existingQuotes[quoteIndex] = validatedQuote;
    fs.writeFileSync(QUOTE_FILE, JSON.stringify(existingQuotes, null, 2));
    quotes = existingQuotes;
    
    log(`Updated quote: "${validatedQuote.text.substring(0, 50)}..."`);
    res.send('<h1>Quote Updated Successfully!</h1><a href="/">Back to Dashboard</a>');
  } catch (error) {
    log('Error updating quote: ' + error.message, 'error');
    res.status(500).send('Error updating quote: ' + error.message);
  }
});

app.post('/edit-word/:id', upload.none(), (req, res) => {
  try {
    const wordId = req.params.id;
    const { word, definition, example, image_url, image_path, display_type, alt_text, link_url, category, seasonal_tags, image_generation_text, background_type } = req.body;
    
    if (!word || word.trim() === '') {
      return res.status(400).send('Word is required');
    }
    
    if (!definition || definition.trim() === '') {
      return res.status(400).send('Definition is required');
    }

    // Load existing words
    let existingWords = [];
    try {
      if (fs.existsSync(WORD_FILE)) {
        const data = fs.readFileSync(WORD_FILE, 'utf-8');
        existingWords = JSON.parse(data);
      }
    } catch (err) {
      existingWords = [];
    }

    // Find the word to edit
    const wordIndex = existingWords.findIndex(w => w.id === wordId);
    if (wordIndex === -1) {
      return res.status(404).send('Word not found');
    }

    // Parse seasonal_tags if it's a string
    let parsedSeasonalTags = [];
    if (seasonal_tags) {
      if (typeof seasonal_tags === 'string') {
        parsedSeasonalTags = seasonal_tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(seasonal_tags)) {
        parsedSeasonalTags = seasonal_tags;
      }
    }

    // Update the existing word
    const updatedWord = {
      ...existingWords[wordIndex], // Keep existing fields like id
      word: word.trim(),
      definition: definition.trim(),
      example: example?.trim() || '',
      image_url: image_url?.trim() || '',
      // Only update image_path if a new one is provided, otherwise keep existing
      image_path: image_path?.trim() || existingWords[wordIndex].image_path || '',
      display_type: display_type?.trim() || 'link',
      alt_text: alt_text?.trim() || '',
      url: link_url?.trim() || '',
      category: category?.trim() || '',
      seasonal_tags: parsedSeasonalTags,
      image_generation_text: image_generation_text?.trim() || '',
      background_type: background_type?.trim() || 'basic'
    };
    
    const validatedWord = validateAndTruncateWord(updatedWord);
    if (validatedWord.word !== updatedWord.word || validatedWord.definition !== updatedWord.definition) {
      log(`Word truncated during edit: original length ${updatedWord.word.length + (updatedWord.definition ? updatedWord.definition.length + 2 : 0)}`, 'warn');
    }

    existingWords[wordIndex] = validatedWord;
    fs.writeFileSync(WORD_FILE, JSON.stringify(existingWords, null, 2));
    words = existingWords;
    
    log(`Updated word: "${validatedWord.word}"`);
    res.send('<h1>Word Updated Successfully!</h1><a href="/">Back to Dashboard</a>');
  } catch (error) {
    log('Error updating word: ' + error.message, 'error');
    res.status(500).send('Error updating word: ' + error.message);
  }
});

// Form submission endpoints
app.post('/add-quote', upload.none(), (req, res) => {
  try {
    const { text, author, source, image_url, image_path, display_type, alt_text, link_url, category, seasonal_tags, image_generation_text, background_type } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).send('Quote text is required');
    }
    
    if (!author || author.trim() === '') {
      return res.status(400).send('Author is required');
    }

    // Load existing quotes
    let existingQuotes = [];
    try {
      if (fs.existsSync(QUOTE_FILE)) {
        const data = fs.readFileSync(QUOTE_FILE, 'utf-8');
        existingQuotes = JSON.parse(data);
      }
    } catch (err) {
      existingQuotes = [];
    }

    // Parse seasonal_tags if it's a string
    let parsedSeasonalTags = [];
    if (seasonal_tags) {
      if (typeof seasonal_tags === 'string') {
        parsedSeasonalTags = seasonal_tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(seasonal_tags)) {
        parsedSeasonalTags = seasonal_tags;
      }
    }

    // Create and validate new quote
    const newQuote = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      text: text.trim(),
      author: author?.trim() || '',
      source: source?.trim() || '',
      image_url: image_url?.trim() || '',
      image_path: image_path?.trim() || '',
      display_type: display_type?.trim() || 'link',
      alt_text: alt_text?.trim() || '',
      link_url: link_url?.trim() || '',
      category: category?.trim() || '',
      seasonal_tags: parsedSeasonalTags,
      image_generation_text: image_generation_text?.trim() || '',
      background_type: background_type?.trim() || 'basic'
    };
    
    const validatedQuote = validateAndTruncateQuote(newQuote);
    if (validatedQuote.text !== newQuote.text || validatedQuote.author !== newQuote.author) {
      log(`Quote truncated during add: original length ${newQuote.text.length + (newQuote.author ? newQuote.author.length + 1 : 0)}`, 'warn');
    }

    existingQuotes.push(validatedQuote);
    fs.writeFileSync(QUOTE_FILE, JSON.stringify(existingQuotes, null, 2));
    quotes = existingQuotes;
    
    log(`Added new quote: "${validatedQuote.text.substring(0, 50)}..."`);
    res.send('<h1>Quote Added Successfully!</h1><a href="/">Add Another</a>');
  } catch (error) {
    log('Error adding quote: ' + error.message, 'error');
    res.status(500).send('Error adding quote: ' + error.message);
  }
});

app.post('/add-word', upload.none(), (req, res) => {
  try {
    const { word, definition, example, image_url, image_path, display_type, alt_text, link_url, category, seasonal_tags, image_generation_text, background_type } = req.body;
    
    if (!word || word.trim() === '') {
      return res.status(400).send('Word is required');
    }
    
    if (!definition || definition.trim() === '') {
      return res.status(400).send('Definition is required');
    }

    // Load existing words
    let existingWords = [];
    try {
      if (fs.existsSync(WORD_FILE)) {
        const data = fs.readFileSync(WORD_FILE, 'utf-8');
        existingWords = JSON.parse(data);
      }
    } catch (err) {
      existingWords = [];
    }

    // Parse seasonal_tags if it's a string
    let parsedSeasonalTags = [];
    if (seasonal_tags) {
      if (typeof seasonal_tags === 'string') {
        parsedSeasonalTags = seasonal_tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      } else if (Array.isArray(seasonal_tags)) {
        parsedSeasonalTags = seasonal_tags;
      }
    }

    // Create and validate new word
    const newWord = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      word: word.trim(),
      definition: definition.trim(),
      example: example?.trim() || '',
      image_url: image_url?.trim() || '',
      image_path: image_path?.trim() || '',
      display_type: display_type?.trim() || 'link',
      alt_text: alt_text?.trim() || '',
      url: link_url?.trim() || '',
      category: category?.trim() || '',
      seasonal_tags: parsedSeasonalTags,
      image_generation_text: image_generation_text?.trim() || '',
      background_type: background_type?.trim() || 'basic'
    };
    
    const validatedWord = validateAndTruncateWord(newWord);
    if (validatedWord.word !== newWord.word || validatedWord.definition !== newWord.definition) {
      log(`Word truncated during add: original length ${newWord.word.length + (newWord.definition ? newWord.definition.length + 2 : 0)}`, 'warn');
    }

    existingWords.push(validatedWord);
    fs.writeFileSync(WORD_FILE, JSON.stringify(existingWords, null, 2));
    words = existingWords;
    
    log(`Added new word: "${validatedWord.word}"`);
    res.send('<h1>Word Added Successfully!</h1><a href="/">Add Another</a>');
  } catch (error) {
    log('Error adding word: ' + error.message, 'error');
    res.status(500).send('Error adding word: ' + error.message);
  }
});

app.post('/import-used-quotes', (req, res) => {
  try {
    const usedData = req.body;
    if (!Array.isArray(usedData)) {
      return res.status(400).json({ success: false, error: 'Data must be an array' });
    }
    
    fs.writeFileSync(USED_QUOTES_FILE, JSON.stringify(usedData, null, 2));
    res.json({ success: true, imported: usedData.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/import-used-words', (req, res) => {
  try {
    const usedData = req.body;
    if (!Array.isArray(usedData)) {
      return res.status(400).json({ success: false, error: 'Data must be an array' });
    }
    
    fs.writeFileSync(USED_WORDS_FILE, JSON.stringify(usedData, null, 2));
    res.json({ success: true, imported: usedData.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/import-all', upload.single('zipFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }
  
  const zipPath = req.file.path;
  
  yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
    if (err) {
      fs.unlinkSync(zipPath);
      return res.status(400).json({ success: false, error: 'Invalid ZIP file' });
    }
    
    const extractedFiles = {};
    let pendingEntries = 0;
    
    zipfile.readEntry();
    
    zipfile.on('entry', (entry) => {
      if (/\/$/.test(entry.fileName)) {
        zipfile.readEntry();
        return;
      }
      
      pendingEntries++;
      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) {
          pendingEntries--;
          if (pendingEntries === 0) processExtractedFiles();
          return;
        }
        
        let data = '';
        readStream.on('data', (chunk) => data += chunk);
        readStream.on('end', () => {
          extractedFiles[entry.fileName] = data;
          pendingEntries--;
          if (pendingEntries === 0) processExtractedFiles();
          zipfile.readEntry();
        });
      });
    });
    
    zipfile.on('end', () => {
      if (pendingEntries === 0) processExtractedFiles();
    });
    
    function processExtractedFiles() {
      try {
        let imported = { quotes: 0, words: 0, usedQuotes: 0, usedWords: 0, settings: false };
        
        // Import quotes
        if (extractedFiles['quotes.json']) {
          const quotesData = JSON.parse(extractedFiles['quotes.json']);
          fs.writeFileSync(QUOTE_FILE, JSON.stringify(quotesData, null, 2));
          quotes = quotesData;
          imported.quotes = quotesData.length;
        }
        
        // Import words
        if (extractedFiles['words.json']) {
          const wordsData = JSON.parse(extractedFiles['words.json']);
          fs.writeFileSync(WORD_FILE, JSON.stringify(wordsData, null, 2));
          words = wordsData;
          imported.words = wordsData.length;
        }
        
        // Import used quotes
        if (extractedFiles['used_quotes.json']) {
          const usedQuotesData = JSON.parse(extractedFiles['used_quotes.json']);
          fs.writeFileSync(USED_QUOTES_FILE, JSON.stringify(usedQuotesData, null, 2));
          imported.usedQuotes = usedQuotesData.length;
        }
        
        // Import used words
        if (extractedFiles['used_words.json']) {
          const usedWordsData = JSON.parse(extractedFiles['used_words.json']);
          fs.writeFileSync(USED_WORDS_FILE, JSON.stringify(usedWordsData, null, 2));
          imported.usedWords = usedWordsData.length;
        }
        
        // Import weighting settings
        if (extractedFiles['weighting_settings.json']) {
          const weightingData = JSON.parse(extractedFiles['weighting_settings.json']);
          
          // Update environment variables
          if (weightingData.cooldownDays) process.env.COOLDOWN_DAYS = weightingData.cooldownDays.toString();
          if (weightingData.outOfSeasonPenalty) process.env.OUT_OF_SEASON_PENALTY = weightingData.outOfSeasonPenalty.toString();
          if (weightingData.seasonalWeight1) process.env.SEASONAL_WEIGHT_1 = weightingData.seasonalWeight1.toString();
          if (weightingData.seasonalWeight2) process.env.SEASONAL_WEIGHT_2 = weightingData.seasonalWeight2.toString();
          if (weightingData.seasonalWeight3) process.env.SEASONAL_WEIGHT_3 = weightingData.seasonalWeight3.toString();
          if (weightingData.recoveryCurve) process.env.RECOVERY_CURVE = JSON.stringify(weightingData.recoveryCurve);
          
          // Update .env file
          const envPath = './.env';
          let envContent = '';
          if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf-8');
          }
          
          const updateEnvVar = (content, key, value) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(content)) {
              return content.replace(regex, `${key}=${value}`);
            } else {
              return content + `\n${key}=${value}`;
            }
          };
          
          if (weightingData.cooldownDays) envContent = updateEnvVar(envContent, 'COOLDOWN_DAYS', weightingData.cooldownDays);
          if (weightingData.outOfSeasonPenalty) envContent = updateEnvVar(envContent, 'OUT_OF_SEASON_PENALTY', weightingData.outOfSeasonPenalty);
          if (weightingData.seasonalWeight1) envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_1', weightingData.seasonalWeight1);
          if (weightingData.seasonalWeight2) envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_2', weightingData.seasonalWeight2);
          if (weightingData.seasonalWeight3) envContent = updateEnvVar(envContent, 'SEASONAL_WEIGHT_3', weightingData.seasonalWeight3);
          if (weightingData.recoveryCurve) envContent = updateEnvVar(envContent, 'RECOVERY_CURVE', JSON.stringify(weightingData.recoveryCurve));
          
          fs.writeFileSync(envPath, envContent);
          imported.settings = true;
        }
        
        fs.unlinkSync(zipPath);
        
        const summary = [];
        if (imported.quotes > 0) summary.push(`${imported.quotes} quotes`);
        if (imported.words > 0) summary.push(`${imported.words} words`);
        if (imported.usedQuotes > 0) summary.push(`${imported.usedQuotes} used quotes`);
        if (imported.usedWords > 0) summary.push(`${imported.usedWords} used words`);
        if (imported.settings) summary.push('weighting settings');
        
        res.json({ 
          success: true, 
          message: `Successfully imported: ${summary.join(', ')}` 
        });
        
      } catch (error) {
        fs.unlinkSync(zipPath);
        res.status(500).json({ success: false, error: 'Error processing ZIP contents: ' + error.message });
      }
    }
  });
});

// Cloud backup endpoints
app.post('/backup/create', async (req, res) => {
  try {
    await createBackup();
    res.json({ success: true, message: 'Backup created successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/backup/list', async (req, res) => {
  try {
    const backups = await listBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/backup/restore/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const restored = await restoreFromBackup(filename);
    
    const summary = [];
    if (restored.quotes > 0) summary.push(`${restored.quotes} quotes`);
    if (restored.words > 0) summary.push(`${restored.words} words`);
    if (restored.usedQuotes > 0) summary.push(`${restored.usedQuotes} used quotes`);
    if (restored.usedWords > 0) summary.push(`${restored.usedWords} used words`);
    
    res.json({ 
      success: true, 
      message: `Successfully restored: ${summary.join(', ')}`,
      restored
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/backup/:filename', async (req, res) => {
  try {
    if (!gcsStorage) {
      return res.status(400).json({ success: false, error: 'Cloud storage not configured' });
    }
    
    const filename = req.params.filename;
    const bucket = gcsStorage.bucket(GCS_BUCKET_NAME);
    const file = bucket.file(filename);
    
    await file.delete();
    res.json({ success: true, message: `Backup ${filename} deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start the express server
app.listen(PORT, () => {
  log(`Manual trigger server running on port ${PORT}`, 'info');
});

function scheduleJobs() {
  if (quoteJob) quoteJob.stop();
  if (wordJob) wordJob.stop();
  if (backupJob) backupJob.stop();
  
  const quoteCron = global.QUOTE_TIME_CRON || QUOTE_TIME_CRON;
  const wordCron = global.WORD_TIME_CRON || WORD_TIME_CRON;
  
  quoteJob = cron.schedule(quoteCron, async () => {
    log('Running scheduled quote job: ' + new Date().toLocaleString(), 'debug');
    await postQuote();
  }, { timezone: TIMEZONE });

  wordJob = cron.schedule(wordCron, async () => {
    log('Running scheduled word job: ' + new Date().toLocaleString(), 'debug');
    await postWord();
  }, { timezone: TIMEZONE });
  
  // Schedule backup job if enabled
  if (BACKUP_ENABLED && gcsStorage) {
    backupJob = cron.schedule(BACKUP_SCHEDULE, async () => {
      log('Running scheduled backup job: ' + new Date().toLocaleString(), 'debug');
      await createBackup();
    }, { timezone: TIMEZONE });
    log(`Backup scheduled: "${BACKUP_SCHEDULE}" ${TIMEZONE ? `TZ: ${TIMEZONE}` : ''}`, 'info');
  }
}

function getNextScheduledTime(cronExpression) {
  try {
    const hour = cronToHour(cronExpression);
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, 0, 0, 0);
    
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  } catch (error) {
    return null;
  }
}

function hourToCron(hour) {
  return `0 ${hour} * * *`;
}

function cronToHour(cronExpression) {
  const parts = cronExpression.split(' ');
  return parts.length >= 2 ? parseInt(parts[1]) : 9;
}

// Initialize the bot
(async () => {
  loadContent();
  const loggedIn = await login();
  if (loggedIn) {
    initializeCloudStorage();
    scheduleJobs();
  }
  log(`Bot is running.`, 'info');
  log(`Quote schedule: "${QUOTE_TIME_CRON}" ${TIMEZONE ? `TZ: ${TIMEZONE}` : ''}`, 'info');
  log(`Word schedule: "${WORD_TIME_CRON}" ${TIMEZONE ? `TZ: ${TIMEZONE}` : ''}`, 'info');
})();