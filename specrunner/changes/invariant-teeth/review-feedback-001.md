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
| 1 | medium | testing | tests/invariants.test.ts | test-cases.md が 27 件の automated テストを宣言しているが、実装は 22 件（差分 5 件）。**must** 優先度の TC-004（`extractInvariantIds` の unit test with synthetic fixture）、TC-005（`collectNonTestTsFiles` が `.test.ts` を除外する unit test）、TC-027（`src/cli/` と `src/prompt/` が verdict-owning modules リストに含まれないことの明示的 test）が未実装。TC-002（missing ID でテストが失敗する失敗パス test）と TC-026（`src/plan/` 動的追加の could テスト）も未実装だが優先度は低い | 各 TC について `it(...)` ブロックを追加する。TC-004: fixture 文字列を `extractInvariantIds` に渡し抽出 ID の配列を assert する。TC-005: テンポラリの仮想ファイルリストを用いず、`collectNonTestTsFiles` の返す配列に `.test.ts` が含まれないことを `src/` 実走査で assert する（現在の scan テストが副産物として保証しているが、専用 `it` が必要）。TC-027: `getVerdictModuleDirs()` の返す配列に `src/cli` と `src/prompt` が含まれないことを assert する | yes |
| 2 | low | correctness | tests/invariants.test.ts / specrunner/changes/invariant-teeth/design.md | TC-015 の fixture `'new RegExp("\\[\\[")'` は JS 実行時に `new RegExp("\[\[")` という文字列（単一バックスラッシュ形式）を表す。これはソースに `\[\[` を含むため `REF_GRAMMAR_RE` で検出される。しかし TypeScript の実際のコードでは `new RegExp("\\[\\[")` （二重バックスラッシュ）と書き、ソースに `\\[\\[` が現れる。`REF_GRAMMAR_RE = /\\\[\\\[/` は `\[\[`（4 文字）を探すため、`\\[\\[`（6 文字）には**マッチしない**。design.md D4 の「`new RegExp("\\[\\[")` は `\[\[` の部分文字列を含むため捕捉される」という主張は誤りである。実用上は `src/parse/` が regex リテラルのみを使うため実害はないが、TC-015 のコメントが誤解を招く | TC-015 のコメントを「単一バックスラッシュ形式を模した fixture（実際の慣用コードは regex リテラルを使用）」のように修正し、design.md D4 のリスク欄に「`new RegExp("\\[\\[")` 形式（二重バックスラッシュ）は検出されないが、現実の参照解釈コードは regex リテラルを用いるため実害なし」を追記する | no |
| 3 | low | maintainability | tests/invariants.test.ts:83 | `collectNonTestTsFiles` が `export` されているが、テストファイル外からの利用がなく不要な `export` である | `export` キーワードを削除し、ファイル内の private ヘルパーとする | yes |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 10 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 10 | 0.10 |
| maintainability | 8 | 0.10 |
| testing | 7 | 0.10 |

- **total**: 9.05

## Summary

### 概要

`tests/invariants.test.ts` の新設による 5 本の不変条件（`inv-*`）の機械検証を実装したチェンジ。品質ゲートはすべて通過している。

**通過した検証項目:**
- `tsc --noEmit` exit 0 ✓
- `bun test` 358 テスト全 green（既存 336 + 新規 22）✓
- `bun src/cli/main.ts check` exit 0 ✓
- `bun src/cli/main.ts export rules --verify` exit 0 ✓
- `package.json` の `dependencies` が `{}` のまま ✓

**コアロジックの正確性:**
- `detectStateWriteViolation`（write API + `state.json` 共起検出）: fixture 陽性/陰性・実ソース走査ともに正確
- `detectReferenceGrammarViolation`（`\[\[` regex 禁止域検出）: regex リテラル形式の検出は正確。実コードベースが regex リテラルのみを使用するため実用上の問題なし
- `detectNondeterministicViolation`（subprocess/fetch 禁止域検出）: 4 パターン（Bun.spawn / child_process / Bun.$ / fetch(）の陽性 fixture と`.exec(` の陰性 fixture を網羅
- 対応表の完全性検証（invariants.md との ID 突合）: 実装済みで 5 本すべて一致

**要注意点:**
Finding #1 は test-cases.md で `must` とされた TC-004/TC-005/TC-027 が実装されていない点。コア検証ロジックの fixture テストは実装済みだが、ヘルパー関数（`extractInvariantIds`・`collectNonTestTsFiles`）の独立 unit test と `getVerdictModuleDirs` の除外挙動の明示的 test が欠けている。機能は正しく動作しているが、将来の変更時の回帰検知力が下がる。

Finding #2（design.md の `new RegExp("\\[\\[")` 捕捉の主張不正確）は実害がないため `no-fix` としたが、将来 RegExp コンストラクタ形式が使われた場合に検出漏れの リスクがあることを認識しておく必要がある。
