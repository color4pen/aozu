# Request Review Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- The verdict line MUST appear before the Findings table.
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approve | needs-discussion | reject
  - approve:          No blocking findings (no HIGH, no decision-needed). Request is ready for pipeline execution.
  - needs-discussion: One or more blocking findings (HIGH or decision-needed) resolvable through discussion.
  - reject:           Multiple blocking findings AND requirement contradictions or structural breakdown.
- Findings table MUST have exactly 6 columns in this order:
  # | Severity | Category | Location | Description | Recommendation
- Valid Severity values (uppercase): HIGH | MEDIUM | LOW
  - HIGH:   Request-level defect — goal unclear, acceptance criteria absent/untestable, or critical external constraint unspecified
  - MEDIUM: Scope ambiguity, recommended additions
  - LOW:    Clarity improvements, expression refinements
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approve

## Findings

| # | Severity | Category | Location | Description | Recommendation |
|---|----------|----------|----------|-------------|----------------|
| 1 | LOW | 現状記述の不正確 | request.md「現状コードの前提」要件4 / src/cli/commands/prompt.ts:204-228 | `request-template` / `request-output-dir` 欠落時のエラーメッセージは「修正手順を含まない」と記述されているが、実際のコードはすでに具体的な記入例（`"  request-template: <file-path-or-command>"` / `"  request-output-dir: <output-directory>"`）を含んでいる。「現状コードの前提」と実態が食い違う。 | 実装者は「エラーメッセージを新規追加する作業」と誤解する可能性がある。実作業は「既存エラーメッセージをテストで固定する」＋「init テンプレコメントに導出キー説明を追記する」の二点であることを実装時に確認のうえ進めること。受け入れ基準・要件定義の内容は依然として有効なので実装方針に変更は不要。 |

## Review Summary

要件 1〜5 はいずれもコードベースで実態確認済みの不具合・ergonomics 問題に対応しており、要件定義・受け入れ基準・architect 評価済みの設計判断がそろっている。

- **要件1（format-version フェンス）**: `src/check/manifest.ts` の `parseManifest` が format-version 値をそのまま返すのみでバージョン集合照合を行っていないこと、`spec/format.md §10` に C12 相当ルールが存在しないことをコードで確認。要件・受け入れ基準ともに明確かつ機械検証可能。
- **要件2（topics 書式の統一）**: `src/prompt/session.ts:45` に `topics: top-my-topic`（plain 形式）が存在すること、`src/check/rules/c09-adr-topics.ts:31` の診断メッセージが正書式への導線を欠くことを確認。修正範囲は例示とメッセージのみで、C9 判定ロジック変更なし。
- **要件3（scaffold prefix 自動補完）**: `src/cli/commands/scaffold.ts:233-242` が id にフル ID（prefix 込み）を要求しており、`DOCUMENT_TYPE_PREFIX` 定数（lines 29-33）を利用した自動補完の実装経路が明快。型矛盾 prefix を error にする fail-closed 方針も明記。
- **要件4（derive 導線改善）**: エラーメッセージは既に記入例を含む（Finding #1）。残作業は init テンプレコメント追記とテスト固定であり、受け入れ基準は有効。
- **要件5（mark ergonomics）**: `src/cli/commands/mark.ts:122-130` が `--request` フラグのみ受理し positional を受け付けないこと、`mark --help`（lines 51-62）がサブコマンド名のみで主要オプション要約を欠くことを確認。「加算的変更・既存 spec-runner hook に無影響」の設計方針も適切。

全受け入れ基準が機械検証可能な形式で記述されており、blocking となる HIGH 所見・要決断事項なし。
