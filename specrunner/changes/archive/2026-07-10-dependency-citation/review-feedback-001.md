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
| 1 | low | testing | src/cli/commands/check-request.test.ts, src/cli/commands/coverage.test.ts | TC-023 / TC-027 (should 優先度) の stderr フォーマット検証が欠落。AC#4 と coverage malformed テストは exit code のみを検証しており、`ERROR R3 - malformed dependency line: '...' (<file>:<line>)` の実際の文字列フォーマットをサブプロセス経由で確認するテストがない。実装コードを直接確認した範囲では書式は仕様（design.md D5 / tasks.md T-05）に準拠している。 | サブプロセス（Bun.spawn）を使った統合テストを追加して stderr を文字列照合する。"should" 優先度であり任意のイテレーションで対応可。 | no |
| 2 | low | maintainability | src/cli/commands/check.ts (L181-190) | 依存引用の R1 診断の `line` フィールドが `1` 固定。`dependencyIds` は `Set<string>` で行番号を持たないため、エラー位置の精度が低い。被覆引用の R1 も dedup 後に `line: 1` であり、これは変更前からの既存挙動の踏襲であって本 request 由来の退行ではない。設計書（design.md D3）は R1 行番号精度を要求していない。 | 将来 `dependencyIds` を `Map<string, number>` に変更して初出行を保持すると精度が上がるが、設計変更を伴うため本 request のスコープ外。 | no |
| 3 | low | testing | src/parse/request-citations.test.ts | TC-012（公開 API エクスポート確認）のテストが `./request-citations.ts` 直接 import であり、`src/parse/index.ts` 経由のエクスポートを自動テストで検証していない。`src/parse/index.ts` を読んで人手確認した結果は正しくエクスポートされている。TypeScript コンパイル通過で静的に保証される範囲ではある。 | `src/parse/index.ts` から named import するテストを 1 件追加すると明示的になる。低優先。 | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 10 | 0.30 |
| security | 10 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 8 | 0.10 |

- **total**: 9.45

## Summary

全受け入れ基準（AC#1〜#10）を満たしている。`bunx tsc --noEmit` exit 0、`bun test` 895 pass / 0 fail、`bun src/cli/main.ts check --dir design` exit 0 をすべて手動実行で確認済み。

設計判断（D1〜D5）がコードに忠実に反映されており、`extractReferences` / `verifyCoverage` は無変更。コードフェンス toggle や `DEP_ID_RE.lastIndex = 0` リセット、seenCoverage による重複 R1 抑制など、細部まで正確に実装されている。

findings はいずれも low severity で、コードフィクサーによる修正は不要（Fix = no）。

