# -----------------------------
# Useage
# -----------------------------
#  Basic usage (defaults)
# ./api/tests/test-upload-sas.sh

# # Custom container/blob/path/file/ttl
# ./api/tests/test-upload-sas.sh files user123/fileB/working/mydoc.pdf ./docs/mydoc.pdf 15

#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# Config (override via env or args)
# -----------------------------
API_BASE="${API_BASE:-http://localhost:7071/api}"
CONTAINER="${CONTAINER:-files}"
BLOB_PATH="${BLOB_PATH:-user123/fileA/original/local-test.pdf}"
TTL_MINUTES="${TTL_MINUTES:-10}"
FILE_TO_UPLOAD="${FILE_TO_UPLOAD:-./api/tests/local-test.pdf}"

# CLI overrides:
# ./test-upload-sas.sh <container> <blobPath> <file> <ttlMinutes>
if [[ $# -ge 1 ]]; then CONTAINER="$1"; fi
if [[ $# -ge 2 ]]; then BLOB_PATH="$2"; fi
if [[ $# -ge 3 ]]; then FILE_TO_UPLOAD="$3"; fi
if [[ $# -ge 4 ]]; then TTL_MINUTES="$4"; fi

# -----------------------------
# Validate inputs
# -----------------------------
if [[ ! -f "$FILE_TO_UPLOAD" ]]; then
  echo "ERROR: File to upload not found: $FILE_TO_UPLOAD" >&2
  exit 1
fi

# -----------------------------
# Request an upload SAS from the Function
# -----------------------------
echo "Requesting upload SAS for:"
echo "  container  = $CONTAINER"
echo "  blob path  = $BLOB_PATH"
echo "  ttl (min)  = $TTL_MINUTES"

UPLOAD_JSON="$(curl -sS -X POST "$API_BASE/getUploadSas" \
  -H "Content-Type: application/json" \
  -d "{\"containerName\":\"$CONTAINER\",\"blobPath\":\"$BLOB_PATH\",\"ttlMinutes\":$TTL_MINUTES}")"

# Extract uploadUrl (works with or without jq)
if command -v jq >/dev/null 2>&1; then
  UPLOAD_URL="$(printf '%s' "$UPLOAD_JSON" | jq -r '.uploadUrl')"
else
  # Fallback parser
  UPLOAD_URL="$(printf '%s' "$UPLOAD_JSON" | sed -n 's/.*"uploadUrl"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
fi

if [[ -z "$UPLOAD_URL" || "$UPLOAD_URL" == "null" ]]; then
  echo "ERROR: Could not parse uploadUrl from response:"
  echo "$UPLOAD_JSON"
  exit 1
fi

# Fix HTML-escaped ampersands (must be real & in SAS query)
CLEAN_UPLOAD_URL="${UPLOAD_URL//&amp;/&}"

echo "uploadUrl:"
echo "  $CLEAN_UPLOAD_URL"

# -----------------------------
# Sanity-check URL path shape: /container/blob
# -----------------------------
PATH_PART="$(printf '%s' "$CLEAN_UPLOAD_URL" | sed 's#https\?://[^/]*##' | sed 's/\?.*$//')"
CONTAINER_PART="$(printf '%s' "$PATH_PART" | awk -F/ '{print $2}')"
BLOBNAME_PART="$(printf '%s' "$PATH_PART" | cut -d/ -f3-)"
if [[ -z "$CONTAINER_PART" || -z "$BLOBNAME_PART" ]]; then
  echo "ERROR: uploadUrl path does not include container/blob: $PATH_PART"
  exit 1
fi

# -----------------------------
# Upload via REST Put Blob with required header
# -----------------------------
# x-ms-blob-type: BlockBlob is mandatory for Put Blob of a block blob. [1](https://stackoverflow.com/questions/79310699/how-to-make-cosmosdb-work-with-an-azure-web-app)
# Optional but recommended: x-ms-date and x-ms-version headers. [1](https://stackoverflow.com/questions/79310699/how-to-make-cosmosdb-work-with-an-azure-web-app)
DATE_GMT="$(date -u '+%a, %d %b %Y %H:%M:%S GMT')"
HTTP_STATUS="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X PUT \
  -H "x-ms-blob-type: BlockBlob" \
  -H "x-ms-date: ${DATE_GMT}" \
  -H "x-ms-version: 2021-12-02" \
  --upload-file "$FILE_TO_UPLOAD" \
  "$CLEAN_UPLOAD_URL")"

# For Put Blob, 201 Created is typical; 202 Accepted can also occur depending on pipeline.
if [[ "$HTTP_STATUS" != "201" && "$HTTP_STATUS" != "202" ]]; then
  echo "ERROR: Upload failed. HTTP $HTTP_STATUS"
  echo "Try verbose:"
  echo "curl -v -X PUT -H 'x-ms-blob-type: BlockBlob' -H \"x-ms-date: ${DATE_GMT}\" -H 'x-ms-version: 2021-12-02' --upload-file \"$FILE_TO_UPLOAD\" \"$CLEAN_UPLOAD_URL\""
  exit 1
fi

echo "✅ Upload succeeded (HTTP $HTTP_STATUS)"