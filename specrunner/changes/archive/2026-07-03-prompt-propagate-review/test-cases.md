# Test Cases: prompt propagate / prompt review

## Summary

- **Total**: 38 cases
- **Automated** (unit/integration): 35
- **Manual**: 3
- **Priority**: must: 28, should: 8, could: 2

---

## propagate — 正常系

### TC-001: 引用ありの ADR で伝播指示の全 8 セクションが stdout に含まれる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The system SHALL output a propagation instruction to stdout when invoked with `prompt propagate --adr <adr-id>` > Scenario: Propagation instruction contains all required sections for an ADR with citations

---

### TC-002: 3-hop 要素が伝播指示の stdout に含まれない

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The system SHALL output a propagation instruction to stdout when invoked with `prompt propagate --adr <adr-id>` > Scenario: 3-hop elements are excluded from propagation instruction

---

### TC-003: 引用 0 件の ADR で exit 0・seed / 近傍セクションがプレースホルダになる

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: The system SHALL output a propagation instruction to stdout when invoked with `prompt propagate --adr <adr-id>` > Scenario: ADR with zero citations produces a valid instruction with empty seed/neighborhood placeholders

---

## propagate — エラー系

### TC-004: --adr 引数欠落で exit 2・stderr に診断・stdout 空

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The system SHALL reject invalid propagate inputs with exit code 2 > Scenario: Missing --adr argument exits with code 2

---

### TC-005: 存在しない ADR ID を指定で exit 2・stderr に ID 名が含まれる

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: The system SHALL reject invalid propagate inputs with exit code 2 > Scenario: Non-existent ADR ID exits with code 2

---

### TC-006: adr 以外の prefix の ID を --adr に指定で exit 2

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: The system SHALL reject invalid propagate inputs with exit code 2 > Scenario: Non-adr prefix ID exits with code 2

---

### TC-007: design ディレクトリ不在で exit 2・stderr に診断・stdout 空

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The system SHALL reject invalid propagate inputs with exit code 2 > Scenario: Design directory not found exits with code 2

---

## propagate — loop gate なし

### TC-008: loop 無効の design で propagate が exit 0

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The system SHALL NOT impose a loop gate on prompt propagate > Scenario: propagate succeeds with loop disabled

---

## review — 正常系

### TC-009: 全要素の本文・形式規則要約・findings 書式指示が stdout に含まれる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The system SHALL output a review instruction to stdout when invoked with `prompt review` > Scenario: Review instruction contains all element bodies and guidance

---

### TC-010: review の指示に check 構造違反（C1〜C11）がレビュー対象外であると明記される

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The system SHALL output a review instruction to stdout when invoked with `prompt review` > Scenario: Review instruction explicitly states check violations are out of scope

---

## review — loop gate なし

### TC-011: loop 無効の design で review が exit 0

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The system SHALL NOT impose a loop gate on prompt review > Scenario: review succeeds with loop disabled

---

## 決定性・副作用なし

### TC-012: propagate を同一入力で 2 回実行すると stdout がバイト同一・stderr 空・ファイル変更なし

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Both propagate and review SHALL produce deterministic output > Scenario: Deterministic propagate output

---

### TC-013: review を同一入力で 2 回実行すると stdout がバイト同一・stderr 空・ファイル変更なし

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Both propagate and review SHALL produce deterministic output > Scenario: Deterministic review output

---

## 共有ヘルパー抽出の回帰

### TC-014: 共有ヘルパー抽出後に session テストが全 pass（テストファイル無変更）

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Shared helper extraction SHALL NOT change session or derive output > Scenario: Session tests pass without modification after shared extraction

---

### TC-015: 共有ヘルパー抽出後に derive テストが全 pass（テストファイル無変更）

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Shared helper extraction SHALL NOT change session or derive output > Scenario: Derive tests pass without modification after shared extraction

---

## shared.ts — 共有ヘルパー単体テスト

### TC-016: collectTermsAndInvariants が term/inv 要素を ID 辞書順に全量連結する

**Category**: unit
**Priority**: must
**Source**: design.md > D1 / tasks.md > T-01

**GIVEN** Graph に `inv-b`、`term-a`、`term-c` の 3 要素が存在し、それぞれ本文が非空である

**WHEN** `collectTermsAndInvariants(graph, files)` を呼び出す

**THEN** 戻り値が `### inv-b\n<body>` → `### term-a\n<body>` → `### term-c\n<body>` の ID 辞書順で連結されていること

---

### TC-017: collectTermsAndInvariants は body が null/空の要素に `(body not available)` プレースホルダを出力する

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01

**GIVEN** Graph に `inv-x` が存在し、対応ファイル内に body が空（または null）である

**WHEN** `collectTermsAndInvariants(graph, files)` を呼び出す

**THEN** 戻り値に `(body not available)` 文字列が含まれること

---

### TC-018: collectStaticModulesSummary が mod 要素を ID 辞書順に縮約形で連結する

**Category**: unit
**Priority**: must
**Source**: design.md > D1 / tasks.md > T-01

**GIVEN** Graph に `mod-a`、`mod-z` の 2 要素が存在し、それぞれの本文に `責務: ...` 行が含まれる

**WHEN** `collectStaticModulesSummary(graph, files)` を呼び出す

**THEN** 戻り値が `### mod-a\n責務: ...` → `### mod-z\n責務: ...` の辞書順であり、`責務:` 行のみが抽出されていること

---

### TC-019: session.ts が SCOPE_MAX_HOPS を SESSION_MAX_HOPS として re-export している

**Category**: unit
**Priority**: must
**Source**: design.md > D6 / tasks.md > T-01

**GIVEN** `src/prompt/shared.ts` に `SCOPE_MAX_HOPS = 2` が定義されている

**WHEN** `src/prompt/session.ts` から `SESSION_MAX_HOPS` を import する

**THEN** 値が `2` であること（re-export により後方互換が維持されていること）

---

### TC-020: session.ts が FORMAT_RULES_SUMMARY を re-export している

**Category**: unit
**Priority**: must
**Source**: design.md > D8 / tasks.md > T-01

**GIVEN** `src/prompt/shared.ts` に `FORMAT_RULES_SUMMARY` が定義されている

**WHEN** `src/prompt/session.ts` から `FORMAT_RULES_SUMMARY` を import する

**THEN** インポートが成功し、shared.ts の値と同一であること

---

## propagate.ts — 純関数単体テスト

### TC-021: buildPropagateInstruction が全 8 セクションを含む文字列を返す

**Category**: unit
**Priority**: must
**Source**: design.md > D2 / tasks.md > T-02

**GIVEN** 有効な `PropagateInput`（adrId、adrBody、seedBodies、neighborBodies、termsAndInvariants、staticModulesSummary、enabledLayers、formatRulesSummary、propagateGuidance がすべて非空）

**WHEN** `buildPropagateInstruction(input)` を呼び出す

**THEN** 戻り値に ADR、Seed Element Bodies、Neighborhood Element Bodies、Terms and Invariants、Static Modules、Enabled Layers、Format Rules、Propagation Guidance の 8 セクション見出しまたは対応する内容がすべて含まれること

---

### TC-022: buildPropagateInstruction で seedBodies が空の場合は seed プレースホルダを出力する

**Category**: unit
**Priority**: should
**Source**: design.md > D2 / tasks.md > T-02

**GIVEN** `seedBodies` が空 Map の `PropagateInput`

**WHEN** `buildPropagateInstruction(input)` を呼び出す

**THEN** 戻り値に `(no seed elements — ADR has no [[id]] citations)` が含まれること

---

### TC-023: buildPropagateInstruction で neighborBodies が空の場合は近傍プレースホルダを出力する

**Category**: unit
**Priority**: should
**Source**: design.md > D2 / tasks.md > T-02

**GIVEN** `neighborBodies` が空 Map の `PropagateInput`

**WHEN** `buildPropagateInstruction(input)` を呼び出す

**THEN** 戻り値に `(no neighborhood elements)` が含まれること

---

### TC-024: buildPropagateInstruction は同一入力で 2 回呼び出すとバイト同一の文字列を返す

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-02

**GIVEN** 固定の `PropagateInput`

**WHEN** `buildPropagateInstruction(input)` を 2 回連続で呼び出す

**THEN** 両者の戻り値が文字列として完全に一致すること

---

## handlePropagate — CLI ハンドラテスト

### TC-025: handlePrompt が "propagate" サブコマンドを handlePropagate へ正しくディスパッチする

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** valid な design ディレクトリと ADR fixture

**WHEN** `handlePrompt(["propagate", "--adr", "adr-0001", "--dir", "<dir>"])` を呼び出す

**THEN** exit code が 0 であり、propagate の出力が stdout に書き出されること

---

### TC-026: handlePrompt のヘルプテキストと未知サブコマンドエラーメッセージに "propagate" が含まれる

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** 任意の設定

**WHEN** `handlePrompt(["--help"])` および `handlePrompt(["unknown"])` を呼び出す

**THEN** 両者の出力に `propagate` という文字列が含まれること

---

### TC-027: handlePropagate に --help を渡すとヘルプ表示で exit 0

**Category**: integration
**Priority**: could
**Source**: tasks.md > T-03

**GIVEN** 任意の環境

**WHEN** `handlePropagate(["--help"])` を呼び出す

**THEN** exit code が 0 であり、stdout に使用方法の説明が含まれること

---

## review.ts — 純関数単体テスト

### TC-028: buildReviewInstruction が全 3 セクションを含む文字列を返す

**Category**: unit
**Priority**: must
**Source**: design.md > D3 / tasks.md > T-04

**GIVEN** 有効な `ReviewInput`（allBodies、formatRulesSummary、reviewGuidance がすべて非空）

**WHEN** `buildReviewInstruction(input)` を呼び出す

**THEN** 戻り値に All Element Bodies、Format Rules、Review Guidance の 3 セクション見出しまたは対応する内容がすべて含まれること

---

### TC-029: buildReviewInstruction は allBodies の要素を ID 辞書順で出力する

**Category**: unit
**Priority**: must
**Source**: design.md > D3 / tasks.md > T-04

**GIVEN** `allBodies` に `ent-z`、`ent-a`、`mod-b` の 3 エントリが格納された `ReviewInput`（Map はソート済みで渡す）

**WHEN** `buildReviewInstruction(input)` を呼び出す

**THEN** 戻り値の要素出力順が `ent-a` → `ent-z` → `mod-b` の ID 辞書順であること

---

### TC-030: REVIEW_GUIDANCE に check 構造違反（C1〜C11）をレビュー対象外とする文言が含まれる

**Category**: unit
**Priority**: must
**Source**: design.md > D5 / tasks.md > T-04

**GIVEN** `src/prompt/review.ts` を import する

**WHEN** `REVIEW_GUIDANCE` 定数の内容を検査する

**THEN** 参照切れ・ID 重複・リンク義務欠落などの構造違反を check の領分として除外することを明示する文字列が含まれること

---

### TC-031: buildReviewInstruction は同一入力で 2 回呼び出すとバイト同一の文字列を返す

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** 固定の `ReviewInput`

**WHEN** `buildReviewInstruction(input)` を 2 回連続で呼び出す

**THEN** 両者の戻り値が文字列として完全に一致すること

---

## handleReview — CLI ハンドラテスト

### TC-032: handlePrompt が "review" サブコマンドを handleReview へ正しくディスパッチする

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-05

**GIVEN** valid な design ディレクトリ

**WHEN** `handlePrompt(["review", "--dir", "<dir>"])` を呼び出す

**THEN** exit code が 0 であり、review の出力が stdout に書き出されること

---

### TC-033: handlePrompt のヘルプテキストと未知サブコマンドエラーメッセージに "review" が含まれる

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-05

**GIVEN** 任意の設定

**WHEN** `handlePrompt(["--help"])` および `handlePrompt(["unknown"])` を呼び出す

**THEN** 両者の出力に `review` という文字列が含まれること

---

### TC-034: handleReview に design 不在のディレクトリを渡すと exit 2・stderr に診断

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-05

**GIVEN** 存在しないディレクトリパス

**WHEN** `handleReview(["--dir", "/nonexistent/design"])` を呼び出す

**THEN** exit code が 2 であり、stderr に診断メッセージが含まれ、stdout が空であること

---

### TC-035: handleReview に --help を渡すとヘルプ表示で exit 0

**Category**: integration
**Priority**: could
**Source**: tasks.md > T-05

**GIVEN** 任意の環境

**WHEN** `handleReview(["--help"])` を呼び出す

**THEN** exit code が 0 であり、stdout に使用方法の説明が含まれること

---

## 全体回帰

### TC-036: tsc --noEmit が pass する

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** 変更後のコードベース

**WHEN** `tsc --noEmit` を実行する

**THEN** 型エラーが 0 件で exit 0

---

### TC-037: bun test 全体が pass する

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** 変更後のコードベース

**WHEN** `bun test` を実行する

**THEN** 全テストが pass し exit 0。session.test.ts / derive.test.ts / prompt.test.ts の既存テストケースにファイル差分がないこと

---

### TC-038: package.json の dependencies フィールドが空オブジェクトである

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** 変更後の package.json

**WHEN** `dependencies` フィールドを確認する

**THEN** `"dependencies": {}` であること（外部依存パッケージが追加されていないこと）

---

## Result

```yaml
result: completed
total: 38
automated: 35
manual: 3
must: 28
should: 8
could: 2
blocked_reasons: []
```
