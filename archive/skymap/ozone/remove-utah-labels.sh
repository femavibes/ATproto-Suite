#!/bin/bash

echo "=== Removing Utah Labels ==="
echo ""

# Count Utah labels
UTAH_COUNT=$(docker exec postgres psql -U postgres -d ozone -t -c "SELECT COUNT(*) FROM label WHERE val LIKE 'us-ut-%' AND neg = false;")
echo "Found $UTAH_COUNT Utah labels to remove"

if [ "$UTAH_COUNT" -eq 0 ]; then
    echo "No Utah labels to remove"
    exit 0
fi

read -p "Proceed with removal? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled"
    exit 0
fi

# Negate all Utah labels
docker exec postgres psql -U postgres -d ozone -c "UPDATE label SET neg = true WHERE val LIKE 'us-ut-%' AND neg = false;"

echo ""
echo "✓ Utah labels removed"
echo ""
echo "Verification:"
docker exec postgres psql -U postgres -d ozone -c "SELECT COUNT(*) as active_utah_labels FROM label WHERE val LIKE 'us-ut-%' AND neg = false;"
