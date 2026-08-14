# Tasks: export operations

## T-01: generateOperations 純関数の実装

`src/export/operations.ts` に `generateOperations(graph: Graph): { json: string }` を実装する。

- [x] `src/export/operations.ts` を新規作成
- [x] `Graph` から `rawElements` を走査し prefix === "op" の要素を収集・ID で重複排除・ID 昇順ソート
- [x] `graph.targetLines` を `findOwningElement` で帰属判定し、owner.prefix === "op" の行を op ID ごとにグループ化。`targetIds` は宣言順を保持する（ソートしない）
- [x] `graph.implementations` を同じく `findOwningElement` で帰属判定し、owner.prefix === "op" の行を op ID ごとにグループ化。複数 `実装:` 行は line 昇順で結合し、各行内の `paths` 順は宣言順を保持する
- [x] 各 op 要素について `{ id, name }` を必須フィールドとし、target（ID 配列）は該当行がある場合のみ、implementation（パス配列）は該当行がある場合のみキーを追加
- [x] 出力は `{ "format-version": 0, "operations": [...] }` を `JSON.stringify(output, null, 2) + "\n"` で文字列化し `{ json }` を返す

**Acceptance Criteria**:
- 関数が Graph のみに依存する純関数である（ファイル I/O なし）
- permissions.ts の `generatePermissions` と同じシグネチャ `(graph: Graph): { json: string }` に従う
- `findOwningElement` と `Graph` 型を既存モジュールから import する（再実装しない）

## T-02: CLI の export サブコマンドに operations を追加

`src/cli/commands/export.ts` に `operations` サブコマンドを追加する。

- [x] `import { generateOperations } from "../../export/operations.ts"` を追加
- [x] subcommand 判定の条件（現在 `"rules"` と `"permissions"`）に `"operations"` を追加
- [x] USAGE 文字列に operations サブコマンドとそのオプション・exit code の説明を追記
- [x] `if (subcommand === "operations")` ブロックを追加。処理内容:
  - `manifest.enabled.includes("domain")` を検査。false なら stderr にエラーメッセージを出力し exit 1
  - `generateOperations(graph)` を呼び出し
  - `--out` があればファイルに書き出し、なければ stdout に出力
  - 引数不足（`--out` のパスなし）は exit 2
- [x] コメントヘッダの Subcommands / Exit codes セクションを更新

**Acceptance Criteria**:
- `export operations` が permissions と同じ定型（stdout 既定・`--out` でファイル）で動作する
- domain 未有効で exit 1、input error で exit 2、success で exit 0
- 既存の rules / permissions 分岐に影響しない（条件追加のみ）

## T-03: index.ts の re-export を追加

- [x] `src/export/index.ts` に `export { generateOperations } from "./operations.ts"` を追加

**Acceptance Criteria**:
- `import { generateOperations } from "../export/index.ts"` で関数にアクセスできる

## T-04: generateOperations の単体テストを作成

`src/export/operations.test.ts` を新規作成。テスト構造は `permissions.test.ts` を参考にする。

- [x] `makeGraph` ヘルパー（`buildGraph(parsed)` を使用）を定義
- [x] テスト: 空 graph で `{ "format-version": 0, "operations": [] }` を返す
- [x] テスト: op 要素 1 件（target あり・implementation あり）で正しい JSON を生成する
- [x] テスト: op 要素で `対象:` 行なし → `target` キーが省略される
- [x] テスト: op 要素で `実装:` 行なし → `implementation` キーが省略される
- [x] テスト: `対象:` も `実装:` も無い op → `id` と `name` のみ
- [x] テスト: 複数 op が id 昇順で並ぶ（宣言順が逆でも出力は id 昇順）
- [x] テスト: target 配列が宣言順を保持する（ソートされない）
- [x] テスト: implementation 配列が宣言順を保持する
- [x] テスト: 同一入力で 2 回呼び出した結果がバイト一致する（決定性）
- [x] テスト: 出力が末尾改行で終わる
- [x] テスト: 出力が valid JSON である

**Acceptance Criteria**:
- 全テストが `bun test src/export/operations.test.ts` で green
- permissions.test.ts の既存テストが無変更で green

## T-05: CLI 統合テスト（domain 未有効・空 op リスト・--out）

`export operations` の CLI 層の振る舞いを検証する。既存の export テストファイルがあればそこに追加、なければ `src/cli/commands/export.test.ts` を作成。

- [x] テスト: domain 未有効の design で `handleExport(["operations"])` が exit code 1 を返す
- [x] テスト: domain 有効・op 0 件で exit 0 かつ `"operations": []` を含む JSON が stdout に排出される
- [x] テスト: `--out` でファイル書き出しが成功する
- [x] テスト: `--out` 引数なしで exit 2

**Acceptance Criteria**:
- 全テストが green
- `bunx tsc --noEmit` が green
- `bun test` が全テスト green（既存テスト含む）

## T-06: 最終検証

- [x] `bunx tsc --noEmit` が green
- [x] `bun test` が全テスト green（既存テストに変更なし）
- [x] `export rules` / `export permissions` の既存テストが無変更で green

**Acceptance Criteria**:
- 型チェック・全テストが green
- 既存テストファイルに変更が入っていない
