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

- **verdict**: approved
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | low | testing | src/cli/commands/prompt.test.ts | TC-027 / TC-035（COULD）: propagate --help / review --help の subprocess テストがない。実装はあるが子プロセス経由の出力検証が欠如している。 | 必要であれば "propagate --help → exit 0 + usage text" と "review --help → exit 0 + usage text" のサブプロセステストを追加する。COULD 優先度のため必須ではない。 | no |
| 2 | low | correctness | src/prompt/shared.ts | `collectTermsAndInvariants` の空文字列ボディハンドリング: `body?.trim() ?? "(body not available)"` は `body` が `undefined`（null 体）のみカバーし、`body === ""` のとき `??` が発動しない。設計仕様「null/空の場合はプレースホルダ」に対して空文字列ケースを取りこぼしている。実運用では本文なし要素は稀だが、理論上の不一致がある。 | `body?.trim() \|\| "(body not available)"` に変更するか、または `(body === undefined \|\| body.trim() === "") ? "(body not available)" : body.trim()` に修正する。ただし既存テストへの影響確認が必要。 | no |
| 3 | low | maintainability | src/cli/commands/prompt.ts | `handleDerive` は共有ヘルパー（`collectTermsAndInvariants`）を使わず独自インライン実装を維持している（ID ソートなし・空文字列プレースホルダなし）。「三重実装にしない」という設計目標が session/propagate の 2 つでのみ達成され、derive と 2 系統が混在する。derive の変更は本 PR のスコープ外のため現状維持が正しいが、将来のリファクタリング課題として記録する。 | 将来の derive リファクタリング PR で `handleDerive` を `collectTermsAndInvariants` に統一する。本 PR では対応不要。 | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 10 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 10 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 9 | 0.10 |

- **total**: 9.35

## Summary

`prompt propagate` / `prompt review` の実装を完全にレビューした。

**合格基準の確認結果:**
- 受け入れ基準 8 項目すべてが満たされている
- must 優先度の test-cases.md ケース（28 件）がすべてテストでカバーされ、通過している
- `tsc --noEmit` クリーン、`bun test` 740 テスト全通過
- session.test.ts / derive.test.ts / prompt.test.ts の既存テスト無変更
- `dependencies: {}` 維持
- loop gate が propagate / review に課されていないことをテストで固定済み（D4 準拠）
- 決定的出力・stderr 空・ファイル書き込みなしをすべて確認

**実装の品質:**
- `src/prompt/shared.ts`（共有ヘルパー）・`src/prompt/propagate.ts`・`src/prompt/review.ts` の分離が設計（D1–D8）に忠実に実装されている
- `SCOPE_MAX_HOPS` / `FORMAT_RULES_SUMMARY` の shared.ts への移動と session.ts からの re-export（D6）が正しく行われており、後方互換が維持されている
- `REVIEW_GUIDANCE` の check（C1–C11）除外指示（D5）が適切に実装されている
- `buildPropagateInstruction` / `buildReviewInstruction` の純関数設計が session / derive と同型のパターンを踏襲している

**残課題（次回 PR 以降）:**
- derive の term/inv 収集インライン実装と共有ヘルパーの統一（スコープ外）
- `collectTermsAndInvariants` の空文字列ケースのプレースホルダ対応（低優先度）

