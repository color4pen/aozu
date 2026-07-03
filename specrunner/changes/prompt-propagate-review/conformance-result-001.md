# Conformance Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:   implementation conforms to tasks.md, design.md, spec.md, and request.md
  - needs-fix:  one or more upstream artifacts are not satisfied by the implementation
  - escalation: conformance cannot be determined (missing artifacts, unresolvable ambiguity)
- The Findings table records the per-artifact judgment.
-->

- **verdict**: approved

## Conformance Findings

| Artifact | Conforms | Notes |
|----------|----------|-------|
| tasks.md | ✅ yes | 全 47 チェックボックスが [x] — T-01〜T-06 完了 |
| design.md | ✅ yes | D1〜D8 すべて実装で確認済み |
| spec.md | ✅ yes | 7 Requirement / 12 Scenario すべてテストでカバー・通過 |
| request.md | ✅ yes | 受け入れ基準 8 項目すべて満たされている |

---

## 1. tasks.md — All Checkboxes Complete

tasks.md の全チェックボックスが `[x]` になっている。

| Task | チェックボックス数 | 状態 |
|------|-----------------|------|
| T-01: 共有ヘルパー抽出 (src/prompt/shared.ts) | 8 | ✅ all [x] |
| T-02: buildPropagateInstruction 純関数 | 5 | ✅ all [x] |
| T-03: handlePropagate CLI ハンドラ | 14 | ✅ all [x] |
| T-04: buildReviewInstruction 純関数 | 5 | ✅ all [x] |
| T-05: handleReview CLI ハンドラ | 9 | ✅ all [x] |
| T-06: 全体回帰検証 | 6 | ✅ all [x] |

---

## 2. design.md — Design Decisions Implemented

| 決定 | 内容 | 実装確認 |
|------|------|---------|
| D1 | 共有ヘルパー抽出先 `src/prompt/shared.ts` | ✅ `collectTermsAndInvariants` / `collectStaticModulesSummary` が export されている |
| D2 | propagate 注入スコープ = ADR-0019 規則の ADR 起点適用（seed → 2-hop 近傍・inv/term 全量・static 縮約） | ✅ `handlePropagate` が `SCOPE_MAX_HOPS=2` で `computeNeighborhood` を呼び出している |
| D3 | review 初版は全量注入（ID 辞書順・全要素） | ✅ `handleReview` が `[...graph.elements.keys()].sort()` → `extractAllBodies` を実行 |
| D4 | propagate / review に loop gate を課さない | ✅ `handlePropagate` / `handleReview` に `isLayerEnabled("loop", ...)` チェックなし。loop 無効 fixture でのテストが固定済み |
| D5 | check の領分（C1〜C11）を `REVIEW_GUIDANCE` から明示除外 | ✅ `REVIEW_GUIDANCE` に「Excluded from scope (check's domain)」セクションで C1〜C11 を列挙 |
| D6 | `SCOPE_MAX_HOPS` を `src/prompt/shared.ts` に移動、`session.ts` から re-export して後方互換維持 | ✅ `session.ts` L26: `export { SCOPE_MAX_HOPS as SESSION_MAX_HOPS, FORMAT_RULES_SUMMARY } from "./shared.ts"` |
| D7 | 純関数入力型 `PropagateInput` / `ReviewInput` を定義。Map のソートは呼び出し側責任 | ✅ 両型が各ファイルで定義・export されている |
| D8 | ファイル構成（shared.ts / propagate.ts / review.ts / prompt.ts 拡張・対応テスト群） | ✅ `git diff main...HEAD --stat` で全ファイルの存在を確認済み |

---

## 3. spec.md — Requirements and Scenarios

### Requirement 1: prompt propagate — stdout 出力（SHALL）
- Scenario「全セクション含有（ADR 本文・seed・2-hop 近傍・inv/term・static 縮約・format rules・propagation guidance）」: ✅ `handlePropagate — normal case stdout` 群でセクション別 assert を確認
- Scenario「3-hop 要素が除外される」: ✅ `handlePropagate — 2-hop scope boundary` が `ent-hop3` 本文の不在を確認

### Requirement 2: propagate — 入力不正 exit 2（SHALL）
- Scenario「--adr 引数欠落 → exit 2」: ✅
- Scenario「ADR 不存在 → exit 2 + stderr」: ✅
- Scenario「非 adr prefix → exit 2 + stderr」: ✅
- Scenario「design 不在 → exit 2」: ✅

### Requirement 3: propagate — loop gate なし（SHALL NOT）
- Scenario「loop 無効で exit 0」: ✅ `handlePropagate — loop gate absent` が loop なし fixture で exit 0 を確認

### Requirement 4: prompt review — stdout 出力（SHALL）
- Scenario「全要素本文・書式指示・check 除外指示」: ✅ `handleReview — normal case stdout` 群でカバー
- Scenario「check 違反が scope 外と明記されている」: ✅ `REVIEW_GUIDANCE` の C1〜C11 列挙を assert で確認

### Requirement 5: review — loop gate なし（SHALL NOT）
- Scenario「loop 無効で exit 0」: ✅ `handleReview — loop gate absent` でカバー

### Requirement 6: 決定的出力（SHALL）
- Scenario「propagate 決定性・stderr 空・ファイル書き込みなし」: ✅ 専用テスト群でカバー
- Scenario「review 決定性・stderr 空・ファイル書き込みなし」: ✅ 専用テスト群でカバー

### Requirement 7: 共有ヘルパー抽出で session / derive 出力が変わらない（SHALL NOT）
- `git diff main...HEAD -- src/prompt/session.test.ts src/prompt/derive.test.ts` が空（テストファイル無変更）
- `bun test src/prompt/session.test.ts src/prompt/derive.test.ts`: 59 テスト全 pass

---

## 4. request.md — Acceptance Criteria

| # | 受け入れ基準 | 判定 |
|---|------------|------|
| AC-1 | propagate: ADR 本文・seed 本文・2-hop 近傍本文・inv/term・static 縮約・形式規則・反映作法指示を stdout でテスト固定 | ✅ |
| AC-2 | propagate: 2-hop 外の要素本文が stdout に含まれないことをテスト固定 | ✅ |
| AC-3 | propagate: 引用 0 件 → exit 0、ADR 不存在・非 adr prefix・design 不在 → exit 2 をテスト固定 | ✅ |
| AC-4 | review: 全要素本文・findings 書式指示・「check 対象外」指示を stdout でテスト固定 | ✅ |
| AC-5 | loop 無効の design で propagate / review とも exit 0 をテスト固定 | ✅ |
| AC-6 | 両動詞: バイト同一 stdout・stderr 空・ファイル書き込みなしをテスト固定 | ✅ |
| AC-7 | session / derive の既存テストが無変更で green | ✅ |
| AC-8 | `tsc --noEmit && bun test` green / `dependencies: {}` | ✅ |

**tsc --noEmit**: 出力なし（pass）  
**bun test**: 740 テスト / 0 fail  
**package.json dependencies**: `{}`（空）

---

## 5. Summary

実装はすべての設計判断（D1〜D8）・仕様要件（7 Requirement / 12 Scenario）・受け入れ基準（8 項目）を満たしている。

- `src/prompt/shared.ts`・`src/prompt/propagate.ts`・`src/prompt/review.ts` の三ファイルと CLI ハンドラ拡張が設計どおり分離されている
- `SCOPE_MAX_HOPS` / `FORMAT_RULES_SUMMARY` の re-export による後方互換が維持されており、session/derive の既存テストが無変更で全通過している
- loop gate の不在が propagate・review 両方でテストにより固定されており、D4（adr は常時層）の設計意図が実装に反映されている
- `REVIEW_GUIDANCE` の check 除外指示（D5）が C1〜C11 を明示列挙しており、決定的検証と非決定的レビューの領分が明確に分離されている
- コードレビュー（review-feedback-001.md）が指摘した低優先度事項はいずれも本 PR スコープ外（Fix: no）であり、conformance 判定に影響しない
