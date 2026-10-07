#!/usr/bin/env bash
# ==============================================================================
# InterviewTutor IntelliJ Companion Bridge - Fast Launcher (Linux / macOS)
# ==============================================================================
set -e

command -v node >/dev/null 2>&1 || {
  echo >&2 "❌ Ошибка: Node.js не найден."
  echo >&2 "Установите Node.js 20+ с официального сайта: https://nodejs.org"
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/bridge.mjs"
