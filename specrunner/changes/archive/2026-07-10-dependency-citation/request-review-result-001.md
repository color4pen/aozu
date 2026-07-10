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
| 1 | LOW | Clarity | 要件 4 | coverage コマンドが不正依存行を検出したときの診断出力形式が未指定。`check --request` は `CheckDiagnostic` / `format.ts` 系（`ERROR R3 - message (file:line)`）を使うが、`coverage` は `COVERAGE ERROR` 形式を使う。要件 4 は「要件 2 と同じく不合格」と記すが、exit 1 であることは明確でも出力形式は曖昧。 | `extractRequestCitations` が R3 情報を構造体で返す設計を前提として、呼び出し側（coverage.ts）が独自の COVERAGE ERROR 形式でフォーマットする実装を許容する旨を明記するか、または両経路で共通の R3 形式を使う旨を明記する。実装への影響は軽微であり、どちらを選んでも後方互換は保たれる。 |

## Summary

**背景確認**: `handleCheckRequest`（check.ts:73-169）・`extractReferences`（parse/references.ts）・coverage の draftRefs 抽出（coverage.ts:214-215）・`verifyCoverage`（plan/coverage.ts:79）はすべてコードベース上に存在し、request が主張する現状前提と一致する。

**仕様整合**: ADR-0024（accepted, adr/0024-dependency-citation.md）と spec/integration.md §1 §4（merge 済み）が確定設計根拠として存在し、request は確定仕様の実装として正しく位置づけられている。新規設計判断は要求されない。

**要件の実装可能性**: 6 要件はすべて具体的かつ決定的に実装可能。R3（fail-closed）・二種類化・--require-citation のスコープ限定・verifyCoverage シグネチャ維持はいずれも既存コード構造と整合する。

**モジュール配置**: `mod-parse`（structured-lines.ts の同族として依存行認識）/ `mod-cli`（check.ts・coverage.ts の呼び出し側変更）/ `mod-plan`（verifyCoverage の扱い）/ `mod-graph`（引用の実在解決）の 4 依存宣言はすべて妥当。既存の設計依存グラフ（design/static/dependencies.md）に違反しない。

**受け入れ基準**: 8 項目がすべて要件に対応し、テスト可能な具体的条件を持つ。既存テスト無変更 green 要件（基準 8）により後方互換が機械検証される。
