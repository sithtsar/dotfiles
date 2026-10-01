#!/usr/bin/env bash
# fff-search-gate.sh - PreToolUse(Grep|Glob|Bash).
# Standing rule: codebase search goes through fff (dmtrKovalenko/fff), which
# keeps a warm in-memory content index and beats a cold ripgrep process on
# every repeat search in a session.
#
# Grep and Glob are blocked outright. Bash is blocked ONLY when a search tool
# sits at a COMMAND position (start of the line, or after ; && || ( ). A search
# tool after a pipe is filtering another command's output, not reading the
# tree, so `make 2>&1 | grep error` stays legal.
#
# Escape hatch: put `# fff-exempt` in the command when fff genuinely cannot do
# the job (find -delete, -newer, -exec, counting one known file).
set -uo pipefail

# Degrade instead of stranding the session: if fff is not installed there is
# nothing to redirect to, and blocking Grep/Glob would leave no search at all.
command -v fff-mcp >/dev/null 2>&1 || exit 0

input=$(cat)

tool=$(printf '%s' "$input" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("tool_name", ""))
except Exception:
    print("")
' 2>/dev/null)

advise() {
  cat >&2 <<'MSG'
Use fff for codebase search, not this tool. It holds a warm content index, so
repeat searches in a session are far cheaper than a cold process each time.

  mcp__fff__find_files      fuzzy search over FILE NAMES      {query, path?}
  mcp__fff__grep            search FILE CONTENTS              {pattern, path?}
  mcp__fff__multi_grep      several patterns, OR logic        {patterns[], path?}

output_mode: content (default) | files_with_matches | count
constraints: file filter, e.g. '*.{ts,tsx} !test/' - always pass it when you can.
multi-grep is the one to reach for when a symbol has several spellings
(snake_case / camelCase / PascalCase): one call instead of three.

Reading a known path is unaffected: cat, sed -n, head and the Read tool are fine.
MSG
}

case "$tool" in
  Grep | Glob)
    advise
    exit 2
    ;;
  Bash) ;;
  *) exit 0 ;;
esac

cmd=$(printf '%s' "$input" | python3 -c '
import json, sys
try:
    print(json.load(sys.stdin).get("tool_input", {}).get("command", ""))
except Exception:
    print("")
' 2>/dev/null)
[ -n "$cmd" ] || exit 0
printf '%s' "$cmd" | grep -q 'fff-exempt' && exit 0

# Command position: line start, or after a separator that is NOT a pipe.
boundary='(^|[;&(]|&&|\|\|)[[:space:]]*'
hit=0
printf '%s' "$cmd" | grep -Eq "${boundary}(rg|ag|ack|fd|fzf)[[:space:]]" && hit=1
printf '%s' "$cmd" | grep -Eq "${boundary}find[[:space:]]" && hit=1
# Plain `grep` only counts as a tree search when it recurses or filters files.
{ printf '%s' "$cmd" | grep -Eq "${boundary}(grep|egrep|fgrep)[[:space:]]" &&
  printf '%s' "$cmd" | grep -Eq '(^|[[:space:]])(-[a-zA-Z]*[rR]|--recursive|--include|--exclude)'; } && hit=1
[ "$hit" = 1 ] || exit 0

advise
printf '\nBlocked command: %s\n' "$cmd" >&2
printf 'If fff truly cannot do this (find -delete/-newer/-exec, one known file), add `# fff-exempt`.\n' >&2
exit 2
