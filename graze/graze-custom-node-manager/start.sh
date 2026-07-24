#!/bin/bash
cd /root/custom-nodes
echo "🎯 Starting Graze Custom Node Manager..."
echo ""
echo "Available nodes:"
python3 -c "from node_loader import get_all_nodes; [print(f'  ✓ {n[\"name\"]} (v{n[\"version\"]})') for n in get_all_nodes()]"
echo ""
echo "Starting web server on http://localhost:5000"
echo "Press Ctrl+C to stop"
echo ""
python3 web/app.py
