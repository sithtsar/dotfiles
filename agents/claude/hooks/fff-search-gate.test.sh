#!/usr/bin/env bash
# Self-check for fff-search-gate.sh. Run it directly; it prints FAIL lines and
# exits non-zero if any case regresses. The interesting boundary is "search the
# tree" (block) vs "filter another command's output" (allow).
GATE="$(dirname "$0")/fff-search-gate.sh"
fails=0

# The gate stands down when fff is absent, so stub it to exercise the rules.
STUB=$(mktemp -d)
trap 'rm -rf "$STUB"' EXIT
printf '#!/bin/sh\nexit 0\n' > "$STUB/fff-mcp"
chmod +x "$STUB/fff-mcp"
PATH="$STUB:$PATH"

check() { # want_exit  tool  command  label
  local want="$1" tool="$2" command="$3" label="$4" got
  printf '{"tool_name":"%s","tool_input":{"command":%s}}' \
    "$tool" "$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$command")" |
    "$GATE" >/dev/null 2>&1
  got=$?
  if [ "$got" != "$want" ]; then
    echo "FAIL want=$want got=$got  $label"
    fails=$((fails + 1))
  fi
}

check 2 Grep "" "Grep tool is blocked"
check 2 Glob "" "Glob tool is blocked"
check 0 Read "" "other tools pass through"

check 2 Bash 'rg foo src/'                      "rg at command position"
check 2 Bash 'find . -name "*.c"'               "find at command position"
check 2 Bash 'grep -rn foo src'                 "recursive grep"
check 2 Bash 'grep -n foo --include="*.c" .'    "grep with --include"
check 2 Bash 'cd x && rg foo'                   "rg after &&"

check 0 Bash 'make 2>&1 | grep error'           "grep filtering a pipe"
check 0 Bash 'ls | grep -i foo'                 "grep -i filtering a pipe"
check 0 Bash 'grep -n foo one_known_file.c'     "grep on one named file"
check 0 Bash 'cat foo.txt'                      "unrelated command"
check 0 Bash 'find . -name x -delete # fff-exempt' "escape hatch honoured"

[ "$fails" = 0 ] && echo "all pass"
exit "$fails"
