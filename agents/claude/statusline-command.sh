#!/usr/bin/env bash
# Zen statusline: last path segment (worktree name in a worktree, else cwd
# basename), branch only when it differs from that segment, model, the PR stack
# this branch sits in, its CI state, and ctx% only once it's high enough to need
# attention. No colour except where something wants attention.
#
# The PR field exists because Claude Code's own indicator names one PR and this
# repo routinely has a branch stacked on another branch's PR — so the built-in
# can say #271 while you are committing to #318.
input=$(cat)
model=$(printf '%s' "$input" | jq -r '.model.display_name')
dir=$(printf '%s' "$input" | jq -r '.workspace.current_dir')
wt=$(printf '%s' "$input" | jq -r '.workspace.git_worktree // empty')
ctx_used=$(printf '%s' "$input" | jq -r '.context_window.used_percentage // empty')

branch=$(git -C "$dir" branch --show-current 2>/dev/null)

if [ -n "$wt" ]; then
  label="$wt"
else
  label=$(basename "$dir")
  [ -n "$branch" ] && [ "$branch" != "$label" ] && label="$label  $branch"
fi

out="$label · $model"

# PR stack and CI for this branch. This script runs on every render and each `gh`
# call takes about a second, so neither runs inline: the cached answer prints now
# and a refresh is kicked off in the background at most once a minute.
#
# Cache is two lines: CI token, then stack token.
if [ -n "$branch" ]; then
  key=$(printf '%s\n%s' "$dir" "$branch" | cksum | cut -d' ' -f1)
  cache="${TMPDIR:-/tmp}/cc-ci-$key"
  if [ ! -f "$cache" ] || [ -n "$(find "$cache" -mmin +1 2>/dev/null)" ]; then
    (
      cd "$dir" 2>/dev/null || exit 0

      # `gh pr checks` exits non-zero for both "no PR" and "cannot reach GitHub",
      # and both want the same handling: keep whatever the field said, but still
      # touch the cache so the mtime guard above throttles. Without the touch, a
      # branch with no PR respawns this on every single render.
      ci=""
      if raw=$(gh pr checks --json bucket 2>/dev/null); then
        ci=$(printf '%s' "$raw" \
          | jq -r '[.[].bucket] as $b
                   | ($b | map(select(. == "fail")) | length) as $f
                   | ($b | map(select(. == "pending")) | length) as $p
                   | if   ($b | length) == 0 then ""
                     elif $f > 0            then "fail \($f)"
                     elif $p > 0            then "pend \($p)"
                     else                        "pass"
                     end' 2>/dev/null)
      elif [ -f "$cache" ]; then
        ci=$(sed -n 1p "$cache")
      fi

      # One list call for every open PR, then walk head->base locally. Cheaper
      # than one call per level and it gets the whole chain in a single request.
      stack=""
      if prs=$(gh pr list --state open --limit 100 \
                 --json number,headRefName,baseRefName 2>/dev/null); then
        stack=$(printf '%s' "$prs" | BR="$branch" python3 -c '
import json, os, sys
prs = json.load(sys.stdin)
by_head = {p["headRefName"]: p for p in prs}
branch = os.environ["BR"]
chain, seen = [], set()
cur = branch
while cur in by_head and cur not in seen:
    seen.add(cur)
    pr = by_head[cur]
    chain.append(pr["number"])
    cur = pr["baseRefName"]
print("▸".join(f"#{n}" for n in chain))
' 2>/dev/null)
      elif [ -f "$cache" ]; then
        stack=$(sed -n 2p "$cache")
      fi

      printf '%s\n%s\n' "$ci" "$stack" > "$cache.$$" 2>/dev/null \
        && mv -f "$cache.$$" "$cache" 2>/dev/null
      rm -f "$cache.$$" 2>/dev/null
    ) >/dev/null 2>&1 &
  fi

  stack=$(sed -n 2p "$cache" 2>/dev/null)
  # Dim, because it is orientation rather than a signal: it is the same every
  # render until you switch branches.
  [ -n "$stack" ] && out="$out · $(printf '\033[2m%s\033[0m' "$stack")"

  ci=$(sed -n 1p "$cache" 2>/dev/null)
  case "$ci" in
    pass)    out="$out · $(printf '\033[32mci ✓\033[0m')" ;;
    pend\ *) out="$out · $(printf '\033[33mci ○%s\033[0m' "${ci#pend }")" ;;
    fail\ *) out="$out · $(printf '\033[31mci ✗%s\033[0m' "${ci#fail }")" ;;
  esac
fi

if [ -n "$ctx_used" ] && awk "BEGIN{exit !($ctx_used >= 80)}"; then
  ctx_color=3
  awk "BEGIN{exit !($ctx_used >= 90)}" && ctx_color=1
  out="$out · $(printf '\033[3%dm%.0f%%\033[0m' "$ctx_color" "$ctx_used")"
fi

printf '%s' "$out"
