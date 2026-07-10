# Test Cases: dependency-citation

## Summary

- **Total**: 30 cases
- **Automated** (unit/integration): 27
- **Manual**: 3
- **Priority**: must: 26, should: 4, could: 0

---

### TC-001: 単一の依存行（複数 ID）

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: 依存行は `依存: [[id]](, [[id]])*` の文法で認識される > Scenario: 単一の依存行

---

### TC-002: 複数の依存行

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: 依存行は `依存: [[id]](, [[id]])*` の文法で認識される > Scenario: 複数の依存行

---

### TC-003: 依存行上の単一 ID

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: 依存行は `依存: [[id]](, [[id]])*` の文法で認識される > Scenario: 依存行上の単一 ID

---

### TC-004: カンマ区切りでない依存行

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: 不正な依存行は malformedLines として報告される > Scenario: カンマ区切りでない依存行

---

### TC-005: ID の無い依存行

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: 不正な依存行は malformedLines として報告される > Scenario: ID の無い依存行

---

### TC-006: 空白のみの依存行

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: 不正な依存行は malformedLines として報告される > Scenario: 空白のみの依存行

---

### TC-007: コードフェンス内の依存行は無視される（extractRequestCitations）

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: コードフェンス内の依存行は無視される > Scenario: コードフェンス内の依存行

---

### TC-008: インラインコード内の参照は除外される（extractRequestCitations）

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: インラインコード内の参照は除外される > Scenario: インラインコード内の参照

---

### TC-009: 同一 ID が依存行と本文の両方に現れた場合の出現箇所ごとの分類

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: 同一 ID が依存行と本文の両方に現れた場合、出現箇所ごとに分類される > Scenario: 同一 ID の両出現

---

### TC-010: 依存行の無い文書では coverageRefs に全引用・dependencyIds と malformedLines は空

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: 依存行の無い文書は既存挙動と完全一致する > Scenario: 依存行の無い request 文書

---

### TC-011: extractRequestCitations の coverageRefs が extractReferences の結果と同等

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-02

**GIVEN** 依存行を含まない request 文書のコンテンツがある
**WHEN** extractRequestCitations と extractReferences をそれぞれ同一コンテンツで呼ぶ
**THEN** extractRequestCitations の coverageRefs の targetId 集合が extractReferences の返す Reference の targetId 集合と一致し、dependencyIds が空集合、malformedLines が空配列である

---

### TC-012: extractRequestCitations と RequestCitationResult が公開 API からエクスポートされる

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01

**GIVEN** src/parse/index.ts を import する
**WHEN** extractRequestCitations 関数と RequestCitationResult 型の参照を確認する
**THEN** mod-parse の公開 API（src/parse/index.ts）から extractRequestCitations 関数と RequestCitationResult 型がエクスポートされており、外部モジュールから import できる

---

### TC-013: extractReferences は依存行を含むコンテンツでも挙動が変わらない

**Category**: unit
**Priority**: must
**Source**: design.md > Non-Goals / D1

**GIVEN** `依存: [[ent-a]]` を含む任意の markdown コンテンツ
**WHEN** extractReferences を呼ぶ
**THEN** 行を依存行として特別扱いせず、行内の `[[ent-a]]` は通常の Reference として返される（extractReferences の実装・シグネチャ・挙動に変更なし）

---

### TC-014: verifyCoverage のシグネチャが不変である

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: verifyCoverage のシグネチャは不変である > Scenario: verifyCoverage の型互換

---

### TC-015: implemented 要素の依存引用は check --request で合格

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: check --request は依存引用の状態を問わない > Scenario: implemented 要素の依存引用は合格

---

### TC-016: implemented 要素の被覆引用は check --request で R2 不合格

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: check --request は被覆引用の implemented を R2 で拒否する > Scenario: implemented 要素の被覆引用は不合格

---

### TC-017: 同一 ID が依存行にも本文にもある場合は本文側が R2 の対象

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: check --request は被覆引用の implemented を R2 で拒否する > Scenario: 同一 ID が依存行にも本文にもある場合

---

### TC-018: 依存行上の未解決 ID は R1 error

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: 未解決の依存引用は R1 で拒否される > Scenario: 未解決の依存引用

---

### TC-019: 依存引用のみの文書は --require-citation で R0 不合格

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: --require-citation は被覆引用のみを数える > Scenario: 依存引用のみの文書

---

### TC-020: 文法不一致の依存行は check --request で R3 error・exit 1

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: 不正な依存行は R3 error で exit 1 になる > Scenario: 不正な依存行

---

### TC-021: コードフェンス内の依存行は check --request で完全無視

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** request 文書のコードフェンス内に `依存: [[ent-a]]` の行があり、コードフェンス外に ent-a への引用が一切なく、ent-a が implemented 状態である
**WHEN** check --request を実行する
**THEN** R3 も R2 も R1 も発生せず exit 0（コードフェンス内の依存行は dependencyIds にも malformedLines にも coverageRefs にも影響しない）

---

### TC-022: 被覆引用の未解決 ID は R1 error（既存挙動の維持）

**Category**: integration
**Priority**: must
**Source**: design.md > D3

**GIVEN** request 文書の本文（依存行の外）に `[[ent-unknown]]` があり、ent-unknown が graph に存在しない
**WHEN** check --request を実行する
**THEN** R1 error で exit 1（被覆引用も依存引用と同様に実在解決が課される）

---

### TC-023: R3 診断メッセージの書式が仕様どおり

**Category**: integration
**Priority**: should
**Source**: design.md > D5

**GIVEN** request 文書に `依存: [[ent-a]] と [[ent-b]]` の文法不一致行がある
**WHEN** check --request を実行し、stderr を確認する
**THEN** stderr に `ERROR R3 - malformed dependency line: '依存: [[ent-a]] と [[ent-b]]' (<requestPath>:<lineNumber>)` 形式のメッセージが出力され、行番号が正確である

---

### TC-024: 依存行にしか現れない要素は coverage で NOT_COVERED

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage は依存引用を被覆集合から除外する > Scenario: 依存行のみの要素は NOT_COVERED

---

### TC-025: 草稿に不正な依存行があれば coverage は exit 1

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage の草稿に不正な依存行があれば exit 1 > Scenario: 草稿の不正な依存行

---

### TC-026: 依存行と本文の両方に引用がある要素は coverage で被覆される

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** plan グループに ent-a が含まれ、草稿に `依存: [[ent-a]]` の依存行と本文に `[[ent-a]]` の被覆引用の両方がある
**WHEN** coverage を実行する
**THEN** ent-a は coverageRefs に含まれるため被覆済みと判定され exit 0

---

### TC-027: coverage の malformed 依存行エラーメッセージの書式が仕様どおり

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-05

**GIVEN** 草稿に `依存: [[ent-a]] と [[ent-b]]` の文法不一致行がある
**WHEN** coverage を実行し、stderr を確認する
**THEN** stderr に `COVERAGE ERROR R3 - malformed dependency line: '依存: [[ent-a]] と [[ent-b]]' (<draftPath>:<lineNumber>)` 形式のメッセージが出力され exit 1

---

### TC-028: bunx tsc --noEmit が green

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-07

**GIVEN** 全実装タスク（T-01〜T-06）が完了した状態
**WHEN** `bunx tsc --noEmit` を実行する
**THEN** 型エラーなく exit 0 で完了する

---

### TC-029: bun test が全件 green（既存テスト含む）

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-07

**GIVEN** 全実装タスク（T-01〜T-06）が完了した状態
**WHEN** `bun test` を実行する
**THEN** 新規テストおよび既存テストが全件 pass し、依存行の無い文書に対する既存テストが無変更で green

---

### TC-030: aozu 自身の design/ check 結果が不変

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-07

**GIVEN** 全実装タスク（T-01〜T-06）が完了した状態
**WHEN** `bun src/cli/main.ts check --dir design` を実行する
**THEN** 実装前と同一の診断結果（exit 0）が得られる（extractReferences の挙動変更なし、design 文書パース経路への影響なし）

---

## Result

```yaml
result: completed
total: 30
automated: 27
manual: 3
must: 26
should: 4
could: 0
blocked_reasons: []
```
