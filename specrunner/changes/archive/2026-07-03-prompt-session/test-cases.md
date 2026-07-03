# Test Cases: prompt-session

## Summary

- **Total**: 34 cases
- **Automated** (unit/integration): 31
- **Manual**: 3
- **Priority**: must: 15, should: 16, could: 3

---

<!-- ===== Spec Scenario 由来 (Source 参照のみ、GWT 省略) ===== -->

### TC-001: Topic with citations produces full instruction

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt session SHALL output a design session instruction to stdout > Scenario: Topic with citations produces full instruction

---

### TC-002: Topic with no citations produces reduced instruction

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt session SHALL output a design session instruction to stdout > Scenario: Topic with no citations produces reduced instruction

---

### TC-003: 3-hop element body is excluded

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt session SHALL NOT include bodies beyond 2-hop neighborhood > Scenario: 3-hop element body is excluded

---

### TC-004: Disconnected inv appears in output

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: prompt session SHALL inject term/inv full text regardless of neighborhood > Scenario: Disconnected inv appears in output

---

### TC-005: Module summary contains only ID and responsibility

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: prompt session SHALL inject static modules in condensed form > Scenario: Module summary contains only ID and responsibility

---

### TC-006: Loop disabled returns exit 1

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt session exit codes SHALL match derive > Scenario: Loop disabled returns exit 1

---

### TC-007: Topic not found returns exit 2

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt session exit codes SHALL match derive > Scenario: Topic not found returns exit 2

---

### TC-008: Design directory not found returns exit 2

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt session exit codes SHALL match derive > Scenario: Design directory not found returns exit 2

---

### TC-009: Repeated invocations produce identical output

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt session output SHALL be deterministic > Scenario: Repeated invocations produce identical output

---

### TC-010: Success case has clean stdout

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Diagnostics SHALL go to stderr only > Scenario: Success case has clean stdout

---

### TC-011: Error case has no stdout

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Diagnostics SHALL go to stderr only > Scenario: Error case has no stdout

---

<!-- ===== 非 Scenario 由来 (GWT 必須) ===== -->

### TC-012: buildSessionInstruction — empty seedBodies outputs placeholder

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01: buildSessionInstruction 純関数の実装 / T-02: buildSessionInstruction のテスト

**GIVEN** `buildSessionInstruction` is called with `seedBodies: new Map()` (empty)
**WHEN** the function returns the instruction string
**THEN** the output contains the placeholder `(no seed elements — topic has no [[id]] citations)`

---

### TC-013: buildSessionInstruction — empty neighborBodies outputs placeholder

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01: buildSessionInstruction 純関数の実装 / T-02: buildSessionInstruction のテスト

**GIVEN** `buildSessionInstruction` is called with `neighborBodies: new Map()` (empty)
**WHEN** the function returns the instruction string
**THEN** the output contains `(no neighborhood elements)`

---

### TC-014: buildSessionInstruction — empty termsAndInvariants outputs placeholder

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01: buildSessionInstruction 純関数の実装 / T-02: buildSessionInstruction のテスト

**GIVEN** `buildSessionInstruction` is called with `termsAndInvariants: ""` (empty string)
**WHEN** the function returns the instruction string
**THEN** the output contains `(no terms or invariants defined)`

---

### TC-015: buildSessionInstruction — all 8 sections present in single output

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-02: buildSessionInstruction のテスト / design.md > D2: 純関数 buildSessionInstruction の設計

**GIVEN** `buildSessionInstruction` is called with fully-populated `SessionInput`
**WHEN** the function returns the instruction string
**THEN** the output contains all 8 section headings: `## Topic`, `## Seed Element Bodies`, `## Neighborhood Element Bodies (2-hop)`, `## Terms and Invariants`, `## Static Modules`, `## Enabled Layers`, `## Format Rules`, `## Session Guidance`

---

### TC-016: buildSessionInstruction — same input produces byte-identical output on repeated calls

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-02: buildSessionInstruction のテスト / design.md > D9: 決定的出力の保証

**GIVEN** a fixed `SessionInput` value
**WHEN** `buildSessionInstruction` is called twice with the same input
**THEN** both return values are strictly equal (same bytes, same ordering)

---

### TC-017: SESSION_MAX_HOPS constant is exported from session.ts

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01: buildSessionInstruction 純関数の実装 / design.md > D3: 注入スコープの規則

**GIVEN** `src/prompt/session.ts` is imported
**WHEN** `SESSION_MAX_HOPS` is accessed
**THEN** it equals `2` and is exported (usable by the handler without re-declaration)

---

### TC-018: FORMAT_RULES_SUMMARY contains declaration and reference syntax

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01: buildSessionInstruction 純関数の実装 / design.md > D6: 形式規則の要約

**GIVEN** the `FORMAT_RULES_SUMMARY` constant defined in `src/prompt/session.ts`
**WHEN** its string value is inspected
**THEN** it contains: declaration syntax for heading elements (`{#id}`), reference syntax (`[[id]]`), ID grammar (`prefix-slug`), and type prefix examples (e.g., `mod`, `ent`, `inv`, `top`, `adr`)

---

### TC-019: SESSION_GUIDANCE contains all four required guidance items

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01: buildSessionInstruction 純関数の実装 / design.md > D7: セッション作法指示

**GIVEN** the `SESSION_GUIDANCE` constant defined in `src/prompt/session.ts`
**WHEN** its string value is inspected
**THEN** it contains references to: scaffold for new elements, check command, ADR for decisions, and `topics:` citation for addressing a topic (ADR-0018)

---

### TC-020: handleSession parses --topic flag and passes topicId to pipeline

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-03: session handler の実装 / design.md > D8: 段階ゲート

**GIVEN** a valid design directory with loop enabled and a topic `top-my-topic`
**WHEN** `handleSession(["--topic", "top-my-topic", "--dir", "<dir>"])` is called
**THEN** the handler resolves without error, identifies `top-my-topic` as the topic ID, and outputs the session instruction to stdout

---

### TC-021: handleSession returns exit 2 when --topic argument is missing

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-03: session handler の実装 / tasks.md > T-04: session handler の統合テスト

**GIVEN** a valid design directory with loop enabled
**WHEN** `handleSession(["--dir", "<dir>"])` is called without `--topic`
**THEN** exit code is 2, stderr contains a diagnostic about the missing `--topic` argument, and stdout is empty

---

### TC-022: handleSession defaults --dir to ./design when not specified

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-03: session handler の実装 / design.md > D1: session handler の配置

**GIVEN** `./design` exists and contains a valid design with loop enabled and a topic
**WHEN** `handleSession(["--topic", "<top-id>"])` is called without `--dir`
**THEN** the handler reads from `./design`, returns exit 0, and outputs the session instruction

---

### TC-023: handlePrompt dispatch routes 'session' subcommand to handleSession

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-03: session handler の実装 / tasks.md > T-05: handlePrompt dispatch の既存テスト更新

**GIVEN** a valid design directory with loop enabled and a topic
**WHEN** `handlePrompt(["session", "--topic", "<top-id>", "--dir", "<dir>"])` is called
**THEN** handleSession is invoked and returns the same result as calling handleSession directly

---

### TC-024: handlePrompt help text includes 'session' subcommand

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-05: handlePrompt dispatch の既存テスト更新 / design.md > D1: session handler の配置

**GIVEN** `handlePrompt` is invoked with `["--help"]` or an unknown subcommand
**WHEN** the help / error message is written to stderr
**THEN** the output contains `session` in the subcommand list

---

### TC-025: Execution does not write any files to the design directory

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-04: session handler の統合テスト / design.md (Non-Goals / G1)

**GIVEN** a design directory with loop enabled and a topic, with a known file listing captured before execution
**WHEN** `aozu prompt session --topic <top-id> --dir <design-dir>` is executed
**THEN** the file listing of the design directory is identical after execution (no files created, modified, or deleted)

---

### TC-026: 2-hop neighborhood boundary enforced — only elements within 2 hops are included

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-04: session handler の統合テスト / design.md > D3: 注入スコープの規則

**GIVEN** a fixture with chain `top-topic [[ent-a]]` → `ent-a [[ent-b]]` → `ent-b [[ent-c]]` → `ent-c [[ent-d]]`, where ent-d is 3 hops from ent-a
**WHEN** `aozu prompt session --topic top-topic --dir <dir>` is executed
**THEN** stdout contains the body of ent-b (1-hop) and ent-c (2-hop from ent-a), but does NOT contain the body of ent-d (3-hop)

---

### TC-027: Duplicate [[id]] citations in topic body are deduplicated

**Category**: unit
**Priority**: should
**Source**: design.md > D4: seed の抽出

**GIVEN** a topic body that references `[[ent-order]]` twice (e.g., `[[ent-order]] and [[ent-order]]`)
**WHEN** the handler extracts seed IDs from the topic body
**THEN** `ent-order` appears only once in the seed ID list used for body extraction and neighborhood computation

---

### TC-028: References to nonexistent elements are filtered out from seed

**Category**: integration
**Priority**: should
**Source**: design.md > D4: seed の抽出 / tasks.md > T-03: session handler の実装

**GIVEN** a topic body referencing `[[ent-missing]]` where `ent-missing` does not exist in the graph
**WHEN** `aozu prompt session --topic <top-id> --dir <dir>` is executed
**THEN** exit code is 0 (nonexistent references are silently skipped, not treated as an error), and the output does not crash on the missing element

---

### TC-029: Static module with no 責務 line outputs heading only

**Category**: integration
**Priority**: should
**Source**: design.md > D5: static モジュール一覧の縮約形

**GIVEN** a static module element `mod-headless` whose body contains no `責務:` line
**WHEN** `aozu prompt session --topic <top-id> --dir <dir>` is executed
**THEN** stdout contains `mod-headless` as a heading in the Static Modules section, but no `責務:` line follows it for that element

---

### TC-030: term/inv elements are included even when unreachable from seed neighborhood

**Category**: integration
**Priority**: should
**Source**: design.md > D2: 注入スコープ / tasks.md > T-04: session handler の統合テスト

**GIVEN** a fixture where `inv-isolated` and `term-isolated` are not referenced by any seed or neighbor element
**WHEN** `aozu prompt session --topic <top-id> --dir <dir>` is executed
**THEN** stdout contains the bodies of `inv-isolated` and `term-isolated` in the Terms and Invariants section

---

### TC-031: docs/open-questions.md 論点 8 contains implementation note

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-06: docs/open-questions.md 論点 8 への注記追加

**GIVEN** `docs/open-questions.md` is read after the implementation is complete
**WHEN** the content of 論点 8 section is inspected
**THEN** it contains a note indicating initial implementation via `prompt session`, referencing `SESSION_MAX_HOPS` in `src/prompt/session.ts`, and the 論点 8 section itself is not removed

---

### TC-032: tsc --noEmit passes with no type errors

**Category**: manual
**Priority**: could
**Source**: tasks.md > T-07: 全体回帰テスト

**GIVEN** the full implementation of T-01 through T-06 is complete
**WHEN** `tsc --noEmit` is run
**THEN** the command exits with code 0 and produces no type errors

---

### TC-033: bun test passes all tests including existing derive tests

**Category**: manual
**Priority**: could
**Source**: tasks.md > T-07: 全体回帰テスト

**GIVEN** the full implementation of T-01 through T-06 is complete
**WHEN** `bun test` is run
**THEN** all tests pass (exit 0), including existing tests for `prompt derive` and architecture constraints

---

### TC-034: No new runtime dependencies are added to package.json

**Category**: manual
**Priority**: could
**Source**: tasks.md > T-07: 全体回帰テスト / request.md > 受け入れ基準

**GIVEN** the full implementation is complete
**WHEN** `package.json` `dependencies` field is inspected
**THEN** the `dependencies` field remains empty (no new packages added; only devDependencies or existing packages used)

---

## Result

```yaml
result: completed
total: 34
automated: 31
manual: 3
must: 15
should: 16
could: 3
blocked_reasons: []
```
