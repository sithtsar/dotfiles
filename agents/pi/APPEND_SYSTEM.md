# Mermaid diagrams: hard rules

Render mermaid that parses on the first try. These rules exist because broken
diagrams are the norm, not the exception — follow them mechanically.

1. **Fence**: diagrams go alone inside triple backticks tagged `mermaid`. No
   language other than `mermaid`, no extra text inside the fence.
2. **Quoted labels are the default**: any label containing a space, `(`, `)`,
   `&`, `;`, `{`, `}`, `<`, `>`, `*`, or an apostrophe must be quoted:
   `A["Team (1st XI)"]`, never `A[Team (1st XI)]`. When unsure, quote it.
3. **Node IDs**: letters or digits only (start with a letter), no spaces, no
   quotes, no punctuation. `A`, `B`, `DB1`, `svc--auth` is NOT an id.
4. **Arrow syntax per diagram type**: flowcharts use `-->`, `--text-->`,
   `-.->`, `==>`. `->>` and `-->>` belong ONLY to sequence diagrams. Never mix
   the two vocabularies in one diagram.
5. **Sequence diagrams**: declare every participant first
   (`participant A as "Label"`), then `A->>B: message`. A message cannot
   contain a newline or an unescaped `:`. No parentheses messages.
6. **No directives** (`%%{init: ...}%%`) unless the user asks for a specific
   theme. If used, the directive MUST be the very first line of the diagram,
   and `themeVariables` must be valid JSON.
7. **No emoji, HTML, or raw `&` in labels** — old renderers choke on them. Use
   words: "and", "to", "from". Escape `&` as `&amp;` inside quoted labels when
   it truly must appear.
8. **Keep it small**: a flowchart that does the job with 12 nodes and 2
   subgraphs is better than a 40-node map. If a diagram grew complicated while
   explaining, split it.
9. **Assume the reader will paste it unmodified** into GitHub, Notion, or
   mermaid.live. A diagram that only renders with hand-tuning is a bug — fix
   it the same as a code error before showing it.
10. **Proven breakages — do not use these**:
    - `~~~` invisible links (parser drops them; mermaid >= 10.4 only). Use a
      dashed `-.->` edge instead.
    - `:::` classes chained onto shaped nodes (`G(["done"]):::ok`). Use the
      separate `class G ok` statement — inline `:::` after a shape is dropped.
    - gantt milestones with an `after` dependency — give them an explicit
      date: `Publish :milestone, m1, 2026-08-09, 0d`.
    GitHub and Notion run older parsers than mermaid.live; if a diagram must
    render there, stay within v10.1-era syntax (the three items above, plus
    no edge `href` clicks, no `stateDiagram` composite states).
11. **pi's built-in renderer supports only five kinds** — `flowchart`, `sequence`,
    `state`, `class`, `er`. Anything else (gantt, pie, journey, mindmap,
    gitGraph, timeline, sankey) silently renders as raw code in the pi TUI.
    A diagram meant to be *seen* inside pi must be one of the five; a gantt
    or timeline is only for pasting into GitHub/Notion/mermaid.live. For a
    timeline in pi, use `sequenceDiagram` or `flowchart` instead.