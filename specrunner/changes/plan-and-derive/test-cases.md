# Test Cases: plan / prompt derive

<!-- FORMAT REQUIREMENTS:
Test Case heading format: `### TC-{NNN}: {Name}` (3-digit zero-padded, e.g. TC-001)

Required fields per test case:
  **Category**: unit | integration | manual
  **Priority**: must | should | could
  **Source**: reference to spec Scenario (spec.md > Requirement: <name> > Scenario: <name>) or design.md / tasks.md section

GIVEN/WHEN/THEN structure (mixed format — depends on TC type):
  Scenario 由来 TC (Source = spec.md > Requirement: <name> > Scenario: <name>):
    GWT は記述しない。Source 参照のみ。behavior の正典は spec の Scenario。
  非 Scenario 由来 TC (Source = design.md or tasks.md section):
    GWT は必須:
    **GIVEN** <preconditions>
    **WHEN** <action>
    **THEN** <expected result>

Category determination:
  unit        — pure logic, validation, helper functions (automated)
  integration — DB operations, API endpoints, multi-module interaction (automated)
  manual      — UI/UX confirmation, visual verification, build artifact check (not automated)

Priority determination:
  must   — core functionality; if broken, the feature does not work
  should — important but core still works; edge cases, error handling
  could  — nice to have; performance, UX details

Summary section MUST appear immediately after the title with ALL 4 items:
  ## Summary
  - **Total**: {count} cases
  - **Automated** (unit/integration): {count}
  - **Manual**: {count}
  - **Priority**: must: {count}, should: {count}, could: {count}

Result section MUST appear at the very end as a YAML code block:
  ## Result
  ```yaml
  result: completed | partial | failed
  total: {count}
  automated: {count}
  manual: {count}
  must: {count}
  should: {count}
  could: {count}
  blocked_reasons: []
  ```

  result determination:
    completed — all testable behaviors are documented
    partial   — some cases could not be derived due to design ambiguity
    failed    — spec is absent AND design.md / tasks.md are also missing
-->

## Summary

- **Total**: 56 cases
- **Automated** (unit/integration): 53
- **Manual**: 3
- **Priority**: must: 39, should: 14, could: 3

---

## plan コマンド — 正常系

### TC-001: plan generates a valid plan file from a fixture with designed elements

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL generate a spec-conformant plan document from designed elements > Scenario: plan generates a valid plan file from a fixture with designed elements

### TC-002: generated plan file does not break check

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL generate a spec-conformant plan document from designed elements > Scenario: generated plan file does not break check

---

## plan コマンド — 注釈

### TC-003: plan annotations include reference edges between designed elements

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL include judgment annotations for reference edges, mod grounding, and requested elements > Scenario: plan annotations include reference edges between designed elements

### TC-004: plan annotations include module grounding

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL include judgment annotations for reference edges, mod grounding, and requested elements > Scenario: plan annotations include module grounding

### TC-005: plan annotations include requested elements list

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL include judgment annotations for reference edges, mod grounding, and requested elements > Scenario: plan annotations include requested elements list

---

## plan コマンド — ゲート違反

### TC-006: plan rejects when loop is not enabled

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL fail-closed with exit 1 for gate violations > Scenario: plan rejects when loop is not enabled

### TC-007: plan rejects when slug already exists

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL fail-closed with exit 1 for gate violations > Scenario: plan rejects when slug already exists

### TC-008: plan rejects when no designed elements exist

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL fail-closed with exit 1 for gate violations > Scenario: plan rejects when no designed elements exist

---

## prompt derive — 正常系

### TC-009: derive output contains all required sections

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt derive SHALL output instruction text to stdout containing all required sections > Scenario: derive output contains all required sections

### TC-010: derive resolves template from file path

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL support dual-mode template resolution > Scenario: derive resolves template from file path

### TC-011: derive resolves template from command execution

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL support dual-mode template resolution > Scenario: derive resolves template from command execution

---

## prompt derive — ゲート違反・設定欠落

### TC-012: derive rejects when request-template is missing

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when request-template is missing

### TC-013: derive rejects when request-output-dir is missing

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when request-output-dir is missing

### TC-014: derive rejects when plan file is not found

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when plan file is not found

### TC-015: derive rejects when group is not found

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when group is not found

### TC-016: derive rejects when loop is not enabled

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when loop is not enabled

### TC-017: derive rejects when group elements do not resolve

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when group elements do not resolve

---

## prompt derive — ファイルシステム非書き込み

### TC-018: derive produces no file system side effects

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL NOT write any files or modify state > Scenario: derive produces no file system side effects

---

## 正本更新

### TC-019: format spec documents new manifest keys

**Category**: manual
**Priority**: should
**Source**: spec.md > Requirement: spec and integration documents SHALL be updated to reflect new manifest keys > Scenario: format spec documents new manifest keys

---

## stdout / stderr 分離

### TC-020: plan writes success to stderr, not stdout

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: all commands SHALL separate stdout and stderr per spec/integration.md §5 > Scenario: plan writes success to stderr, not stdout

### TC-021: derive writes instruction to stdout, errors to stderr

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: all commands SHALL separate stdout and stderr per spec/integration.md §5 > Scenario: derive writes instruction to stdout, errors to stderr

---

## T-01: computeFrontier 移設

### TC-022: computeFrontier is exported from src/plan/frontier.ts

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01

**GIVEN** the source repository after T-01 is applied
**WHEN** src/plan/frontier.ts is inspected for exported symbols
**THEN** `computeFrontier` function, `Frontier` type, and `IMPLEMENTATION_PREFIXES` constant are all exported from that file

### TC-023: status.ts imports computeFrontier from src/plan/frontier.ts

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-01

**GIVEN** the source repository after T-01 is applied
**WHEN** src/cli/commands/status.ts import statements are inspected
**THEN** `computeFrontier` is imported from `../../plan/frontier` (not defined locally) and the original local definition is absent

### TC-024: computeFrontier accepts enabledPrefixes argument with no mod-check import

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01

**GIVEN** src/plan/frontier.ts after T-01 is applied
**WHEN** the function signature and import list of `computeFrontier` are inspected
**THEN** the signature includes an `enabledPrefixes: Set<string>` parameter, and the file contains no import from `../check/`

---

## T-02: findOwningElement 移設

### TC-025: findOwningElement is defined in src/graph/attribution.ts

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-02

**GIVEN** the source repository after T-02 is applied
**WHEN** src/graph/attribution.ts is inspected
**THEN** `findOwningElement` is defined and exported from that file

### TC-026: src/check/attribution.ts re-exports findOwningElement without local definition

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-02

**GIVEN** the source repository after T-02 is applied
**WHEN** src/check/attribution.ts is read
**THEN** the file contains a re-export statement pointing to `../graph/attribution` and does not define `findOwningElement` locally

---

## T-03: extractElementBody

### TC-027: extractElementBody returns correct body text for a heading element

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** a Graph with heading element `mod-app` declared at line 3 of `design/modules/app.md`, and a FileInput for that file where the next heading of the same level begins at line 10
**WHEN** `extractElementBody("mod-app", graph, files)` is called
**THEN** the returned string contains lines 4 through 9 (inclusive) of the file, not including the next heading line

### TC-028: extractElementBody returns body for a document element excluding frontmatter

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** a Graph with document element `adr-0001` declared in `design/adr/0001.md`, and a FileInput for that file containing a YAML frontmatter block followed by body text
**WHEN** `extractElementBody("adr-0001", graph, files)` is called
**THEN** the returned string contains only the content after the closing `---` of the frontmatter, not the frontmatter itself

### TC-029: extractElementBody returns null for a nonexistent element ID

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** a Graph that contains no element with ID `ent-ghost`
**WHEN** `extractElementBody("ent-ghost", graph, files)` is called
**THEN** the function returns `null`

### TC-030: extractElementBody stops at the next same-level heading boundary

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** a single file containing heading element `mod-a` at line 2 and `mod-b` at line 7 (both are `##` headings)
**WHEN** `extractElementBody("mod-a", graph, files)` is called
**THEN** the returned body ends at line 6 and does not include line 7 (the `mod-b` declaration) or later lines

---

## T-04: computeNeighborhood

### TC-031: computeNeighborhood returns direct neighbors in both in and out directions

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** a Graph where element A references B (out) and element C references A (in)
**WHEN** `computeNeighborhood(["A"], graph, 1)` is called
**THEN** the returned Set contains both `B` and `C`

### TC-032: computeNeighborhood includes 2-hop transitive neighbors

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** a Graph where A -> B -> C (A references B, B references C)
**WHEN** `computeNeighborhood(["A"], graph, 2)` is called
**THEN** the returned Set contains both `B` (1-hop) and `C` (2-hop)

### TC-033: computeNeighborhood excludes seedIds from the result

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** a Graph where A references B
**WHEN** `computeNeighborhood(["A"], graph, 2)` is called
**THEN** the returned Set does not contain `A`

### TC-034: computeNeighborhood terminates without infinite loop on circular references

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** a Graph where A references B and B references A (circular)
**WHEN** `computeNeighborhood(["A"], graph, 2)` is called
**THEN** the function returns a finite result without hanging, and the Set contains `B`

---

## T-05: generatePlan

### TC-035: generatePlan places H1 title heading immediately after frontmatter

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05

**GIVEN** `generatePlan("my-batch", ["mod-app"], annotations)` is called
**WHEN** the returned string is split by lines
**THEN** the line immediately following the closing `---` of the frontmatter is `# my-batch`

### TC-036: generatePlan uses grp-\<slug\> as the group anchor ID

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05

**GIVEN** `generatePlan("my-batch", ["mod-app"], annotations)` is called
**WHEN** the returned string is inspected for the group heading
**THEN** the group heading contains `{#grp-my-batch}`

### TC-037: generatePlan does not include any request: line

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05

**GIVEN** `generatePlan("my-batch", ["mod-app", "ent-order"], annotations)` is called
**WHEN** every line of the returned string is checked
**THEN** no line matching `- request:` exists in the output

---

## T-06: plan handler

### TC-038: handlePlan returns exit 2 for invalid slug format

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** `handlePlan` is invoked with a slug that does not match `[a-z0-9]+(-[a-z0-9]+)*` (e.g., `../evil`, `My Batch`, `UPPER`)
**WHEN** the handler completes
**THEN** the return value is 2, stderr contains an error message, and no file is created in the design directory

### TC-039: handlePlan creates plans/ directory when it does not exist

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-06

**GIVEN** a design directory with loop enabled and designed elements, but no existing `plans/` subdirectory
**WHEN** `handlePlan(["new-slug", "--dir", dir])` is executed
**THEN** `design/plans/` directory is created and `design/plans/new-slug.md` is written

### TC-040: handlePlan produces no stdout output on successful generation

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-06

**GIVEN** a valid design directory with loop enabled and designed elements
**WHEN** `handlePlan` is run as a subprocess
**THEN** stdout is empty and the exit code is 0

---

## T-08: buildDeriveInstruction

### TC-041: buildDeriveInstruction wraps template content with BEGIN/END delimiters

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-08

**GIVEN** a `DeriveInput` with `templateContent: "## My Template"`
**WHEN** `buildDeriveInstruction(input)` is called
**THEN** the returned string contains `---TEMPLATE BEGIN---` before and `---TEMPLATE END---` after the template content, with both delimiters appearing on their own lines

### TC-042: buildDeriveInstruction includes citation convention with [[id]] and coverage mention

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-08

**GIVEN** any valid `DeriveInput`
**WHEN** `buildDeriveInstruction(input)` is called
**THEN** the returned string contains a section mentioning `[[id]]` and the word "coverage" in the context of the citation convention instruction

---

## T-09: prompt handler

### TC-043: handlePrompt returns exit 2 for missing or unrecognized subcommand

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-09

**GIVEN** `handlePrompt` is invoked with args `[]` (no subcommand) or `["unknown"]`
**WHEN** the handler completes
**THEN** the return value is 2 and stderr contains an error message about the subcommand

### TC-044: handleDerive returns exit 2 when template command exits non-zero

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-09

**GIVEN** a manifest with `request-template` set to a shell command that exits non-zero (e.g., `false`), and no matching file exists at that path
**WHEN** `aozu prompt derive --group grp-test --dir <path>` is executed
**THEN** exit code is 2 and stderr contains a diagnostic about the command failure

---

## T-11: main.ts 登録

### TC-045: aozu --help lists both plan and prompt commands

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-11

**GIVEN** plan and prompt are registered in src/cli/main.ts
**WHEN** `aozu --help` is run
**THEN** the output includes both `plan` and `prompt` entries in the command listing

### TC-046: aozu plan --help shows plan usage on stderr

**Category**: integration
**Priority**: could
**Source**: tasks.md > T-11

**GIVEN** the plan command is registered
**WHEN** `aozu plan --help` is run
**THEN** exit code is 0 and stderr contains usage information describing the `<slug>` argument and `--dir` option

### TC-047: aozu prompt --help shows prompt usage on stderr

**Category**: integration
**Priority**: could
**Source**: tasks.md > T-11

**GIVEN** the prompt command is registered
**WHEN** `aozu prompt --help` is run
**THEN** exit code is 0 and stderr contains usage information describing the `derive` subcommand

---

## T-12: 正本追随

### TC-048: spec/integration.md §4 specifies manifest frontmatter as injection point

**Category**: manual
**Priority**: should
**Source**: tasks.md > T-12

**GIVEN** spec/integration.md after this change is applied
**WHEN** §4 is reviewed
**THEN** the text explicitly identifies manifest frontmatter keys `request-template` and `request-output-dir` as the injection point for derive settings

### TC-049: design/static/modules.md mod-plan responsibility excludes request recording

**Category**: manual
**Priority**: should
**Source**: tasks.md > T-12

**GIVEN** design/static/modules.md after this change is applied
**WHEN** the mod-plan entry is read
**THEN** the responsibility description does not contain「グループへの request 記録」

### TC-050: export rules --verify exits 0 after rules.json regeneration

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-12

**GIVEN** design/rules.json has been regenerated by running `aozu export rules --out design/rules.json`
**WHEN** `aozu export rules --verify` is executed
**THEN** exit code is 0

---

## T-13: 全体回帰

### TC-051: tsc --noEmit exits 0 with all new and modified files

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-13

**GIVEN** all new TypeScript files in src/plan/, src/prompt/, modified files in src/graph/ and src/cli/ are present
**WHEN** `tsc --noEmit` is executed
**THEN** exit code is 0 with no type errors reported

### TC-052: bun test passes all tests including the original 336 pre-existing tests

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-13

**GIVEN** the complete test suite after all new tests are added
**WHEN** `bun test` is executed
**THEN** all tests pass and the count of passing tests is at least 336 (the pre-existing count) plus the new tests added by this change

### TC-053: package.json dependencies field remains empty

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-13

**GIVEN** package.json after all implementation is complete
**WHEN** the `dependencies` field is read
**THEN** the field is empty — no new runtime dependencies have been added

### TC-054: architecture test passes with no forbidden dependency violations

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-13

**GIVEN** architecture.test.ts enforcing allowed cross-module dependency rules
**WHEN** `bun test` is run and the architecture test executes
**THEN** no forbidden import paths are detected (e.g., mod-plan does not import from mod-check, mod-prompt does not import from mod-cli)

---

## D7: テンプレートのシェル実行

### TC-055: template command with spaces executes correctly via shell mode

**Category**: integration
**Priority**: could
**Source**: design.md > D7

**GIVEN** a manifest with `request-template: echo "hello world"` and no file at that path exists
**WHEN** `aozu prompt derive --group grp-test --dir <path>` is executed
**THEN** stdout contains `hello world` between the `---TEMPLATE BEGIN---` and `---TEMPLATE END---` delimiters, confirming that shell: true allows space-delimited commands

---

## D9: 注釈の自由 Markdown 節

### TC-056: plan annotation free Markdown section does not violate check C10

**Category**: integration
**Priority**: must
**Source**: design.md > D9

**GIVEN** a plan file generated by the plan command that contains a `## 注釈` section with reference edges, module grounding, and requested elements as free Markdown text
**WHEN** `aozu check --dir <path>` is run on the design directory containing that plan file
**THEN** check exits 0, confirming that the free Markdown annotation section does not trigger C10 (or any other check rule) violations

---

## Result

```yaml
result: completed
total: 56
automated: 53
manual: 3
must: 39
should: 14
could: 3
blocked_reasons: []
```
