---
description: Live web search (Exa) and GitHub repository documentation (DeepWiki) over MCP. Use when the user asks for current/up-to-date web information, "search the web", recent news or docs, or wants to learn how a GitHub repository works from its generated wiki.
---

# Web Search + DeepWiki (MCP)

Two live lookups behind one script: **Exa** for current web search / page fetch, and
**DeepWiki** for AI-generated docs about a GitHub repository. Both talk to the same
hosted MCP endpoints Claude Code and Codex use (`https://mcp.exa.ai/mcp`,
`https://mcp.deepwiki.com/mcp`) — no SDK, no local server, no auth for public use.

Script: `./bin/mcp-web.ts` (run with `bun`).

## When to use

- "search the web", "what's the latest on X", "find sources about Y" → `search`
- a URL is referenced and the full clean content is needed → `fetch`
- "how does the repo <owner/repo> work", "read the docs for <repo>" → `wiki` / `wiki-read`
- a pointed question about a repo's architecture, APIs, or internals → `ask`

## Commands

```bash
# Exa web search — current, sourced results with highlights
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts search "query" [numResults] [--text]

# Exa page fetch — full page as clean markdown (falls back to Jina Reader if Exa is empty/blocked)
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts fetch "https://example.com/page"

# Document parsing — PDF, Word, PPT, Excel, ODF, RTF, EPUB, CSV → markdown.
# Local + keyless via firecrawl anydoc (`bunx @firecrawl/anydoc`); accepts a URL or a local path.
# Ceiling: scanned/image-only PDFs need hosted OCR — use Firecrawl Parse with an API key for those.
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts doc "https://example.com/report.pdf"
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts doc "./local/file.docx"

# YouTube transcript — keyless via yt-dlp auto-subs, deduplicated plain text
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts yt "https://youtube.com/watch?v=..."

# GitHub repo as filesystem — shallow clone to /tmp/<owner>-repo[-ref], then read/grep it locally
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts gh "owner/repo"        # default branch
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts gh "owner/repo@v1.2"   # tag or branch

# DeepWiki — topic list for a public repo (repoName is case-sensitive: match deepwiki.com/owner/Repo exactly)
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts wiki "owner/repo"

# DeepWiki — the full generated wiki for the repo
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts wiki-read "owner/repo"

# DeepWiki — ask a question about the repo (gets a sourced, AI-generated answer)
bun ~/.pi/agent/skills/websearch/bin/mcp-web.ts ask "owner/repo" "How does X work?"
```

`repoName` uses the short form and **exact case**: `openai/openai-python`,
`microsoft/TypeScript` — no `https://github.com/` prefix. A repo that is
not indexed on deepwiki.com returns "Repository not found" — `ask` still
works for many of those. `wiki` lists the topic tree; `wiki-read` returns
the full wiki (DeepWiki exposes no per-topic param); `ask` is the fast path
for pointed questions and stays sourced.

For pages that require real browser rendering (JS-gated content, logins,
lazy-loaded apps), drive `~/.bun/bin/agent-browser` directly instead of
`fetch` — it is the same browser this skill uses for Exa auth.

## Auto-auth (no manual steps)

Both servers work keyless in public mode. If a search comes back unauthed (Exa
needs a key, or a DeepWiki tool is private-mode only), the script triggers the
agent-browser flow automatically:

1. It opens `https://dashboard.exa.ai/api-keys` in the headed agent-browser.
2. If Exa is logged out (`auth.exa.ai`), it prints a notice and polls up to
   5 minutes while you complete login in that browser window.
3. It extracts the key from the dashboard (create-key + copy fallbacks) and
   saves it to `~/.pi/agent/exa.json` (mode 0600).
4. It retries the original call once.

Force the flow anytime with `bun mcp-web.ts auth`; check state with
`bun mcp-web.ts status`. DeepWiki private mode takes `DEEPWIKI_MCP_API_KEY`
(no browser flow — those keys come from the Devin workspace settings).

## Output

`search` returns Exa's formatted results (title, URL, published date, highlights)
— already clean and ready to cite. `ask` returns DeepWiki's sourced answer.
Long outputs are truncated by the script; ask for more depth with a targeted
`wiki-read`/`fetch` on the relevant source.
