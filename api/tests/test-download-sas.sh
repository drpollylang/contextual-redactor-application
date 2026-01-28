# -----------------------------
# Useage
# -----------------------------

# Run with default values
# ./test-download-sas.sh

# Or override from CLI:
# ./test-download-sas.sh <container> <blobPath> <outputFile> <ttlMinutes>
# ./test-download-sas.sh files "user123/fileB/final/mydoc.pdf" ./mydoc-downloaded.pdf 10


#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Config (override via env or CLI args)
# -----------------------------
API_BASE="${API_BASE:-http://localhost:7071/api}"
CONTAINER="${CONTAINER:-files}"
BLOB_PATH="${BLOB_PATH:-user123/fileA/original/local-test.pdf}"
TTL_MINUTES="${TTL_MINUTES:-5}"
OUTPUT_FILE="${OUTPUT_FILE:-./api/tests/downloaded-local-test.pdf}"

# CLI overrides:
# ./test-download-sas.sh <container> <blobPath> <outputFile> <ttlMinutes>
if [[ $# -ge 1 ]]; then CONTAINER="$1"; fi
if [[ $# -ge 2 ]]; then BLOB_PATH="$2"; fi
if [[ $# -ge 3 ]]; then OUTPUT_FILE="$3"; fi
if [[ $# -ge 4 ]]; then TTL_MINUTES="$4"; fi

# -----------------------------
# Request a download SAS from the Function
# -----------------------------
echo "Requesting download SAS for:"
echo "  container  = $CONTAINER"
echo "  blob path  = $BLOB_PATH"
echo "  ttl (min)  = $TTL_MINUTES"

DOWNLOAD_JSON="$(curl -sS -X POST "$API_BASE/getDownloadSas" \
  -H "Content-Type: application/json" \
  -d "{\"containerName\":\"$CONTAINER\",\"blobPath\":\"$BLOB_PATH\",\"ttlMinutes\":$TTL_MINUTES}")"

# Extract downloadUrl (works with or without jq)
if command -v jq >/dev/null 2>&1; then
  DOWNLOAD_URL="$(printf '%s' "$DOWNLOAD_JSON" | jq -r '.downloadUrl')"
else
  DOWNLOAD_URL="$(printf '%s' "$DOWNLOAD_JSON" | sed -n 's/.*"downloadUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
fi

if [[ -z "$DOWNLOAD_URL" || "$DOWNLOAD_URL" == "null" ]]; then
  echo "ERROR: Could not parse downloadUrl from response:"
  echo "$DOWNLOAD_JSON"
  exit 1
fi

# Fix HTML-escaped ampersands (Blob service expects real & separators)
CLEAN_DOWNLOAD_URL="${DOWNLOAD_URL//&amp;/&}"

echo "downloadUrl:"
echo "  $CLEAN_DOWNLOAD_URL"

# -----------------------------
# Download the blob with SAS
# -----------------------------
# For GET with SAS, headers are typically not required; curl -L -f is sufficient. [1](https://medirelay.com/blog/148-offline-first-apps-indexeddb-service-workers/)
echo "Downloading → $OUTPUT_FILE"
curl -sS -L -f "$CLEAN_DOWNLOAD_URL" -o "$OUTPUT_FILE" || {
  echo "ERROR: Download failed"
  echo "Try verbose:"
  echo "curl -v -L \"$CLEAN_DOWNLOAD_URL\" -o \"$OUTPUT_FILE\""
  exit 1
}

BYTES="$(wc -c < "$OUTPUT_FILE" | tr -d '[:space:]')"
echo "✅ Download succeeded → $OUTPUT_FILE (${BYTES} bytes)"
``