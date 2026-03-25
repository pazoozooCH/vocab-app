#!/bin/bash
# Quiet validation script — only outputs errors and a final summary.
# Designed for use by AI agents (Claude Code) to minimize token usage.

set -e

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

run_step "build" npm run build
run_step "lint" npm run lint
run_step "test" npm test
run_step "test:e2e" npx playwright test

if [ $FAIL -gt 0 ]; then
  echo -e "$ERRORS"
  echo "RESULT: ${PASS} passed, ${FAIL} failed"
  exit 1
else
  echo "RESULT: all ${PASS} checks passed"
fi
