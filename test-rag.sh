#!/bin/bash

# Test script for RAG API
# Usage: ./test-rag.sh

BASE_URL="http://localhost:3000"

echo "=== RAG API Test Script ==="
echo ""

# 1. Create a RAG node
echo "1. Creating RAG node..."
NODE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/rag/nodes" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Node","description":"Test RAG system"}')

NODE_ID=$(echo $NODE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$NODE_ID" ]; then
  echo "❌ Failed to create node"
  echo "Response: $NODE_RESPONSE"
  exit 1
fi

echo "✅ Node created: $NODE_ID"
echo ""

# 2. List nodes
echo "2. Listing all nodes..."
curl -s -X GET "$BASE_URL/api/rag/nodes" | jq '.'
echo ""

# 3. Upload a document (you need to provide a file path)
echo "3. Upload document..."
echo "⚠️  Please upload a document manually using:"
echo "curl -X POST \"$BASE_URL/api/rag/nodes/$NODE_ID/upload\" \\"
echo "  -F \"file=@/path/to/your/document.pdf\""
echo ""

# 4. Query (after uploading)
echo "4. Query example (run after uploading a document):"
echo "curl -X POST \"$BASE_URL/api/rag/query\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"nodeId\":\"$NODE_ID\",\"query\":\"What is this document about?\"}'"
echo ""

# 5. Answer (after uploading)
echo "5. Answer example (run after uploading a document):"
echo "curl -X POST \"$BASE_URL/api/rag/answer\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"nodeId\":\"$NODE_ID\",\"query\":\"Summarize the main points\",\"model\":\"gpt-4o-mini\"}'"
echo ""

echo "=== Test Complete ==="
echo "Node ID for testing: $NODE_ID"
