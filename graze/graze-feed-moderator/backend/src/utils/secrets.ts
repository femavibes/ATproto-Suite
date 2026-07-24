import fs from 'fs';

export function getSecret(name: string, fallback?: string): string {
  // Try Docker secret file first
  const secretFile = process.env[`${name}_FILE`];
  if (secretFile && fs.existsSync(secretFile)) {
    return fs.readFileSync(secretFile, 'utf8').trim();
  }
  
  // Fall back to environment variable
  return process.env[name] || fallback || '';
}

export const ENCRYPTION_KEY = getSecret('ENCRYPTION_KEY', 'feed-moderator-key-32-chars-long!');
export const LEGACY_ENCRYPTION_KEY = getSecret('LEGACY_ENCRYPTION_KEY', 'feed-moderator-key-32-chars-long!');
export const JWT_SECRET = getSecret('JWT_SECRET');