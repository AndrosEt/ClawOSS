#!/usr/bin/env bash
# run-repo-tests.sh — Auto-detect test framework and run tests
# Usage: run-repo-tests.sh <workspace_path> [--targeted <module>] [--full] [--timeout N]
# Exit 0 = tests pass, Exit 1 = tests fail

WORKDIR="${1:?Usage: run-repo-tests.sh <workspace_path> [--targeted <module>] [--full]}"
MODE="targeted"
TARGET=""
TIMEOUT=120

shift
while [ $# -gt 0 ]; do
  case "$1" in
    --targeted) MODE="targeted"; TARGET="$2"; shift 2 ;;
    --full) MODE="full"; shift ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

cd "$WORKDIR" || { echo '{"pass": false, "reason": "cannot cd to workspace"}'; exit 1; }

# ─── 1. Detect test framework ───
FRAMEWORK="unknown"
TEST_CMD=""

if [ -f "package.json" ]; then
  # Node.js project
  if grep -q '"test"' package.json 2>/dev/null; then
    FRAMEWORK="npm"
    if [ -f "yarn.lock" ]; then
      TEST_CMD="yarn test"
    elif [ -f "pnpm-lock.yaml" ]; then
      TEST_CMD="pnpm test"
    else
      TEST_CMD="npm test"
    fi
  fi
  # Check for specific test runners
  if grep -q "jest\|vitest\|mocha" package.json 2>/dev/null; then
    if grep -q "vitest" package.json; then FRAMEWORK="vitest"
    elif grep -q "jest" package.json; then FRAMEWORK="jest"
    elif grep -q "mocha" package.json; then FRAMEWORK="mocha"; fi
  fi
elif [ -f "Cargo.toml" ]; then
  FRAMEWORK="cargo"
  TEST_CMD="cargo test"
elif [ -f "go.mod" ]; then
  FRAMEWORK="go"
  TEST_CMD="go test ./..."
elif [ -f "setup.py" ] || [ -f "pyproject.toml" ] || [ -f "setup.cfg" ]; then
  FRAMEWORK="pytest"
  TEST_CMD="python3 -m pytest"
elif [ -f "Gemfile" ]; then
  FRAMEWORK="ruby"
  if [ -f "Rakefile" ] && grep -q "test\|spec" Rakefile 2>/dev/null; then
    TEST_CMD="bundle exec rake test"
  else
    TEST_CMD="bundle exec rspec"
  fi
elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  FRAMEWORK="gradle"
  TEST_CMD="./gradlew test"
elif [ -f "pom.xml" ]; then
  FRAMEWORK="maven"
  TEST_CMD="mvn test"
elif [ -f "Makefile" ] && grep -q "^test:" Makefile 2>/dev/null; then
  FRAMEWORK="make"
  TEST_CMD="make test"
fi

if [ -z "$TEST_CMD" ]; then
  echo "{\"pass\": true, \"framework\": \"none\", \"reason\": \"no test framework detected\", \"skipped\": true}"
  exit 0
fi

# ─── 2. Target specific module if requested ───
if [ "$MODE" = "targeted" ] && [ -n "$TARGET" ]; then
  case "$FRAMEWORK" in
    npm|jest|vitest) TEST_CMD="$TEST_CMD -- --testPathPattern='$TARGET'" ;;
    pytest)          TEST_CMD="$TEST_CMD $TARGET" ;;
    go)              TEST_CMD="go test ./$TARGET/..." ;;
    cargo)           TEST_CMD="cargo test -p $TARGET" ;;
    *)               ;; # Use full test command
  esac
fi

# ─── 3. Install dependencies if needed ───
if [ "$FRAMEWORK" = "npm" ] || [ "$FRAMEWORK" = "jest" ] || [ "$FRAMEWORK" = "vitest" ] || [ "$FRAMEWORK" = "mocha" ]; then
  if [ ! -d "node_modules" ]; then
    if [ -f "yarn.lock" ]; then yarn install --frozen-lockfile 2>/dev/null
    elif [ -f "pnpm-lock.yaml" ]; then pnpm install --frozen-lockfile 2>/dev/null
    else npm ci 2>/dev/null || npm install 2>/dev/null; fi
  fi
elif [ "$FRAMEWORK" = "pytest" ]; then
  if [ -f "requirements.txt" ]; then
    pip install -q -r requirements.txt 2>/dev/null
  fi
elif [ "$FRAMEWORK" = "ruby" ]; then
  bundle install --quiet 2>/dev/null
fi

# ─── 4. Run tests with timeout ───
OUTPUT=$(timeout "${TIMEOUT}s" bash -c "$TEST_CMD" 2>&1)
EXIT_CODE=$?

# Truncate output for JSON safety
OUTPUT_TRUNC=$(echo "$OUTPUT" | tail -50)

cat <<ENDJSON
{
  "pass": $([ $EXIT_CODE -eq 0 ] && echo true || echo false),
  "exit_code": $EXIT_CODE,
  "framework": "$FRAMEWORK",
  "command": $(echo "$TEST_CMD" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '"unknown"'),
  "mode": "$MODE",
  "target": $(echo "$TARGET" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '""'),
  "output_tail": $(echo "$OUTPUT_TRUNC" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))' 2>/dev/null || echo '""')
}
ENDJSON

exit $EXIT_CODE
