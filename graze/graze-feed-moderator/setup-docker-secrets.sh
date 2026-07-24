#!/bin/bash

# Create secrets directory
mkdir -p secrets

# Generate encryption key
echo "Generating encryption key..."
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > secrets/encryption_key.txt

# Generate JWT secret  
echo "Generating JWT secret..."
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" > secrets/jwt_secret.txt

# Set permissions
chmod 600 secrets/*.txt

echo "✅ Docker secrets created in ./secrets/"
echo "⚠️  Add secrets/ to .gitignore"
echo "🔒 Use docker-secrets-example.yml for deployment"