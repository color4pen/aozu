# Test Cases: export operations

## Summary

- **Total**: 22 cases
- **Automated** (unit/integration): 18
- **Manual**: 0
- **Priority**: must: 17, should: 5, could: 0

---

### TC-001: op with target and implementation produces correct JSON

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: export operations SHALL produce spec §11 operations JSON > Scenario: op with target and implementation

---

### TC-002: op without target or implementation outputs id and name only

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: export operations SHALL produce spec §11 operations JSON > Scenario: op without target or implementation

---

### TC-003: target present but implementation absent omits implementation key

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: target and implementation keys SHALL be omitted when absent > Scenario: target present but implementation absent

---

### TC-004: implementation present but target absent omits target key

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: target and implementation keys SHALL be omitted when absent > Scenario: implementation present but target absent

---

### TC-005: multiple ops sorted by id ascending regardless of declaration order

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: operations SHALL be sorted by id ascending > Scenario: multiple ops in non-alphabetical declaration order

---

### TC-006: repeated runs on same input produce byte-identical output

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: operations SHALL be sorted by id ascending > Scenario: deterministic output on repeated runs

---

### TC-007: multiple targets in 対象: line preserved in declaration order

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: target array SHALL preserve declaration order > Scenario: multiple targets in declaration order

---

### TC-008: multiple 実装: lines merged in line-number order

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: implementation array SHALL preserve declaration order > Scenario: multiple implementation lines

---

### TC-009: domain not in enabled list causes exit 1

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: domain not enabled SHALL cause exit 1 > Scenario: domain not in enabled list

---

### TC-010: domain enabled with no op elements produces empty list and exit 0

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: domain enabled with zero ops SHALL produce empty list with exit 0 > Scenario: domain enabled but no op elements

---

### TC-011: --out writes JSON to file and suppresses stdout

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: --out option SHALL write to file > Scenario: --out writes to file

---

### TC-012: --out without path argument causes exit 2

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: --out option SHALL write to file > Scenario: --out without path argument

---

### TC-013: export rules existing tests remain green

**Category**: gate
**Priority**: must
**Source**: spec.md > Requirement: existing export subcommands SHALL remain unchanged > Scenario: export rules unchanged

verification phase: verification (`bun test`)

---

### TC-014: export permissions existing tests remain green

**Category**: gate
**Priority**: must
**Source**: spec.md > Requirement: existing export subcommands SHALL remain unchanged > Scenario: export permissions unchanged

verification phase: verification (`bun test`)

---

### TC-015: generateOperations is a pure function with no file I/O

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01 Acceptance Criteria

**GIVEN** a graph containing op elements with target and implementation lines
**WHEN** `generateOperations(graph)` is called
**THEN** the function returns `{ json: string }` without performing any file system reads or writes, and calling it twice with the same graph argument returns structurally identical output

---

### TC-016: JSON output ends with a trailing newline

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04

**GIVEN** any graph (empty or with op elements)
**WHEN** `generateOperations(graph)` is called
**THEN** the returned `json` string ends with `"\n"`

---

### TC-017: JSON output is syntactically valid JSON

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04

**GIVEN** any graph (empty or with op elements)
**WHEN** `generateOperations(graph)` is called and `JSON.parse(json)` is invoked on the result
**THEN** no exception is thrown and the parsed value has `format-version: 0` and an `operations` array

---

### TC-018: empty graph at unit level returns operations: []

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04

**GIVEN** an empty graph (no elements, no targetLines, no implementations)
**WHEN** `generateOperations(graph)` is called
**THEN** the returned json parses to `{ "format-version": 0, "operations": [] }`

---

### TC-019: generateOperations is accessible via src/export/index.ts re-export

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** `src/export/index.ts` includes `export { generateOperations } from "./operations.ts"`
**WHEN** `import { generateOperations } from "../export/index.ts"` is used in a consumer module
**THEN** the import resolves without TypeScript error and the function is callable

---

### TC-020: multiple paths within a single 実装: line are preserved in declaration order

**Category**: unit
**Priority**: should
**Source**: design.md > D4

**GIVEN** an op element with a single `実装:` line that declares two comma-separated paths `src/a.ts, src/b.ts`
**WHEN** `generateOperations(graph)` is called
**THEN** `implementation` is `["src/a.ts", "src/b.ts"]` in the order they appear on the line (not sorted alphabetically)

---

### TC-021: TypeScript type check passes with no errors

**Category**: gate
**Priority**: must
**Source**: tasks.md > T-06

verification phase: verification (`bunx tsc --noEmit`)

---

### TC-022: full test suite green including all existing tests

**Category**: gate
**Priority**: must
**Source**: tasks.md > T-06

verification phase: verification (`bun test`)

---

## Result

```yaml
result: completed
total: 22
automated: 18
manual: 0
must: 17
should: 5
could: 0
blocked_reasons: []
```
