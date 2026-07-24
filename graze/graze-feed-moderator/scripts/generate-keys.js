#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

console.log('🔐 Feed Moderator Security Key Generator\n');

// Generate encryption key
const encryptionKey = crypto.randomBytes(32).toString('hex');
console.log('Generated ENCRYPTION_KEY:');
console.log(encryptionKey);
console.log('');

// Generate JWT secret
const jwtSecret = crypto.randomBytes(64).toString('hex');
console.log('Generated JWT_SECRET:');
console.log(jwtSecret);
console.log('');

// Check if .env exists
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env file already exists. Please manually add these keys:');
  console.log('');
  console.log('ENCRYPTION_KEY=' + encryptionKey);
  console.log('JWT_SECRET=' + jwtSecret);
} else if (fs.existsSync(envExamplePath)) {
  // Read .env.example and add the keys
  let envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  // Add encryption key if not present
  if (!envContent.includes('ENCRYPTION_KEY=')) {
    envContent += '\n# Security Keys\nENCRYPTION_KEY=' + encryptionKey + '\n';
  }
  
  // Add JWT secret if not present
  if (!envContent.includes('JWT_SECRET=')) {
    envContent = envContent.replace('JWT_SECRET=your-jwt-secret-here', 'JWT_SECRET=' + jwtSecret);
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with secure keys');
} else {
  // Create new .env file
  const envContent = `# Security Keys (NEVER commit these to version control)
ENCRYPTION_KEY=${encryptionKey}
JWT_SECRET=${jwtSecret}

# Database
DATABASE_URL=postgresql://feedmod:feedmod_password@postgres:5432/feedmoderator

# Ozone Configuration
OZONE_URL=https://your-ozone.example.com
LABELER_DID=did:plc:your-labeler-did
LABELER_PASSWORD=your-labeler-app-password
LABELER_SOCKET_URL=wss://your-labeler.example.com/xrpc/com.atproto.label.subscribeLabels

# Service Configuration
ADMIN_EMAIL=admin@example.com
`;
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file with secure keys');
}

console.log('');
console.log('🔒 IMPORTANT SECURITY NOTES:');
console.log('1. Never commit the .env file to version control');
console.log('2. Store these keys securely in production');
console.log('3. Rotate keys periodically');
console.log('4. Use environment-specific keys for different deployments');
console.log('');
console.log('✅ Key generation complete!');