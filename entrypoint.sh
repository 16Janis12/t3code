#!/usr/bin/env bash
set -e

PACKAGE_NAME="${PACKAGE_NAME:-@16janis12/t3}"
REGISTRY="${REGISTRY:-https://npm.pkg.github.com}"
AUTO_UPDATE="${AUTO_UPDATE:-true}"
AUTO_UPDATE_ON_START="${AUTO_UPDATE_ON_START:-true}"
AUTO_UPDATE_INTERVAL="${AUTO_UPDATE_INTERVAL:-3600}" # seconds; 0 disables background polling

log() {
  echo "[auto-update $(date +'%Y-%m-%d %H:%M:%S')] $*"
}

is_true() {
  case "${1:-}" in
    1|[tT][rR][uU][eE]|[yY][eE][sS]) return 0 ;;
    *) return 1 ;;
  esac
}

setup_npm_auth() {
  local token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
  if [ -n "$token" ]; then
    npm config set @16janis12:registry "$REGISTRY" >/dev/null 2>&1 || true
    npm config set "//npm.pkg.github.com/:_authToken" "$token" >/dev/null 2>&1 || true
    export GH_TOKEN="$token"
    export GITHUB_TOKEN="$token"
  else
    log "WARN: Neither GH_TOKEN nor GITHUB_TOKEN is set. Access to $REGISTRY may fail without authentication."
  fi
}

get_installed_version() {
  local global_root
  global_root="$(npm root -g 2>/dev/null || echo '/usr/local/lib/node_modules')"
  node -e "try { console.log(require('${global_root}/${PACKAGE_NAME}/package.json').version); } catch(e) { process.exit(1); }" 2>/dev/null || true
}

get_latest_version() {
  npm view "$PACKAGE_NAME" version --registry="$REGISTRY" 2>/dev/null || true
}

install_version() {
  local target_ver="${1:-latest}"
  log "Installing ${PACKAGE_NAME}@${target_ver} from ${REGISTRY}..."
  if npm install -g "${PACKAGE_NAME}@${target_ver}" --registry="$REGISTRY"; then
    local installed
    installed="$(get_installed_version)"
    log "Successfully installed ${PACKAGE_NAME} (version: ${installed})."
    rm -rf /root/.npm
    return 0
  else
    log "ERROR: Failed to install ${PACKAGE_NAME}@${target_ver}." >&2
    return 1
  fi
}

check_and_update() {
  local current latest
  current="$(get_installed_version)"
  latest="$(get_latest_version)"

  if [ -z "$latest" ]; then
    log "Could not query latest version from ${REGISTRY}. Skipping update check."
    return 1
  fi

  if [ -n "$current" ] && [ "$latest" = "$current" ]; then
    log "Current version (${current}) is up to date."
    return 1
  fi

  log "Update available: ${latest} (currently installed: ${current:-none})."
  if install_version "$latest"; then
    return 0
  else
    return 1
  fi
}

is_t3_command() {
  case "${1:-}" in
    t3|*"/t3"|t3code|*"/t3code") return 0 ;;
    *) return 1 ;;
  esac
}

# 1. Manual update invocation: e.g. "entrypoint.sh update" or "t3-update"
if [ "${1:-}" = "update" ] || [ "$(basename "$0")" = "t3-update" ]; then
  setup_npm_auth
  if check_and_update; then
    log "Update completed successfully."
    exit 0
  else
    log "No update applied."
    exit 0
  fi
fi

# 2. If running an arbitrary non-t3 command (e.g. "docker compose run ... bash")
if ! is_t3_command "${1:-}"; then
  setup_npm_auth
  exec "$@"
fi

# 3. Main server execution flow
setup_npm_auth

if is_true "$AUTO_UPDATE" && is_true "$AUTO_UPDATE_ON_START"; then
  log "Checking for updates on startup..."
  check_and_update || true
fi

SERVER_PID=""
BG_CHECKER_PID=""
RESTART_REQUESTED=0
SHUTTING_DOWN=0

stop_server() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    log "Stopping server process (PID: $SERVER_PID)..."
    kill -TERM "$SERVER_PID" 2>/dev/null || true
    local count=0
    while kill -0 "$SERVER_PID" 2>/dev/null && [ "$count" -lt 15 ]; do
      sleep 1
      count=$((count + 1))
    done
    if kill -0 "$SERVER_PID" 2>/dev/null; then
      log "Server did not terminate gracefully within 15s; force killing..."
      kill -KILL "$SERVER_PID" 2>/dev/null || true
    fi
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
}

handle_term() {
  SHUTTING_DOWN=1
  log "Received termination signal; shutting down gracefully..."
  if [ -n "$BG_CHECKER_PID" ] && kill -0 "$BG_CHECKER_PID" 2>/dev/null; then
    kill "$BG_CHECKER_PID" 2>/dev/null || true
  fi
  stop_server
  exit 0
}

handle_restart() {
  log "Restart requested by background auto-updater."
  RESTART_REQUESTED=1
  stop_server
}

trap handle_term SIGTERM SIGINT SIGHUP
trap handle_restart SIGUSR1

start_background_checker() {
  local parent_pid=$$
  (
    while true; do
      sleep "$AUTO_UPDATE_INTERVAL"
      if ! kill -0 "$parent_pid" 2>/dev/null; then
        exit 0
      fi
      log "Background updater: Checking for new version..."
      if check_and_update; then
        log "Background updater: Update installed. Triggering server restart..."
        kill -USR1 "$parent_pid" 2>/dev/null || true
      fi
    done
  ) &
  BG_CHECKER_PID=$!
}

if is_true "$AUTO_UPDATE" && [ "$AUTO_UPDATE_INTERVAL" -gt 0 ] 2>/dev/null; then
  log "Background auto-updater enabled (interval: ${AUTO_UPDATE_INTERVAL}s)."
  start_background_checker
fi

while [ "$SHUTTING_DOWN" -eq 0 ]; do
  RESTART_REQUESTED=0
  log "Starting server: $*"
  "$@" &
  SERVER_PID=$!

  set +e
  wait "$SERVER_PID"
  exit_status=$?
  set -e

  if [ "$SHUTTING_DOWN" -eq 1 ]; then
    exit 0
  fi

  if [ "$RESTART_REQUESTED" -eq 1 ]; then
    log "Server stopped for restart. Restarting with new version..."
    sleep 1
    continue
  fi

  log "Server process exited with status $exit_status."
  if [ -n "$BG_CHECKER_PID" ] && kill -0 "$BG_CHECKER_PID" 2>/dev/null; then
    kill "$BG_CHECKER_PID" 2>/dev/null || true
  fi
  exit "$exit_status"
done
