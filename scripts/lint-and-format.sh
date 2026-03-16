#!/usr/bin/env bash
# lint-and-format.sh — Auto-detect and run linters/formatters
# Usage: lint-and-format.sh <workspace_path> [--fix] [--check-only]
# Default: --fix (auto-fix what's possible, report the rest)
# Outputs JSON with: tools_run, fixes_applied, unfixable_issues

if [ "${1:-}" = "--help" ]; then
  echo "Usage: lint-and-format.sh <workspace_path> [--fix] [--check-only]"
  echo "Auto-detects and runs linters/formatters from the repo."
  exit 0
fi

WORKDIR="${1:?Usage: lint-and-format.sh <workspace_path> [--fix] [--check-only]}"
MODE="fix"

shift 1
while [ $# -gt 0 ]; do
  case "$1" in
    --fix) MODE="fix"; shift ;;
    --check-only) MODE="check"; shift ;;
    *) shift ;;
  esac
done

cd "$WORKDIR" || { echo '{"pass": false, "error": "workspace not found"}'; exit 1; }

TOOLS_RUN=()
FIXES=()
ERRORS=()
OVERALL_PASS=true

run_tool() {
  local name="$1"
  local check_cmd="$2"
  local fix_cmd="$3"

  if [ "$MODE" = "check" ]; then
    OUTPUT=$(eval "$check_cmd" 2>&1 | tail -30)
    EXIT=$?
  else
    OUTPUT=$(eval "$fix_cmd" 2>&1 | tail -30)
    EXIT=$?
  fi

  TOOLS_RUN+=("$name")
  if [ $EXIT -ne 0 ]; then
    ERRORS+=("$name")
    OVERALL_PASS=false
  else
    FIXES+=("$name")
  fi
}

# ─── Python ───
if [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "setup.cfg" ]; then
  # Ruff (fast Python linter + formatter)
  if command -v ruff &>/dev/null || [ -f "pyproject.toml" ] && grep -q "ruff" "pyproject.toml" 2>/dev/null; then
    if python3 -m ruff --version &>/dev/null; then
      run_tool "ruff-check" "python3 -m ruff check ." "python3 -m ruff check --fix ."
      run_tool "ruff-format" "python3 -m ruff format --check ." "python3 -m ruff format ."
    fi
  fi

  # Black
  if [ -z "$(echo "${TOOLS_RUN[@]}" | grep ruff-format)" ]; then
    if python3 -m black --version &>/dev/null 2>&1; then
      run_tool "black" "python3 -m black --check ." "python3 -m black ."
    fi
  fi

  # isort
  if python3 -m isort --version &>/dev/null 2>&1; then
    run_tool "isort" "python3 -m isort --check-only ." "python3 -m isort ."
  fi

  # mypy (check only — doesn't auto-fix)
  if python3 -m mypy --version &>/dev/null 2>&1; then
    if [ -f "mypy.ini" ] || grep -q "mypy" "pyproject.toml" 2>/dev/null; then
      OUTPUT=$(python3 -m mypy . --ignore-missing-imports 2>&1 | tail -20)
      EXIT=$?
      TOOLS_RUN+=("mypy")
      [ $EXIT -ne 0 ] && ERRORS+=("mypy")
    fi
  fi
fi

# ─── JavaScript/TypeScript ───
if [ -f "package.json" ]; then
  # ESLint
  if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.yml" ] || grep -q "eslint" "package.json" 2>/dev/null; then
    if npx eslint --version &>/dev/null 2>&1; then
      run_tool "eslint" "npx eslint ." "npx eslint --fix ."
    fi
  fi

  # Prettier
  if [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ] || [ -f "prettier.config.js" ] || grep -q "prettier" "package.json" 2>/dev/null; then
    if npx prettier --version &>/dev/null 2>&1; then
      run_tool "prettier" "npx prettier --check ." "npx prettier --write ."
    fi
  fi

  # TypeScript compiler check
  if [ -f "tsconfig.json" ]; then
    if npx tsc --version &>/dev/null 2>&1; then
      OUTPUT=$(npx tsc --noEmit 2>&1 | tail -20)
      EXIT=$?
      TOOLS_RUN+=("tsc")
      [ $EXIT -ne 0 ] && ERRORS+=("tsc")
    fi
  fi
fi

# ─── Go ───
if [ -f "go.mod" ]; then
  if command -v gofmt &>/dev/null; then
    run_tool "gofmt" "gofmt -l ." "gofmt -w ."
  fi
  if command -v goimports &>/dev/null; then
    run_tool "goimports" "goimports -l ." "goimports -w ."
  fi
  if command -v golangci-lint &>/dev/null; then
    OUTPUT=$(golangci-lint run 2>&1 | tail -30)
    EXIT=$?
    TOOLS_RUN+=("golangci-lint")
    [ $EXIT -ne 0 ] && ERRORS+=("golangci-lint")
  fi
fi

# ─── Rust ───
if [ -f "Cargo.toml" ]; then
  if command -v cargo &>/dev/null; then
    run_tool "rustfmt" "cargo fmt --check" "cargo fmt"
    OUTPUT=$(cargo clippy 2>&1 | tail -30)
    EXIT=$?
    TOOLS_RUN+=("clippy")
    [ $EXIT -ne 0 ] && ERRORS+=("clippy")
  fi
fi

# Output JSON
python3 -c "
import json
result = {
    'pass': $( [ \"$OVERALL_PASS\" = true ] && echo 'True' || echo 'False' ),
    'mode': '$MODE',
    'tools_run': $(printf '%s\n' "${TOOLS_RUN[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))' 2>/dev/null || echo '[]'),
    'fixes_applied': $(printf '%s\n' "${FIXES[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))' 2>/dev/null || echo '[]'),
    'errors': $(printf '%s\n' "${ERRORS[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))' 2>/dev/null || echo '[]'),
}
print(json.dumps(result, indent=2))
" 2>/dev/null || echo '{"pass": false, "error": "output generation failed"}'

[ "$OVERALL_PASS" = true ] && exit 0 || exit 1
