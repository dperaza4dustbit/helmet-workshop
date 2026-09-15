#!/usr/bin/env bash
# Tear down DevConf workshop namespaces and optional HTPasswd users.
#
# Usage: ./hack/cleanup-workshop.sh [--dry-run] [--keep-htpasswd] [--wait]
#
# Use the same env as setup (source hack/workshop.env) so PARTICIPANT_COUNT matches.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "${SCRIPT_DIR}/lib/common.sh"

DRY_RUN=0
KEEP_HTPASSWD=0
WAIT_FOR_DELETE=0
DELETED=0
SKIPPED=0
FAILED=0

usage() {
  cat <<'EOF'
Usage: cleanup-workshop.sh [options]

Options:
  --dry-run         Print actions only
  --keep-htpasswd   (no-op today; htpasswd users are never auto-removed)
  --wait            Wait for each namespace to finish deleting
  -h, --help        Show help

Tip: source hack/workshop.env before cleanup so PARTICIPANT_COUNT matches setup.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --dry-run) DRY_RUN=1 ;;
  --keep-htpasswd) KEEP_HTPASSWD=1 ;;
  --wait) WAIT_FOR_DELETE=1 ;;
  -h | --help) usage; exit 0 ;;
  *) die "unknown argument: $1" ;;
  esac
  shift
done

require_cmd oc
require_cluster_access

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    log "[dry-run] $*"
  else
    log "# $*"
    "$@"
  fi
}

delete_namespace() {
  local ns="$1"
  local err wait_flag=()

  if [[ "$WAIT_FOR_DELETE" -eq 1 ]]; then
    wait_flag=(--wait=true)
  else
    wait_flag=(--wait=false)
  fi

  if oc get namespace "$ns" >/dev/null 2>&1; then
    # OpenShift project == namespace; delete project is idiomatic on OCP.
    run oc delete project "$ns" "${wait_flag[@]}"
    DELETED=$((DELETED + 1))
    return 0
  fi

  err="$(oc get namespace "$ns" 2>&1 || true)"
  if [[ "$err" == *NotFound* ]] || [[ "$err" == *'not found'* ]]; then
    log "skip $ns (not found)"
    SKIPPED=$((SKIPPED + 1))
    return 0
  fi

  log "Warning: cannot check namespace $ns: $err"
  FAILED=$((FAILED + 1))
}

report_remaining_workshop_namespaces() {
  local remaining
  remaining="$(oc get projects -o jsonpath='{range .items[*].metadata.name}{.}{"\n"}{end}' 2>/dev/null \
    | grep -E "^${WORKSHOP_PREFIX}-(p|i)[0-9]+" || true)"
  if [[ -n "$remaining" ]]; then
    log "Still present (may be Terminating — refresh console or re-run with --wait):"
    printf '%s\n' "$remaining" | sed 's/^/  /'
  else
    log "No workshop participant/instructor namespaces remain."
  fi

  if oc get namespace "$COORDINATOR_NAMESPACE" >/dev/null 2>&1; then
    log "Coordinator namespace still present: $COORDINATOR_NAMESPACE"
  fi
}

main() {
  local ns

  log "Cleanup: ${PARTICIPANT_COUNT} participants + ${INSTRUCTOR_COUNT} instructors (prefix: ${WORKSHOP_PREFIX})"

  while IFS= read -r ns; do
    delete_namespace "$ns"
  done < <(all_workshop_namespaces)

  delete_namespace "$COORDINATOR_NAMESPACE"

  log "Summary: deleted=${DELETED} skipped=${SKIPPED} failed=${FAILED}"
  if [[ "$DRY_RUN" -eq 0 ]]; then
    report_remaining_workshop_namespaces
  fi

  if [[ "$KEEP_HTPASSWD" -eq 0 ]]; then
    log "Note: HTPasswd users are not removed automatically (shared secret)."
    log "Edit $HTPASSWD_NS/$HTPASSWD_SECRET manually or regenerate htpasswd file."
  fi
}

main "$@"
