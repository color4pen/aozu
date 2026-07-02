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
| 1 | low | maintainability | src/cli/commands/scaffold.ts | `fs/promises` が L14 と L16 の 2 箇所でインポートされている（`mkdir` と `stat` が別行）。コンパイルエラーにはならないが冗長。 | `import { mkdir, stat } from "fs/promises";` に統合する。 | yes |
| 2 | low | testing | src/cli/commands/scaffold.test.ts | TC-020（adr/0001-first.md が存在する状態で adr-0002-second を scaffold するシナリオ、"should" 優先度）がテストに含まれていない。また T-04 のタスク説明に「adr/ ディレクトリをスキャンして NNNN 最大値+1 で採番」と記述されチェック済みだが、実装はユーザー提供の番号をそのまま使用しており乖離がある。テストケースおよびタスク記述は実際の挙動（ユーザー指定採番）に合わせて更新が望ましい。 | TC-020 相当のテストを追加し、T-04 の adr 採番説明を「ユーザーが番号付き ID を提供する」旨に修正する。機能そのものは正しく動作しているため動作変更は不要。 | yes |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 9 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 8 | 0.10 |
| testing | 8 | 0.10 |

- **total**: 8.85

## Summary

### 検証結果

| 項目 | 結果 |
|---|---|
| `tsc --noEmit` | ✅ エラーなし |
| `bun test` | ✅ 310 pass / 0 fail（新規 62 テスト） |
| `aozu check` (本リポジトリ) | ✅ exit 0 |
| `aozu export rules --verify` | ✅ exit 0 |
| `package.json dependencies` | ✅ 空のまま |
| 受け入れ基準 must 全 10 項目 | ✅ 全カバー |

### 肯定評価

**G1–G5 の実装品質は高い。**

- `init` の 3 ファイルテンプレートは ADR-0010 段階①の最小プロファイルを正確に表現しており、生成直後に `handleCheck` が exit 0 を返すことが e2e テストで固定されている（TC-001 対応）。
- `scaffold` の D5 バリデーション順序（見出し型チェック → 未知型 → 文法 → prefix → manifest → グラフ衝突）が T-04 の通りに実装されており、TC-013 / TC-015 / TC-016 の「must」ケースがすべてカバーされている。
- `status` の `computeFrontier` は純粋関数として実装されており、open / designed / requested の分類ロジックが単体テストで独立して検証されている（TC-031 / TC-032 対応）。
- `IMPLEMENTATION_PREFIXES` による designed フロンティアの絞り込み（top / plan / grp / adr を除外）は設計文書 D7 の「実装ターゲットのみ対象」という意図を正確に実装している。
- stdout / stderr 分離はすべてのコマンドでサブプロセステスト（TC-009 / TC-027 / TC-030）により固定されている。
- テンプレートはすべてコード内埋め込み（G4）で、実行時ファイル参照なし。`Bun.write` + `fs/promises` 直接使用（D9）も設計判断と一致する。

### 注記

`adrTemplate`（loop 有効時）は `topics: （[[top-xxx]] を記入する）`、`seqTemplate` / `planTemplate` は `[[mod-xxx]]` プレースホルダを含むため、scaffold 直後の check は C3 違反になる。ただし「生成直後に check exit 0」は `init` の要件であり `scaffold` には課されていない（設計 D3 / D6 でテンプレートは編集前提）。動作は意図どおりである。

### 受け入れ基準の対応確認

| 基準 | テスト | 判定 |
|---|---|---|
| 空ディレクトリで init → check exit 0 | `init.test.ts` "generated directory passes aozu check" | ✅ |
| 既存ディレクトリへの init が何も変更せず exit 1 | `init.test.ts` "does not write any files when directory exists" | ✅ |
| scaffold topic（loop 有効 fixture）が §8 適合ファイルを生成 | `scaffold.test.ts` "generated topic has id: top-my-feature and status: open" | ✅ |
| scaffold の ID 文法違反 → exit 1 | `scaffold.test.ts` "returns 1 for an ID with invalid format" | ✅ |
| scaffold の既存 ID 衝突 → exit 1 | `scaffold.test.ts` "returns 1 when the ID already exists" | ✅ |
| scaffold の型無効（loop 無効で topic）→ exit 1 | `scaffold.test.ts` "returns 1 for 'scaffold topic' when loop is not enabled" | ✅ |
| status: 3 フロンティア表示（loop 有効） | `status.test.ts` "outputs 3 frontier sections to stdout" | ✅ |
| status: 退化表示（loop 無効 = 本リポジトリ design/） | `status.test.ts` "outputs summary with element count..." | ✅ |
| stdout / stderr 分離 | 各 test ファイルのサブプロセステスト | ✅ |
| 既存テスト無変更 / tsc / check / export rules / deps 空 | CI 全通過（310/310） | ✅ |
