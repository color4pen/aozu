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
| 1 | medium | maintainability | `package.json` | `scripts` フィールドが空 (`{}`)。設計仕様 D6 と tasks.md T-01 は `"typecheck": "tsc --noEmit"`, `"test": "bun test"` を明示要求しているが未実装。これにより verification pipeline の typecheck / test / lint フェーズがすべて「script not found」でスキップされ、自動検証が実質機能しなかった（`verification-result.md` 参照）。`tsc --noEmit && bun test` は直接呼び出せば green だが CI では担保されない。 | `"scripts": { "typecheck": "tsc --noEmit", "test": "bun test" }` を追加する | yes |
| 2 | low | performance | `src/parse/parser.ts` | frontmatter の二重パース。`parser.ts` L34 で `parseFrontmatter` を呼び frontmatters を蓄積し、続く `extractDeclarations`（L39）内部でも `parseFrontmatter` を再度呼ぶ。結果として各ファイルの frontmatter を 2 回パースする。L44–51 の診断重複除去ロジックはこの二重処理の workaround として存在しており、設計上の不整合を示している。 | `extractDeclarations` のシグネチャを `(content, filePath, fmResult?: FrontmatterResult)` に拡張し、パース済み結果を渡すか、または `extractDeclarations` に frontmatter パースも委ねて `parser.ts` 側の重複呼び出しを削除する | yes |
| 3 | low | correctness | `src/parse/references.ts`, `src/parse/declarations.ts` | コードフェンス検出に `line.trimStart().startsWith("```")` を使用。`trimStart()` によりインデントが何スペースあっても ` ``` ` をフェンスとみなす。Markdown 仕様では 0–3 スペースが有効なフェンス、4 スペース以上はインデントコードブロック。`tools/check.sh` は `/^\`\`\`/ ` で行頭固定。現実の design/ 文書への影響はゼロだが、仕様外の入力でフェンス状態が誤トグルするリスクがある。 | `line.startsWith("```")` に変更して check.sh と挙動を揃える（ただし 1–3 スペースのインデントフェンスを捨てることになるが、strict プロファイルでは問題ない） | no |
| 4 | low | correctness | `src/parse/declarations.ts` | `findFrontmatterIdLine()` がファイル全体を `/^id:\s/` でスキャンし、frontmatter ブロック外の `id:` 行にもマッチしうる。例：frontmatter なしのファイルに本文行 `id: something` があると、その行番号を frontmatter id の位置として誤報告する。実用上の影響は極めて限定的（フォールバック値は 1 であり、診断メッセージの行番号精度の問題にとどまる）。 | スキャン範囲を `lines.slice(1, fm.bodyStart)` に制限し、frontmatter ブロック内のみを対象とする | no |
| 5 | low | architecture | `src/parse/parser.ts` | `extractStructuredLines` が返す `responsibilities`, `implementations`, `actorIds`, `elementItems` が `parser.ts` 内で無視され、`ParseResult` に含まれない。`spec.md` の Requirement §8 は「SHALL recognize ... as structured data within the parse result」と述べているが、`ParseResult` 型定義（D4）にこれらのフィールドがなく、parser がそれらを破棄している。`dependencyEdges` のみが利用される。設計 D4 は一貫しているが、spec.md の言語と実装の間に意味的な乖離がある。次 request でのモジュール追加時に顕在化する可能性がある。 | 現時点では次 request でのスコープ拡張を待つ（TC-012 は should 優先度）。`ParseResult` 型と `parser.ts` が意図的に絞っていることをコメントで明示することを推奨 | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 9 | 0.25 |
| architecture | 8 | 0.15 |
| performance | 8 | 0.10 |
| maintainability | 8 | 0.10 |
| testing | 9 | 0.10 |

- **total**: 8.7

## Summary

greenfield 実装として全体的に高品質。以下の点は特筆に値する:

**良い点:**
- `tsc --noEmit && bun test` 両方が exit 0（72 tests, 0 failures）
- `tools/check.sh design` は変更後も `OK: 宣言 25 要素 / 参照 15 種` を返し、ベースラインを破壊していない
- 純関数設計（D1）と I/O 分離（`src/fs/`）が clean に実現されており、テストでファイルシステムなしの in-memory テストが可能
- 全 must acceptance criteria を満たす（宣言 25 件・参照 15 種・フェンス/インラインコード除外・診断位置付き・dependencies 空）
- test-cases.md の must 25 ケースが integration/unit 両レベルでカバーされている
- 診断集約（throw しない）・依存ゼロ方針・行指向パース（ADR-0003）を正しく遵守

**要対応（Fix: yes）:**
1. `package.json` の `scripts` フィールドが空のため、verification pipeline の typecheck/test フェーズがスキップされた。`"typecheck"` と `"test"` スクリプトを追加することで CI が自動検証できるようになる（finding #1）。
2. `parser.ts` の frontmatter 二重パースは、`extractDeclarations` へ FrontmatterResult を引き渡すリファクタリングで解消できる。現状の重複除去 workaround を除去し、コードの意図を明確にすることを推奨（finding #2）。

**スコープ外（Fix: no）:**
- フェンス検出の `trimStart()` と check.sh のアンカー検出の差異（finding #3）: design 文書への実影響なし。次 request で追加する文書タイプに備えて修正は推奨するが必須ではない。
- `findFrontmatterIdLine` の境界精度（finding #4）および structured lines の ParseResult 不在（finding #5）は設計 D4 に準拠した意図的判断であり、現状はスコープ内で適切。
