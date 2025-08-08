#!/bin/bash

# Test script for Perplexity API (Non-streaming)
# Usage: ./test-perplexity-non-streaming.sh YOUR_API_KEY

if [ -z "$1" ]; then
    echo "Usage: $0 YOUR_API_KEY"
    echo "Example: $0 pplx-abc123..."
    exit 1
fi

API_KEY="$1"

echo "Testing Perplexity API (NON-STREAMING) with the same payload structure..."
echo "API Key: ${API_KEY:0:10}..."
echo ""

curl -X POST "https://api.perplexity.ai/chat/completions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "model": "sonar-pro",
    "messages": [
      {
        "role": "user",
        "content": "What is GRC in simple terms?"
      }
    ],
    "stream": false,
    "return_citations": true,
    "return_images": false,
    "return_related_questions": false
  }' \
  --verbose \
  --max-time 30

echo ""
echo "Non-streaming test completed."
