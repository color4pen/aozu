# Code Review Feedback — iteration 001

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

- **verdict**: needs-fix
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | high | testing | src/cli/commands/prompt.test.ts | TC-017 (must) missing: "derive rejects when group elements do not resolve" — spec.md has this as a required Scenario under "derive SHALL fail with exit 2 for missing configuration or invalid input", and test-cases.md marks it must. The code at prompt.ts:236-243 correctly returns exit 2 with stderr diagnostic when `groupElementIds` contains IDs absent from the graph, but no automated test exercises this path. | Add integration test: create a plan file whose `elements:` line references `[[ent-nonexistent]]` (not declared in any design file), call `prompt derive --group grp-test`, assert exit code 2 and non-empty stderr. | yes |
| 2 | low | testing | src/cli/commands/prompt.test.ts | TC-044 (should) missing: no test for template command returning non-zero exit code. prompt.ts:305-322 handles this (writes stderr diagnostic, returns 2), but the branch is untested. | Add test: set `request-template` to a command that exits non-zero (e.g., `false`), assert exit code 2 and stderr mentions the failure. Can be added together with F-01. | yes |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 8 | 0.25 |
| architecture | 10 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 7 | 0.10 |

- **total**: 8.70

## Summary

実装の全体品質は高い。設計上の判断（computeFrontier と findOwningElement の移設、純粋関数アーキテクチャ、段階ゲートの exit code 分離）はすべて要件通りに具体化されており、architecture test・tsc・bun test・check・export rules --verify がすべて green。

ブロッカーは test-cases.md の must シナリオ（TC-017）のテスト欠落のみ。対応するコードは正しく実装済みであり、テストを 1 件追加するだけで全受け入れ基準を満たせる。

**確認済み要件**:
- `tsc --noEmit`: exit 0（型エラー 0）
- `bun test`: 434 pass / 0 fail（新規 98 テスト含む）
- `aozu check`: exit 0
- `aozu export rules --verify`: exit 0
- `package.json dependencies`: `{}` (空)
- architecture.test.ts: 15/15 pass（mod-plan → mod-check 依存なし等）
- plan 生成物が check C10 を破らないことを `runCheck` 統合テストで確認済み（TC-056）
- spec/format.md §3 に `request-template` / `request-output-dir` 追補済み
- spec/integration.md §4 に manifest frontmatter 注入点明記済み
- design/static/modules.md の mod-plan 責務行修正済み（「グループへの request 記録」削除）

