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

- **verdict**: needs-fix

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | HIGH | Inconsistency | spec.md:93 | `derive` + loop 無効時の exit code が仕様書間で矛盾している。spec.md §"Requirement: derive SHALL fail with exit 2" の列挙 (a) に「loop not enabled」が含まれており exit 2 を示唆している。一方 request.md §5「plan / derive とも loop が無効なら … exit 1」、design.md D8「false なら … exit 1 を返す」、tasks.md T-09「return 1」、T-10「loop 無効 → exit 1」の 4 文書すべてが exit 1 と規定している。spec.md のみが逆の値を持つ。実装者が spec.md に従えば exit 2、tasks.md に従えば exit 1 となり、テストの期待値が実装者の参照文書によって割れる。 | spec.md の §"Requirement: derive SHALL fail with exit 2" の列挙から (a) を削除し、その代わりに新設した §"Requirement: derive SHALL fail with exit 1 when loop is not enabled"（または plan と並置した共通要件節）に「derive も plan と同様、loop が無効なら exit 1」として記載する。BDD シナリオ「derive rejects when loop is not enabled → exit 1」を追加し、request.md / design.md / tasks.md と一致させる。 |
| 2 | MEDIUM | Security | design.md:D7, tasks.md:T-09 | `Bun.spawn` によるテンプレートコマンド実行において `shell: true` / `shell: false` の区別が未定義。D7「値をシェルコマンドとして実行し stdout を採る」と記述しているが、Bun.spawn のデフォルト（shell: false）では文字列をシェルに渡さず実行ファイル名として解釈するため、`specrunner request template` のようなスペース区切りコマンドが単体では動作しない（コマンドと引数の分割が必要）。shell: true にすれば pipe や subshell 展開も通るが、manifest の内容がそのまま shell に渡される攻撃面が広がる（供給チェーン侵害や悪意 PR によるコマンド注入）。ローカル CLI である以上リスクは低いが、設計として明示が必要。 | D7 に「コマンド実行は `shell: false` とし、`request-template` の値を空白区切りで `[cmd, ...args]` に分割して `Bun.spawn` に渡す」か「`shell: true` とし manifest はリポジトリの信頼境界内とみなす（ADR-0012 の根拠を再確認）」かを明示する。tasks.md T-09 にも対応する実装仕様（スペース区切り分割 or shell: true）を追記し、テストケース（パイプを含むコマンド / スペース区切り引数）を T-10 に追加する。 |
| 3 | LOW | Incompleteness | spec.md | spec.md に derive + loop 無効のシナリオが存在しない。requirements テキストには (a) として言及があるが（exit code が誤りとは別に）、plan には「Scenario: plan rejects when loop is not enabled」があるのに derive には対応シナリオがない。また requirement 列挙 (f) 「group elements that do not resolve to existing elements in the graph → exit 2」のシナリオも欠落している。 | finding #1 の修正にあわせて「Scenario: derive rejects when loop is not enabled → exit code 1, stderr に案内」と「Scenario: derive rejects when group elements are unresolvable → exit code 2, stderr に診断」の 2 シナリオを spec.md に追加する。 |
| 4 | LOW | Incompleteness | tasks.md:T-05, spec.md | 生成される plan ファイルに title heading（`# <表示名>`）が含まれることが要件に書かれていない。spec §5「文書要素の表示名はファイル先頭の `# 見出し` とする」は plan（文書要素）にも適用される。T-05 の `generatePlan` 出力仕様と spec.md シナリオ冒頭の Then 節のいずれも title heading を要求しておらず、生成ファイルが spec §5 の表示名規則を守らない実装が通ってしまう。なお request-review-result-001 finding #3 でも LOW として同件が指摘されている。 | T-05 の `generatePlan` 出力仕様に「frontmatter の直後に `# plan-<slug>` 形式の H1 title heading を出力する」を追記する。spec.md シナリオの Then 節にも「ファイルに `# plan-my-batch`（またはそれに相当する表示名）が含まれる」を加える。 |
| 5 | LOW | Incompleteness | tasks.md:T-06 | T-06 の `handlePlan` 実装仕様および acceptance criteria に、slug の形式検証（spec §4 `slug = [a-z0-9]+("-"[a-z0-9]+)*`）が明記されていない。slug は `plans/<slug>.md` のファイルパス構成に直接使われるため、`../` や `/` を含む値でも受理されうる。ローカル CLI ゆえ実害は限定的だが、spec §4 の文法定義を実行時に強制する検証が仕様として抜けている。 | T-06 の「`args[0]` を slug として取得」の直後に「slug が `/^[a-z0-9]+(-[a-z0-9]+)*$/` に一致しない場合は stderr にエラーを出力して return 2」を追加し、T-07 にその異常系テストを追加する。 |

## Summary

設計の核となる依存方向の解決（computeFrontier → mod-plan 移設、findOwningElement → mod-graph 移設）、純粋関数への閉じ込め（generatePlan / buildDeriveInstruction）、消費者非依存のテンプレート注入（ADR-0012）、段階ゲート（ADR-0010）はいずれも request.md・design.md・tasks.md で整合している。ParseResult の mod-graph 経由 re-export（`src/graph/index.ts` が `ParseResult`, `Element`, `FileInput` を既に re-export していることを確認済み）も問題ない。

ブロッキング障害は 1 件: **spec.md と design.md/tasks.md/request.md の間で derive + loop 無効時の exit code が HIGH レベルで矛盾**している（spec.md は exit 2、その他 3 文書は exit 1）。spec.md を修正して exit 1 に統一するとともに、欠落シナリオを補う必要がある。

セキュリティ面では `Bun.spawn` のシェルモード指定が未定義（MEDIUM）。ローカル CLI の信頼境界内での使用であり直ちにブロッキングではないが、実装前に方針を確定し、設計文書と実装・テストを揃えることを推奨する。
