#!/usr/bin/env bash
# Submit a CodeClash solution and immediately watch its production judge SSE feed.

set -euo pipefail

# Replace this placeholder with a fresh CodeClash access token. Do not commit it.
ACCESS_TOKEN="NEW ACCESS TOKEN"

API_BASE_URL="https://algoriumx.api.pramit.tech/api"
LOG_DIR="${LOG_DIR:-./sse-test-logs}"

if [[ "$ACCESS_TOKEN" == "REPLACE_WITH_YOUR_ACCESS_TOKEN" || -z "$ACCESS_TOKEN" ]]; then
  echo "Set ACCESS_TOKEN near the top of this script before running it." >&2
  exit 1
fi

for command in curl jq tee; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command '$command' is not installed or is not on PATH." >&2
    if [[ "$command" == "jq" ]]; then
      echo "Install jq (for example, 'brew install jq' on macOS) and run the script again." >&2
    fi
    exit 1
  fi
done

submission_payload=$(cat <<'JSON'
{
  "problemId": "problemId",
  "language": "javascript",
  "sourceCode": "const fs = require('fs');\n\nconst input = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\nconst [a, b] = input;\nconsole.log(a + b);"
}
JSON
)

echo "Creating submission..."
create_response=$(curl --fail-with-body --silent --show-error \
  --request POST "$API_BASE_URL/submissions" \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --data "$submission_payload")

submission_id=$(jq --raw-output --exit-status '.submission.id // .id // empty' <<<"$create_response") || {
  echo "Could not find submission.id (or id) in the API response:" >&2
  jq . <<<"$create_response" >&2 || printf '%s\n' "$create_response" >&2
  exit 1
}

if [[ -z "$submission_id" ]]; then
  echo "The submission API returned an empty submission id." >&2
  exit 1
fi

mkdir -p "$LOG_DIR"
timestamp=$(date '+%Y%m%d-%H%M%S')
log_file="$LOG_DIR/judge-stream-${submission_id}-${timestamp}.log"
stream_url="$API_BASE_URL/submissions/$submission_id/judgeStream"

echo "Submission ID: $submission_id"
echo "Streaming SSE now; output is also being saved to: $log_file"
echo

# --no-buffer makes curl print each SSE event as soon as it arrives.
curl --fail-with-body --no-buffer --silent --show-error \
  --header "Authorization: Bearer $ACCESS_TOKEN" \
  --header "Accept: text/event-stream" \
  "$stream_url" | tee "$log_file"

echo
echo "SSE stream finished. Saved log: $log_file"
