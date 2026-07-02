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
| 1 | low | architecture | src/check/manifest.ts | `manifest.ts` は `import type { ParseResult } from "../parse/types.ts"` で `mod-parse` を直接 import している。設計の依存方向は `mod-check → mod-graph → mod-parse` のみ許可されており、`mod-check → mod-parse` は `design/static/dependencies.md` に存在しない。`type` import のため実行時依存は生じないが、宣言上の境界違反。`parseManifest` のシグネチャを `frontmatters: Map<string, Record<string, string \| string[]>>` に変更するか、`ParseResult` を `src/graph/index.ts` から re-export することで解消できる。 | `parseManifest` のパラメータ型を `ParseResult["frontmatters"]` の替わりに `Map<string, Record<string, string \| string[]>>` として `parse/` への直接 import を除去するか、`src/graph/index.ts` で `export type { ParseResult } from "../parse/types.ts"` を追加する。 | yes |
| 2 | low | maintainability | src/check/checker.ts | `getEnabledLayers` を import しているが、関数本体では使用されていない。`getEnabledPrefixes` と `isLayerEnabled` のみ使用。未使用 import はコードの意図を曖昧にする。 | import 文から `getEnabledLayers` を削除する。 | yes |
| 3 | low | maintainability | src/check/rules/c07-manifest-prerequisites.ts | `LAYER_ENABLED_NAMES` と `VIEW_TYPE_NAMES` を import しているが、`checkC7` 関数本体では一切使用されていない。 | import 文から `LAYER_ENABLED_NAMES` と `VIEW_TYPE_NAMES` を削除する。 | yes |
| 4 | low | maintainability | src/check/rules/c03-ref-resolved.ts, src/check/rules/c11-layer-direction.ts | C3・C11 の両実装で参照元要素の特定に `graph.rawElements.find((el) => el.file === ref.file)` を使用している（O(n×m)）。strict プロファイルの「1 ファイル 1 要素宣言」前提のもとでは正しく動作するが、前提がコメントに記載されていないため暗黙の仮定になっている。また参照数 × 要素数のループが大規模 repo で性能問題になる可能性がある。 | コメントに「このファイルには要素宣言が 1 つだけ存在するという strict プロファイルの前提に依存している」旨を追記する。将来的には `Graph` に `fileToElement: Map<string, Element>` インデックスを追加すると O(1) になる。 | yes |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 10 | 0.25 |
| architecture | 8 | 0.15 |
| performance | 8 | 0.10 |
| maintainability | 8 | 0.10 |
| testing | 9 | 0.10 |

- **total**: 8.90

## Summary

実装品質は高い。184 テスト全 green・`tsc --noEmit` クリーン・`dependencies` 空・`design/` 自己検証 0 件・`tools/check.sh` 出力変化なし と、受け入れ基準をすべて満たしている。

**正しく実装された点:**

- C1〜C11 の全規則が `src/check/rules/` に独立モジュールとして実装され、設計 D4 の方針に従って単体テストが揃っている
- `rawElements`（宣言順配列）と `elements`（Map、last-wins）を分離して C2 の重複検出を正確に実装している点は特に適切
- `Graph` が `manifestPath` のみを保持し、`Manifest` は外部で解析して渡す設計（D8）により `mod-check → mod-state` 依存を回避できている
- C6 の fail-closed（ビュー型が `enabled` に含まれれば診断を出す）が `VIEW_TYPE_NAMES` を使って簡潔かつ網羅的に実装されている
- 段階縮退（graceful degradation）のテストが `degradation.test.ts` に丁寧に書かれており、`enabled: static` でのスキップ動作と `enabled: static, domain, use-case` での C6 発火を両方カバーしている
- test-cases.md の must 29 件がすべてカバーされている（verification-result.md 確認）

**指摘事項（全 low）:**

1. `manifest.ts` が `mod-parse` を直接 import している（`import type` だが宣言依存違反）
2. `checker.ts` と `c07-manifest-prerequisites.ts` に未使用 import が計 3 件
3. C3・C11 のファイル→要素ルックアップが O(n×m) かつ「1 ファイル 1 要素」前提を暗黙に仮定している

blocking 要因なし。次 request（CLI 結線）に進んで問題ない。
