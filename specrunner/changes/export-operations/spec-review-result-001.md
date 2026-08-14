# Spec Review Result

<!-- EVIDENCE REPORT FORMAT:
     verdict は CLI が typed findings から導出する。この file に verdict 行を書かない。
     findings は report_result（typed）で報告し、この file はその補足の evidence report である。
     decision-needed の finding がある場合は escalation として扱われる。
-->

## 検証した項目

### 読んだファイル

- `specrunner/changes/export-operations/request.md` — 要件・受け入れ基準・設計判断
- `specrunner/changes/export-operations/design.md` — D1〜D5 設計判断
- `specrunner/changes/export-operations/tasks.md` — T-01〜T-06 タスク定義
- `specrunner/changes/export-operations/spec.md` — 9 Requirements / 17 Scenarios
- `spec/format.md §11` — operations export スキーマ定義（正典）
- `src/export/permissions.ts` — 参照パターン（generatePermissions 純関数）
- `src/cli/commands/export.ts` — 既存 CLI 定型（permissions/rules サブコマンド分岐）
- `src/cli/commands/export.test.ts` — 既存 CLI 統合テスト
- `src/export/permissions.test.ts` — 既存 unit テスト（参照パターン）
- `src/export/index.ts` — 現状の re-export 定義
- `src/graph/types.ts` — Graph 型（targetLines / implementations 含む）
- `src/parse/types.ts` — TargetLine / ImplementationEntry 型
- `src/graph/attribution.ts` — findOwningElement 実装
- `src/check/manifest.ts` — LAYER_MAP / parseManifest / LAYER_ENABLED_NAMES

### 検証した観点

#### 1. SHALL キーワード充足（spec rules §spec 記法 条件3）

spec.md の全 9 Requirements の本文に SHALL が含まれることを確認：

| # | Requirement header | SHALL |
|---|---|---|
| 1 | export operations SHALL produce spec §11 operations JSON | ✓ |
| 2 | target and implementation keys SHALL be omitted when absent | ✓ |
| 3 | operations SHALL be sorted by id ascending | ✓ |
| 4 | target array SHALL preserve declaration order | ✓ |
| 5 | implementation array SHALL preserve declaration order | ✓ |
| 6 | domain not enabled SHALL cause exit 1 | ✓ |
| 7 | domain enabled with zero ops SHALL produce empty list with exit 0 | ✓ |
| 8 | --out option SHALL write to file | ✓ |
| 9 | existing export subcommands SHALL remain unchanged | ✓ |

全 9 Requirements が条件を充足する。

#### 2. Scenario の Given/When/Then 形式

全 17 Scenarios が Given/When/Then 形式であることを確認済み。省略なし。

#### 3. request.md 受け入れ基準 → spec.md Requirements の対応

| 受け入れ基準 | 対応 Requirement |
|---|---|
| `対象:`・`実装:` つき op で spec §11 形式 JSON | Requirement 1 (Scenario: op with target and implementation) |
| `対象:` / `実装:` 無い op でキー省略 | Requirement 2 (2 Scenarios) |
| 複数 op が id 昇順 | Requirement 3 (Scenario: multiple ops in non-alphabetical declaration order) |
| 同一入力でバイト一致（決定性） | Requirement 3 (Scenario: deterministic output on repeated runs) |
| domain 未有効で exit 1 | Requirement 6 (Scenario: domain not in enabled list) |
| domain 有効・op 0 件で `operations: []` / exit 0 | Requirement 7 |
| `--out` でファイルへ書ける | Requirement 8 (Scenario: --out writes to file) |
| `--out` 引数なしで exit 2 | Requirement 8 (Scenario: --out without path argument) |
| export rules / permissions の既存テストが green | Requirement 9 (2 Scenarios) |

全 8 受け入れ基準が対応 Requirement を持つ。

#### 4. spec/format.md §11 との整合

spec.md が記述する出力形式・順序・省略規則を spec/format.md §11 operations export と照合：

- `format-version: 0`（数値） ✓
- `operations` 配列 ✓
- 各要素 `id`・`name`（必須）/ `target`（省略可）/ `implementation`（省略可） ✓
- `operations` は id 昇順、`target`/`implementation` は宣言順 ✓
- `--verify` なし・コミット済み成果物なし（ADR-0025 D3） ✓
- domain 未有効 → exit 1 / domain 有効・op 0 件 → 空リスト exit 0 ✓

#### 5. domain 有効チェックの正確性

`op: "domain"` は manifest.ts の `LAYER_MAP` で確認済み。`LAYER_ENABLED_NAMES` に "domain" が含まれ、manifest の `enabled` リストに "domain" という文字列が入る。design.md D2 と spec.md Requirement 6 が指定する `manifest.enabled.includes("domain")` は正確。

比較: permissions の `manifest.enabled.includes("permission")` は view type 名（"permission"）を使う。operations が layer 名（"domain"）を使うのは設計上の相違ではなく、perm が views 層・op が domain 層という型体系の相違に対応した正しい実装。

#### 6. 純関数分離パターンの整合

- permissions.ts の `generatePermissions(graph: Graph): { json: string }` が確立した定型 ✓
- design.md D1・spec.md Requirement 1 が同じシグネチャを要求 ✓
- domain 有効チェックは CLI 層で行い generateOperations は Graph のみ受け取る（D5） ✓
- index.ts への re-export（T-03）は現状の `generatePermissions` 追加パターンに倣う ✓

#### 7. Graph 型との整合

- `graph.targetLines: TargetLine[]`（`targetIds: string[]` + file/line）→ 複数 ID を配列で収集可能 ✓
- `graph.implementations: ImplementationEntry[]`（`paths: string[]` + file/line）→ paths を連結可能 ✓
- `findOwningElement(rawElements, file, line)` → owner prefix === "op" でフィルタするパターンは permissions.ts:69 と同じ定型 ✓

#### 8. 既存テストへの非破壊性

`export.test.ts` の `returns 2 for unknown subcommand` は `handleExport(["unknown"])` を呼ぶ。T-02 で "operations" が追加されても "unknown" は依然として無効なサブコマンドなので exit 2 のまま。他の rules / permissions テストも subcommand 分岐追加のみで影響を受けない。

#### 9. セキュリティ観点（OWASP Top 10 該当性）

本コマンドは developer CLI（ローカル実行・ファイル I/O のみ・ネットワーク不使用）。

- **Injection**: JSON は `JSON.stringify` で構築。文字列連結なし。リスクなし。
- **認証・認可**: 対象外（CLI ツール）。
- **Path traversal**: `--out` は任意パスへの書き込みを許容するが、permissions の既存動作と同一。開発者ツールとして意図的。
- **Sensitive data exposure**: 出力は設計文書の構造情報のみ。機密情報なし。

OWASP Top 10 上の懸念事項はない。

## 検証できなかった項目

- **ランタイム実行**: spec-review ステップはソースコードを Read/Grep するのみ。`bun test` の実行は行っていない。
- **パーサの targetLines 列挙順保証**: `graph.targetLines` が宣言順（line 昇順）に並ぶことは `src/graph/builder.ts` の実装に依存するが、コードを確認した範囲では `ParseResult.targetLines` を渡すのみ（builder.ts の内部順序は詳細追跡せず）。

## Findings 詳細

### F-01（Low / fixable）: spec.md Requirement 8 の "--out writes to file" Scenario に exit code の明示なし

`spec.md` の Requirement 8（--out option SHALL write to file）の Scenario "–out writes to file" の Then 節：

> `/tmp/ops.json` に JSON が書き出され、stdout には何も出力されない

exit code が Then 節に記載されていない。Requirement 本文には "exit code は stdout 出力時と同じ規約に従う" と書いてあるため機能的な欠落ではないが、Then 節に `exit code は 0 である` を追記すると Scenario が自己完結し conformance 判定が明確になる。

**影響**: 実装上の問題はない。conformance テスト生成時に Then 節から exit code を抽出しようとするツールが情報を得られない可能性がある。

**修正案**: Then 節に `exit code は 0 であり、` を追加する。

---

以上。
