#!/bin/bash

# Test script for Perplexity API
# Usage: ./test-perplexity-api.sh YOUR_API_KEY

if [ -z "$1" ]; then
    echo "Usage: $0 YOUR_API_KEY"
    echo "Example: $0 pplx-abc123..."
    exit 1
fi

API_KEY="$1"

echo "Testing Perplexity API with the same payload structure..."
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
        "content": "In GRC platforms, what does Governance mean? Please explain important workflows, tools, processes, and any policies or regulations that might be relevant. If you mention tools or services or regulatory bodies or membership organizations, please link to them in the text.\n\n**Image References:**\nPlease include the following image references throughout your response where appropriate:\n- [IMAGE 1: Relevant diagram or illustration related to the topic]\n- [IMAGE 2: Practical example or use case visualization]\n- [IMAGE 3: Additional supporting visual content]"
      }
    ],
    "stream": true,
    "return_citations": true,
    "return_images": true,
    "return_related_questions": false
  }' \
  --verbose \
  --max-time 30

echo ""
echo "Test completed."
