# Test Cases: permission-view

## Summary

- **Total**: 45 cases
- **Automated** (unit/integration): 43
- **Manual**: 2
- **Priority**: must: 20, should: 24, could: 1

---

## C6 Two-Phase Dispatch

### TC-001: permission enabled triggers perm link validation, not blanket error

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: SUPPORTED_VIEW_TYPES SHALL gate C6 two-phase dispatch > Scenario: permission enabled triggers perm link validation, not blanket error

---

### TC-002: unsupported view type still produces C6 error

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: SUPPORTED_VIEW_TYPES SHALL gate C6 two-phase dispatch > Scenario: unsupported view type still produces C6 error

---

## C7 Prerequisites

### TC-003: permission enabled without domain triggers C7

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: LAYER_PREREQUISITES for permission SHALL be domain > Scenario: permission enabled without domain triggers C7

---

### TC-004: permission enabled with domain satisfies C7

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: LAYER_PREREQUISITES for permission SHALL be domain > Scenario: permission enabled with domain satisfies C7

---

## Structured Line Parsing

### TC-005: operation line parsed correctly

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: structured-lines SHALL recognize perm operation lines and target lines > Scenario: operation line parsed correctly

---

### TC-006: target line parsed correctly

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: structured-lines SHALL recognize perm operation lines and target lines > Scenario: target line parsed correctly

---

### TC-007: operation line inside code fence is ignored

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: structured-lines SHALL recognize perm operation lines and target lines > Scenario: operation line inside code fence is ignored

---

## C6 perm Validation

### TC-008: perm element with valid operations passes C6

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C6 perm validation SHALL enforce non-empty operations, uniqueness, and act prefix > Scenario: perm element with valid operations passes C6

---

### TC-009: perm element with zero operation lines fails C6

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C6 perm validation SHALL enforce non-empty operations, uniqueness, and act prefix > Scenario: perm element with zero operation lines fails C6

---

### TC-010: duplicate operation in same perm fails C6

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C6 perm validation SHALL enforce non-empty operations, uniqueness, and act prefix > Scenario: duplicate operation in same perm fails C6

---

### TC-011: operation line referencing non-act prefix fails C6

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C6 perm validation SHALL enforce non-empty operations, uniqueness, and act prefix > Scenario: operation line referencing non-act prefix fails C6

---

### TC-012: unresolved act reference is NOT reported by C6

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C6 perm validation SHALL enforce non-empty operations, uniqueness, and act prefix > Scenario: unresolved act reference is NOT reported by C6 (C3's responsibility)

---

## C11 Reference Direction

### TC-013: perm referencing act (domain) is allowed

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: C11 SHALL restrict views layer reference direction > Scenario: perm referencing act (domain) is allowed

---

### TC-014: perm referencing ent (domain) is allowed

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: C11 SHALL restrict views layer reference direction > Scenario: perm referencing ent (domain) is allowed

---

### TC-015: domain element referencing perm is forbidden

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C11 SHALL restrict views layer reference direction > Scenario: domain element referencing perm is forbidden

---

## getEnabledPrefixes

### TC-016: permission enabled includes perm in enabledPrefixes

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: getEnabledPrefixes SHALL include supported view type prefixes > Scenario: permission enabled includes perm in enabledPrefixes

---

### TC-017: unsupported view type does not add prefix

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: getEnabledPrefixes SHALL include supported view type prefixes > Scenario: unsupported view type does not add prefix

---

## export permissions CLI

### TC-018: valid permission design produces JSON

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: export permissions SHALL produce spec-compliant JSON > Scenario: valid permission design produces JSON

---

### TC-019: permission not enabled returns exit 1

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: export permissions SHALL produce spec-compliant JSON > Scenario: permission not enabled returns exit 1

---

### TC-020: design directory not found returns exit 2

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: export permissions SHALL produce spec-compliant JSON > Scenario: design directory not found returns exit 2

---

### TC-021: --out writes to file

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: export permissions SHALL produce spec-compliant JSON > Scenario: --out writes to file

---

## Degeneration

### TC-022: perm declaration with permission not enabled

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: perm declarations in non-enabled design SHALL degenerate silently > Scenario: perm declaration with permission not enabled

---

## Self-Hosting

### TC-023: aozu design/ self-check

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: aozu self-hosting check SHALL remain unchanged > Scenario: design/ self-check

---

## Parsing (Additional)

### TC-024: operation line with single actorId parsed correctly

**Category**: unit
**Priority**: should

**GIVEN** a file containing `- list: [[act-admin]]` (single actorId)
**WHEN** extractStructuredLines is invoked
**THEN** the result contains an operation entry with operation "list" and actorIds `["act-admin"]`

---

### TC-025: normal bullet not misidentified as operation line

**Category**: unit
**Priority**: should

**GIVEN** a file containing `- some descriptive text` (no colon-bracket pattern following a token)
**WHEN** extractStructuredLines is invoked
**THEN** no operation entry is produced for that line

---

### TC-026: target line inside code fence is ignored

**Category**: unit
**Priority**: should

**GIVEN** a file containing `対象: [[ent-deal]]` inside a fenced code block
**WHEN** extractStructuredLines is invoked
**THEN** no target entry is produced for that line

---

## SUPPORTED_VIEW_TYPES Constant

### TC-027: SUPPORTED_VIEW_TYPES contains permission but not screen

**Category**: unit
**Priority**: must

**GIVEN** the `SUPPORTED_VIEW_TYPES` constant exported from `src/check/manifest.ts`
**WHEN** `SUPPORTED_VIEW_TYPES.has("permission")` and `SUPPORTED_VIEW_TYPES.has("screen")` are evaluated
**THEN** `has("permission")` returns `true` and `has("screen")` returns `false`

---

## C6 perm Validation (Additional)

### TC-028: multiple perm elements in one file validated independently

**Category**: unit
**Priority**: should

**GIVEN** a single file containing two perm elements: `perm-a` with a valid operation line and `perm-b` with no operation lines, with permission enabled
**WHEN** checkC6 is invoked
**THEN** a C6 error is produced for `perm-b` only; no C6 error is produced for `perm-a`

---

### TC-029: permission + unsupported view type both enabled — mixed C6 behavior

**Category**: unit
**Priority**: should

**GIVEN** a manifest with `enabled: static, domain, permission, screen`
**WHEN** checkC6 is invoked
**THEN** C6 produces an "unsupported view type" error for "screen" and does not produce that error for "permission"

---

## C11 Reference Direction (Additional)

### TC-030: perm referencing another views-layer element is allowed

**Category**: unit
**Priority**: should

**GIVEN** a perm element containing a reference to another views-layer element (e.g., `[[uc-home]]`) with both domain and permission enabled
**WHEN** checkC11 is invoked
**THEN** no C11 diagnostic is produced

---

### TC-031: static element (mod) referencing perm is forbidden

**Category**: unit
**Priority**: should

**GIVEN** a mod element containing `[[perm-deal]]`, with both static and permission enabled
**WHEN** checkC11 is invoked
**THEN** a C11 error diagnostic is produced for that reference

---

### TC-032: dynamic element (seq) referencing perm is forbidden

**Category**: unit
**Priority**: should

**GIVEN** a seq element containing `[[perm-deal]]`, with both dynamic and permission enabled
**WHEN** checkC11 is invoked
**THEN** a C11 error diagnostic is produced for that reference

---

### TC-033: loop and adr element references remain unrestricted

**Category**: unit
**Priority**: should

**GIVEN** a loop or adr element referencing any other element (including perm)
**WHEN** checkC11 is invoked
**THEN** no C11 diagnostic is produced for the loop/adr reference (unlisted layers remain unrestricted)

---

## export permissions — JSON Ordering

### TC-034: permissions JSON permissions array is id ascending

**Category**: unit
**Priority**: should

**GIVEN** a graph with perm elements whose ids are `perm-z` and `perm-a`
**WHEN** generatePermissions is called
**THEN** the `permissions` array in the output JSON lists `perm-a` before `perm-z`

---

### TC-035: permissions JSON operations keys are lexicographically ordered

**Category**: unit
**Priority**: should

**GIVEN** a perm element with operations named "update", "list", and "create"
**WHEN** generatePermissions is called
**THEN** the keys of the `operations` object in the output JSON appear in order `"create"`, `"list"`, `"update"`

---

### TC-036: permissions JSON act arrays are id ascending

**Category**: unit
**Priority**: should

**GIVEN** a perm operation with actorIds `["act-member", "act-admin", "act-manager"]`
**WHEN** generatePermissions is called
**THEN** the `act` array in the output JSON is `["act-admin", "act-manager", "act-member"]`

---

### TC-037: target field absent when no 対象: line

**Category**: unit
**Priority**: should

**GIVEN** a perm element with no `対象:` line
**WHEN** generatePermissions is called
**THEN** the JSON entry for that perm element has no `"target"` key

---

### TC-038: target field present when 対象: line exists

**Category**: unit
**Priority**: should

**GIVEN** a perm element with `対象: [[ent-deal]]`
**WHEN** generatePermissions is called
**THEN** the JSON entry for that perm element contains `"target": "ent-deal"`

---

## export permissions — Independence from check

### TC-039: export permissions does not require check to pass

**Category**: integration
**Priority**: should

**GIVEN** a design with permission enabled but containing a C3 error (a perm operation references an act element that does not exist)
**WHEN** `export permissions` is invoked
**THEN** exit code 0 and valid JSON is written to stdout (check errors do not block export)

---

## C3 Reference Resolution for perm

### TC-040: C3 passes for existing act reference when permission enabled

**Category**: unit
**Priority**: should

**GIVEN** a design with permission enabled and a perm element that references an existing `act-admin` element in its operation line
**WHEN** checkC3 is invoked
**THEN** no C3 diagnostic is produced for the `act-admin` reference

---

### TC-041: C3 error for nonexistent act reference when permission enabled

**Category**: unit
**Priority**: should

**GIVEN** a design with permission enabled and a perm element that references `act-nonexistent` which has no declaration in the graph
**WHEN** checkC3 is invoked
**THEN** a C3 error diagnostic is produced for `act-nonexistent`

---

## Conformance Fixture

### TC-042: spec §8 conformance fixture checks clean

**Category**: integration
**Priority**: must

**GIVEN** a fixture matching the spec §8 example shape:
- manifest with `enabled: static, domain, permission`
- mod element, act elements (act-admin, act-manager, act-member, act-finance), ent element (ent-deal)
- perm element `perm-deal` with operations `list` and `create` (each referencing act elements) and `対象: [[ent-deal]]`
**WHEN** `runCheck(graph, manifest, [])` is invoked
**THEN** zero diagnostics are returned

---

## Build Verification

### TC-043: typecheck succeeds after all implementation changes

**Category**: manual
**Priority**: should

**GIVEN** all implementation changes applied (T-01 through T-14)
**WHEN** `tsc --noEmit` is run
**THEN** no TypeScript compilation errors are reported (exit code 0)

---

### TC-044: no new runtime dependencies introduced

**Category**: manual
**Priority**: could

**GIVEN** the completed implementation
**WHEN** the `dependencies` field in `package.json` is inspected
**THEN** `dependencies` remains `{}` (all implementation uses only existing packages)

---

### TC-045: export rules --verify unaffected by changes

**Category**: integration
**Priority**: should

**GIVEN** aozu's own `design/` directory and its `design/rules.json`
**WHEN** `export rules --verify` is run
**THEN** exit code 0 (the C11 and other changes introduce no regression in the rules export path)

---

## Result

```yaml
result: completed
total: 45
automated: 43
manual: 2
must: 20
should: 24
could: 1
blocked_reasons: []
```
