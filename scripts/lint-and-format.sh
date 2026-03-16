#!/usr/bin/env bash
# lint-and-format.sh — Auto-detect and run linters/formatters
# Usage: lint-and-format.sh <workspace_path> [--fix] [--check-only]
# Exit 0 = clean, Exit 1 = issues found (or fixed if --fix)

WORKDIR="${1:?Usage: lint-and-format.sh <workspace_path> [--fix]}"
FIX=""
CHECK_ONLY=""

shift
while [ $# -gt 0 ]; do
  case "$1" in
    --fix) FIX="true"; shift ;;
    --check-only) CHECK_ONLY="true"; shift ;;
    *) shift ;;
  esac
done

cd "$WORKDIR" || { echo '{"pass": false, "reason": "cannot cd to workspace"}'; exit 1; }

TOOLS_RUN=()
ISSUES=0

# ─── Node.js ───
if [ -f "package.json" ]; then
  # ESLint
  if [ -f ".eslintrc" ] || [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.yml" ] || grep -q "eslint" package.json 2>/dev/null; then
    if [ "$FIX" = "true" ]; then
      npx eslint --fix . 2>/dev/null; ISSUES=$((ISSUES + $?))
    else
      npx eslint . 2>/dev/null; ISSUES=$((ISSUES + $?))
    fi
    TOOLS_RUN+=("eslint")
  fi

  # Prettier
  if [ -f ".prettierrc" ] || [ -f ".prettierrc.js" ] || [ -f ".prettierrc.json" ] || grep -q "prettier" package.json 2>/dev/null; then
    if [ "$FIX" = "true" ]; then
      npx prettier --write . 2>/dev/null; ISSUES=$((ISSUES + $?))
    else
      npx prettier --check . 2>/dev/null; ISSUES=$((ISSUES + $?))
    fi
    TOOLS_RUN+=("prettier")
  fi
fi

# ─── Python ───
if [ -f "setup.py" ] || [ -f "pyproject.toml" ] || [ -f "setup.cfg" ]; then
  # Black
  if [ -f "pyproject.toml" ] && grep -q "black" pyproject.toml 2>/dev/null || command -v black >/dev/null 2>&1; then
    if [ "$FIX" = "true" ]; then
      python3 -m black . 2>/dev/null; ISSUES=$((ISSUES + $?))
    else
      python3 -m black --check . 2>/dev/null; ISSUES=$((ISSUES + $?))
    fi
    TOOLS_RUN+=("black")
  fi

  # Ruff
  if command -v ruff >/dev/null 2>&1 || [ -f "pyproject.toml" ] && grep -q "ruff" pyproject.toml 2>/dev/null; then
    if [ "$FIX" = "true" ]; then
      python3 -m ruff check --fix . 2>/dev/null; ISSUES=$((ISSUES + $?))
    else
      python3 -m ruff check . 2>/dev/null; ISSUES=$((ISSUES + $?))
    fi
    TOOLS_RUN+=("ruff")
  fi

  # isort
  if [ -f "pyproject.toml" ] && grep -q "isort" pyproject.toml 2>/dev/null; then
    if [ "$FIX" = "true" ]; then
      python3 -m isort . 2>/dev/null; ISSUES=$((ISSUES + $?))
    else
      python3 -m isort --check . 2>/dev/null; ISSUES=$((ISSUES + $?))
    fi
    TOOLS_RUN+=("isort")
  fi
fi

# ─── Rust ───
if [ -f "Cargo.toml" ]; then
  if [ "$FIX" = "true" ]; then
    cargo fmt 2>/dev/null
    cargo clippy --fix --allow-dirty 2>/dev/null; ISSUES=$((ISSUES + $?))
  else
    cargo fmt --check 2>/dev/null; ISSUES=$((ISSUES + $?))
    cargo clippy 2>/dev/null; ISSUES=$((ISSUES + $?))
  fi
  TOOLS_RUN+=("rustfmt" "clippy")
fi

# ─── Go ───
if [ -f "go.mod" ]; then
  gofmt -l . 2>/dev/null
  FMT_FILES=$(gofmt -l . 2>/dev/null | wc -l | tr -d ' ')
  if [ "$FIX" = "true" ] && [ "$FMT_FILES" -gt 0 ]; then
    gofmt -w . 2>/dev/null
  fi
  [ "$FMT_FILES" -gt 0 ] && ISSUES=$((ISSUES + 1))
  TOOLS_RUN+=("gofmt")

  if command -v golangci-lint >/dev/null 2>&1; then
    if [ "$FIX" = "true" ]; then
      golangci-lint run --fix 2>/dev/null; ISSUES=$((ISSUES + $?))
    else
      golangci-lint run 2>/dev/null; ISSUES=$((ISSUES + $?))
    fi
    TOOLS_RUN+=("golangci-lint")
  fi
fi

# ─── Makefile lint target ───
if [ -f "Makefile" ] && grep -q "^lint:" Makefile 2>/dev/null && [ ${#TOOLS_RUN[@]} -eq 0 ]; then
  make lint 2>/dev/null; ISSUES=$((ISSUES + $?))
  TOOLS_RUN+=("make-lint")
fi

# ─── Output ───
TOOLS_JSON=$(printf '%s\n' "${TOOLS_RUN[@]}" | python3 -c 'import json,sys; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))' 2>/dev/null || echo '[]')

cat <<ENDJSON
{
  "pass": $([ $ISSUES -eq 0 ] && echo true || echo false),
  "issues_found": $ISSUES,
  "tools_run": $TOOLS_JSON,
  "fix_mode": $([ "$FIX" = "true" ] && echo true || echo false),
  "workspace": "$WORKDIR"
}
ENDJSON

[ $ISSUES -eq 0 ] && exit 0 || exit 1
