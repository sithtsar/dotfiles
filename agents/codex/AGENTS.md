<!-- codebase-memory-mcp:start -->
# Codebase Knowledge Graph (codebase-memory-mcp)

This project uses codebase-memory-mcp to maintain a knowledge graph of the codebase.
ALWAYS prefer MCP graph tools over grep/glob/file-search for code discovery.

## Priority Order
1. `search_graph` — find functions, classes, routes, variables by pattern
2. `trace_path` — trace who calls a function or what it calls
3. `get_code_snippet` — read specific function/class source code
4. `query_graph` — run Cypher queries for complex patterns
5. `get_architecture` — high-level project summary

## When to fall back to grep/glob
- Searching for string literals, error messages, config values
- Searching non-code files (Dockerfiles, shell scripts, configs)
- When MCP tools return insufficient results

## Examples
- Find a handler: `search_graph(name_pattern=".*OrderHandler.*")`
- Who calls it: `trace_path(function_name="OrderHandler", direction="inbound")`
- Read source: `get_code_snippet(qualified_name="pkg/orders.OrderHandler")`
<!-- codebase-memory-mcp:end -->

<!-- local-resource-controls:start -->
# Local resource controls

- The coordinator owns code discovery. Workers request graph queries from the coordinator and reuse the existing project index; never create per-worker or per-worktree indexes.
- Keep CMM auto_index and auto_watch disabled. Prefer the existing shared graph through one coordinator-owned connection; if unavailable, use bounded read-only CLI/SQLite queries before source-search fallback. Do not restart a failed MCP server repeatedly.
- CMM, AWS MCP, Strands, and the computer-use plugin server automatic startup is disabled in config.toml to prevent duplicate local servers. Do not re-enable them globally to satisfy a worker task. The coordinator may deliberately enable a needed server for one session after checking for an existing process.
- Workers must not launch MCP/helper servers, Node/uv/npm tool processes, background jobs, additional agents, or worktrees without explicit coordinator assignment. Give each worker a bounded checkpoint and require it to stop and report.
<!-- local-resource-controls:end -->

<!-- research-grounding:start -->
# Research and prior art

- For research questions, technical investigations, design decisions, or implementation work that requires prior-art grounding, research before proposing or building a solution.
- Use Exa for web research: existing approaches, standards, official documentation, papers, and relevant engineering write-ups. Do not substitute remembered claims for current evidence.
- Use DeepWiki for relevant GitHub repositories to understand their architecture, implementation, and supported behavior. Use it alongside Exa when repository internals matter; omit it when no relevant repository exists.
- Prefer the available Exa and DeepWiki MCP tools. If they are unavailable, use the `websearch` skill at `~/.agents/skills/websearch/SKILL.md` and its Bun script `~/.agents/skills/websearch/bin/mcp-web.ts` (`search`, `fetch`, and `ask`). If those also fail, state the limitation and use available search tools.
- Verify consequential claims against primary sources and the applicable version. Cite source links and distinguish documented behavior, inference, and locally tested behavior.
- Keep research proportional to the task. A research request or a need for prior art triggers this rule; routine edits with an established specification do not require a new research round.
<!-- research-grounding:end -->
