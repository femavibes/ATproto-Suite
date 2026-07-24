#!/bin/bash
# Start the visual builder mockup server on port 7000

cd "$(dirname "$0")"
echo "Starting visual builder server on http://localhost:7000"
echo "Press Ctrl+C to stop"
python3 -m http.server 7000 --bind 0.0.0.0
