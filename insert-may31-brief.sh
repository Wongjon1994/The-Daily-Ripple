#!/bin/bash

# Insert May 31 brief via the /api/scheduled/publish-n8n-brief endpoint
curl -X POST http://localhost:3000/api/scheduled/publish-n8n-brief \
  -H "Content-Type: application/json" \
  -d @may31_brief_data.json

echo ""
echo "✓ May 31 brief insertion request sent"
