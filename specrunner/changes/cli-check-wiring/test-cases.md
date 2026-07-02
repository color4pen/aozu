# Test Cases: cli-check-wiring

## Summary

- **Total**: 34 cases
- **Automated** (unit/integration): 31
- **Manual**: 3
- **Priority**: must: 19, should: 14, could: 1

---

## Unit Tests

### TC-001: readState - state.json absent returns empty StateMap

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: state.json reader SHALL return an empty map when the file is absent > Scenario: state.json absent

---

### TC-002: readState - state.json present returns StateMap entries

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: state.json reader SHALL return an empty map when the file is absent > Scenario: state.json present

---

### TC-003: readState - state.json is empty object `{}` returns empty StateMap

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01

**GIVEN** a `state.json` file whose contents are `{}`
**WHEN** `readState(path)` is called
**THEN** an empty `StateMap` is returned

---

### TC-004: formatDiagnostic returns contract-format string

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** a `CheckDiagnostic` with `level: "error"`, `code: "C01"`, `elementId: "mod-parse"`, `message: "unresolved reference"`, `file: "design/modules.md"`, `line: 5`
**WHEN** `formatDiagnostic(d)` is called
**THEN** the returned string is `"ERROR C01 mod-parse unresolved reference (design/modules.md:5)"`

---

### TC-005: formatDiagnostic - null elementId renders as "-"

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** a `CheckDiagnostic` with `elementId` set to `null` or `undefined`
**WHEN** `formatDiagnostic(d)` is called
**THEN** the element ID field in the output string is `"-"`

---

### TC-006: formatDiagnostic - level is uppercased

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** a `CheckDiagnostic` with `level: "warning"`
**WHEN** `formatDiagnostic(d)` is called
**THEN** the output string contains `"WARNING"` (uppercase)

---

### TC-007: registry dispatch - known command calls handler and returns its exit code

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-02

**GIVEN** a registry with a command `"test-cmd"` registered to a handler that returns `Promise.resolve(0)`
**WHEN** `dispatch(registry, "test-cmd", [])` is called
**THEN** the handler is invoked and `0` is returned

---

### TC-008: registry dispatch - unknown command writes to stderr and returns 2

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-02

**GIVEN** a registry with no command named `"unknown"`
**WHEN** `dispatch(registry, "unknown", [])` is called
**THEN** an error message is written to stderr and `2` is returned

---

### TC-009: registry helpText contains all registered command names

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-02

**GIVEN** a registry with commands `"check"` and `"status"` registered
**WHEN** `helpText(registry)` is called
**THEN** the returned string contains both `"check"` and `"status"`

---

## Integration Tests

### TC-010: CLI dispatch - known command dispatches to handler

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: CLI SHALL dispatch commands via a self-contained registry > Scenario: known command dispatches to handler

---

### TC-011: CLI dispatch - unknown command writes error to stderr and exits 2

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: CLI SHALL dispatch commands via a self-contained registry > Scenario: unknown command prints error

---

### TC-012: CLI - no command prints usage to stderr and exits 0

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: CLI SHALL dispatch commands via a self-contained registry > Scenario: no command prints usage

---

### TC-013: check - self-check on this repository exits 0 with no diagnostics

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: `aozu check` SHALL run closure verification on a design directory > Scenario: self-check on this repository yields exit 0

---

### TC-014: check - violations fixture exits 1 with contract-format diagnostics on stderr

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: `aozu check` SHALL run closure verification on a design directory > Scenario: violations produce exit 1 with contract-format diagnostics on stderr

---

### TC-015: check - missing design directory exits 2

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: `aozu check` SHALL run closure verification on a design directory > Scenario: missing design directory produces exit 2

---

### TC-016: check - stdout is always empty

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: `aozu check` SHALL run closure verification on a design directory > Scenario: stdout remains empty

---

### TC-017: check --request - valid citations exit 0

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: `aozu check --request` SHALL validate request document citations > Scenario: valid citations produce exit 0

---

### TC-018: check --request - non-existent citation exits 1

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: `aozu check --request` SHALL validate request document citations > Scenario: non-existent citation produces exit 1

---

### TC-019: check --request - request file not found exits 2

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: `aozu check --request` SHALL validate request document citations > Scenario: request file not found produces exit 2

---

### TC-020: check --request - citation inside code fence is excluded

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: `aozu check --request` SHALL validate request document citations > Scenario: citation in code fence is excluded

---

### TC-021: check --request --require-citation - zero citations exits 1

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: `--require-citation` SHALL reject zero citations > Scenario: zero citations with --require-citation

---

### TC-022: check --request - zero citations without --require-citation exits 0

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: `--require-citation` SHALL reject zero citations > Scenario: zero citations without --require-citation

---

### TC-023: check --request - implemented-only citation exits 1

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: `check --request` SHALL reject citations to implemented-only elements > Scenario: implemented-only citation produces exit 1

---

### TC-024: check --request - designed element citation passes

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: `check --request` SHALL reject citations to implemented-only elements > Scenario: designed element citation passes

---

### TC-025: check --request - requested element citation passes

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: `check --request` SHALL reject citations to implemented-only elements > Scenario: requested element citation passes

---

### TC-026: stderr/stdout separation - diagnostics go to stderr, stdout remains empty

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: diagnostics SHALL be written to stderr, never stdout > Scenario: stderr/stdout separation

---

### TC-027: check --help outputs usage to stderr and exits 0

**Category**: integration
**Priority**: should
**Source**: design.md > D1

**GIVEN** the CLI is invoked with `aozu check --help` or `aozu --help`
**WHEN** the registry processes the `--help` flag
**THEN** usage text listing available commands is written to stderr and exit code is 0

---

### TC-028: check --dir overrides the default design directory path

**Category**: integration
**Priority**: could
**Source**: design.md > D2

**GIVEN** a valid design directory located at a custom path (not `./design`)
**WHEN** `aozu check --dir <custom-path>` is invoked
**THEN** the files in `<custom-path>` are used for verification, not `./design`

---

### TC-029: check --request - mixed citations (implemented + designed) exits 1 with diagnostic for implemented element only

**Category**: integration
**Priority**: should
**Source**: design.md > D7

**GIVEN** a request document citing `[[mod-cli]]` (state = implemented) and `[[mod-parse]]` (no state entry → defaults to designed), and state.json contains `{"mod-cli": {"state": "implemented", "request": "prev", "pr": 1}}`
**WHEN** `aozu check --request <path>` is invoked
**THEN** exit code is 1, stderr contains a diagnostic for `mod-cli`, and no diagnostic is emitted for `mod-parse`

---

### TC-030: check --request - missing design directory exits 2

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-05

**GIVEN** `--request` points to an existing request file, but `--dir` points to a non-existent directory
**WHEN** `aozu check --request <path> --dir /nonexistent` is invoked
**THEN** exit code is 2 and an error message is written to stderr

---

### TC-031: all pre-existing tests remain green after implementation

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-09

**GIVEN** the repository with R1 and R2 already merged (184 existing tests)
**WHEN** `bun test` is run after implementing cli-check-wiring
**THEN** all 184 pre-existing tests pass without modification

---

## Manual Tests

### TC-032: tsc --noEmit succeeds with no type errors

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-09

**GIVEN** the full implementation of cli-check-wiring is complete
**WHEN** `tsc --noEmit` is run
**THEN** it exits 0 with no type errors reported

---

### TC-033: package.json dependencies field remains empty

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-09

**GIVEN** the implementation adds no external runtime packages
**WHEN** `package.json` is inspected
**THEN** the `dependencies` field is `{}` (empty object)

---

### TC-034: tools/check.sh continues to work alongside the new implementation

**Category**: manual
**Priority**: should
**Source**: tasks.md > T-09

**GIVEN** the new `aozu check` command is implemented
**WHEN** `tools/check.sh design` is run against this repository
**THEN** it exits 0 with the same result as before — `aozu check` and `tools/check.sh` coexist without conflict

---

## Result

```yaml
result: completed
total: 34
automated: 31
manual: 3
must: 19
should: 14
could: 1
blocked_reasons: []
```
