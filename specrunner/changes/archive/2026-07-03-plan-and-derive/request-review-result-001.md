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
| 1 | MEDIUM | Scope Ambiguity | 要件 3・architect 評価 | 要素本文テキストの取得経路が未決。`Element` 型（`src/parse/types.ts`）には `id/prefix/displayName/file/line` のみ存在し、本文は保持されていない。architect 評価は「mod-prompt は純関数、IO は mod-fsread の seam」と述べるが、本文を mod-cli が mod-fsread で読んで mod-prompt に渡す経路と、`Element` 型に body フィールドを追加してパースパイプライン内で保持する経路の 2 案は設計上の分岐点であり、どちらを選ぶかが `Element` 型・parse モジュール・既存テストへの影響範囲を決める。 | architect 評価セクションに「本文取得は `Element` 型拡張（mod-parse 変更）と mod-cli が mod-fsread 経由で後読みする案のいずれかとする」など 1 文方針を追記するか、実装者の裁量として明示する。どちらの案も要件を満たせるため blocking ではない。 |
| 2 | LOW | Clarity | 要件 1 | 生成 plan ファイルの初期グループ ID 命名規則（`{#grp-???}`）が未指定。spec §8 はグループを `{#grp-<slug>}` 形式の見出し要素と定義するが、`aozu plan <slug>` が自動生成するグループ ID の具体的パターン（例: `grp-<slug>`）が記述されていない。テスト時の期待値が実装者の選択に依存する。 | 要件 1 または受け入れ基準に「初期グループ ID は `grp-<slug>` とする」など 1 行追記する。 |
| 3 | LOW | Clarity | 要件 1 | 生成 plan ファイルの `# 見出し`（表示名）が要件に登場しない。spec §5 は「文書要素の表示名はファイル先頭の `# 見出し` とする」と規定し、plan はその文書要素。`check` は閉包規則のみを検証するため absence は直ちに違反にならないが、`status` 等が表示名を参照した場合に空文字列になる可能性がある。 | 要件 1 に「frontmatter の次に `# plan-<slug>` などの title heading を置く」を追記する。 |
| 4 | LOW | Clarity | 要件 4・5 | `request-template` にファイルパスでなくコマンドを指定した場合、そのコマンドが非 0 exit したときの動作が未定義。要件 5 は設定キー欠落を exit 2 とするが、コマンド実行失敗は別ケース。 | 要件 4 または 5 に「テンプレートコマンドの exit code が非 0 の場合は exit 2 + stderr 診断」を 1 文追記する。 |

## Summary

要件・受け入れ基準・ADR 参照を横断して検証した結果、重大な欠陥は見当たらない。

- **ADR 整合性**: すべての設計判断が実在する ADR（0006/0008/0010/0012/0016/0018）と spec/format.md §3・§7・§8 に明確に紐づいており、ADR 内容と要件の間に矛盾はない。
- **依存制約**: `mod-plan -> mod-cli` 不可・`mod-plan -> mod-check` 不可という制約を request 自身が正確に認識し、`computeFrontier` の移設と `attribution.ts` の移設（`mod-graph` へ）という対処方針を architect 評価に明記している。`design/rules.json` の allowed 配列とも整合する。
- **正本文書更新の網羅**: spec/format.md §3（manifest キー追補）・spec/integration.md §4（注入点明記）・design/static/modules.md（mod-plan 責務行修正）の 3 点更新が要件 6 に列挙されており、正本と実装を同一 PR で揃える規律が守られている。
- **受け入れ基準**: loop 有効/無効・slug 衝突・designed 0 件・設定欠落・plan 不在・グループ不在などの境界ケースが個別にテスト固定対象として列挙されており、testability は高い。
- **スコープ外明示**: coverage・mark implemented・state.json 書き込みが明確に後続 request の領分として除外されており、スコープ境界が明確。

MEDIUM 1 件（要素本文取得経路の方針未定）と LOW 3 件（初期グループ ID 命名・plan title heading・テンプレートコマンド失敗の exit code）は実装時に解決可能な範囲であり、pipeline 実行を妨げない。
