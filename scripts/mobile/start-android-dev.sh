#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
METRO_LOG="$LOG_DIR/metro-android.log"

mkdir -p "$LOG_DIR"

if ! lsof -iTCP:8081 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Starting Metro on :8081 (log: $METRO_LOG)"
  nohup npm run start --workspace @passport-quest/mobile -- --dev-client --clear --port 8081 >"$METRO_LOG" 2>&1 &
  sleep 2
else
  echo "Metro already running on :8081"
fi

if command -v adb >/dev/null 2>&1; then
  adb reverse tcp:8081 tcp:8081 >/dev/null 2>&1 || true
  echo "ADB reverse set: tcp:8081 -> tcp:8081"
else
  echo "adb not found; install Android platform-tools for device port forwarding"
fi

npm run android --workspace @passport-quest/mobile -- --no-bundler
