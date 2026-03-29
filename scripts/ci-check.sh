#!/bin/bash
# Fail-fast validation with parallel phases.
# Phase 1 (parallel): lint (~10s) + test (~5s) → ~10s
# Phase 2 (parallel): build (~5s) + e2e (~37s)  → ~37s
# Total: ~47s (vs ~57s sequential)

set -e

PASS=0
FAIL=0
ERRORS=""

# Run two commands in parallel, fail-fast if either fails
run_parallel() {
  local name1="$1" cmd1="$2" name2="$3" cmd2="$4"
  local tmp1 tmp2 pid1 pid2 exit1 exit2
  tmp1=$(mktemp) tmp2=$(mktemp)

  eval "$cmd1" >"$tmp1" 2>&1 & pid1=$!
  eval "$cmd2" >"$tmp2" 2>&1 & pid2=$!

  wait $pid1; exit1=$?
  wait $pid2; exit2=$?

  if [ $exit1 -ne 0 ]; then
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}\n--- ${name1} FAILED ---\n$(cat "$tmp1")\n"
  else
    PASS=$((PASS + 1))
  fi

  if [ $exit2 -ne 0 ]; then
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}\n--- ${name2} FAILED ---\n$(cat "$tmp2")\n"
  else
    PASS=$((PASS + 1))
  fi

  rm -f "$tmp1" "$tmp2"

  [ $FAIL -eq 0 ]
}

# Phase 1: lint + test (parallel)
if ! run_parallel "lint" "npm run lint" "test" "npm test"; then
  echo -e "$ERRORS"
  echo "RESULT: ${PASS} passed, ${FAIL} failed (fail-fast)"
  exit 1
fi

# Phase 2: build + e2e (parallel)
if ! run_parallel "build" "npm run build" "test:e2e" "npx playwright test"; then
  echo -e "$ERRORS"
  echo "RESULT: ${PASS} passed, ${FAIL} failed (fail-fast)"
  exit 1
fi

echo "RESULT: all ${PASS} checks passed"
