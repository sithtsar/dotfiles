# SCIP As a Security Graph Foundation

## Use This Reference For

- explaining SCIP through a security lens
- designing a graph ingest layer on top of SCIP
- answering whether SCIP is enough for security analysis by itself

## Core Position

SCIP is not a security tool. It is a high-fidelity structural map of code derived from language tooling. That makes it a strong foundation for a security knowledge graph, because most security questions start with structure:

- where input enters
- which symbols reference which other symbols
- which concrete implementations satisfy a sensitive abstraction
- which packages and files participate in a reachable path

## What SCIP Gives You Directly

- `Document.relative_path`
  Good for file identity and coarse security-zone classification.
- `Occurrence`
  Core location-plus-symbol record for definitions, references, imports, and read/write roles.
- `SymbolInformation`
  Metadata about defined symbols, including kind, display name, docs, signatures, and relationships.
- `Relationship.is_implementation`
  High-value signal for enumerating concrete implementations of security-sensitive interfaces.
- global symbol strings
  Stable identities for cross-file and cross-repo joins when package identity is correct.

## Useful Graph Mapping

### Core Nodes

- `REPOSITORY`
- `FILE`
- `SYMBOL`
- `PACKAGE`

### Derived Labels

- `ENTRY_POINT`
- `SINK`
- `TRUST_BOUNDARY`
- security-zone labels such as `auth`, `crypto`, `external_input`, `persistence`

### Core Edges From SCIP

- `DEFINED_IN`
- `REFERENCES`
- `IMPLEMENTS`
- `IMPORTS`

### Derived Edges

- `DEPENDS_ON`
- `CROSSES_BOUNDARY`
- candidate reachability or flow edges

## What Must Be Derived Or Added

- entry-point detection
  Usually from framework conventions, path patterns, decorators, or annotations.
- sink detection
  Usually from curated symbol allowlists.
- trust boundaries
  Usually from file zones, service ownership, or deployment metadata.
- package risk or CVE state
  Usually from OSV, NVD, or internal inventory.

## What SCIP Does Not Give You

- taint flow
  SCIP does not prove that a value passed into one function reaches a sink unchanged or unsanitized.
- runtime reachability
  SCIP does not know which path is actually executed in production.
- security intent
  SCIP does not know that a symbol is auth-sensitive unless you add that ontology.
- infrastructure permissions
  SCIP does not encode IAM, RBAC, network policy, or secret policy.

## Recommended Positioning

When asked to design a security system on top of SCIP, describe it as:

- structural substrate from SCIP
- semantic or security labels from custom classifiers
- dataflow from CodeQL, Semgrep, Joern, or another analyzer
- runtime confidence from traces or production telemetry
- supply-chain enrichment from dependency and CVE data

## Common Mistakes

- claiming SCIP already contains a complete call graph in the security-analysis sense
- treating `REFERENCES` as proven exploitable reachability
- skipping version discipline for cross-repo symbol resolution
- ignoring local symbols and scope when mapping references back to callers
- failing to separate recorded facts from heuristics and derived labels

## Good Answer Pattern

When answering a security question with SCIP:

1. state the exact SCIP facts available
2. state the derivations you can make confidently
3. name the missing layers
4. suggest the next analyzer only if the missing layer matters
