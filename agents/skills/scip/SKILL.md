---
name: scip
description: Work with SCIP indexes, `index.scip` files, `scip.proto`, symbol strings, CLI workflows, indexer output, and graph-ingest pipelines. Use when Codex needs to inspect or explain SCIP data, debug indexing issues, parse symbols, map SCIP into a code or security knowledge graph, or ground answers in the official `scip-code/scip` repository and related indexer docs.
---

# SCIP

## Overview

Use this skill to reason about SCIP as a protocol and as a practical artifact in a repo. Prefer primary sources from `github.com/scip-code/scip`, keep claims precise, and separate what SCIP records directly from what must be derived on top.

SCIP is a protobuf-defined interchange format for semantic code intelligence. The authoritative schema is `scip.proto`. In practice, most user requests fall into one of five buckets:

- inspect or explain an existing `index.scip`
- answer protocol/schema questions precisely
- parse or validate symbol strings and ranges
- debug CLI/indexer output or testing workflows
- map SCIP into a graph, search, or security-analysis pipeline

Treat DeepWiki MCP as a fast repo map for the official `sourcegraph/scip` repository, then verify exact fields, enum values, and command semantics against the upstream repo artifacts it points to.

## Quick Start

Identify the task first:

- Protocol or schema question: inspect `scip.proto`, then `docs/scip.md`, then `README.md`.
- CLI or debugging question: inspect `docs/CLI.md`, `docs/Development.md`, then confirm against `cmd/scip`.
- Symbol parsing or consumer implementation question: inspect `bindings/go/scip`, especially symbol and range helpers plus streaming APIs.
- Security-graph or knowledge-graph question: read [references/security-graph-foundation.md](./references/security-graph-foundation.md) and treat SCIP as structural ground truth, not full dataflow.
- Indexer-specific question: inspect the relevant upstream indexer repo or official docs after grounding in the base protocol.

If DeepWiki MCP is available, use this orientation path first:

1. `read_wiki_structure` on `sourcegraph/scip` to find the right repo surface.
2. `ask_question` for a focused summary of the exact area you need.
3. Verify exact claims against the linked repo files or local copies before making a precise statement.

If DeepWiki is not available, continue with the repo and official docs only.

## Source Order

Prefer sources in this order:

- Local repo artifacts the user provided.
- Official `scip-code/scip` repo surfaces summarized in [references/sourcegraph-scip-repo.md](./references/sourcegraph-scip-repo.md).
- Official indexer docs or indexer repos.
- Optional DeepWiki summaries only as navigation aid, not as final authority.

Do not rely on memory alone for field names, enum values, or CLI flags when the exact surface matters.

## DeepWiki Workflow

Use DeepWiki MCP to reduce repo spelunking time, especially when the user asks broad questions such as "how does SCIP represent X?" or "what part of the repo should I inspect?"

Recommended prompts:

- protocol shape: ask for `Index`, `Metadata`, `Document`, `Occurrence`, `SymbolInformation`, `Relationship`, `Package`, and symbol-string pitfalls
- CLI workflows: ask for `print`, `lint`, `snapshot`, `test`, `stats`, and `expt-convert`
- consumer implementation: ask for Go bindings, `ParseStreaming`, symbol parsing helpers, and range helpers
- development workflow: ask about `proto-generate`, snapshot tests, Reprolang, and where docs are kept in sync with code

Useful DeepWiki pages in `sourcegraph/scip`:

- `Overview`
- `Protocol Definition`
- `Data Model`
- `Symbol Structure and Representation`
- `Language Bindings`
- `CLI Commands`
- `Index Validation`
- `Reprolang Test Language`
- `Development Guide`

When answering, be explicit about which parts are:

- directly encoded in SCIP
- conventions used by indexers or the CLI
- inferred from DeepWiki summaries and then validated against repo files

## Task Router

Choose the narrowest path that fits the request.

### 1. Understand a `.scip` file

Primary surfaces:

- `Index.metadata`
- `Document.relative_path`, `language`, `position_encoding`, optional `text`
- `Occurrence.range`, `symbol`, `symbol_roles`, `diagnostics`, `enclosing_range`
- `SymbolInformation.symbol`, `kind`, `display_name`, `relationships`, `signature_documentation`
- `Index.external_symbols`

First questions to answer:

- What workspace root and tool produced this index?
- Which files are present, and is file text embedded?
- Are symbol roles populated correctly for definitions/imports/reads/writes?
- Are external references modeled in `external_symbols` or only by raw symbol strings?
- Is position encoding set in a way that matches the producer language?

### 2. Answer a schema question

Go straight to `scip.proto` and keep the answer field-accurate.

Important protocol facts to keep in view:

- `Index` is designed for streaming; `metadata` must come first.
- `Occurrence.range` is a compact `repeated int32`, not a nested message.
- `Occurrence.symbol_roles` is a bitset, not a single enum.
- `Document.position_encoding` controls interpretation of character offsets.
- `SymbolInformation.kind` is the better semantic kind source than descriptor suffix alone.
- Local symbols use the `local <id>` form and are document-scoped.

### 3. Build or debug a consumer

Prefer Go bindings when the user needs implementation guidance because they contain the richest helper layer.

Focus areas:

- streaming parse with `IndexVisitor` and `ParseStreaming`
- symbol helpers such as `ParseSymbol`, validation helpers, and local/global tests
- range helpers from `position.go` for containment, comparison, and conversion
- CLI code under `cmd/scip` as a concrete reference consumer

### 4. Debug a producer or CLI workflow

Use the CLI/documentation/testing path:

- `docs/CLI.md`
- `cmd/scip`
- `docs/Development.md`
- Reprolang-based tests and snapshot workflows

Useful workflow model:

1. generate an index
2. run `scip lint`
3. inspect with `scip print` or `scip print --json`
4. generate snapshots with `scip snapshot` when visual debugging helps
5. validate with `scip test` if annotated fixtures exist

### 5. Map SCIP into a graph or security system

Use SCIP as a structural substrate only.

Safe direct uses:

- repository/file/package/symbol inventory
- definitions and references
- implementation/type-definition relationships
- import-like structural edges
- candidate blast-radius and reachability prefiltering

Do not overclaim:

- taint/dataflow is not native SCIP
- runtime dispatch and execution reachability are not native SCIP
- policy, authz, infrastructure exposure, and exploitability require external layers

## Workflow

### Inspect an Existing Index

Use the least expensive path first:

- If `scip` CLI is installed, use `scip print`, `scip stats`, and `scip lint`.
- If `protoc` and `scip.proto` are available, decode with `protoc --decode=scip.Index`.
- If bindings are available, prefer Go bindings for robust consumers and streaming visitors.

Extract these facts before making claims:

- `Index.metadata`
- per-`Document` `relative_path`, `language`, and whether `text` is present
- per-`Document` `position_encoding`
- `Occurrence` roles, ranges, and enclosing context
- `SymbolInformation.kind`, `display_name`, relationships, and signatures
- whether referenced symbols are local or global
- whether `external_symbols` are populated

### Explain What SCIP Gives You

State the boundary clearly:

- SCIP gives structural, compiler-derived semantic relationships.
- SCIP does not natively give taint flow, runtime reachability, infra permissions, or security intent.
- Cross-repo precision depends on correct package identity and versioning.

When the user asks for security analysis, explicitly distinguish:

- recorded edges: definitions, references, implementations, imports
- derived edges: entry points, sinks, trust boundaries, package dependencies, candidate call paths
- non-SCIP layers: taint/dataflow, runtime telemetry, CVE enrichment, ownership, infra context

### Build a Graph Model

Use a minimal node and edge taxonomy unless the user needs more:

- Nodes: `REPOSITORY`, `FILE`, `SYMBOL`, `PACKAGE`
- Derived labels when needed: `ENTRY_POINT`, `SINK`, `TRUST_BOUNDARY`, security zones
- Edges from SCIP: `DEFINED_IN`, `REFERENCES`, `IMPLEMENTS`, `IMPORTS`
- Derived edges: `DEPENDS_ON`, `CROSSES_BOUNDARY`, candidate flow or reachability edges

Prefer deterministic derivations:

- infer zones from paths and ownership metadata
- infer package identity from parsed symbol strings
- infer entry points and sinks from path, kind, framework conventions, and curated allowlists
- treat any dataflow edge as derived and probabilistic unless another analyzer proves it

### Answer Security-Graph Questions

For security-oriented requests, read [references/security-graph-foundation.md](./references/security-graph-foundation.md) and keep these rules:

- Treat SCIP as the structural substrate for security questions, not the full security engine.
- Use it to narrow candidate paths and blast radius.
- Bring in CodeQL, Semgrep, Joern, runtime traces, or infra analysis only when the question requires semantics beyond structure.
- Call out blind spots instead of papering over them.

## Common Pitfalls

Watch for these errors before trusting an index or a downstream analysis:

- misreading `Occurrence.range` because line and character offsets are 0-based
- ignoring `Document.position_encoding`, which breaks multi-byte and UTF-16-based producers
- treating `symbol_roles` as a scalar enum instead of a bitset
- assuming descriptor suffix alone is the canonical symbol kind
- using local symbols as if they were cross-document stable identifiers
- forgetting that cross-repo precision depends on package identity and version quality
- assuming missing `external_symbols` means no external references exist
- mistaking snapshot/test fixtures for protocol semantics; they are validation tooling, not the schema

## Debugging Recipes

### Inspect structure quickly

Use:

```bash
scip stats --from index.scip
scip print --from index.scip
scip print --from index.scip --json
```

This is the fastest path for "what is in this file?" questions.

### Validate well-formedness

Use:

```bash
scip lint index.scip
```

`lint` is useful for catching duplicate documents, empty or non-canonical symbols, and broken relationships before writing custom debugging code.

### Decode with protobuf tooling

Use:

```bash
protoc --decode=scip.Index scip.proto < index.scip
```

Use this when the CLI is unavailable or when you need raw protobuf-level inspection.

### Explore testing semantics

If the problem is about expected roles, snapshots, or annotated fixtures, inspect:

- `cmd/scip/main.go`
- `cmd/scip/main_test.go`
- `bindings/go/scip/testutil`
- Reprolang-related files in the upstream repo

### Follow schema changes

If `scip.proto` changed, expect regeneration and documentation sync steps. In the upstream repo, `nix run .#proto-generate` regenerates bindings and generated docs. Generated files should not be edited manually.

## Practical Commands

Use concise commands and prefer non-destructive inspection:

```bash
scip print --from index.scip
scip print --from index.scip --json
scip stats --from index.scip
scip lint index.scip
protoc --decode=scip.Index scip.proto < index.scip
```

For repo inspection, start with:

```bash
rg --files
rg -n "message Index|message Metadata|message Document|message Occurrence|message SymbolInformation|message Relationship" scip.proto
rg -n "enum SymbolRole|enum PositionEncoding|message Package|message Symbol|message Descriptor" scip.proto
rg -n "scip print|scip lint|scip stats|scip snapshot|scip test|scip expt-convert" docs cmd
rg -n "ParseStreaming|IndexVisitor|ParseSymbol|ValidateSymbol|NewRangeUnchecked" bindings/go/scip
```

## References

Read only what the task needs:

- [references/sourcegraph-scip-repo.md](./references/sourcegraph-scip-repo.md) for canonical repo surfaces and where to look first.
- [references/security-graph-foundation.md](./references/security-graph-foundation.md) for the SCIP-to-security-graph mapping and the sharp limits of that approach.

If DeepWiki MCP is available, prefer `sourcegraph/scip` as the repo target for orientation because it exposes the protocol, bindings, CLI, testing workflow, and release/development docs in one place.
