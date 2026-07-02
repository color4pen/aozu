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
| 1 | MEDIUM | Design consistency | tasks.md | `mod-cli` の責務記述が実装と乖離する — T-10 は import 依存の整合確認のみを行い、`design/static/modules.md` の `mod-cli` 責務行（"検証・導出のロジックを持たない composition root"）を更新するタスクが存在しない。init / scaffold はテンプレート展開と雛形ファイル生成という新しい責務を持ち、この記述と矛盾する。architecture test は `実装:` パスのみを参照するためテストは通過するが、「設計と実装の乖離を作らない」原則に反する。 | T-01 または T-10 にサブタスクを追加し、`mod-cli` の責務行を "コマンド解釈・引数検証・診断の出力整形、およびテンプレートによる設計ディレクトリ雛形生成" に更新すること。 |
| 2 | MEDIUM | Spec ambiguity | tasks.md T-04, spec.md | ADR の NNNN 付番方式が T-04 と spec.md シナリオで矛盾する。T-04 は "adr/ をスキャンして既存の NNNN 最大値 +1 を自動生成する" と記述するが、spec.md シナリオはユーザーが NNNN を含む完全 ID (`adr-0001-my-decision`) を入力する形式を示す。自動生成モデルを実装すると spec.md シナリオの動作が再現できず、ユーザー入力の ID が無視されるか二重 NNNN（`0001-0001-my-decision.md`）が生じるリスクがある。 | spec.md を正本として「ユーザーが NNNN を含む完全 ID を提供し、tool は slug を filename として使用する」モデルを採用することを T-04 に明記する。scan は衝突検出（`adr/<slug>.md` が既存か確認）のみに限定し、自動採番ではないことを注記する。 |
| 3 | MEDIUM | UX / missing guidance | design.md D6, spec.md | `scaffold adr`（loop 有効時）の生成テンプレートに `topics: [[top-xxx]]` プレースホルダを含む設計だが、`top-xxx` は実在しない要素のため、scaffold 直後に `aozu check` を実行すると C3（参照未解決）で失敗する。この動作は仕様に明示されておらず、ユーザーが予期しない check 失敗に直面する可能性がある。受け入れ基準にも scaffold 後 check が失敗することを期待するテストが存在しない。 | D6 に注記を追加し「scaffold で生成する adr は意図的に check 不合格のテンプレートであり、`[[top-xxx]]` をユーザーが実在 topic ID に置き換えるまで C3 が失敗する」と明示する。テンプレート本文にも補足コメントを入れることを推奨する。 |
| 4 | LOW | Spec coverage | spec.md | `scaffold plan <id>` の BDD シナリオが spec.md に存在しない。tasks.md T-05 ではユニットテストとして `scaffold plan plan-my-plan` を明示しているが、spec.md には topic / seq / adr のシナリオのみがある。仕様の自己完結性が低い。 | spec.md の "scaffold SHALL generate type-conformant template files" 要件下に `plan` 型のシナリオ（Given: loop 有効 fixture、When: scaffold plan plan-my-plan、Then: plans/my-plan.md に frontmatter id/status:open が含まれる）を追加する。 |
| 5 | LOW | Spec coverage | tasks.md T-03, design.md D3 | `grp`（plan サブグループ）型への対応が未定義。`grp` は見出し要素型の guidance リスト（mod / term / ent / inv）にも文書要素型リストにも含まれず、`scaffold grp grp-something` は "未知の型 → exit 2" に落ちるが、ユーザーへの追記先案内がない。`grp` は plan ファイル内の見出し要素であり、追記先は `plans/<slug>.md` である。 | T-03 の見出し要素型マッピング定数に `grp → plans/<slug>.md（plan ファイル内の見出し要素）` を追記し、D3 の対象外型説明に `grp` を明示する。エラーメッセージは該当 plan ファイルへの追記を案内する形にする。 |
| 6 | LOW | Security | design.md D9, tasks.md | `--dir` に任意パスを渡すことで設計ディレクトリ外にファイルを生成できる（パス正規化・封じ込め検査なし）。CLI ツールとしてこれは標準的な動作であり攻撃面は低いが、仕様に明示されていない。 | 注記として「`--dir` は作業リポジトリ配下のパスを想定し、ツールはリポジトリ外へのファイル生成を防止しない」を design.md D2/D9 に追記することを推奨する（ブロッカーではない）。 |

## Summary

仕様は全体として高品質で一貫性があり、実装に進める状態にある。設計判断（D1〜D10）は明確な根拠を持ち、受け入れ基準はテスト可能、タスクは詳細かつ順序が明確である。

主な注意点は以下の 3 点（すべて MEDIUM）:

1. **modules.md の更新漏れ** — 架構テストは通過するが設計文書と実装の記述が乖離する。T-10 またはタスク追加で対処すること。
2. **ADR NNNN 付番の曖昧性** — spec.md シナリオを正本として T-04 の記述を「衝突検出」に修正することで解消できる。
3. **scaffold adr テンプレートが check を壊す** — 意図的な動作だが D6 に明記されていない。コメント 1 行の追加で UX が改善される。

セキュリティ上の観点では、CLI ツールとして標準的な範囲であり OWASP Top 10 相当の問題は存在しない。
