#!/usr/bin/env bash
# run-repo-tests.sh — Auto-detect test framework and run tests
# Usage: run-repo-tests.sh <workspace_path> [--targeted <module>] [--full]
# Default: targeted if module specified, otherwise full
# Outputs JSON with test results, exit code, and evidence

if [ "${1:-}" = "--help" ]; then
  echo "Usage: run-repo-tests.sh <workspace_path> [--targeted <module>] [--full]"
  echo "Auto-detects test framework and runs tests."
  exit 0
fi

WORKDIR="${1:?Usage: run-repo-tests.sh <workspace_path> [--targeted <module>] [--full]}"
TARGET_MODULE=""
RUN_FULL=false

shift 1
while [ $# -gt 0 ]; do
  case "$1" in
    --targeted) TARGET_MODULE="$2"; shift 2 ;;
    --full) RUN_FULL=true; shift ;;
    *) shift ;;
  esac
done

cd "$WORKDIR" || { echo '{"pass": false, "error": "workspace not found"}'; exit 1; }

# ─── Detect test framework ───
FRAMEWORK="unknown"
TEST_CMD=""
FULL_TEST_CMD=""

# Python
if [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "setup.cfg" ]; then
  if [ -f "pyproject.toml" ] && grep -q "pytest" "pyproject.toml" 2>/dev/null; then
    FRAMEWORK="pytest"
  elif [ -d ".tox" ] || grep -q "tox" "pyproject.toml" 2>/dev/null; then
    FRAMEWORK="tox"
  elif [ -f "tox.ini" ]; then
    FRAMEWORK="tox"
  else
    FRAMEWORK="pytest"
  fi

  case "$FRAMEWORK" in
    pytest)
      FULL_TEST_CMD="python3 -m pytest -x -q"
      if [ -n "$TARGET_MODULE" ]; then
        # Try test file patterns
        for pattern in "tests/test_${TARGET_MODULE}.py" "tests/${TARGET_MODULE}/test_*.py" "test_${TARGET_MODULE}.py"; do
          MATCH=$(ls $pattern 2>/dev/null | head -1)
          if [ -n "$MATCH" ]; then
            TEST_CMD="python3 -m pytest -x -q $MATCH"
            break
          fi
        done
        [ -z "$TEST_CMD" ] && TEST_CMD="python3 -m pytest -x -q -k $TARGET_MODULE"
      fi
      ;;
    tox)
      FULL_TEST_CMD="tox -e py"
      TEST_CMD="$FULL_TEST_CMD"
      ;;
  esac
fi

# JavaScript/TypeScript
if [ -f "package.json" ]; then
  if grep -q '"jest"' "package.json" 2>/dev/null || [ -f "jest.config.js" ] || [ -f "jest.config.ts" ]; then
    FRAMEWORK="jest"
    FULL_TEST_CMD="npx jest --no-coverage"
    if [ -n "$TARGET_MODULE" ]; then
      TEST_CMD="npx jest --no-coverage $TARGET_MODULE"
    fi
  elif grep -q '"vitest"' "package.json" 2>/dev/null || [ -f "vitest.config.ts" ]; then
    FRAMEWORK="vitest"
    FULL_TEST_CMD="npx vitest run"
    if [ -n "$TARGET_MODULE" ]; then
      TEST_CMD="npx vitest run $TARGET_MODULE"
    fi
  elif grep -q '"mocha"' "package.json" 2>/dev/null; then
    FRAMEWORK="mocha"
    FULL_TEST_CMD="npx mocha"
    TEST_CMD="$FULL_TEST_CMD"
  elif grep -q '"test"' "package.json" 2>/dev/null; then
    FRAMEWORK="npm-test"
    FULL_TEST_CMD="npm test"
    TEST_CMD="$FULL_TEST_CMD"
  fi
fi

# Go
if [ -f "go.mod" ]; then
  FRAMEWORK="go-test"
  FULL_TEST_CMD="go test ./..."
  if [ -n "$TARGET_MODULE" ]; then
    TEST_CMD="go test ./${TARGET_MODULE}/..."
  fi
fi

# Rust
if [ -f "Cargo.toml" ]; then
  FRAMEWORK="cargo-test"
  FULL_TEST_CMD="cargo test"
  if [ -n "$TARGET_MODULE" ]; then
    TEST_CMD="cargo test $TARGET_MODULE"
  fi
fi

# Ruby
if [ -f "Gemfile" ]; then
  if [ -d "spec" ]; then
    FRAMEWORK="rspec"
    FULL_TEST_CMD="bundle exec rspec"
    if [ -n "$TARGET_MODULE" ]; then
      TEST_CMD="bundle exec rspec spec/${TARGET_MODULE}_spec.rb"
    fi
  elif [ -d "test" ]; then
    FRAMEWORK="minitest"
    FULL_TEST_CMD="bundle exec rake test"
    TEST_CMD="$FULL_TEST_CMD"
  fi
fi

if [ "$FRAMEWORK" = "unknown" ]; then
  echo '{"pass": false, "framework": "unknown", "error": "could not detect test framework"}'
  exit 1
fi

# Default: if no targeted cmd, use full
[ -z "$TEST_CMD" ] && TEST_CMD="$FULL_TEST_CMD"
[ -z "$FULL_TEST_CMD" ] && FULL_TEST_CMD="$TEST_CMD"

# ─── Run targeted tests first ───
TARGETED_PASS=false
TARGETED_OUTPUT=""
if [ -n "$TARGET_MODULE" ] && [ "$TEST_CMD" != "$FULL_TEST_CMD" ]; then
  TARGETED_OUTPUT=$(eval "$TEST_CMD" 2>&1 | tail -50)
  if [ ${PIPESTATUS[0]:-$?} -eq 0 ]; then
    TARGETED_PASS=true
  fi
fi

# ─── Run full suite if requested or if targeted passed ───
FULL_PASS=false
FULL_OUTPUT=""
if [ "$RUN_FULL" = true ] || [ "$TARGETED_PASS" = true ] || [ -z "$TARGET_MODULE" ]; then
  FULL_OUTPUT=$(eval "$FULL_TEST_CMD" 2>&1 | tail -100)
  if [ ${PIPESTATUS[0]:-$?} -eq 0 ]; then
    FULL_PASS=true
  fi
fi

# ─── Determine overall result ───
OVERALL_PASS=false
if [ "$RUN_FULL" = true ] || [ -z "$TARGET_MODULE" ]; then
  OVERALL_PASS=$FULL_PASS
elif [ "$TARGETED_PASS" = true ]; then
  OVERALL_PASS=true
fi

# Output JSON
python3 -c "
import json
result = {
    'pass': $( [ \"$OVERALL_PASS\" = true ] && echo 'True' || echo 'False' ),
    'framework': '$FRAMEWORK',
    'targeted_module': '$TARGET_MODULE' or None,
    'targeted_pass': $( [ \"$TARGETED_PASS\" = true ] && echo 'True' || echo 'False' ),
    'targeted_cmd': $(echo "$TEST_CMD" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),
    'full_pass': $( [ \"$FULL_PASS\" = true ] && echo 'True' || echo 'False' ),
    'full_cmd': $(echo "$FULL_TEST_CMD" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'),
    'targeted_output_tail': $(echo "$TARGETED_OUTPUT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()[-500:]))' 2>/dev/null || echo '""'),
    'full_output_tail': $(echo "$FULL_OUTPUT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()[-1000:]))' 2>/dev/null || echo '""'),
}
print(json.dumps(result, indent=2))
" 2>/dev/null || echo '{"pass": false, "error": "output generation failed"}'

[ "$OVERALL_PASS" = true ] && exit 0 || exit 1
