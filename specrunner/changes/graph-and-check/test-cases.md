# Test Cases: graph-and-check

## Summary

- **Total**: 52 cases
- **Automated** (unit/integration): 51
- **Manual**: 1
- **Priority**: must: 29, should: 23, could: 0

---

## Graph Module — Build & Resolve

### TC-001: Build graph from design/ produces 25-element table

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The graph module SHALL build an element table and reference index from ParseResult > Scenario: Build graph from design/ parse result

---

### TC-002: Reference index provides byTarget lookup

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: The graph module SHALL build an element table and reference index from ParseResult > Scenario: Reference index provides lookup by target ID

---

### TC-003: Resolve a known ID returns the element

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: The graph module SHALL resolve IDs > Scenario: Resolve a known ID

---

### TC-004: Resolve an unknown ID returns undefined

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: The graph module SHALL resolve IDs > Scenario: Resolve an unknown ID

---

### TC-030: Empty ParseResult produces empty Graph

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** a ParseResult with empty `elements`, `references`, `dependencyEdges`, `actorIds`, and `elementItems`
**WHEN** `buildGraph` is called with this ParseResult
**THEN** the returned Graph has an empty ElementTable (size 0), an empty rawElements array, and a ReferenceIndex with empty bySource/byTarget/all

---

## Manifest Parsing

### TC-005: Parse enabled list with three layers

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: The check module SHALL parse manifest enabled list > Scenario: Parse enabled list with three layers

---

### TC-006: Parse enabled list with static only

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: The check module SHALL parse manifest enabled list > Scenario: Parse enabled list with static only

---

### TC-031: getEnabledPrefixes returns correct prefix sets per layer

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05

**GIVEN** a manifest with `enabled: static, domain, dynamic`
**WHEN** `getEnabledPrefixes` is called
**THEN** the returned Set contains `mod` (static), `term`, `ent`, `inv` (domain), `seq` (dynamic), and `adr` (always), and does not contain any view type prefix

---

### TC-032: getEnabledPrefixes excludes view type prefixes

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05; design.md > D3

**GIVEN** a manifest with `enabled: static, use-case`
**WHEN** `getEnabledPrefixes` is called
**THEN** the returned Set does NOT contain `uc` or any other view prefix, because view types are not yet supported and must not be silently resolved

---

## C1 — ID Grammar

### TC-007: Invalid ID produces C1 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C1 — All IDs SHALL conform to the ID grammar > Scenario: Invalid ID produces C1 diagnostic

---

### TC-033: Valid IDs produce no C1 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-06

**GIVEN** a Graph where all element IDs match the pattern `prefix "-" slug` with a known prefix
**WHEN** `checkC1` is called
**THEN** no C1 diagnostics are returned

---

### TC-034: Unknown prefix in ID produces C1 diagnostic

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** a Graph containing an element with ID `xyz-foo` where `xyz` is not a known prefix
**WHEN** `checkC1` is called
**THEN** a diagnostic with code `C1` is returned for that element

---

## C2 — ID Uniqueness

### TC-008: Duplicate ID produces C2 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C2 — IDs SHALL be unique across the repository > Scenario: Duplicate ID produces C2 diagnostic

---

### TC-035: Unique IDs produce no C2 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-07

**GIVEN** a Graph whose rawElements array contains no duplicate IDs
**WHEN** `checkC2` is called
**THEN** no C2 diagnostics are returned

---

## C3 — Reference Resolution

### TC-009: Unresolved reference produces C3 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C3 — All references SHALL resolve to existing elements of enabled types > Scenario: Unresolved reference produces C3 diagnostic

---

### TC-010: Reference to disabled-type element is not a C3 error

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C3 — All references SHALL resolve to existing elements of enabled types > Scenario: Reference to disabled-type element is not a C3 error

---

### TC-036: Disabled-layer source element's unresolved reference produces no C3 diagnostic

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-08; design.md > D6

**GIVEN** a manifest with `enabled: static` and a ParseResult containing a `seq` element (dynamic layer, disabled) that references a non-existent `mod` element
**WHEN** `checkC3` is called with enabledPrefixes derived from static-only manifest
**THEN** no C3 diagnostic is produced, because the referencing element belongs to a disabled layer

---

## C4 — Dependency Edge Endpoints

### TC-011: Dependency edge with non-mod endpoint produces C4 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C4 — Dependency edge endpoints SHALL resolve to mod elements > Scenario: Dependency edge with non-mod endpoint produces C4 diagnostic

---

### TC-037: Both mod endpoints in dependency edge produce no C4 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-09

**GIVEN** a Graph with dependency edges where both `from` and `to` IDs resolve to `mod` elements in the ElementTable
**WHEN** `checkC4` is called
**THEN** no C4 diagnostics are returned

---

### TC-038: Unresolved dependency edge endpoint produces C4 diagnostic

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-09

**GIVEN** a Graph with a dependency edge where one endpoint ID does not exist in the ElementTable
**WHEN** `checkC4` is called
**THEN** a diagnostic with code `C4` is returned for the unresolved endpoint

---

## C5 — Sequence Actor Lists

### TC-012: Empty actor list produces C5 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C5 — Sequence actor lists SHALL be non-empty and resolve to mod elements > Scenario: Empty actor list produces C5 diagnostic

---

### TC-013: Non-mod actor produces C5 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C5 — Sequence actor lists SHALL be non-empty and resolve to mod elements > Scenario: Non-mod actor produces C5 diagnostic

---

### TC-039: Valid seq with all mod actors produces no C5 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-10

**GIVEN** a Graph with a seq element whose associated actorIds all resolve to `mod` elements
**WHEN** `checkC5` is called
**THEN** no C5 diagnostics are returned

---

## C6 — View Link Obligation (fail-closed)

### TC-014: View type in enabled produces C6 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C6 — Unsupported view types SHALL produce a diagnostic > Scenario: View type in enabled produces C6 diagnostic

---

### TC-015: No view types in enabled produces no C6 diagnostic

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: C6 — Unsupported view types SHALL produce a diagnostic > Scenario: No view types in enabled produces no C6 diagnostic

---

### TC-040: Multiple view types in enabled produce separate C6 diagnostics

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-11

**GIVEN** a manifest with `enabled: static, use-case, screen`
**WHEN** `checkC6` is called
**THEN** two C6 diagnostics are returned, one for `use-case` and one for `screen`, each with a message containing "unsupported view type"

---

## C7 — Manifest Prerequisites

### TC-016: Loop without static produces C7 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C7 — Manifest enabled combination SHALL satisfy type prerequisites > Scenario: Loop without static produces C7 diagnostic

---

### TC-041: Dynamic without static produces C7 diagnostic

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-12

**GIVEN** a manifest with `enabled: dynamic` (static is absent)
**WHEN** `checkC7` is called
**THEN** a diagnostic with code `C7` is returned indicating that `dynamic` requires `static`

---

### TC-042: Domain without static produces C7 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-12

**GIVEN** a manifest with `enabled: domain` (static is absent)
**WHEN** `checkC7` is called
**THEN** a diagnostic with code `C7` is returned indicating that `domain` requires `static`

---

### TC-043: Enabled combination that satisfies all prerequisites produces no C7 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-12

**GIVEN** a manifest with `enabled: static, domain, dynamic` where all prerequisites are satisfied
**WHEN** `checkC7` is called
**THEN** no C7 diagnostics are returned

---

## C8 — state.json Key Validation (loop only)

### TC-017: Stale state.json key produces C8 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C8 — state.json keys SHALL resolve to existing elements (loop only) > Scenario: Stale state.json key produces C8 diagnostic

---

### TC-018: C8 is skipped when loop is disabled

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C8 — state.json keys SHALL resolve to existing elements (loop only) > Scenario: C8 is skipped when loop is disabled

---

### TC-044: All stateKeys resolve to existing elements produce no C8 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-13

**GIVEN** a Graph containing elements `mod-foo` and `mod-bar`, and `stateKeys = ["mod-foo", "mod-bar"]`
**WHEN** `checkC8` is called
**THEN** no C8 diagnostics are returned

---

### TC-045: Empty stateKeys produce no C8 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-13

**GIVEN** a Graph and an empty `stateKeys` array (`[]`)
**WHEN** `checkC8` is called
**THEN** no C8 diagnostics are returned (no keys to validate)

---

## C9 — ADR Topic References (loop only)

### TC-019: ADR without topic reference produces C9 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C9 — ADR elements SHALL reference at least one topic (loop only) > Scenario: ADR without topic reference produces C9 diagnostic

---

### TC-046: ADR with top reference produces no C9 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-14

**GIVEN** a Graph with an `adr` element that has at least one `[[top-*]]` reference in its file's references
**WHEN** `checkC9` is called
**THEN** no C9 diagnostics are returned

---

## C10 — Plan Element References (loop only)

### TC-020: Plan with unresolved element produces C10 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C10 — Plan elements and groups SHALL reference existing elements (loop only) > Scenario: Plan with unresolved element produces C10 diagnostic

---

### TC-047: Resolved plan elements produce no C10 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-15

**GIVEN** a Graph with a plan element where all `elementItems` IDs resolve to existing entries in the ElementTable
**WHEN** `checkC10` is called
**THEN** no C10 diagnostics are returned

---

## C11 — Cross-Layer Reference Direction

### TC-021: Domain element referencing a mod produces C11 diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C11 — Cross-layer references SHALL follow the allowed direction > Scenario: Domain element referencing a mod produces C11 diagnostic

---

### TC-022: Static element referencing a domain element is allowed

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: C11 — Cross-layer references SHALL follow the allowed direction > Scenario: Static element referencing a domain element is allowed

---

### TC-023: Dynamic element referencing static is allowed

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: C11 — Cross-layer references SHALL follow the allowed direction > Scenario: Dynamic element referencing static is allowed

---

### TC-048: Static element referencing a seq element produces C11 diagnostic

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-16; design.md > D7

**GIVEN** a Graph where a `mod` element (static layer) has a reference to a `seq` element, with both prefixes in enabledPrefixes
**WHEN** `checkC11` is called
**THEN** a diagnostic with code `C11` is returned, because static elements may not reference dynamic elements

---

### TC-049: Dynamic element referencing static and domain elements produces no C11 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-16

**GIVEN** a Graph where a `seq` element references both a `mod` element and an `ent` element
**WHEN** `checkC11` is called
**THEN** no C11 diagnostics are returned (seq can reference static and domain layers)

---

### TC-050: adr element referencing any prefix produces no C11 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-16

**GIVEN** a Graph where an `adr` element references `mod`, `ent`, and `seq` elements
**WHEN** `checkC11` is called
**THEN** no C11 diagnostics are returned (adr elements have no cross-layer restriction)

---

## Checker Aggregation

### TC-051: Multiple rule violations are all reported without fail-fast

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-17; design.md > D4

**GIVEN** a Graph with elements having an invalid ID (C1 violation), a duplicate ID (C2 violation), and an unresolved reference (C3 violation)
**WHEN** `runCheck` is called
**THEN** all three violations are present in the returned diagnostic array (no fail-fast; all rules evaluated regardless of prior violations)

---

## Graceful Degradation

### TC-024: Static-only manifest skips domain/dynamic/loop rules

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The checker SHALL apply graceful degradation based on manifest enabled > Scenario: Static-only manifest skips domain/dynamic/loop rules

---

## design/ Self-Check

### TC-025: design/ produces zero error diagnostics

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: design/ SHALL pass check with zero violations > Scenario: design/ self-check

---

## Pure Function Property

### TC-026: Check accepts in-memory input with no file I/O

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: The check module SHALL be a pure function with no file I/O > Scenario: Check accepts in-memory input

---

## ParseResult Extension

### TC-027: ParseResult includes actorIds from seq documents

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: ParseResult SHALL include actorIds and elementItems > Scenario: ParseResult includes actorIds from seq documents

---

## Zero Runtime Dependencies

### TC-028: package.json dependencies field remains empty

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: package.json dependencies SHALL remain empty > Scenario: Verify dependencies field unchanged

---

## Final Verification

### TC-029: tsc --noEmit && bun test both pass with exit 0

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Type checking and all tests SHALL pass > Scenario: Full verification

---

### TC-052: tools/check.sh output is unchanged after implementation

**Category**: manual
**Priority**: should
**Source**: tasks.md > T-21

**GIVEN** the implementation is complete and all source files have been added
**WHEN** `bash tools/check.sh design` is executed
**THEN** the output shows `OK: 宣言 25 要素 / 参照 15 種` (identical to pre-implementation behavior, confirming the bash script is unaffected)

---

## Result

```yaml
result: completed
total: 52
automated: 51
manual: 1
must: 29
should: 23
could: 0
blocked_reasons: []
```
