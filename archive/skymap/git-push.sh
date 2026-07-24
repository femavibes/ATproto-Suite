#!/bin/bash

# Git commit and push script
# Usage: ./git-push.sh "commit message"

if [ -z "$1" ]; then
    echo "Usage: ./git-push.sh \"commit message\""
    exit 1
fi

COMMIT_MSG="$1"

# Add all changes
git add .

# Commit with message
git commit -m "$COMMIT_MSG"

# Push to remote
git push

echo "Done! Changes committed and pushed."
