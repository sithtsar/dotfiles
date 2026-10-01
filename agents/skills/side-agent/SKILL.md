---
description: Run headless side agents via `pi -p` — adversarial code reviews, claim/implementation verification loops, and deep research loops, each in an isolated context window. Use when the user wants a second opinion, an adversarial read of a diff, claims checked against code, or a research pass that shouldn't pollute the main session.
---

# Side Agent (headless `pi -p`)

One thin script, three modes. Each invocation is a **separate `pi` process** with
its own context window, so side agents never pollute the main session and can
run long without eviction pressure. The side agent has pi's normal skills and
tools (websearch works in research mode).

Script: `./bin/side-agent.ts`

## Commands

```bash
# Adversarial review of the working diff (unstaged + staged)
bun ~/.pi/agent/skills/side-agent/bin/side-agent.ts review

# Review against a base branch
bun ~/.pi/agent/skills/side-agent/bin/side-agent.ts review --base main

# Review specific files instead of the diff
bun ~/.pi/agent/skills/side-agent/bin/side-agent.ts review src/foo.ts internal/x.go

# Verify claims against files — output is a verdict table
bun ~/.pi/agent/skills/side-agent/bin/side-agent.ts verify "The lock is taken before the read" internal/cmm/control/lock.go
echo "invariant text" | bun ~/.pi/agent/skills/side-agent/bin/side-agent.ts verify

# Deep research (side agent uses the websearch skill)
bun ~/.pi/agent/skills/side-agent/bin/side-agent.ts research "what is the best vector DB for X"

# Choose a model / machine-readable output
bun ~/.pi/agent/skills/side-agent/bin/side-agent.ts review --model anthropic/claude-sonnet-4
bun ~/.pi/agent/skills/side-agent/bin/side-agent.ts verify "..." --json
```

## Mode contracts

| Mode | What the side agent outputs |
| --- | --- |
| `review` | VERDICT (merge / changes-requested), BLOCKING ISSUES (numbered), NITS — adversarial stance, no rubber-stamping |
| `verify` | One row per claim: claim \| VERIFIED \| REFUTED \| UNVERIFIABLE \| evidence (file:line), then a summary count |
| `research` | ANSWER with calibrated confidence, KEY EVIDENCE (sources), GAPS |

## When to use

- **Adversarial review**: before merging, or when a claim like "a green suite
  proves backend parity" needs a hostile read of the diff only.
- **Verification loops**: check implementation against an invariant, check a
  checklist against shipped code, verify a summary's file claims.
- **Deep research**: a multi-source pass you don't want to hold in the main
  session — the side agent gathers sources and returns a cited answer.

Context flows over stdin (pi merges it into the prompt), capped at ~400KB.
Long reviews can be run with `--model <id>` to pick a stronger model without
changing the main session's model.
