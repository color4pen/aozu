# Tasks: cli-check-wiring

## T-01: state.json リーダーの最小実装（`src/state/`）

- [ ] `src/state/types.ts` を作成し、以下の型を定義:
  - `StateEntry`: `{ state: "designed" | "requested" | "implemented"; request?: string; pr?: number }`
  - `StateMap`: `Record<string, StateEntry>`
- [ ] `src/state/reader.ts` を作成し、`readState(path: string): Promise<StateMap>` を実装:
  - ファイルが存在すれば `Bun.file(path).json()` で読み込み `StateMap` として返す
  - ファイルが不在なら空オブジェクト `{}` を返す（`Bun.file(path).exists()` で判定、または try-catch）
- [ ] `src/state/index.ts` を作成し、`StateEntry`, `StateMap`, `readState` を re-export する
- [ ] `src/state/reader.test.ts` を作成:
  - state.json が存在する場合: `readState` がエントリを返す
  - state.json が不在の場合: `readState` が空オブジェクトを返す
  - state.json が空オブジェクト `{}` の場合: 空オブジェクトを返す

**Acceptance Criteria**:
- `readState` が state.json の読み込みと不在時のフォールバックを正しく処理する
- `bun test src/state/reader.test.ts` が green
- `tsc --noEmit` が成功する

## T-02: command registry の実装（`src/cli/registry.ts`）

- [ ] `src/cli/registry.ts` を作成し、以下を実装:
  - `CommandHandler` 型: `(args: string[]) => Promise<number>`（戻り値は exit code）
  - `CommandDef` 型: `{ handler: CommandHandler; description: string }`
  - `createRegistry()` 関数: `Map<string, CommandDef>` を返す。コマンドの登録・lookup・help テキスト生成を提供する。またはオブジェクトとして `register`, `dispatch`, `helpText` メソッドを持つ
  - `dispatch(registry, commandName, args)`: コマンド名で handler を引き、呼び出して exit code を返す。未知のコマンドなら stderr にエラーを出力し 2 を返す
  - `helpText(registry)`: 登録済みコマンド一覧を文字列で返す
- [ ] `src/cli/registry.test.ts` を作成:
  - 登録済みコマンドの dispatch が handler を呼ぶ
  - 未知コマンドの dispatch が 2 を返す
  - helpText が登録済みコマンド名を含む

**Acceptance Criteria**:
- コマンド登録・dispatch・help テキスト生成が動作する
- `bun test src/cli/registry.test.ts` が green
- `tsc --noEmit` が成功する

## T-03: 診断フォーマッタの実装（`src/cli/format.ts`）

- [ ] `src/cli/format.ts` を作成し、以下を実装:
  - `formatDiagnostic(d: CheckDiagnostic): string`: `CheckDiagnostic` を契約形式文字列に変換。フォーマット: `${d.level.toUpperCase()} ${d.code} ${d.elementId ?? "-"} ${d.message} (${d.file}:${d.line})`
  - `writeDiagnostics(diagnostics: CheckDiagnostic[]): void`: 全診断を `formatDiagnostic` で変換し、各行を stderr に出力（`console.error` または `Bun.write(Bun.stderr, ...)`）
- [ ] `src/cli/format.test.ts` を作成:
  - `formatDiagnostic` が契約形式の文字列を返す（level / code / elementId / message / file:line を含む）
  - `elementId` が null の場合に `"-"` が使われる
  - level が大文字に変換される

**Acceptance Criteria**:
- `formatDiagnostic` が `spec/integration.md` §1 の形式に合致する文字列を返す
- `bun test src/cli/format.test.ts` が green
- `tsc --noEmit` が成功する

## T-04: `check` コマンドの handler 実装（`src/cli/commands/check.ts`）

- [ ] `src/cli/commands/check.ts` を作成し、`handleCheck(args: string[]): Promise<number>` を実装:
  - `args` から `--dir <path>` を解析（デフォルト `./design`）
  - `args` に `--request <path>` が存在するかを判定し、存在すれば request モードへ分岐（T-05 で実装する `handleCheckRequest` を呼ぶ）
  - **通常モード**:
    1. design ディレクトリの存在確認（`fs/promises` の `stat` または `Bun.file` 系で判定）→ 不在なら stderr に診断を出し 2 を返す
    2. `readMarkdownFiles(dir)` でファイル読み込み
    3. `parseFiles(files)` でパース
    4. `manifestPath = join(dir, "manifest.md")` → `parseManifest(parsed.frontmatters, manifestPath)` で manifest 解析
    5. `buildGraph(parsed, manifestPath)` でグラフ構築
    6. `readState(join(dir, "state.json"))` で state.json 読み込み → `Object.keys(stateMap)` で stateKeys 取得
    7. `runCheck(graph, manifest, stateKeys)` で検証
    8. 診断を `writeDiagnostics` で stderr に出力
    9. 診断 0 件なら 0、1 件以上なら 1 を返す
- [ ] `--help` フラグがあれば check コマンドの使い方を stderr に出力し 0 を返す

**Acceptance Criteria**:
- `handleCheck(["--dir", "design"])` が exit code 0 を返す（本リポジトリの design/ は違反なし）
- `handleCheck(["--dir", "/nonexistent"])` が exit code 2 を返す
- 診断は stderr に出力される（stdout に出力されない）
- `tsc --noEmit` が成功する

## T-05: `check --request` handler の実装

- [ ] `src/cli/commands/check.ts` 内に `handleCheckRequest(args: string[], designDir: string): Promise<number>` を実装（T-04 の handler から呼ばれる）:
  - `args` から `--request <path>` のパスを取得
  - `args` に `--require-citation` が存在するかを判定
  - request ファイルの存在確認 → 不在なら stderr に診断を出し 2 を返す
  - design ディレクトリの存在確認 → 不在なら stderr に診断を出し 2 を返す
  - design ディレクトリの読み込み + パース + グラフ構築（T-04 と同じ前半パイプライン。共通関数に抽出してもよい）
  - request 文書を `Bun.file(path).text()` で読み込み
  - `extractReferences(content, path)` で `[[id]]` を抽出（`src/parse/references.ts` を import — `mod-cli → mod-parse` は許可依存）
  - 重複する引用 ID を除去（同一 ID の複数引用は 1 回だけ検証）
  - 検証 (a): 各引用 ID が `graph.elements` に存在するか確認。不在なら `CheckDiagnostic` 相当の診断を生成
  - state.json の読み込み → 検証 (b): 各引用 ID の状態を確認。`stateMap[id]?.state` が `"implemented"` なら診断を生成。エントリなしは designed（合格）
  - `--require-citation`: 引用 0 件なら診断を生成
  - 全診断を stderr に出力
  - 診断 0 件なら 0、1 件以上なら 1 を返す

**Acceptance Criteria**:
- 実在 ID を引用する request で exit 0 を返す
- 架空 ID を引用する request で exit 1 を返す
- `--require-citation` かつ引用 0 件で exit 1 を返す
- request ファイル不在で exit 2 を返す
- implemented のみを引用する request で exit 1 を返す
- `tsc --noEmit` が成功する

## T-06: `main.ts` の結線

- [ ] `src/cli/main.ts` を書き換え:
  - shebang `#!/usr/bin/env bun` を維持
  - registry を生成し、`check` コマンドを `handleCheck` で登録
  - `process.argv` を解析:
    - `process.argv[0]` = bun/node 実行ファイル、`process.argv[1]` = スクリプトパス
    - `process.argv[2]` がコマンド名、`process.argv.slice(3)` が引数
  - コマンド名なし → help テキストを stderr に出力し exit 0
  - `--help` / `-h` がコマンド名位置にあれば help テキストを stderr に出力し exit 0
  - コマンド名あり → `dispatch` で handler を呼び、戻り値で `process.exit`
- [ ] スタブの `console.log("aozu — design layer CLI (not yet wired)")` を削除

**Acceptance Criteria**:
- `bun src/cli/main.ts check` が exit 0 を返す（本リポジトリ）
- `bun src/cli/main.ts` が usage を stderr に出力し exit 0
- `bun src/cli/main.ts unknown` が exit 2
- `tsc --noEmit` が成功する

## T-07: `check` コマンドの統合テスト（通常モード）

- [ ] `src/cli/commands/check.test.ts` を作成
- [ ] テスト: 本リポジトリ自身の `design/` で `handleCheck` が exit 0 を返す（`tools/check.sh` と同判定）
  - `handleCheck([])` または `handleCheck(["--dir", "<repo>/design"])` で呼び出す
  - 戻り値が 0 であることを assert
- [ ] テスト: 違反を含む fixture で exit 1 を返す
  - fixture: manifest.md + modules.md（未解決参照 `[[mod-nonexistent]]` を含む）を一時ディレクトリに配置
  - `handleCheck(["--dir", "<fixture>"])` が 1 を返すことを assert
  - （可能であれば stderr キャプチャで契約形式の診断が出力されていることを assert）
- [ ] テスト: design ディレクトリ不在で exit 2 を返す
  - `handleCheck(["--dir", "/tmp/nonexistent-" + Date.now()])` が 2 を返すことを assert
- [ ] テスト: stdout に診断が混ざらないことの確認
  - subprocess として `bun src/cli/main.ts check --dir <fixture>` を実行し、stdout が空・stderr が非空であることを assert

**Acceptance Criteria**:
- 受け入れ基準「本リポジトリ自身で exit 0」がテストで固定される
- 受け入れ基準「違反 fixture で exit 1 + 契約形式の診断」がテストで固定される
- 受け入れ基準「design ディレクトリ不在で exit 2」がテストで固定される
- 受け入れ基準「stdout に診断が混ざらない」がテストで固定される
- `bun test src/cli/commands/check.test.ts` が green

## T-08: `check --request` の統合テスト

- [ ] `src/cli/commands/check-request.test.ts` を作成（または `check.test.ts` 内に追加）
- [ ] テスト: 実在 ID を引用する request で exit 0
  - fixture: 本リポジトリの `design/` を design ディレクトリとして使用
  - request 文書に `[[mod-parse]]` を含める
  - `handleCheck(["--request", "<request-path>"])` が 0 を返すことを assert
- [ ] テスト: 架空 ID を引用する request で exit 1
  - request 文書に `[[mod-nonexistent]]` を含める
  - `handleCheck(["--request", "<request-path>"])` が 1 を返すことを assert
- [ ] テスト: `--require-citation` かつ引用 0 件で exit 1
  - request 文書に `[[id]]` を含めない
  - `handleCheck(["--request", "<request-path>", "--require-citation"])` が 1 を返すことを assert
- [ ] テスト: request ファイル不在で exit 2
  - `handleCheck(["--request", "/tmp/nonexistent-" + Date.now() + ".md"])` が 2 を返すことを assert
- [ ] テスト: implemented のみを引用する request で exit 1
  - fixture: design ディレクトリ + state.json（`{"mod-cli": {"state": "implemented", "request": "prev", "pr": 1}}`）
  - request 文書に `[[mod-cli]]` を含める
  - `handleCheck(["--request", "<request-path>", "--dir", "<fixture>"])` が 1 を返すことを assert
- [ ] テスト: designed / requested な要素の引用で exit 0
  - fixture: design ディレクトリ + state.json（`{"mod-parse": {"state": "requested", "request": "some"}}`）
  - request 文書に `[[mod-parse]]` を含める
  - exit 0 を assert
- [ ] テスト: コードフェンス内の引用は無視される
  - request 文書でコードフェンス内に `[[mod-nonexistent]]` を置く
  - exit 0（引用 0 件、`--require-citation` なし）を assert

**Acceptance Criteria**:
- 受け入れ基準「check --request: 実在 ID で exit 0 / 架空 ID で exit 1 / --require-citation かつ 0 件で exit 1 / ファイル不在で exit 2」がテストで固定される
- 受け入れ基準「implemented のみを引用する request が不合格」がテストで固定される
- `bun test src/cli/commands/check-request.test.ts` が green

## T-09: 最終検証

- [ ] `tsc --noEmit` が成功する
- [ ] `bun test` が全テスト green（既存 184 テスト + 新規テストすべて）
- [ ] `package.json` の `dependencies` が `{}` のまま
- [ ] `bun src/cli/main.ts check` が exit 0 を返すことを手動確認
- [ ] `bun src/cli/main.ts check --request <path>` が機能することを手動確認（実在 ID の request 文書で）
- [ ] `tools/check.sh design` が引き続き動作する（共存確認）

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- 既存 184 テストが変更なしで green
- `dependencies` が空
- `tools/check.sh` の出力が変わらない
