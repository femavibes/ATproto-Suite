#!/bin/bash

# Run the user ban threshold migration
echo "Running user ban threshold migration..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set"
    echo "Please set it to your PostgreSQL connection string"
    echo "Example: export DATABASE_URL='postgresql://user:password@localhost:5432/dbname'"
    exit 1
fi

# Run the migration
psql "$DATABASE_URL" -f migrate_user_ban_thresholds.sql

if [ $? -eq 0 ]; then
    echo "Migration completed successfully!"
    echo ""
    echo "Summary of changes:"
    echo "- Added hierarchical user ban threshold columns to feeds table"
    echo "- Migrated existing legacy data (spam -> misleading-spam, etc.)"
    echo "- Added global user ban settings table"
    echo "- Updated user_reports table with hierarchical report types"
    echo "- Added proper indexes for performance"
    echo ""
    echo "Next steps:"
    echo "1. Update your backend API to handle the new hierarchical structure"
    echo "2. Test the new user ban thresholds in the frontend"
    echo "3. Consider removing legacy columns in a future migration"
else
    echo "Migration failed! Please check the error messages above."
    exit 1
fi