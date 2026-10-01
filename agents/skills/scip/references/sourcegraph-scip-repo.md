# Sourcegraph SCIP Repo

## Use This Reference For

- locating the canonical upstream sources for protocol details
- grounding claims about CLI commands and repo structure
- finding the right file before reading a large section of the repo

## Primary Surfaces

- `README.md`
  Explains what SCIP is, what ships in the repo, and the supported tooling surface.
- `scip.proto`
  Canonical protocol schema. Use this for exact field names, message layout, and enums.
- `docs/Development.md`
  Best starting point for debugging, project structure, and generation workflows.
- `docs/CLI.md`
  CLI surface for `print`, `lint`, `stats`, `snapshot`, `test`, and `expt-convert`.
- `bindings/go/scip/`
  Best consumer implementation reference. Use this when building readers, parsers, or visitors.
- `cmd/scip/`
  Ground truth for actual CLI behavior if docs and examples diverge.

## Repo Facts To Reuse

- The official repo is `https://github.com/scip-code/scip`.
- The repo README describes SCIP as a language-agnostic protocol for indexing source code and powering navigation such as definitions, references, and implementations.
- The repo contains the protobuf schema, bindings, and the `scip` CLI in one place.
- `docs/Development.md` shows the basic debugging path:
  `scip print /path/to/index.scip`
  `protoc --decode=scip.Index -I /path/to/scip scip.proto < index.scip`

## Reading Order By Task

### Protocol Accuracy

1. `scip.proto`
2. `bindings/go/scip/`
3. `README.md`

### CLI Behavior

1. `docs/CLI.md`
2. `cmd/scip/`
3. `docs/Development.md`

### Consumer or Ingest Pipeline

1. `scip.proto`
2. `bindings/go/scip/`
3. `docs/Development.md`

### Security or Graph Framing

1. `scip.proto`
2. `README.md`
3. `docs/Development.md`
4. local design notes or the security-graph reference in this skill

## Cautions

- Do not overstate SCIP as a taint-analysis or runtime-analysis system.
- Do not infer exact CLI flags from memory when the docs or command source are available.
- Do not assume external symbol metadata is complete just because an occurrence points at an external symbol.
- Do not treat all cross-repo resolution problems as protocol failures; many are package naming or versioning mismatches.

## Optional DeepWiki Use

If a `deepwiki` MCP server is configured, use it for fast orientation on the upstream repo, then verify exact details against the repo itself. Treat DeepWiki as secondary.
