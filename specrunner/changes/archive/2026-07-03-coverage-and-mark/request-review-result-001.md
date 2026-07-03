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
| 1 | LOW | Clarity | 要件2 exit code 仕様 + 受け入れ基準 | `--request <slug>` の文法違反を exit 2 として列挙しているが、valid slug の文法（正規表現・空文字禁止など）が未定義。受け入れ基準にも対応テストケースがない。 | 実装時に slug 文法規則（例: `[a-z0-9][a-z0-9-]*`）を決めて実装コメントに明記するか、spec に1行追記する。`validateId` は element ID 用なので流用不可であることに注意。 |
| 2 | LOW | Clarity | 要件2(d) クロスグループ警告 | クロスグループ参照辺の `after:` 判定には「どの要素がどのグループに属するか」を全 plan にわたって解決する必要があるが、実装の手順が記述されていない。`graph.elementItems` は grp 帰属情報を持たず、`prompt derive` と同様の近接行ロジックで推論が必要。 | 実装上は `prompt derive` の grp 帰属推論ロジック（ファイル内で直前の grp 要素を探すパターン）を参考に共通化できる。仕様への追記は不要だが、実装ノートとして残すと良い。 |
| 3 | LOW | Clarity | 要件4 openTopics 計算 | `parsed.frontmatters` の `topics:` 値はカンマ区切りリスト時に `string[]` に分割される（`parseFrontmatter` の挙動）。`[[top-xxx]], [[top-yyy]]` は `["[[top-xxx]]", "[[top-yyy]]"]` として格納されるため、`extractRefsFromLine` を各要素に適用するか、join してから適用する必要がある。 | 実装時に `string \| string[]` の両ケースを処理するユーティリティを1箇所（mod-state または mod-plan 内）に置き、unit test で両ケースを固定する。 |
| 4 | LOW | Clarity | 現状コードの前提 → `src/state/types.ts` | `types.ts` の JSDoc に「write side is out of scope」と記載されており、writer 追加後に陳腐化する。 | writer 追加時にコメントを更新する。実装作業の一部として自然に対応できる範囲であり、request 本文への追記は不要。 |

## Summary

コードベースの前提記述はすべて実コードと照合済みで正確。設計判断（全遷移 or 全不変、slug は引数で受ける、クロスグループ警告は warn のみ、openTopics は frontmatter 厳密抽出）はそれぞれ adr/0005・0012・0018 と整合している。受け入れ基準は主要ケース（被覆完全・引用漏れ・状態違反・冪等・loop 無効・コードフェンス除外・クロスグループ警告・scaffold テンプレート）を網羅しており、テスト可能。依存グラフ（mod-cli → mod-parse, mod-plan → mod-state）は `dependencies.md` の許可辺内で実装可能（draft の `extractReferences` は mod-cli ハンドラ層で行い、純粋な coverage 判定ロジックは mod-plan に置く分割が自然）。invariants.test.ts T-03 の歯（state.json 書き込みは src/state/ のみ）への準拠も `writeDesignState` 経由設計で維持される。blocking 相当の findings なし。
