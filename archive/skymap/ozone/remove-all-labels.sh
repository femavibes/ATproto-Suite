#!/bin/bash

echo "=== Removing ALL Labels (Slowly) ==="
echo ""

# Count total active labels
TOTAL=$(docker exec postgres psql -U postgres -d ozone -t -c "SELECT COUNT(*) FROM label WHERE neg = false;" | xargs)
echo "Found $TOTAL active labels to remove"

if [ "$TOTAL" -eq 0 ]; then
    echo "No labels to remove"
    exit 0
fi

read -p "Proceed with removal? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "Negating labels in batches of 50 with 2 second delays..."
echo ""

BATCH_SIZE=50
PROCESSED=0

while [ $PROCESSED -lt $TOTAL ]; do
    # Negate next batch
    docker exec postgres psql -U postgres -d ozone -c "
        UPDATE label 
        SET neg = true 
        WHERE id IN (
            SELECT id FROM label 
            WHERE neg = false 
            LIMIT $BATCH_SIZE
        );" > /dev/null 2>&1
    
    PROCESSED=$((PROCESSED + BATCH_SIZE))
    REMAINING=$(docker exec postgres psql -U postgres -d ozone -t -c "SELECT COUNT(*) FROM label WHERE neg = false;" | xargs)
    
    echo "Progress: Negated $PROCESSED labels, $REMAINING remaining..."
    
    if [ $REMAINING -gt 0 ]; then
        sleep 2
    fi
done

echo ""
echo "✓ All labels removed"
echo ""
echo "Final verification:"
docker exec postgres psql -U postgres -d ozone -c "SELECT 
    COUNT(*) FILTER (WHERE neg = false) as active_labels,
    COUNT(*) FILTER (WHERE neg = true) as negated_labels,
    COUNT(*) as total_labels
FROM label;"
