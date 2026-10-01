#!/usr/bin/env bash
# no-poll-loop.sh — PreToolUse(Bash).
# Blocks hand-rolled monitoring / polling loops — they hang, miss events, and
# fail silently. Use the built-in Monitor tool to stream events, or a single
# serial cron (CronCreate) for periodic checks on a long-running task.
#
# Catches, at a command position (not inside a string):
#   - until … loops
#   - watch …
#   - while/for … loops that sleep (the poll gotcha)
# Hard block, no bypass: per standing rule these are always the wrong tool.
set -uo pipefail

input=$(cat)
cmd=$(printf '%s' "$input" | python3 -c "import json,sys;print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

boundary='(^|[;&|(]|do|then|else)[[:space:]]*'   # start, separators, or loop/if keywords
poll=0
printf '%s' "$cmd" | grep -Eq "${boundary}until[[:space:]]"           && poll=1   # until loop
printf '%s' "$cmd" | grep -Eq '(^|[;&|(])[[:space:]]*watch[[:space:]]' && poll=1   # watch
{ printf '%s' "$cmd" | grep -Eq "${boundary}(while|for)[[:space:]]" \
  && printf '%s' "$cmd" | grep -Eq '[^[:alpha:]]sleep[[:space:]]'; }   && poll=1   # while/for + sleep
[ "$poll" = 1 ] || exit 0

cat >&2 <<'EOF'
🛑 No hand-rolled monitor / poll loops — they hang, miss events, and fail silently.
Instead, for a long-running task:
  • Stream it with the Monitor tool (foreground sleep is blocked here for this reason).
  • Or schedule a SINGLE serial cron (CronCreate) for periodic checks.
Don't poll with: until … / watch … / while|for … sleep … done.
EOF
exit 2
