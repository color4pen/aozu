# Test Cases: init / scaffold / status

## Summary

- **Total**: 39 cases
- **Automated** (unit/integration): 37
- **Manual**: 2
- **Priority**: must: 17, should: 20, could: 2

---

## init

### TC-001: init creates a valid design directory in an empty location

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: init SHALL generate a minimal design directory that passes check > Scenario: init creates a valid design directory in an empty location

---

### TC-002: init respects --dir flag

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: init SHALL generate a minimal design directory that passes check > Scenario: init respects --dir flag

---

### TC-003: init refuses to overwrite existing design directory

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: init SHALL fail-closed when design directory already exists > Scenario: init refuses to overwrite existing design directory

---

### TC-004: init refuses even if design directory is partially populated

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: init SHALL fail-closed when design directory already exists > Scenario: init refuses even if design directory is partially populated

---

### TC-005: init generates manifest with minimal profile content

**Category**: unit
**Priority**: must
**Source**: design.md > D1: init のテンプレート構造 — 3 ファイル固定 / tasks.md > T-01

**GIVEN** `handleInit` is called on an empty directory  
**WHEN** the generated `design/manifest.md` is read  
**THEN** it contains frontmatter with `format-version: 0` and `enabled: static`

---

### TC-006: init generates modules.md with placeholder module and usage comments

**Category**: unit
**Priority**: must
**Source**: design.md > D1: init のテンプレート構造 — 3 ファイル固定 / tasks.md > T-01

**GIVEN** `handleInit` is called on an empty directory  
**WHEN** the generated `design/static/modules.md` is read  
**THEN** it contains `## アプリケーション {#mod-app}`, a `責務:` line, an `実装: src/` line, and at least one usage comment

---

### TC-007: init generates dependencies.md with no module entries

**Category**: unit
**Priority**: should
**Source**: design.md > D1: init のテンプレート構造 — 3 ファイル固定 / tasks.md > T-01

**GIVEN** `handleInit` is called on an empty directory  
**WHEN** the generated `design/static/dependencies.md` is read  
**THEN** it contains no module-to-module dependency entries (comment-only content)

---

### TC-008: init --help returns 0 and outputs usage to stderr

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01

**GIVEN** `handleInit` is called with `["--help"]`  
**WHEN** execution completes  
**THEN** the return code is 0 and stderr contains usage information describing `--dir` option

---

### TC-009: init error goes to stderr

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: all three commands SHALL maintain stdout/stderr separation > Scenario: init error goes to stderr

---

## scaffold

### TC-010: scaffold creates a topic file

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: scaffold SHALL generate type-conformant template files for document element types > Scenario: scaffold creates a topic file

---

### TC-011: scaffold creates a seq file

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: scaffold SHALL generate type-conformant template files for document element types > Scenario: scaffold creates a seq file

---

### TC-012: scaffold creates an adr file with auto-numbering

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: scaffold SHALL generate type-conformant template files for document element types > Scenario: scaffold creates an adr file with auto-numbering

---

### TC-013: scaffold rejects malformed ID

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: scaffold SHALL reject invalid inputs with exit 1 > Scenario: scaffold rejects malformed ID

---

### TC-014: scaffold rejects ID with wrong prefix for type

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: scaffold SHALL reject invalid inputs with exit 1 > Scenario: scaffold rejects ID with wrong prefix for type

---

### TC-015: scaffold rejects type disabled in manifest

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: scaffold SHALL reject invalid inputs with exit 1 > Scenario: scaffold rejects type disabled in manifest

---

### TC-016: scaffold rejects duplicate ID

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: scaffold SHALL reject invalid inputs with exit 1 > Scenario: scaffold rejects duplicate ID

---

### TC-017: scaffold guides for mod type

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: scaffold SHALL guide users for heading element types > Scenario: scaffold guides for mod type

---

### TC-018: scaffold creates a plan file at plans/<slug>.md

**Category**: integration
**Priority**: should
**Source**: design.md > D4: scaffold の型名→prefix・ディレクトリ・ファイル名のマッピング / tasks.md > T-05

**GIVEN** a design directory with `enabled: static, domain, dynamic, loop`  
**WHEN** `handleScaffold(["plan", "plan-my-plan"])` is called  
**THEN** `plans/my-plan.md` is created (the `plan-` prefix is stripped for the filename, placed in `plans/` directory)

---

### TC-019: scaffold plan template contains required frontmatter and structure

**Category**: unit
**Priority**: should
**Source**: design.md > D6: scaffold のテンプレート内容 — spec/format.md §8 準拠 / tasks.md > T-03

**GIVEN** `planTemplate("plan-my-plan")` is called  
**WHEN** the returned string is inspected  
**THEN** it contains frontmatter with `id: plan-my-plan` and `status: open`, and a group heading placeholder (`{#grp-...}`)

---

### TC-020: scaffold adr auto-numbering increments from existing maximum

**Category**: integration
**Priority**: should
**Source**: design.md > D4: scaffold の型名→prefix・ディレクトリ・ファイル名のマッピング / tasks.md > T-04

**GIVEN** a design directory containing `adr/0001-first.md`  
**WHEN** `handleScaffold(["adr", "adr-0002-second"])` is called  
**THEN** `adr/0002-second.md` is created; the number follows sequentially from the existing maximum

---

### TC-021: scaffold adr starts at 0001 when no existing adr files

**Category**: integration
**Priority**: should
**Source**: design.md > D4: scaffold の型名→prefix・ディレクトリ・ファイル名のマッピング / tasks.md > T-04

**GIVEN** a design directory with no `adr/` directory or an empty `adr/` directory  
**WHEN** `handleScaffold(["adr", "adr-0001-decision"])` is called  
**THEN** `adr/0001-decision.md` is created (number starts at 0001)

---

### TC-022: scaffold adr template includes topics placeholder when loop is enabled

**Category**: unit
**Priority**: could
**Source**: design.md > D6: scaffold のテンプレート内容 — spec/format.md §8 準拠

**GIVEN** `adrTemplate("adr-0001-decision", true)` is called (hasLoop = true)  
**WHEN** the returned string is inspected  
**THEN** it contains a `topics:` line with a `[[top-xxx]]` placeholder

---

### TC-023: scaffold validates ID grammar before manifest enablement check

**Category**: unit
**Priority**: should
**Source**: design.md > D5: scaffold のバリデーション順序

**GIVEN** a design directory with `enabled: static` (loop disabled)  
**WHEN** `handleScaffold(["topic", "INVALID_ID"])` is called (ID grammar is invalid and topic type is also disabled)  
**THEN** exit code is 1 and stderr references ID grammar error, not manifest enablement error

---

### TC-024: scaffold --help returns 0 and outputs usage to stderr

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04

**GIVEN** `handleScaffold` is called with `["--help"]`  
**WHEN** execution completes  
**THEN** return code is 0 and stderr contains usage describing supported types and ID format

---

### TC-025: scaffold with missing type or id argument returns exit 2

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04

**GIVEN** `handleScaffold` is called with `[]` (no arguments)  
**WHEN** execution completes  
**THEN** return code is 2 and stderr contains an error about missing required arguments

---

### TC-026: scaffold with non-existent design directory returns exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-04

**GIVEN** `handleScaffold(["topic", "top-x", "--dir", "/nonexistent/path"])` is called  
**WHEN** execution completes  
**THEN** return code is 2 and stderr contains a design directory not found error

---

### TC-027: scaffold stdout is empty on both success and failure

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: all three commands SHALL maintain stdout/stderr separation / tasks.md > T-05

**GIVEN** `handleScaffold` is executed via subprocess for both a valid and an invalid invocation  
**WHEN** both executions complete  
**THEN** stdout is empty in both cases; all output (success confirmation and error messages) appears on stderr

---

## status

### TC-028: status shows all three frontiers

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: status SHALL display three frontiers when loop is enabled > Scenario: status shows all three frontiers

---

### TC-029: status shows summary for static-only project

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: status SHALL degrade to summary when loop is disabled > Scenario: status shows summary for static-only project

---

### TC-030: status output goes to stdout

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: all three commands SHALL maintain stdout/stderr separation > Scenario: status output goes to stdout

---

### TC-031: computeFrontier excludes implemented elements from all frontiers

**Category**: unit
**Priority**: should
**Source**: design.md > D8: status のデータ取得 — 既存パイプラインの再利用 / tasks.md > T-08

**GIVEN** a graph containing element `mod-x` with `state: implemented` in stateMap  
**WHEN** `computeFrontier(graph, stateMap, manifest)` is called  
**THEN** `mod-x` does not appear in `openTopics`, `designed`, or `requested`

---

### TC-032: computeFrontier excludes addressed topics from open topics list

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-08 / design.md > D8

**GIVEN** a graph where `top-b` has `status: addressed` in its frontmatter  
**WHEN** `computeFrontier(graph, stateMap, manifest)` is called  
**THEN** `top-b` does not appear in `openTopics`

---

### TC-033: status open topic entry includes source field when present

**Category**: unit
**Priority**: could
**Source**: design.md > D7: status の表示モード — loop 有効/無効で分岐 / tasks.md > T-06

**GIVEN** a graph containing `top-a` with `status: open` and `source: gh#123` in its frontmatter  
**WHEN** `computeFrontier` is called and the result is formatted  
**THEN** the open topics section includes `gh#123` adjacent to `top-a`

---

### TC-034: status --help returns 0 and outputs usage to stderr

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-07

**GIVEN** `handleStatus` is called with `["--help"]`  
**WHEN** execution completes  
**THEN** return code is 0 and stderr contains usage describing `--dir` option

---

### TC-035: status with non-existent design directory returns exit 2

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-07

**GIVEN** `handleStatus(["--dir", "/nonexistent/path"])` is called  
**WHEN** execution completes  
**THEN** return code is 2 and stderr contains an error about the missing design directory

---

## CLI Registration

### TC-036: aozu --help displays init, scaffold, and status commands

**Category**: manual
**Priority**: should
**Source**: tasks.md > T-09

**GIVEN** the CLI is built with the three new commands registered in `src/cli/main.ts`  
**WHEN** `aozu --help` is executed  
**THEN** the output lists `init`, `scaffold`, and `status` with their descriptions

---

## Regression

### TC-037: existing 247 tests remain green after changes

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-10

**GIVEN** all new implementation files (init.ts, scaffold.ts, status.ts) are in place  
**WHEN** `bun test` is executed  
**THEN** all 247 pre-existing tests pass without modification

---

### TC-038: tsc --noEmit reports no type errors

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-10

**GIVEN** the new TypeScript files are written and registered in main.ts  
**WHEN** `tsc --noEmit` is executed  
**THEN** no type errors are reported

---

### TC-039: package.json dependencies remain empty

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-10

**GIVEN** the implementation is complete  
**WHEN** the `dependencies` field in `package.json` is inspected  
**THEN** no new runtime dependencies have been added (field remains empty)

---

## Result

```yaml
result: completed
total: 39
automated: 37
manual: 2
must: 17
should: 20
could: 2
blocked_reasons: []
```
