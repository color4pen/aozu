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
| 1 | MEDIUM | Scope clarity | request.md 要件7 / src/plan/frontier.ts | `Frontier.designed` は現在 `string[]` だが、乖離注記（"drift: ..."）を持つには型変更が必要。新型の形状（例: `Array<{ id: string; drift?: string }>` vs 別フィールド `driftedDesigned`）は request が指定せず実装者の判断に委ねられている。`computeFrontier` シグネチャ変更・`formatFrontier` の出力フォーマット変更が波及するが、request はその範囲に言及しない。 | 実装者は `Frontier.designed` の型変更方針（フィールド拡張 or 分離フィールド）を設計フェーズで決定すること。変更が `src/cli/commands/status.ts:formatFrontier` と既存テスト（`status.test.ts`）に波及する旨を念頭に置くこと。 |
| 2 | LOW | Implementation guidance | request.md 要件2 / src/graph/body.ts | 既存の `extractElementBody`（`src/graph/body.ts`）は body を **宣言行の次の行から**抽出する（`lines.slice(headingIdx + 1, ...)`）が、request 要件2・spec/format.md §9 ともにハッシュ対象は**宣言行（`## Name {#id}`）を含む**「宣言行から次要素の直前まで」と規定する。request は「共有ヘルパ」の作成を求めているが、`extractElementBody` の再利用では宣言行が欠落する旨を明示していない。 | 共有ハッシュヘルパは `extractElementBody` をそのまま転用せず、`el.line`（宣言行インデックス）を始点とする範囲で実装すること（body.ts の既存ロジックを参考にしつつ `headingIdx` を `headingIdx + 1` に上げない）。受け入れ基準「mark と check のハッシュが同一要素で一致する共有ヘルパの等値テスト」でこの差異が捕捉されるため致命的ではないが、実装開始前に把握しておくことを推奨する。 |
| 3 | LOW | Implementation guidance | request.md 要件2 / spec/format.md §9 | 文書要素（seq / top / plan / adr）のハッシュ対象を request は「ファイル全体」と記述するが、`extractElementBody` は「frontmatter の閉じ `---` 以降」を返す。spec §9 は文書要素の範囲を明示しておらず、"ファイル全体（= frontmatter 込み）" か "frontmatter 除く本文" かが微妙に曖昧。 | mark と check が共通ヘルパを使う設計であれば、どちらの解釈を選んでも内部一致は保たれる。ただし将来の変更時に混乱を避けるため、共有ヘルパのコメントに「frontmatter を含む/含まない」の選択理由を明記することを推奨する。 |
