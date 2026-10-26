#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==================================================="
echo "            PocketGravity Server Daemon"
echo "   Secure Mobile Workspace Remote Manager"
echo "==================================================="

VENV_PATH="$SCRIPT_DIR/.venv"
if [ ! -d "$VENV_PATH" ]; then
    echo "[INFO] Creating virtual environment..."
    python3 -m venv "$VENV_PATH"
    "$VENV_PATH/bin/pip" install --cache-dir "$SCRIPT_DIR/.pip_cache" -r requirements.txt
fi

source "$VENV_PATH/bin/activate" 2>/dev/null || source "$VENV_PATH/Scripts/activate" 2>/dev/null || true

echo "[INFO] Binding FastAPI to 0.0.0.0:8000..."
python -m uvicorn server.main:app --host 0.0.0.0 --port 8000
