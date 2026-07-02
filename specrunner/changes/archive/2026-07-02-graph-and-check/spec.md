# Spec: graph-and-check

## Requirements

### Requirement: The graph module SHALL build an element table and reference index from ParseResult

The graph module SHALL accept a `ParseResult` and produce a `Graph` containing an `ElementTable` (Map of ID → Element), a `ReferenceIndex` (references indexed by source file and by target ID), dependency edges, actor IDs, element items, and parsed manifest. The graph builder SHALL be a pure function with no file I/O.

#### Scenario: Build graph from design/ parse result

**Given** the `design/` directory is parsed via `parseFiles`
**When** `buildGraph(parseResult)` is called
**Then** the returned `Graph` contains 25 entries in the element table, keyed by their IDs

#### Scenario: Reference index provides lookup by target ID

**Given** a parse result containing references to `mod-cli` from multiple files
**When** a graph is built
**Then** `graph.references.byTarget.get("mod-cli")` returns all references targeting `mod-cli`

### Requirement: The graph module SHALL resolve IDs

The graph module SHALL provide an `resolveId(id: string): Element | undefined` function that returns the element for a valid, declared ID, or `undefined` for unknown IDs.

#### Scenario: Resolve a known ID

**Given** a graph built from design/ containing `mod-parse`
**When** `resolveId("mod-parse")` is called
**Then** the returned Element has `id: "mod-parse"` and `prefix: "mod"`

#### Scenario: Resolve an unknown ID

**Given** a graph built from design/
**When** `resolveId("mod-nonexistent")` is called
**Then** `undefined` is returned

### Requirement: The check module SHALL parse manifest enabled list

The check module SHALL extract the `enabled` list from the manifest file's frontmatter and determine which layers (static, domain, dynamic, loop) and view types are active. The manifest file SHALL be identified by its path ending in `manifest.md`.

#### Scenario: Parse enabled list with three layers

**Given** a manifest with `enabled: static, domain, dynamic`
**When** the manifest is parsed
**Then** layers static, domain, and dynamic are active; loop is inactive

#### Scenario: Parse enabled list with static only

**Given** a manifest with `enabled: static`
**When** the manifest is parsed
**Then** only the static layer is active

### Requirement: C1 — All IDs SHALL conform to the ID grammar

The checker SHALL verify that every declared element ID matches the grammar `prefix "-" slug` with a known prefix. IDs that fail grammar validation SHALL produce an error diagnostic with code "C1".

#### Scenario: Invalid ID produces C1 diagnostic

**Given** a fixture with element `## Foo {#Mod-Parse}` (uppercase)
**When** check is run
**Then** a diagnostic with code "C1" is returned for the invalid ID

### Requirement: C2 — IDs SHALL be unique across the repository

The checker SHALL detect duplicate element IDs. Each duplicate SHALL produce an error diagnostic with code "C2".

#### Scenario: Duplicate ID produces C2 diagnostic

**Given** a fixture with two elements both declaring `{#mod-foo}`
**When** check is run
**Then** a diagnostic with code "C2" is returned indicating the duplicate

### Requirement: C3 — All references SHALL resolve to existing elements of enabled types

The checker SHALL verify that every `[[id]]` reference resolves to a declared element whose type belongs to an enabled layer. Unresolved references SHALL produce an error diagnostic with code "C3". References targeting elements of disabled types SHALL NOT produce C3 errors.

#### Scenario: Unresolved reference produces C3 diagnostic

**Given** a fixture with `[[mod-nonexistent]]` where no such element exists
**When** check is run
**Then** a diagnostic with code "C3" is returned

#### Scenario: Reference to disabled-type element is not a C3 error

**Given** a fixture with `enabled: static` and a reference `[[seq-foo]]` where seq-foo is declared
**When** check is run
**Then** no C3 diagnostic is produced for `[[seq-foo]]` because `dynamic` (seq's layer) is not enabled

### Requirement: C4 — Dependency edge endpoints SHALL resolve to mod elements

The checker SHALL verify that both endpoints of every dependency edge (`- [[a]] -> [[b]]`) resolve to elements with prefix `mod`. Non-mod endpoints or unresolved endpoints SHALL produce an error diagnostic with code "C4".

#### Scenario: Dependency edge with non-mod endpoint produces C4 diagnostic

**Given** a fixture with `- [[ent-order]] -> [[mod-cli]]`
**When** check is run
**Then** a diagnostic with code "C4" is returned for the non-mod endpoint `ent-order`

### Requirement: C5 — Sequence actor lists SHALL be non-empty and resolve to mod elements

The checker SHALL verify that every seq element's `## 登場要素` section contains at least one entry, and that all entries resolve to elements with prefix `mod`. Empty actor lists or non-mod actors SHALL produce an error diagnostic with code "C5".

#### Scenario: Empty actor list produces C5 diagnostic

**Given** a fixture with a seq element that has an empty `## 登場要素` section
**When** check is run
**Then** a diagnostic with code "C5" is returned

#### Scenario: Non-mod actor produces C5 diagnostic

**Given** a fixture with a seq element whose `## 登場要素` lists `[[ent-order]]`
**When** check is run
**Then** a diagnostic with code "C5" is returned for the non-mod actor

### Requirement: C6 — Unsupported view types SHALL produce a diagnostic

The checker SHALL detect view type identifiers in the `enabled` list. Because view type schemas are not yet defined, any view type in `enabled` SHALL produce an error diagnostic with code "C6" and message indicating "unsupported view type". If no view types are in `enabled`, C6 is trivially satisfied.

#### Scenario: View type in enabled produces C6 diagnostic

**Given** a fixture with `enabled: static, domain, use-case`
**When** check is run
**Then** a diagnostic with code "C6" is returned with message containing "unsupported view type"

#### Scenario: No view types in enabled produces no C6 diagnostic

**Given** a fixture with `enabled: static, domain, dynamic`
**When** check is run
**Then** no C6 diagnostic is produced

### Requirement: C7 — Manifest enabled combination SHALL satisfy type prerequisites

The checker SHALL verify that the `enabled` list satisfies type prerequisite relationships (e.g., loop requires static, dynamic requires static). Missing prerequisites SHALL produce an error diagnostic with code "C7".

#### Scenario: Loop without static produces C7 diagnostic

**Given** a fixture with `enabled: loop` (missing static)
**When** check is run
**Then** a diagnostic with code "C7" is returned indicating loop requires static

### Requirement: C8 — state.json keys SHALL resolve to existing elements (loop only)

The checker SHALL verify that all keys in state.json correspond to declared element IDs. Keys not matching any element SHALL produce an error diagnostic with code "C8". This rule SHALL only be evaluated when loop is enabled.

#### Scenario: Stale state.json key produces C8 diagnostic

**Given** a fixture with loop enabled and state.json containing key `ent-deleted` that does not exist as an element
**When** check is run
**Then** a diagnostic with code "C8" is returned for the stale key

#### Scenario: C8 is skipped when loop is disabled

**Given** a fixture with `enabled: static` and state.json containing stale keys
**When** check is run
**Then** no C8 diagnostic is produced

### Requirement: C9 — ADR elements SHALL reference at least one topic (loop only)

The checker SHALL verify that every `adr` element references at least one `top` element via `[[top-*]]`. ADR elements without topic references SHALL produce an error diagnostic with code "C9". This rule SHALL only be evaluated when loop is enabled.

#### Scenario: ADR without topic reference produces C9 diagnostic

**Given** a fixture with loop enabled and an adr element that references no top element
**When** check is run
**Then** a diagnostic with code "C9" is returned

### Requirement: C10 — Plan elements and groups SHALL reference existing elements (loop only)

The checker SHALL verify that all IDs in plan `elements:` lines resolve to existing elements, and all `after:` grp references resolve to existing grp elements. Unresolved references SHALL produce an error diagnostic with code "C10". This rule SHALL only be evaluated when loop is enabled.

#### Scenario: Plan with unresolved element produces C10 diagnostic

**Given** a fixture with loop enabled and a plan whose `elements:` line references `[[ent-nonexistent]]`
**When** check is run
**Then** a diagnostic with code "C10" is returned

### Requirement: C11 — Cross-layer references SHALL follow the allowed direction

The checker SHALL verify that elements only reference other elements within their allowed reference scope. Domain elements (term/ent/inv) SHALL only reference domain elements. Static elements (mod) SHALL only reference static and domain elements. Dynamic elements (seq) SHALL only reference dynamic, static, and domain elements. Loop (top/plan/grp) and adr elements have no restriction. Violations SHALL produce an error diagnostic with code "C11".

#### Scenario: Domain element referencing a mod produces C11 diagnostic

**Given** a fixture where `domain/glossary.md` contains a term element that references `[[mod-cli]]`
**When** check is run
**Then** a diagnostic with code "C11" is returned

#### Scenario: Static element referencing a domain element is allowed

**Given** a fixture where `static/modules.md` contains a mod element that references `[[ent-order]]`
**When** check is run
**Then** no C11 diagnostic is produced for that reference

#### Scenario: Dynamic element referencing static is allowed

**Given** a fixture where a seq element references `[[mod-cli]]`
**When** check is run
**Then** no C11 diagnostic is produced for that reference

### Requirement: The checker SHALL apply graceful degradation based on manifest enabled

The checker SHALL skip rules for disabled layers. When only `enabled: static` is set, rules specific to domain, dynamic, and loop layers SHALL NOT be evaluated. Elements of disabled types SHALL NOT produce obligation violations.

#### Scenario: Static-only manifest skips domain/dynamic/loop rules

**Given** a fixture with `enabled: static` and elements only in `static/`
**When** check is run
**Then** no diagnostics for C5 (dynamic), C8/C9/C10 (loop) are produced
**And** C4 (static dependency edges) is evaluated

### Requirement: design/ SHALL pass check with zero violations

Running check against the `design/` directory with its manifest SHALL produce zero error diagnostics, confirming that aozu's self-description is a valid closure.

#### Scenario: design/ self-check

**Given** the `design/` directory with `enabled: static, domain, dynamic`
**When** check is run against design/
**Then** zero error diagnostics are returned

### Requirement: The check module SHALL be a pure function with no file I/O

The check module's public API SHALL accept a `Graph` (or `ParseResult` + manifest) and optional state keys, and return a `CheckDiagnostic[]`. The module SHALL NOT perform any file system operations.

#### Scenario: Check accepts in-memory input

**Given** a `Graph` built from in-memory parse data
**When** `runCheck(graph, manifest)` is called
**Then** the result is returned without any file system access

### Requirement: ParseResult SHALL include actorIds and elementItems

The `ParseResult` type SHALL be extended with `actorIds` (seq actor list entries) and `elementItems` (plan element list entries) fields. The `parseFiles` function SHALL populate these fields from `extractStructuredLines` results.

#### Scenario: ParseResult includes actorIds from seq documents

**Given** design/ containing seq documents with `## 登場要素` sections
**When** files are parsed
**Then** `parseResult.actorIds` contains entries for each `- [[id]]` in actor sections

### Requirement: package.json dependencies SHALL remain empty

The `dependencies` field in `package.json` SHALL remain `{}` (empty object), enforcing the zero runtime dependency policy.

#### Scenario: Verify dependencies field unchanged

**Given** the `package.json` file after implementation
**When** the file is read
**Then** the `dependencies` field is `{}`

### Requirement: Type checking and all tests SHALL pass

`tsc --noEmit` and `bun test` SHALL both complete successfully with zero failures. All existing tests SHALL continue to pass without modification.

#### Scenario: Full verification

**Given** the complete project with all new and existing source files and tests
**When** `tsc --noEmit && bun test` is executed
**Then** both commands exit with status 0
