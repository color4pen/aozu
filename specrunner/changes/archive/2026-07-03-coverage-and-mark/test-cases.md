# Test Cases: coverage / mark implemented

## Summary

- **Total**: 45 cases
- **Automated** (unit/integration): 42
- **Manual**: 3
- **Priority**: must: 18, should: 23, could: 4

---

## Writer (writeDesignState)

### TC-001: round-trip with readDesignState

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: writeDesignState SHALL produce spec §9 compliant output > Scenario: round-trip with readDesignState

### TC-002: lexicographic key order

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: writeDesignState SHALL produce spec §9 compliant output > Scenario: lexicographic key order

### TC-003: one entry per line

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: writeDesignState SHALL produce spec §9 compliant output > Scenario: one entry per line

### TC-004: writeDesignState — pr field included in round-trip

**Category**: unit
**Priority**: should
**Source**: tasks.md T-01: mod-state に writeDesignState を新設する

**GIVEN** a StateMap with an entry `{ "ent-order": { state: "implemented", request: "r1", pr: 42 } }`
**WHEN** `writeDesignState` writes the map and `readDesignState` reads it back
**THEN** the read result contains `pr: 42` on the `ent-order` entry

### TC-005: writeDesignState — empty stateMap with no existing file does not create file

**Category**: unit
**Priority**: should
**Source**: design.md D1: writer の配置と書式

**GIVEN** an empty stateMap (`{}`) and no state.json file exists in designDir
**WHEN** `writeDesignState(designDir, {})` is called
**THEN** no state.json file is created in designDir

### TC-006: writeDesignState — empty stateMap overwrites existing file with `{}`

**Category**: unit
**Priority**: should
**Source**: design.md D1: writer の配置と書式

**GIVEN** an empty stateMap (`{}`) and a state.json file already exists in designDir
**WHEN** `writeDesignState(designDir, {})` is called
**THEN** state.json is overwritten with `{}` (single line)

### TC-007: writeDesignState re-exported from state/index.ts

**Category**: unit
**Priority**: could
**Source**: tasks.md T-01: mod-state に writeDesignState を新設する

**GIVEN** the module `src/state/index.ts`
**WHEN** `writeDesignState` is imported from it
**THEN** the import resolves without error and is the same function as in `src/state/writer.ts`

---

## Coverage — Verification Logic (verifyCoverage unit tests)

### TC-008: full coverage passes and transitions to requested

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage SHALL verify draft coverage of group elements > Scenario: full coverage passes and transitions to requested

### TC-009: missing citation fails without state change

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage SHALL verify draft coverage of group elements > Scenario: missing citation fails without state change

### TC-010: code fence citations are excluded

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage SHALL verify draft coverage of group elements > Scenario: code fence citations are excluded

### TC-011: group contains a requested element

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage SHALL reject non-designed elements (adr/0018-4) > Scenario: group contains a requested element

### TC-012: group contains an implemented element

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage SHALL reject non-designed elements (adr/0018-4) > Scenario: group contains an implemented element

### TC-013: verifyCoverage — graph-absent element produces error

**Category**: unit
**Priority**: should
**Source**: tasks.md T-02: coverage の検証ロジックを mod-plan に新設する

**GIVEN** a groupElementIds list containing `"ent-missing"` that does not exist in graph.elements, and draftRefs including `"ent-missing"`
**WHEN** `verifyCoverage` is called
**THEN** `pass` is `false` and `errors` contains a diagnostic referencing `ent-missing`

### TC-014: verifyCoverage — cross-group edge with after constraint produces no warning

**Category**: unit
**Priority**: should
**Source**: tasks.md T-02: coverage の検証ロジックを mod-plan に新設する

**GIVEN** two groups grp-a and grp-b, element `ent-order` in grp-a references `inv-3` in grp-b, and `afterEdges` contains `"grp-a->grp-b"`, with full draft coverage
**WHEN** `verifyCoverage` is called for grp-a
**THEN** `warnings` is empty and `pass` is `true`

---

## Coverage — Cross-Group Warning

### TC-015: cross-group edge without after emits warning but passes

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: coverage SHALL warn on cross-group reference edges without after > Scenario: cross-group edge without after emits warning but passes

---

## Coverage — Handler Input Validation

### TC-016: coverage handler — missing --group argument → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-03: coverage コマンド handler を実装する

**GIVEN** a valid design directory, draft file, and slug
**WHEN** `aozu coverage` is invoked without `--group`
**THEN** exit code is 2 and no state.json change occurs

### TC-017: coverage handler — missing --draft argument → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-03: coverage コマンド handler を実装する

**GIVEN** a valid design directory and group ID
**WHEN** `aozu coverage` is invoked without `--draft`
**THEN** exit code is 2 and no state.json change occurs

### TC-018: coverage handler — missing --request argument → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-03: coverage コマンド handler を実装する

**GIVEN** a valid design directory, group ID, and draft file
**WHEN** `aozu coverage` is invoked without `--request`
**THEN** exit code is 2 and no state.json change occurs

### TC-019: coverage handler — draft file not found → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-04: coverage コマンドの統合テスト

**GIVEN** valid group ID and slug, but `--draft` points to a non-existent file
**WHEN** `aozu coverage` is invoked
**THEN** exit code is 2 and no state.json change occurs

### TC-020: coverage handler — group ID not found in plan → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-04: coverage コマンドの統合テスト

**GIVEN** a valid design directory and draft file, but `--group` names a group that does not exist in any plan file
**WHEN** `aozu coverage` is invoked
**THEN** exit code is 2 and no state.json change occurs

### TC-021: coverage handler — invalid slug format → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-04: coverage コマンドの統合テスト

**GIVEN** all other arguments are valid, but `--request` value is `"My Request"` (contains uppercase and space, violating `[a-z0-9]+(-[a-z0-9]+)*`)
**WHEN** `aozu coverage` is invoked
**THEN** exit code is 2 and no state.json change occurs

### TC-022: coverage handler — design directory not found → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-04: coverage コマンドの統合テスト

**GIVEN** `--dir` points to a non-existent directory
**WHEN** `aozu coverage` is invoked
**THEN** exit code is 2 and no state.json change occurs

---

## Coverage — Loop Gate

### TC-023: coverage with loop disabled

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage and mark SHALL require loop layer > Scenario: coverage with loop disabled

---

## Mark Implemented — Transitions

### TC-024: normal transition with --pr

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark implemented SHALL conform to spec/integration.md §2 > Scenario: normal transition with --pr

### TC-025: idempotent re-run

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark implemented SHALL conform to spec/integration.md §2 > Scenario: idempotent re-run

### TC-026: unknown slug

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark implemented SHALL conform to spec/integration.md §2 > Scenario: unknown slug

### TC-027: mixed states — only requested transitions

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark implemented SHALL conform to spec/integration.md §2 > Scenario: mixed states — only requested transitions

---

## Mark — Loop Gate

### TC-028: mark with loop disabled

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage and mark SHALL require loop layer > Scenario: mark with loop disabled

---

## Mark — Handler Input Validation

### TC-029: mark handler — missing --request argument → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-05: mark implemented コマンド handler を実装する

**GIVEN** a valid design directory and loop-enabled manifest
**WHEN** `aozu mark implemented` is invoked without `--request`
**THEN** exit code is 2 and no state.json change occurs

### TC-030: mark handler — unknown subcommand → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-05: mark implemented コマンド handler を実装する

**GIVEN** a valid design directory
**WHEN** `aozu mark done --request some-slug` is invoked (subcommand is not `implemented`)
**THEN** exit code is 2 and no state.json change occurs

### TC-031: mark handler — design directory not found → exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md T-06: mark implemented コマンドの統合テスト

**GIVEN** `--dir` points to a non-existent directory
**WHEN** `aozu mark implemented --request some-slug` is invoked
**THEN** exit code is 2 and no state.json change occurs

---

## Diagnostic Output

### TC-032: coverage — errors and warnings go to stderr, stdout is empty

**Category**: integration
**Priority**: should
**Source**: design.md D14: 診断出力の形式

**GIVEN** a coverage run that produces both a warning (cross-group edge) and an error (missing citation)
**WHEN** the command completes
**THEN** all diagnostic lines appear on stderr in `COVERAGE ERROR` / `COVERAGE WARN` format, and stdout contains no output

### TC-033: mark — status messages go to stderr, stdout is empty

**Category**: integration
**Priority**: should
**Source**: design.md D14: 診断出力の形式

**GIVEN** a mark implemented run that transitions 2 elements
**WHEN** the command completes
**THEN** the transition summary appears on stderr and stdout contains no output

### TC-034: coverage — transition count summary on stderr on success

**Category**: integration
**Priority**: should
**Source**: design.md D14: 診断出力の形式

**GIVEN** a coverage run with full draft coverage over a group of 3 designed elements
**WHEN** coverage exits 0
**THEN** stderr contains a summary line indicating 3 elements were transitioned to requested

### TC-035: mark — transition count summary on stderr on success

**Category**: integration
**Priority**: should
**Source**: design.md D14: 診断出力の形式

**GIVEN** a mark implemented run that transitions 2 requested elements
**WHEN** mark exits 0
**THEN** stderr contains a summary line indicating 2 elements were transitioned to implemented

---

## openTopics — Computed Derivation

### TC-036: topic cited in ADR topics is not open

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: openTopics SHALL use computed derivation from ADR topics frontmatter > Scenario: topic cited in ADR topics is not open

### TC-037: topic not cited is open regardless of status frontmatter

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: openTopics SHALL use computed derivation from ADR topics frontmatter > Scenario: topic not cited is open regardless of status frontmatter

### TC-038: openTopics — source field is preserved after computation change

**Category**: integration
**Priority**: should
**Source**: tasks.md T-07: openTopics の計算導出に置換する（ADR-0018-3）

**GIVEN** a topic `top-perf` that is not cited in any ADR's `topics:` frontmatter, and the topic file has a frontmatter field used as its source
**WHEN** `aozu status` is run
**THEN** `top-perf` appears in Open Topics with its source field correctly populated

### TC-039: openTopics — ADR body mention of topic does not count as addressed

**Category**: integration
**Priority**: must
**Source**: design.md D8: openTopics の計算導出 — ADR frontmatter topics: の厳密抽出

**GIVEN** topic `top-perf` is NOT listed in any ADR's `topics:` frontmatter, but the text `[[top-perf]]` appears in the body of an ADR document
**WHEN** `aozu status` is run
**THEN** `top-perf` still appears in Open Topics (body mention is not counted as addressed)

---

## Scaffold — Topic Template

### TC-040: generated topic has no status line

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: scaffold topic template SHALL NOT include status field > Scenario: generated topic has no status line

---

## Command Registration

### TC-041: aozu --help lists coverage and mark

**Category**: manual
**Priority**: could
**Source**: tasks.md T-10: main.ts への coverage / mark コマンド登録

**GIVEN** the CLI is built and registered
**WHEN** `aozu --help` is run
**THEN** both `coverage` and `mark` appear in the command list with their descriptions

### TC-042: aozu coverage --help shows usage

**Category**: manual
**Priority**: could
**Source**: tasks.md T-10: main.ts への coverage / mark コマンド登録

**GIVEN** the coverage command is registered
**WHEN** `aozu coverage --help` is run
**THEN** usage text is printed to stderr and exit code is 0

### TC-043: aozu mark --help shows usage

**Category**: manual
**Priority**: could
**Source**: tasks.md T-10: main.ts への coverage / mark コマンド登録

**GIVEN** the mark command is registered
**WHEN** `aozu mark --help` is run
**THEN** usage text is printed to stderr and exit code is 0

---

## Architecture Integrity

### TC-044: T-03 invariant — state.json write confined to src/state/

**Category**: unit
**Priority**: should
**Source**: tasks.md T-12: 全体回帰テスト

**GIVEN** the new coverage.ts and mark.ts handler files exist in src/cli/commands/
**WHEN** `tests/invariants.test.ts` (T-03) is run
**THEN** the invariant test passes — no file-write API co-occurs with the literal `state.json` outside of `src/state/`

### TC-045: export rules --verify exits 0 after coverage/mark addition

**Category**: integration
**Priority**: should
**Source**: tasks.md T-11: design/rules.json の再 export

**GIVEN** coverage and mark commands are added to main.ts and rules.json is regenerated
**WHEN** `aozu export rules --verify` is run
**THEN** exit code is 0 (rules.json is consistent with the current module graph)

---

## Result

```yaml
result: completed
total: 45
automated: 42
manual: 3
must: 18
should: 23
could: 4
blocked_reasons: []
```
