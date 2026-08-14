# Test Cases: op 要素の実装 — op 型の追加と perm 操作行の op 参照化

<!-- FORMAT REQUIREMENTS:
Test Case heading format: `### TC-{NNN}: {Name}` (3-digit zero-padded, e.g. TC-001)

Required fields per test case:
  **Category**: unit | integration | manual | gate
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
  gate TC:
    GWT は記述しない。充足を担う verification phase 名（または verification.commands の command 名）を本文に記録する。

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

  所有権と書込時点: Result YAML は test-case-gen によるテストケース生成の結果記録である。
  生成時に一度だけ書かれ、後続ステップ（test-materialize を含む）は更新しない。

  `result` の値の意味:
  - completed = 全 TC の設計が完了し blocked_reasons が空
  - partial   = 一部 TC が設計不能で blocked_reasons に記録あり
  - failed    = 生成自体が成立しなかった
-->

## Summary

- **Total**: 29 cases
- **Automated** (unit/integration): 26
- **Manual**: 0
- **Priority**: must: 23, should: 6, could: 0

---

## TC Group 1: op prefix recognition (C1 / C3 / C11 / layer machinery)

### TC-001: op heading element declaration passes check

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: op prefix SHALL be recognized as a valid domain-layer element type > Scenario: op heading element declaration passes check

### TC-002: op reference from domain element resolves without C11 violation

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: op prefix SHALL be recognized as a valid domain-layer element type > Scenario: op reference from domain element resolves without C11 violation

### TC-003: op reference to static-layer element violates C11

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: op prefix SHALL be recognized as a valid domain-layer element type > Scenario: op reference to static-layer element violates C11

### TC-004: unresolved op reference triggers C3

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: op prefix SHALL be recognized as a valid domain-layer element type > Scenario: unresolved op reference triggers C3

---

## TC Group 2: op target line — multiple references

### TC-005: op target line with multiple references passes check

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: op target line SHALL support multiple comma-separated references > Scenario: op target line with multiple references

### TC-006: op target line with unresolved reference triggers C3

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: op target line SHALL support multiple comma-separated references > Scenario: op target line with unresolved reference triggers C3

---

## TC Group 3: perm target line — single-reference constraint

### TC-007: perm target line with single reference passes check

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: perm target line SHALL reject multiple references as C6 error > Scenario: perm target line with single reference passes

### TC-008: perm target line with multiple references triggers C6 error

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: perm target line SHALL reject multiple references as C6 error > Scenario: perm target line with multiple references triggers C6 error

---

## TC Group 4: perm operation line — op reference

### TC-009: valid operation line with op and act references passes C6

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: perm operation line SHALL reference op elements > Scenario: valid operation line with op and act references

### TC-010: unresolved op reference in operation line triggers C6 error

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: perm operation line SHALL reference op elements > Scenario: unresolved op reference in operation line triggers C6 error

### TC-011: non-op prefix in operation line triggers C6 error

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: perm operation line SHALL reference op elements > Scenario: non-op prefix in operation line triggers C6 error

### TC-012: duplicate op reference within same perm triggers exactly one C6 error

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: perm operation line SHALL reference op elements > Scenario: duplicate op reference within same perm triggers C6 error

---

## TC Group 5: fail-closed — malformed operation lines

### TC-013: free-token operation line triggers C6 error

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: free-token operation lines SHALL be rejected as malformed (fail-closed) > Scenario: free-token operation line triggers error

### TC-014: perm with only malformed lines produces exactly two C6 errors

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: free-token operation lines SHALL be rejected as malformed (fail-closed) > Scenario: perm with only malformed lines produces two errors

---

## TC Group 6: implementation tracking

### TC-015: op element with implementation line appears in designed frontier

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: op elements SHALL participate in implementation tracking > Scenario: op element with implementation line appears in designed frontier

---

## TC Group 7: export permissions — op ID keys

### TC-016: export permissions outputs op ID keys in lexicographic order

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: export permissions SHALL use op ID as operation key > Scenario: export permissions outputs op ID keys

---

## TC Group 8: spec/format.md documentation

### TC-017: C11 domain listing in spec/format.md includes op

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: spec/format.md SHALL reflect op in C11 domain listing and perm target constraint > Scenario: C11 domain listing includes op

### TC-018: perm target single-reference constraint documented in spec/format.md

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: spec/format.md SHALL reflect op in C11 domain listing and perm target constraint > Scenario: perm target single-reference constraint is documented

---

## TC Group 9: JSDoc and test name hygiene

### TC-019: PermOperation JSDoc reflects new [[op-id]] grammar

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: JSDoc and test names SHALL be updated for new grammar > Scenario: PermOperation JSDoc reflects new grammar

### TC-020: export permissions test name does not reference "spec §8"

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: JSDoc and test names SHALL be updated for new grammar > Scenario: export permissions test name updated

---

## TC Group 10: structural / unit — TargetLine and operation parsing

### TC-021: TargetLine stores single reference as one-element targetIds array

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-02: `対象:` 行の汎用化と TargetLine 型の導入

**GIVEN** a `対象:` line `対象: [[ent-order]]` is parsed by the structured-lines extractor
**WHEN** the resulting TargetLine is inspected
**THEN** `targetIds` is `["ent-order"]` and `line` is the correct line number

### TC-022: TargetLine stores multiple references as multi-element targetIds array

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-02: `対象:` 行の汎用化と TargetLine 型の導入

**GIVEN** a `対象:` line `対象: [[ent-order]], [[ent-customer]]` is parsed
**WHEN** the resulting TargetLine is inspected
**THEN** `targetIds` is `["ent-order", "ent-customer"]` in declaration order

### TC-023: valid `- [[op-id]]: [[act-id]]` operation line stored with op ID as operation field

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04: perm 操作行の op 参照化（structured-lines）

**GIVEN** an operation line `- [[op-create-deal]]: [[act-admin]]` is parsed by the structured-lines extractor
**WHEN** the resulting PermOperation is inspected
**THEN** `operation` equals `"op-create-deal"` (no brackets) and the line is in `permOperations`, not `malformedPermOperations`

### TC-024: free-token operation line stored as MalformedPermOperation, not in permOperations

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04: perm 操作行の op 参照化（structured-lines）

**GIVEN** an operation line `- create: [[act-admin]]` (free token, not a `[[id]]` reference) is parsed
**WHEN** the parsed results are inspected
**THEN** the line appears in `malformedPermOperations` with the correct `file` and `line` values, and `permOperations` does not contain it

### TC-025: generatePermissions omits target field when perm has no target line

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-06: generatePermissions の対象行取得を targetLines に移行

**GIVEN** a graph with a perm element that has no `対象:` line (empty `targetLines` for that perm)
**WHEN** `generatePermissions` is called
**THEN** the output JSON for that perm does not include a `target` field

### TC-026: generatePermissions includes target field when perm has single target line

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-06: generatePermissions の対象行取得を targetLines に移行

**GIVEN** a graph with a perm element having `対象: [[ent-deal]]` (single-reference target line attributed to the perm)
**WHEN** `generatePermissions` is called
**THEN** the output JSON for that perm includes `"target": "ent-deal"`

---

## TC Group 11: gates

### TC-027: TypeScript compilation passes with no errors

**Category**: gate
**Priority**: must
**Source**: tasks.md > T-01 / T-09 Acceptance Criteria (`bunx tsc --noEmit`)

Verification: `bunx tsc --noEmit` (runs during the verification phase)

### TC-028: All bun tests pass

**Category**: gate
**Priority**: must
**Source**: tasks.md > T-09 Acceptance Criteria (`bun test`)

Verification: `bun test` (runs during the verification phase)

### TC-029: aozu own design/ check result unchanged

**Category**: gate
**Priority**: must
**Source**: tasks.md > T-09: 既存テストの新文法への書き換えと回帰テスト > aozu 自身の design/ の check 結果が不変

Verification: `bun run check` on aozu's own `design/` directory during the verification phase; exit code and diagnostic count must match the baseline (no new errors introduced)

---

## Result

```yaml
result: completed
total: 29
automated: 26
manual: 0
must: 23
should: 6
could: 0
blocked_reasons: []
```
