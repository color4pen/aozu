# Spec Review Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- The verdict line MUST appear before the Findings table.
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:    specification is complete, consistent, and ready for implementation
  - needs-fix:   specification has issues that must be resolved before implementation
  - escalation:  unresolvable conflicts, missing context, or requires human judgment
- Findings table MUST have exactly 6 columns in this order:
  # | Severity | Category | File | Description | How to Fix
- Valid Severity values (uppercase): CRITICAL | HIGH | MEDIUM | LOW
  - CRITICAL: production outage, data loss, security breach
  - HIGH:     functional failure, clear bug, no workaround — blocks approval
  - MEDIUM:   quality degradation, maintainability issue, future risk
  - LOW:      informational, style, minor improvement
- If no findings, write a table row with "None" or omit the table body.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | LOW | Inconsistency | request.md:§5 | request.md §5「plan / derive とも loop が無効なら exit 1」が最新の設計と乖離している。spec-review-001 の HIGH finding #1 の解決として design.md D8・tasks.md T-09/T-10 が exit 2（derive + loop 不可）に統一されたが、request.md §5 は更新されなかった。spec.md / design.md / tasks.md の三文書は exit 2 で一致しており、実装を誤誘導する危険はない。また request.md の受け入れ基準（§受け入れ基準）は derive の loop 無効ケースを明示テスト対象としていないため、実際の検証にも影響しない。 | request.md §5 の該当箇所を「plan は exit 1、derive は exit 2（loop 無効は derive にとって設定不備 = D8 参照）」に修正して文書の整合を取る。必須ではないが、将来の読者への混乱防止のため推奨する。 |
| 2 | LOW | Incompleteness | spec.md | spec.md に slug 形式バリデーション（`[a-z0-9]+(-[a-z0-9]+)*` 以外 → exit 2）の BDD シナリオが存在しない。tasks.md T-06 と T-07 は「不正 slug で exit 2、ファイル未生成」の実装仕様とテストを明記しており実装は網羅されているが、spec.md の受け入れ BDD には対応シナリオがない（spec-review-001 finding #5 の LOW 未解消部分）。 | spec.md の "Requirement: plan SHALL fail-closed" 節に「(d) slug が `[a-z0-9]+(-[a-z0-9]+)*` に適合しない場合 exit 2」を追記し、対応シナリオ（`aozu plan ../evil --dir <path>` → exit 2, ファイル未生成）を追加する。 |
| 3 | LOW | Incompleteness | spec.md | spec.md に「テンプレートコマンドが非ゼロで終了した場合 exit 2」のシナリオが存在しない。design.md の Risks 節と tasks.md T-09 は「非ゼロ exit → return 2 + stderr 診断」を明記しているが、spec.md の "Requirement: derive SHALL fail with exit 2" の列挙にこのケースがなく、BDD シナリオもない。テンプレートデュアルモードテスト（tasks.md T-10）もコマンド成功ケースのみを対象としている。 | spec.md の "Requirement: derive SHALL fail with exit 2" の列挙に「(g) `request-template` をコマンドとして実行した結果が非ゼロ exit の場合」を追加し、シナリオ「Given manifest with `request-template: false-command`, When derive is executed, Then exit 2 and stderr contains diagnostic」を追記する。 |

## Summary

spec-review-001 の 5 件の所見に対する対応状況:

| 旧 # | 重篤度 | 対応状況 |
|------|--------|---------|
| 1 | HIGH | **解決済み**: design.md D8 が `derive + loop 無効 → exit 2` の明確な根拠（「設定不備 = 入力不正 = exit 2」）を提示し、tasks.md T-09/T-10 が exit 2 を明記。spec.md / design.md / tasks.md の三文書が一致。request.md §5 のみ旧記述が残るが（上記 finding #1 LOW）、実装への影響なし。 |
| 2 | MEDIUM | **解決済み**: design.md D7 が `shell: true` を明示し「manifest はリポジトリの信頼境界内、ローカル CLI」の根拠を詳述。tasks.md T-09 も `shell: true` を指定して一致。 |
| 3 | LOW | **解決済み**: spec.md に「Scenario: derive rejects when loop is not enabled → exit 2」（l.119-123）と「Scenario: derive rejects when group elements do not resolve → exit 2」（l.126-130）を追加。 |
| 4 | LOW | **解決済み**: spec.md l.13 が `a title heading \`# my-batch\` immediately after the frontmatter` を明記。tasks.md T-05 が `generatePlan` の出力仕様に H1 見出しを追加し、T-07 がテストで固定。 |
| 5 | LOW | **部分解決**: tasks.md T-06 が slug 形式検証（exit 2）と T-07 が異常系テストを追加。ただし spec.md の BDD には未反映（上記 finding #2 LOW）。 |

全 HIGH/MEDIUM 所見が解消されており、残存所見はすべて LOW（情報的不整合・シナリオ補完）。設計の核——依存制約の解決（computeFrontier → mod-plan 移設、findOwningElement → mod-graph 移設）、純粋関数閉じ込め（generatePlan / buildDeriveInstruction）、消費者非依存のテンプレート注入（ADR-0012）、段階ゲート（ADR-0010）——は request.md・design.md・spec.md・tasks.md の四文書で整合しており、実装に進める状態にある。
