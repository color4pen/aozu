# Code Review Feedback — iteration 002

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
- **iteration**: 002

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | low | testing | `src/check/manifest.ts` / `src/check/manifest.test.ts` | TC-003（`LAYER_MAP["act"]` → `"domain"`、unit/must）の直接ユニットテストが manifest.test.ts に存在しない。機能的には C11 テスト `"domain (act) → mod reference → C11 diagnostic"` が LAYER_MAP の act 分類を間接的に担保している（誤分類なら C11 の層判定が崩れ当該テストが失敗する）ため、回帰リスクは低い。前イテレーションの F-03 で指摘済みの未解消項目。 | manifest.test.ts に `LAYER_MAP["act"] === "domain"` を直接アサートするユニットテストを追加することを推奨（LAYER_MAP は export 済み）。 | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 10 | 0.30 |
| security | 10 | 0.25 |
| architecture | 10 | 0.15 |
| performance | 10 | 0.10 |
| maintainability | 10 | 0.10 |
| testing | 9 | 0.10 |

- **total**: 9.90

## Summary

iteration 001 で指摘したすべてのブロック要因が解消されており、承認とする。

**解消確認:**

- **F-01（high）**: `TC-008: domain (term) → act reference → no diagnostics` が c11-layer-direction.test.ts に追加された。`term-order`（domain/term）が `act-approver` を参照するグラフで `checkC11` が 0 件を返すことを検証しており、`LAYER_ALLOWED_TARGET_PREFIXES.domain` に `"act"` が含まれることを直接ピン止めしている。前イテレーションの逆方向テスト（act→term）も引き続き存在するが、当該テストは「domain 要素が act を TARGET にできる」という必要条件を正しく検証していなかったため、TC-008 の追加で要件が充足された。

- **F-02(a)（medium）**: TC-015・TC-016 が manifest.test.ts に直接追加された。`getEnabledPrefixes(["static","domain"])` が `"act"` を含み、`getEnabledPrefixes(["static"])` が含まないことが単体テストでピン止めされた。

- **F-02(b)（medium）**: degradation テストの `act-approver` をグラフ要素に含む構造は変更されていないが、TC-016 が `getEnabledPrefixes` の縮退挙動を直接検証するため、縮退ロジックの回帰は十分に担保されている。

**実装品質:**

- 4 つの宣言的テーブル（KNOWN_PREFIXES / LAYER_MAP / LAYER_TO_PREFIXES / LAYER_ALLOWED_TARGET_PREFIXES）への追加が正確。act 専用分岐なし、テーブル駆動設計を維持。
- C5 の `ALLOWED_ACTOR_PREFIXES` はモジュールスコープの const として定義され、関数内での都度生成より適切。
- `tsc --noEmit` 成功・325 テスト全 green（310 既存 + 15 新規）・dependencies 空・C11 docstring 更新済み。
- 17 件すべての must 優先度テストケース（TC-001〜TC-016、TC-023）が直接または間接に網羅されていることを確認した。

**残存低優先度ギャップ:** TC-003（`LAYER_MAP["act"]` の直接テスト）は manifest.test.ts に存在しないが、C11 テストによる間接担保で機能リスクは実質ゼロ。Fix: no として次改善候補に残す。

