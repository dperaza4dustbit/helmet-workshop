#!/usr/bin/env bash
# Publish coordinator links: OpenShift Route URL + optional TinyURL + QR code.
#
# Usage:
#   ./hack/publish-coordinator-url.sh [https://coordinator-host/]
#
# Environment (auto-loaded from hack/workshop.env when present):
#   WORKSHOP_PUBLISH_SHORT_URL=1        Try TinyURL (default: 1). Set 0 to skip.
#   WORKSHOP_SHORTURL_SLUG=helmet-devconf   Base slug (requires TINYURL_API_TOKEN)
#   WORKSHOP_SHORTURL_INDEXED=1         Append 1,2,3… (default: 1 with token+slug)
#   WORKSHOP_SHORTURL_INDEX=2           Optional: force slot index
#   TINYURL_API_TOKEN=                  tinyurl.com → Profile → API → Create token
#
# Indexed alias pick: GET /urls, then GET /alias/tinyurl.com/<alias> for each slot to
# match the long URL. Reuse smallest matching index; else create next free integer slot.
#
# Output: out/coordinator-links.txt
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

WORKSHOP_PUBLISH_SHORT_URL="${WORKSHOP_PUBLISH_SHORT_URL:-1}"
if [[ -n "${TINYURL_API_TOKEN:-}" && -n "${WORKSHOP_SHORTURL_SLUG:-}" ]]; then
  WORKSHOP_SHORTURL_INDEXED="${WORKSHOP_SHORTURL_INDEXED:-1}"
else
  WORKSHOP_SHORTURL_INDEXED="${WORKSHOP_SHORTURL_INDEXED:-0}"
fi

resolve_coordinator_url() {
  if [[ -n "${1:-}" ]]; then
    printf '%s' "$1"
    return 0
  fi
  if [[ -n "${COORDINATOR_URL:-}" ]]; then
    printf '%s' "$COORDINATOR_URL"
    return 0
  fi
  local host
  host="$(oc get route workshop-coordinator -n "$COORDINATOR_NAMESPACE" \
    -o jsonpath='{.spec.host}' 2>/dev/null || true)"
  if [[ -z "$host" ]]; then
    die "coordinator URL unknown — pass https://.../ or deploy the Route first"
  fi
  printf 'https://%s/' "$host"
}

normalize_url() {
  local url="${1%/}"
  printf '%s/' "$url"
}

shorten_with_tinyurl() {
  local target="$1"
  local result
  result="$(curl -fsSG "https://tinyurl.com/api-create.php" --data-urlencode "url=${target}" 2>/dev/null)" || return 1
  if [[ "$result" =~ ^https://(www\.)?tinyurl\.com/ ]]; then
    printf '%s' "$result"
    return 0
  fi
  log "tinyurl response: ${result}" >&2
  return 1
}

list_tinyurl_urls_json() {
  local token="${TINYURL_API_TOKEN:?TINYURL_API_TOKEN required}"
  curl -fsS "https://api.tinyurl.com/urls" \
    -H "Authorization: Bearer ${token}" 2>/dev/null
}

pick_indexed_tinyurl_alias() {
  local base="$1"
  local target="$2"
  local forced_index="${WORKSHOP_SHORTURL_INDEX:-}"
  local token="${TINYURL_API_TOKEN:?TINYURL_API_TOKEN required}"
  export TINYURL_BASE="$base"
  export TINYURL_TARGET="$target"
  export TINYURL_FORCED_INDEX="$forced_index"
  export TINYURL_API_TOKEN="$token"
  python3 - <<'PY'
import json, os, re, sys, urllib.error, urllib.request

def norm(url: str) -> str:
    return url.rstrip("/") + "/"

def api_get(path: str) -> dict:
    req = urllib.request.Request(
        f"https://api.tinyurl.com/{path}",
        headers={
            "Authorization": f"Bearer {os.environ['TINYURL_API_TOKEN']}",
            "User-Agent": "helmet-workshop/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)

base = os.environ["TINYURL_BASE"]
target = norm(os.environ["TINYURL_TARGET"])
forced = os.environ.get("TINYURL_FORCED_INDEX", "").strip()
pattern = re.compile(rf"^{re.escape(base)}([1-9][0-9]*)$")

if forced:
    if not re.fullmatch(r"[1-9][0-9]*", forced):
        sys.exit(f"WORKSHOP_SHORTURL_INDEX must be a positive integer, got: {forced}")
    print(f"{base}{forced}")
    raise SystemExit(0)

urls_payload = api_get("urls")
indexed = sorted(
    int(match.group(1))
    for alias in (item.get("alias", "") for item in (urls_payload.get("data") or []))
    if (match := pattern.fullmatch(alias))
)

for index in indexed:
    alias = f"{base}{index}"
    try:
        detail = api_get(f"alias/tinyurl.com/{alias}")
    except urllib.error.HTTPError:
        continue
    long_url = (detail.get("data") or {}).get("url") or ""
    if norm(long_url) == target:
        print(alias)
        raise SystemExit(0)

slot = 1
used = set(indexed)
while slot in used:
    slot += 1
print(f"{base}{slot}")
PY
}

resolve_tinyurl_alias() {
  local target="$1"
  local base="${WORKSHOP_SHORTURL_SLUG:-}"
  if [[ -z "$base" ]]; then
    return 1
  fi
  if [[ "$WORKSHOP_SHORTURL_INDEXED" == "1" ]]; then
    pick_indexed_tinyurl_alias "$base" "$target"
    return $?
  fi
  printf '%s' "$base"
}

shorten_with_tinyurl_api() {
  local target="$1"
  local token="${TINYURL_API_TOKEN:?TINYURL_API_TOKEN required}"
  local alias
  alias="$(resolve_tinyurl_alias "$target")" || {
    log "tinyurl: could not resolve alias for slug base ${WORKSHOP_SHORTURL_SLUG:-}" >&2
    return 1
  }
  local payload response url api_errors http_code tmp
  tmp="$(mktemp)"
  payload="$(python3 -c 'import json,sys; print(json.dumps({"url":sys.argv[1],"domain":"tinyurl.com","alias":sys.argv[2]}))' \
    "$target" "$alias")"
  http_code="$(curl -sS -o "$tmp" -w '%{http_code}' -X POST "https://api.tinyurl.com/create" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null)" || {
    rm -f "$tmp"
    return 1
  }
  response="$(cat "$tmp")"
  rm -f "$tmp"
  url="$(printf '%s' "$response" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(1)
if d.get("code") not in (None, 0):
    print(json.dumps(d.get("errors", d.get("message", d))), file=sys.stderr)
    sys.exit(1)
tiny = (d.get("data") or {}).get("tiny_url") or ""
if tiny:
    print(tiny)
' 2>/dev/null)" || {
    api_errors="$(printf '%s' "$response" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(1)
errs = d.get("errors") or []
if errs:
    print("; ".join(str(e) for e in errs))
elif d.get("message"):
    print(d["message"])
' 2>/dev/null || true)"
    if [[ -n "$alias" && "$api_errors" == *"Alias is not available"* ]]; then
      log "Note: reusing TinyURL alias ${alias}" >&2
      printf 'https://tinyurl.com/%s' "$alias"
      return 0
    fi
    log "tinyurl API error (${http_code}): ${api_errors:-${response}}" >&2
    return 1
  }
  if [[ "$url" =~ ^https://(www\.)?tinyurl\.com/ ]]; then
    printf '%s' "$url"
    return 0
  fi
  return 1
}

shorten_url() {
  local target="$1"
  if [[ -n "${TINYURL_API_TOKEN:-}" ]]; then
    if shorten_with_tinyurl_api "$target"; then
      return 0
    fi
    log "Warning: TinyURL API failed (check token, alias, permissions) — trying anonymous link" >&2
  elif [[ -n "${WORKSHOP_SHORTURL_SLUG:-}" ]]; then
    log "Warning: WORKSHOP_SHORTURL_SLUG ignored without TINYURL_API_TOKEN" >&2
  fi
  shorten_with_tinyurl "$target"
}

qr_link_for() {
  local url="$1"
  python3 -c 'import urllib.parse,sys; print("https://api.qrserver.com/v1/create-qr-code/?size=400x400&data="+urllib.parse.quote(sys.argv[1], safe=""))' "$url"
}

main() {
  require_cmd curl
  require_cmd python3
  local canonical short_url="" qr_url alias_used=""
  canonical="$(normalize_url "$(resolve_coordinator_url "${1:-}")")"

  if [[ "$WORKSHOP_PUBLISH_SHORT_URL" == "1" ]]; then
    if [[ -n "${TINYURL_API_TOKEN:-}" && -n "${WORKSHOP_SHORTURL_SLUG:-}" && "$WORKSHOP_SHORTURL_INDEXED" == "1" ]]; then
      alias_used="$(resolve_tinyurl_alias "$canonical" 2>/dev/null || true)"
    fi
    short_url="$(shorten_url "$canonical")" || {
      log "Warning: TinyURL failed — use OpenShift URL on slides"
      short_url=""
    }
  fi

  local share_url="${short_url:-$canonical}"
  qr_url="$(qr_link_for "$share_url")"

  ensure_output_dir
  cat >"${OUTPUT_DIR}/coordinator-links.txt" <<EOF
# Coordinator links — $(date -u +"%Y-%m-%dT%H:%M:%SZ")
openshift_url=${canonical}
short_url=${short_url:-}
short_url_alias=${alias_used:-}
share_with_participants=${share_url}
qr_code=${qr_url}
room_code=see coordinator row in credentials.csv
EOF

  log ""
  log "=== Coordinator links ==="
  log "OpenShift (long):  ${canonical}"
  if [[ -n "$short_url" ]]; then
    log "TinyURL (short):   ${short_url}  → redirects to OpenShift URL"
    log "Use on slides/QR:  ${short_url}"
    if [[ -n "$alias_used" ]]; then
      log "TinyURL alias:     ${alias_used} (set WORKSHOP_SHORTURL_INDEX to pin a slot)"
    fi
  else
    log "TinyURL:           (not created — use OpenShift URL above)"
    log "Use on slides/QR:  ${canonical}"
  fi
  log "QR code image:     ${qr_url}"
  log "Saved:             ${OUTPUT_DIR}/coordinator-links.txt"
  log "Room code:         coordinator row in ${CREDENTIALS_FILE}"
  log ""
}

main "$@"
