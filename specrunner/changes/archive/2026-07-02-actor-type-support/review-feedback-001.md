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

- **verdict**: needs-fix
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | high | testing | `src/check/rules/c11-layer-direction.test.ts` | TC-008（must）のテストが逆方向になっている。spec.md シナリオは「term 要素が [[act-approver]] を参照 → C11 エラーなし」（domain→act）を要求するが、追加されたテスト `"domain (act) → domain (term) reference → no diagnostics"` は act が SOURCE・term が TARGET（act→term）であり方向が逆。この状態では `LAYER_ALLOWED_TARGET_PREFIXES.domain` から `"act"` が削除されても当該テストは通過し続ける（act→term のチェックは term が allowed set に含まれるかを見るため）。request.md 受け入れ基準「domain の要素から act への参照が C11 で許可されることをテストで固定する」が実質未充足。 | `c11-layer-direction.test.ts` に `"domain (term) → act reference → no diagnostics"` テストを追加する: term-order (term, glossary.md) が act-approver を参照するグラフを組み `checkC11(graph, ALL_PREFIXES)` が 0 件であることを検証する。これにより `LAYER_ALLOWED_TARGET_PREFIXES.domain` に `"act"` が含まれることが回帰固定される。 | yes |
| 2 | medium | testing | `src/check/manifest.ts` / `src/check/manifest.test.ts` | TC-015（getEnabledPrefixes with domain enabled includes act）と TC-016（with domain disabled excludes act）がともに must 優先度だが manifest.test.ts に追加がない。また degradation.test.ts の TC-016 相当テストは act-approver をグラフに宣言しているため、domain 無効でも C3 は解決済み扱いになり、getEnabledPrefixes が act を誤って含んでも検出できない（テストが常時 green になる）。 | (a) manifest.test.ts に直接ユニットテストを追加: `getEnabledPrefixes({ enabled: ["static","domain"] })` が `"act"` を含む、`getEnabledPrefixes({ enabled: ["static"] })` が `"act"` を含まないことを検証。(b) degradation テストを強化: act-approver をグラフに含めず参照のみ存在させ domain 無効で C3 が出ないことを確認することで縮退ロジックを意味ある形でピン止めする。 | yes |
| 3 | low | testing | `src/parse/id.ts` / `src/check/manifest.ts` | TC-001（`validateId("act-approver")` → `{valid:true}`）・TC-002（`KNOWN_PREFIXES.has("act")`）・TC-003（`LAYER_MAP["act"]` → `"domain"`）・TC-004（`LAYER_TO_PREFIXES.domain` に "act" 含む）はいずれも must 優先度だが id.test.ts / manifest.test.ts に直接テストがない。コード検査で正しいことは明らかであり統合テストで間接的に担保されているため機能リスクは低い。 | F-02 対応時に合わせて manifest.test.ts に TC-003・TC-004 を追加し、id.test.ts に TC-001・TC-002 を追加することを推奨。 | yes |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 10 | 0.25 |
| architecture | 10 | 0.15 |
| performance | 10 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 6 | 0.10 |

- **total**: 9.20

## Summary

実装コードは機能的に正確。4 つの宣言的テーブル（KNOWN_PREFIXES / LAYER_MAP / LAYER_TO_PREFIXES / LAYER_ALLOWED_TARGET_PREFIXES）への追加・C5 の Set ベース判定化・docstring 更新がすべて意図通りに完了し、テーブル駆動の設計原則（act 専用分岐なし）も維持されている。322 テスト全 green・tsc --noEmit・export rules --verify・dependencies 空の全項目が充足。

ブロック要因は F-01 のみ: TC-008 のテストが逆方向（act→term）であり、`LAYER_ALLOWED_TARGET_PREFIXES.domain` に "act" が TARGET として含まれることを直接ピン止めするテスト（term→act）が存在しない。この結果、request.md 受け入れ基準「domain の要素から act への参照が C11 で許可されることをテストで固定する」が未充足となっている。修正は 1 テストケースの追加で完結する。

F-02（manifest.test.ts での getEnabledPrefixes 直接テストおよび縮退テストの強化）は中優先度の補強。F-03（id.ts / manifest.ts 定数の直接テスト）は低優先度の補強。いずれも実装コードの変更は不要で、テスト追加のみで対応できる。
