# Code Review Feedback — iteration 003

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
- iteration line format (exact): `- **iteration**: NNN` (3-digit zero-padded integer)
- Findings table MUST have exactly 7 columns in this order:
  # | Severity | Category | File | Description | How to Fix | Fix
  - Fix column: yes = fixer should address this finding; no = skip (pre-existing / out-of-scope)
- Scores table columns: Category | Score | Weight
  - Valid Category values: correctness | security | architecture | performance | maintainability | testing
  - Score: integer 1-10
  - Weight: decimal as defined below
- total line format (exact): `- **total**: <decimal>`
- Default weights: correctness=0.30, security=0.25, architecture=0.15, performance=0.10, maintainability=0.10, testing=0.10
- Scores table is optional but recommended.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved
- **iteration**: 003

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | low | testing | src/cli/main.ts / src/cli/commands/plan.test.ts | TC-043 (should): no automated test for `aozu --help` listing `plan` and `prompt`. Both commands are correctly registered in `main.ts:23-24`, and the help output would display them. The gap is test coverage only, not functional correctness. | Add one subprocess test that runs `bun main.ts --help`, captures stderr, and asserts it contains `plan` and `prompt`. Can go in `src/package.test.ts` or a new `main.test.ts`. | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 10 | 0.30 |
| security | 8 | 0.25 |
| architecture | 10 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 9 | 0.10 |

- **total**: 9.35

## Summary

iteration 002 の残存 low finding（TC-044: テンプレートコマンド非ゼロ exit → exit 2 の統合テスト）は本 iteration で修正済み。`prompt.test.ts:418-448` に `"request-template command exits non-zero → exit 2 + stderr diagnostic (TC-044)"` テストが追加され、`request-template: exit 1` を設定した場合に exit 2 かつ stderr に `request-template` が含まれることを確認できた。

**全受け入れ基準 GREEN（実測値）**:

- `tsc --noEmit`: exit 0（型エラー 0）
- `bun test`: 467 pass / 0 fail（45 ファイル。iteration 002 比 +32 テスト）
- `aozu check --dir design/`: exit 0
- `aozu export rules --verify`: exit 0
- `package.json dependencies`: `{}` (空)
- architecture.test.ts: mod-plan → mod-check 等の不許可依存なし、全 green

**必須テストケース（must 37 件）全カバー確認**:

- TC-001〜TC-008 (plan 正常系・ゲート違反): `plan.test.ts` で全て統合テスト済み
- TC-009〜TC-018 (derive 正常系・ゲート違反・非書き込み): `prompt.test.ts` で全て統合テスト済み（TC-017 は `createUnresolvedElementFixture` ヘルパー経由）
- TC-022〜TC-026, TC-028, TC-029, TC-031〜TC-037 (移設・純粋関数・境界テスト): 各ユニットテストで確認済み
- TC-038, TC-040, TC-041 (バリデーション・区切り文字・dispatch): `plan.test.ts` / `derive.test.ts` / `prompt.test.ts` で確認済み
- TC-046〜TC-048 (`export rules --verify` / `bun test` green / architecture): 上記実測値で確認済み

**正本追随の確認**:

- `spec/format.md §3`: `request-template` / `request-output-dir` の任意キーが追補済み（diff 確認）
- `spec/integration.md §4`: 注入点（manifest frontmatter）の明記追加済み（diff 確認）
- `design/static/modules.md`: mod-plan 責務行から「グループへの request 記録」削除、「plan の生成・coverage 検証」に修正済み（diff 確認）
- `design/rules.json`: `export rules --verify` exit 0 により同期確認済み

**実装品質のハイライト**:

- `computeFrontier` 移設: `src/plan/frontier.ts` に移設し、`status.ts` はラッパー経由で backward-compatible に再公開。`IMPLEMENTATION_PREFIXES` に `act` を追加（ADR-0015 × ADR-0005 整合）。`status.test.ts` に `act-sales` を含む回帰テストが追加済み
- `findOwningElement` 移設: `src/graph/attribution.ts` に移設、`src/check/attribution.ts` は re-export に変更（mod-plan → mod-check 依存なし）
- `extractElementBody` / `computeNeighborhood`: mod-graph に新設。それぞれ h2 境界・双方向 BFS で正確に実装。循環参照ガード・self-reference ガード済み
- `buildDeriveInstruction`: 純粋関数。テンプレートは `---TEMPLATE BEGIN---` / `---TEMPLATE END---` で明示区切りされ、指示本文と混同されない
- plan の注釈 3 種（参照辺・mod 接地・実行中要素）が決定的に導出され、check C10 を破らないことを `runCheck` 統合テスト（TC-056）で固定
- `derive` がファイルシステムに一切書かないことをスナップショット比較（listAllFiles before/after）で固定（TC-018）

**残存 low finding**: TC-043（should 優先度）は機能的に正しく（plan / prompt とも main.ts に登録済み）、テスト追加のみで対応可能。ブロッカーではない。

