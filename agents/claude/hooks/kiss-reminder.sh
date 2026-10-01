#!/usr/bin/env bash
# kiss-reminder.sh — PreToolUse(Write|Edit).
# Surfaces KISS / Zen-of-Python / ponytail ONCE per ~session, before the first
# code edit, then gets out of the way. Self-clearing: it sets its own marker, so
# the blocked edit just succeeds on retry — no manual acknowledgement needed.
#
# (The always-on ponytail plugin already nudges every turn; this is the hard,
#  can't-miss version at the moment code is actually being written.)
set -uo pipefail

input=$(cat)
path=$(printf '%s' "$input" | python3 -c "import json,sys;print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null)

# Only for code files — never markdown / json / yaml / config.
case "$path" in
  *.go|*.py|*.ts|*.tsx|*.js|*.jsx|*.rs|*.java|*.c|*.h|*.sh) ;;
  *) exit 0 ;;
esac

# Fire at most once per 90 min, then stay silent.
marker="${TMPDIR:-/tmp}/kiss-reminded"
if [ -f "$marker" ] && [ -n "$(find "$marker" -mmin -90 2>/dev/null)" ]; then
  exit 0
fi
touch "$marker"   # self-clear: the retry of this same edit will pass straight through

cat >&2 <<'EOF'
🧘 KISS / Zen / ponytail — before writing this code:
  • Does it need to exist at all? Speculative = skip it (YAGNI).
  • Already in the codebase / stdlib / an installed dep? Reuse before you write.
  • Simple beats clever. Flat beats nested. Shortest diff that works wins.
  • Non-trivial logic leaves ONE runnable check behind.
Fires once per session — just retry the edit and it proceeds.
EOF
exit 2
