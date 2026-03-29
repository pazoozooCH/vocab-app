#!/bin/bash
# Run all checks regardless of failures — reports a full summary.
#   lint (~10s) → test (~5s) → build (~5s) → e2e (~37s)

ERRORS=""
PASS=0
FAIL=0

run_step() {
  local name="$1"
  shift
  if output=$("$@" 2>&1); then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}\n--- ${name} FAILED ---\n${output}\n"
  fi
}

run_step "lint" npm run lint
run_step "test" npm test
run_step "build" npm run build
run_step "test:e2e" npx playwright test

if [ $FAIL -gt 0 ]; then
  echo -e "$ERRORS"
  echo "RESULT: ${PASS} passed, ${FAIL} failed"
  exit 1
else
  echo "RESULT: all ${PASS} checks passed"
fi
