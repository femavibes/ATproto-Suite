#!/bin/bash

echo "Starting bounding box enrichment in background..."
cd /root/skymap/services/data-parser

DATABASE_URL="postgresql://dev:devpass@localhost:5435/skymap" \
  nohup node enrich-bounding-boxes.js > /root/skymap/bbox-enrichment.log 2>&1 &

PID=$!
echo "Process started with PID: $PID"
echo "Monitor progress with: tail -f /root/skymap/bbox-enrichment.log"
echo "Check if still running: ps aux | grep $PID"
