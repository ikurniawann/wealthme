#!/bin/bash
# Generates TypeScript types from the running API's OpenAPI spec.
# Usage: bash scripts/generate-api-types.sh
set -euo pipefail
API_URL="${API_URL:-http://localhost:4000}"
OUTPUT="src/lib/api/api-types.generated.ts"
mkdir -p src/lib/api
npx openapi-typescript "${API_URL}/api/docs-json" --output "$OUTPUT"
echo "Generated: $OUTPUT"
