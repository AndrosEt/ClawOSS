#!/usr/bin/env bash
set -euo pipefail
echo "=== Stopping ClawOSS ==="
openclaw stop 2>/dev/null || echo "Gateway was not running"
echo "ClawOSS stopped."
