# Conformance Result

<!-- EVIDENCE REPORT FORMAT:
     verdict は CLI が typed findings から導出する。この file に verdict 行を書かない。
     findings は report_result（typed）で報告し、この file はその補足の evidence report である。
-->

## 検証した項目

### tasks.md — チェックボックス確認
T-01 〜 T-06 の全チェックボックスが [x] 済みであることを確認した。

### 実装コードの確認

**src/export/operations.ts**
- `generateOperations(graph: Graph): { json: string }` として純関数実装済み（ファイル I/O なし）
- prefix === "op" の要素を収集・重複排除・id 昇順ソート（:38–48）
- `graph.targetLines` を `findOwningElement` で帰属判定し、op owner の targetIds を宣言順でグループ化（:51–62）
- `graph.implementations` を同様に帰属判定し、line 昇順でソート後 paths をフラット化（:64–92）
- `target` / `implementation` はデータが存在する場合のみキーを追加（null/空配列でなくキーごと省略）（:82–92）
- 出力: `{ "format-version": 0, "operations": [...] }` を `JSON.stringify(output, null, 2) + "\n"` で文字列化（:97–103）

**src/cli/commands/export.ts**
- `generateOperations` のインポートを追加（:40）
- サブコマンドガードに `"operations"` を追加（:96）
- USAGE 文字列に operations サブコマンド・オプション・exit code の説明を追記（:57–79）
- `if (subcommand === "operations")` ブロック: `manifest.enabled.includes("domain")` → false なら exit 1、`generateOperations(graph)` → `--out` ならファイル書き出し、なければ stdout（:163–189）
- 既存の rules / permissions 分岐に手を加えていない

**src/export/index.ts**
- `export { generateOperations } from "./operations.ts"` 追加済み（:10）

### テスト確認

| テストファイル | 件数 | 結果 |
|--------------|------|------|
| src/export/operations.test.ts | 14 | 14 pass / 0 fail |
| src/cli/commands/export.test.ts | 27 | 27 pass / 0 fail |
| src/export/permissions.test.ts | 10 | 10 pass / 0 fail |
| src/export/generator.test.ts | 7 | 7 pass / 0 fail |
| src/export/op-element.test.ts | 4 | 4 pass / 0 fail |

`bunx tsc --noEmit` — 出力なし（エラーなし）

### request.md 受け入れ基準の照合

| 基準 | 対応テスト | 結果 |
|------|-----------|------|
| `対象:`・`実装:` つき op で §11 JSON を stdout に排出 | TC-001 | ✅ |
| `対象:` / `実装:` 無しで該当キー省略 | TC-002, TC-003, TC-004 | ✅ |
| 複数 op が id 昇順 | TC-005 | ✅ |
| 同一入力でバイト一致（決定性）| TC-006, TC-015 | ✅ |
| domain 未有効で exit 1 | TC-009 | ✅ |
| domain 有効・op 0 件で `"operations": []` / exit 0 | TC-010 | ✅ |
| `--out` でファイルへ書ける | TC-011 | ✅ |
| export rules / permissions の既存テストが無変更で green | permissions.test.ts, generator.test.ts, export.test.ts permissions 部 | ✅ |
| bunx tsc --noEmit && bun test が green | tsc: エラーなし / bun test: 全 export 関連 green | ✅ |

### spec.md SHALL/MUST 要件の照合

| Requirement | 実装 | テスト | 結果 |
|-------------|------|--------|------|
| export operations SHALL produce spec §11 JSON | operations.ts:97–103 | TC-001, TC-018 | ✅ |
| target and implementation keys SHALL be omitted when absent | :82–92 条件付きキー追加 | TC-002, TC-003, TC-004 | ✅ |
| operations SHALL be sorted by id ascending | :48 sort | TC-005, TC-006 | ✅ |
| target array SHALL preserve declaration order | targetIds 宣言順、ソートなし | TC-007 | ✅ |
| implementation array SHALL preserve declaration order | line 昇順 + paths 宣言順 flatMap | TC-008, TC-020 | ✅ |
| domain not enabled SHALL cause exit 1 | export.ts:165–170 | TC-009 | ✅ |
| domain enabled with zero ops SHALL produce empty list with exit 0 | generateOperations が空 ops を返す + exit 0 | TC-010 | ✅ |
| --out SHALL write to file | export.ts:177–184 | TC-011, TC-012 | ✅ |
| existing export subcommands SHALL remain unchanged | rules/permissions 分岐無変更 | permissions.test.ts, generator.test.ts | ✅ |

### design.md 設計判断の照合

| Decision | 実装 | 結果 |
|----------|------|------|
| D1: generateOperations を pure function として分離 | operations.ts — I/O なし | ✅ |
| D2: domain 未有効は manifest.enabled.includes("domain") → exit 1 | export.ts:165 | ✅ |
| D3: target は ID 配列（1 件でも配列）| `entry["target"] = targets` (string[]) | ✅ |
| D4: implementation は line 昇順・パス宣言順フラット排出 | :89–91 sort + flatMap | ✅ |
| D5: domain チェックは CLI 層、generateOperations は Graph のみ受け取る | export.ts でチェック、generateOperations 引数は graph のみ | ✅ |

## 検証できなかった項目

None。全要件・設計判断・タスク・受け入れ基準を確認した。

**補足**: `bun test` 全スイートで 13 件の失敗があるが、すべて `tests/packaging.test.ts` の `npm pack` テスト（`npm error EPERM` — ホストの npm キャッシュが root 所有であることによる環境レベルの問題）。このファイルは commit 62e4681 で追加されており、本ブランチによる変更ではない。export-operations の実装による regression ではない。

## Findings 詳細

None。指摘なし。
