# Spec: actor-type-support

## Requirements

### Requirement: KNOWN_PREFIXES SHALL include act

The ID grammar validation SHALL recognize `act` as a known prefix. IDs of the form `act-<slug>` SHALL pass `validateId` without errors.

#### Scenario: act prefix is valid

**Given** the ID `act-approver`
**When** `validateId("act-approver")` is called
**Then** the result is `{ valid: true }`

#### Scenario: act prefix appears in KNOWN_PREFIXES

**Given** the `KNOWN_PREFIXES` set
**When** its contents are inspected
**Then** `"act"` is a member of the set

### Requirement: act SHALL belong to the domain layer in LAYER_MAP

The type table (`LAYER_MAP`) SHALL map the `act` prefix to the `"domain"` layer. This mapping SHALL be consistent with `LAYER_TO_PREFIXES.domain` which SHALL include `"act"`.

#### Scenario: LAYER_MAP maps act to domain

**Given** the `LAYER_MAP` constant
**When** `LAYER_MAP["act"]` is accessed
**Then** the value is `"domain"`

#### Scenario: LAYER_TO_PREFIXES.domain includes act

**Given** the `LAYER_TO_PREFIXES` constant
**When** the `domain` entry is inspected
**Then** `"act"` is included in the array

### Requirement: C5 SHALL accept mod or act as seq actor prefixes

The C5 rule SHALL verify that seq actor lists are non-empty and that all entries resolve to elements with prefix `mod` or `act`. Actors with any other prefix (e.g., `ent`, `term`) SHALL produce a C5 error diagnostic.

#### Scenario: seq with act-only actors passes C5

**Given** a seq element whose `## 登場要素` section lists `[[act-approver]]`
**When** C5 check is run
**Then** no C5 diagnostic is produced

#### Scenario: seq with mixed mod and act actors passes C5

**Given** a seq element whose `## 登場要素` section lists `[[mod-cli]]` and `[[act-operator]]`
**When** C5 check is run
**Then** no C5 diagnostic is produced

#### Scenario: seq with ent actor fails C5

**Given** a seq element whose `## 登場要素` section lists `[[ent-order]]`
**When** C5 check is run
**Then** a C5 error diagnostic is produced indicating that `ent-order` is not a mod or act element

### Requirement: C11 SHALL allow references to act from domain, static, and dynamic layers

The `LAYER_ALLOWED_TARGET_PREFIXES` table SHALL include `"act"` in the allowed target sets for `domain`, `static`, and `dynamic` layers. This ensures:
- domain elements (term/ent/inv/act) MAY reference act elements
- static elements (mod) MAY reference act elements
- dynamic elements (seq) MAY reference act elements

Act elements, being domain-layer, SHALL only reference other domain elements (term/ent/inv/act). An act element referencing a mod element SHALL produce a C11 error.

#### Scenario: domain element references act — allowed

**Given** a term element that references `[[act-approver]]`
**When** C11 check is run
**Then** no C11 diagnostic is produced

#### Scenario: mod element references act — allowed

**Given** a mod element that references `[[act-approver]]`
**When** C11 check is run
**Then** no C11 diagnostic is produced

#### Scenario: seq element references act — allowed

**Given** a seq element that references `[[act-operator]]`
**When** C11 check is run
**Then** no C11 diagnostic is produced

#### Scenario: act element references mod — rejected

**Given** an act element that references `[[mod-cli]]`
**When** C11 check is run
**Then** a C11 error diagnostic is produced indicating domain elements cannot reference static elements

### Requirement: Unresolved act references SHALL be detected by C3

When domain is enabled, a reference to a non-existent `act-*` element SHALL produce a C3 error diagnostic, consistent with unresolved references to other enabled-type elements.

#### Scenario: reference to non-existent act element produces C3

**Given** a mod element that references `[[act-nonexistent]]` where no `act-nonexistent` element exists
**When** C3 check is run with domain enabled
**Then** a C3 error diagnostic is produced for the unresolved reference

### Requirement: act references SHALL be silenced by graceful degradation when domain is disabled

When the manifest does not include `domain` in its enabled list, references to `act-*` elements SHALL NOT produce C3 or C5 diagnostics. The graceful degradation mechanism (getEnabledPrefixes) SHALL exclude `act` from the enabled prefix set when domain is disabled.

#### Scenario: act reference with domain disabled produces no C3

**Given** a manifest with `enabled: static` (domain not enabled) and a reference to `[[act-approver]]`
**When** check is run
**Then** no C3 diagnostic is produced for the act reference

### Requirement: Existing tests SHALL pass without modification

All 310 existing tests SHALL continue to pass without any changes. The `tsc --noEmit` and `bun test` commands SHALL exit with status 0. The `dependencies` field in `package.json` SHALL remain empty. The `export rules --verify` command SHALL exit 0.

#### Scenario: Full verification

**Given** the complete project with all changes applied
**When** `tsc --noEmit && bun test` is executed
**Then** both commands exit with status 0 and all tests pass
