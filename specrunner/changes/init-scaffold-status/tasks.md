# Tasks: init / scaffold / status

## T-01: init コマンドのテンプレート定義と handler 実装

`src/cli/commands/init.ts` を新規作成する。

- [x] テンプレート文字列を定数として定義する:
  - `MANIFEST_TEMPLATE`: frontmatter（`format-version: 0`, `enabled: static`）+ 見出し + コメント
  - `MODULES_TEMPLATE`: プレースホルダモジュール `## アプリケーション {#mod-app}` + `責務:` 行 + `実装:` 行（`src/`）+ 書き方コメント
  - `DEPENDENCIES_TEMPLATE`: 見出し + 書き方コメント（許可依存の空リスト）
- [x] `handleInit(args: string[]): Promise<number>` を実装する:
  - `--dir <path>` フラグをパースする（デフォルト: `./design`）
  - `--help` / `-h` で usage を stderr に出力して exit 0
  - 対象ディレクトリが既に存在するか `stat()` で検査 → 存在する場合は stderr にエラーを出力して return 1
  - `mkdir` で `<dir>/` と `<dir>/static/` を再帰的に作成
  - `Bun.write` で 3 ファイルを書き出す
  - 成功メッセージを stderr に出力して return 0
- [x] テンプレートの内容が spec/format.md §2, §3, §8 に適合することを手動確認する（`check` が exit 0 を返す構造であること）

**Acceptance Criteria**:
- `handleInit` が export されている
- 生成される 3 ファイルの内容が spec/format.md に適合する
- 既存ディレクトリへの init が何も書かずに 1 を返す
- `--help` が usage を stderr に出力して 0 を返す

## T-02: init コマンドのテスト

`src/cli/commands/init.test.ts` を新規作成する。

- [x] 空ディレクトリで `handleInit` を実行し、3 ファイルが生成されることを検証する
- [x] 生成後に `handleCheck(["--dir", dir])` を呼び出し、exit 0 を返すことを検証する（init → check の e2e）
- [x] 既存ディレクトリへの `handleInit` が exit 1 を返し、ファイルが変更されないことを検証する
- [x] `--dir` フラグが正しくパースされることを検証する
- [x] subprocess テスト: `Bun.spawn` で `bun src/cli/main.ts init --dir <path>` を実行し、stdout が空、stderr にメッセージが出力されることを検証する

**Acceptance Criteria**:
- init → check exit 0 のテストが存在する
- 既存ディレクトリ拒否のテストが存在する
- stdout/stderr 分離のテストが存在する

## T-03: scaffold のテンプレート定義

`src/cli/commands/scaffold.ts` を新規作成する。まずテンプレートとバリデーション補助の定数・型を定義する。

- [x] 文書要素型の型名 → prefix マッピング定数を定義する:
  ```
  topic → top, plan → plan, seq → seq, adr → adr
  ```
- [x] 文書要素型の型名 → ディレクトリマッピング定数を定義する:
  ```
  topic → topics/, plan → plans/, seq → dynamic/, adr → adr/
  ```
- [x] 見出し要素型の型名 → 追記先ファイルマッピング定数を定義する:
  ```
  mod → static/modules.md, term → domain/glossary.md,
  ent → domain/model.md, inv → domain/invariants.md
  ```
- [x] 各文書要素型のテンプレート生成関数を定義する（ID を引数として受け取り、spec/format.md §8 準拠の文字列を返す）:
  - `topicTemplate(id: string): string` — frontmatter（`id`, `status: open`）+ 本文
  - `planTemplate(id: string): string` — frontmatter（`id`, `status: open`）+ グループ見出しプレースホルダ
  - `seqTemplate(id: string): string` — frontmatter（`id`）+ タイトル + 登場要素 + 流れ
  - `adrTemplate(id: string, hasLoop: boolean): string` — frontmatter（`id`、loop 有効時は `topics:` 行を含む）+ タイトル
- [x] `enabled` の層名 → 型名のマッピングで型の有効性を判定する補助関数:
  - topic / plan は `loop` が enabled である必要がある
  - seq は `dynamic` が enabled である必要がある
  - adr は常に有効

**Acceptance Criteria**:
- 各テンプレート関数が spec/format.md §8 のスキーマに適合する文字列を返す
- 型名→prefix、型名→ディレクトリのマッピングが正しい

## T-04: scaffold の handler 実装

T-03 の続き。`src/cli/commands/scaffold.ts` に `handleScaffold` を追加する。

- [x] `handleScaffold(args: string[]): Promise<number>` を実装する:
  - `--help` / `-h` で usage を stderr に出力して exit 0
  - `args[0]` を型名、`args[1]` を ID として取得。不足は stderr にエラー出力して return 2
  - `--dir <path>` フラグをパースする（デフォルト: `./design`）
  - design ディレクトリ存在チェック → 不在は return 2
- [x] バリデーション（D5 の順序で）:
  1. 見出し要素型チェック → 該当する場合は追記先ファイルを案内して return 1
  2. 文書要素型に含まれるかチェック → 未知の型は return 2
  3. `validateId(id)` → 不合格は return 1
  4. ID の prefix が指定型の prefix と一致するかチェック → 不一致は return 1
  5. manifest 読み込み + 型の有効性チェック → 無効は return 1
  6. グラフ構築 + `graph.elements.has(id)` → 衝突は return 1
- [x] ファイル生成:
  - adr の場合: `adr/` ディレクトリをスキャンして既存の `NNNN-` 番号の最大値を取得し +1。ディレクトリが存在しない場合は mkdir して 0001 から
  - ファイルパスを構築し、ファイル存在チェック（衝突防止の二重チェック）
  - `Bun.write` でテンプレートを書き出す
  - 成功メッセージを stderr に出力して return 0

**Acceptance Criteria**:
- `handleScaffold` が export されている
- バリデーション順序が D5 に従う
- 全エラーケースが stderr にメッセージを出力し、適切な exit code を返す

## T-05: scaffold のテスト

`src/cli/commands/scaffold.test.ts` を新規作成する。

- [x] loop 有効 fixture を作成するヘルパー関数を定義する（manifest に `enabled: static, domain, dynamic, loop` を含む最小構造）
- [x] `scaffold topic top-my-feature`: 生成されるファイルが `topics/my-feature.md` に配置され、frontmatter に `id: top-my-feature` と `status: open` を含むことを検証する
- [x] `scaffold plan plan-my-plan`: 生成されるファイルが `plans/my-plan.md` に配置されることを検証する
- [x] `scaffold seq seq-my-flow`: 生成されるファイルが `dynamic/my-flow.md` に配置され、`## 登場要素` セクションを含むことを検証する
- [x] `scaffold adr adr-0001-my-decision`: 生成されるファイルが `adr/0001-my-decision.md` に配置されることを検証する
- [x] ID 文法違反（`scaffold topic INVALID`）→ exit 1
- [x] prefix 不一致（`scaffold topic seq-something`）→ exit 1
- [x] 型無効（loop 無効 fixture で `scaffold topic top-xxx`）→ exit 1
- [x] 既存 ID 衝突 → exit 1
- [x] 見出し要素型（`scaffold mod mod-new`）→ exit 1 + 追記先案内メッセージ
- [x] subprocess テスト: stdout/stderr 分離の検証

**Acceptance Criteria**:
- topic テンプレートが §8 スキーマに適合するテストが存在する
- ID 文法違反・衝突・型無効の 3 エラーケースのテストがそれぞれ存在する
- stdout/stderr 分離のテストが存在する

## T-06: status のフロンティア算出ロジック

`src/cli/commands/status.ts` を新規作成する。まず純粋関数としてフロンティア算出を実装する。

- [x] フロンティア結果の型を定義する:
  ```typescript
  interface Frontier {
    openTopics: Array<{ id: string; source?: string }>;
    designed: string[];
    requested: Array<{ id: string; request: string }>;
  }
  ```
- [x] `computeFrontier(graph, stateMap, manifest): Frontier` を実装する:
  - open topics: graph.elements から prefix `top` の要素を取得し、frontmatter の `status` が `open` のものをフィルタ。`source` があれば含める
  - designed: graph.elements の全 ID のうち、stateMap にエントリがないか `state === "designed"` のもの。enabled な prefix のみ対象とする
  - requested: stateMap のうち `state === "requested"` のもの。`request` slug を含める
- [x] frontmatter の `status` / `source` を取得するため、`parseFiles` の結果（frontmatters Map）を受け取るか、graph にアクセスする設計を決める。実装上は `parseFiles` の `frontmatters` を `computeFrontier` に渡すのが最も直接的

**Acceptance Criteria**:
- `computeFrontier` が純粋関数として export されている
- open topics / designed / requested の 3 カテゴリが正しく分類される

## T-07: status の表示フォーマットと handler 実装

T-06 の続き。表示ロジックと `handleStatus` を実装する。

- [x] `formatFrontier(frontier: Frontier): string` を実装する — フロンティア表示のフォーマット（stdout 用）
- [x] `formatSummary(elementCount, refCount, checkOk): string` を実装する — 退化表示のフォーマット
- [x] `handleStatus(args: string[]): Promise<number>` を実装する:
  - `--help` / `-h` で usage を stderr に出力して exit 0
  - `--dir <path>` フラグをパースする（デフォルト: `./design`）
  - design ディレクトリ存在チェック → 不在は stderr にエラーを出力して return 2
  - パイプライン実行: `readMarkdownFiles` → `parseFiles` → `buildGraph` → `parseManifest`
  - `isLayerEnabled("loop", manifest)` で分岐:
    - loop 有効: `readState` → `computeFrontier` → `formatFrontier` → stdout に出力
    - loop 無効: `runCheck` → `formatSummary` → stdout に出力
  - return 0

**Acceptance Criteria**:
- `handleStatus` が export されている
- loop 有効時はフロンティア 3 種が stdout に出力される
- loop 無効時は要約が stdout に出力される
- エラーは stderr に出力される

## T-08: status のテスト

`src/cli/commands/status.test.ts` を新規作成する。

- [x] loop 有効 fixture を作成するヘルパー関数を定義する（open topic + designed 要素 + requested 要素を含む state.json 付き）
- [x] `computeFrontier` の単体テスト:
  - open topic が正しく抽出される
  - addressed topic が除外される
  - designed 要素が正しく抽出される（state.json にエントリなし）
  - requested 要素が正しく抽出される（request slug 付き）
  - implemented 要素がどのフロンティアにも現れない
- [x] `handleStatus` の統合テスト:
  - loop 有効 fixture で 3 フロンティアが表示されることを検証
  - loop 無効 fixture（本リポジトリの `design/` を `--dir` で指定）で退化表示になることを検証
- [x] subprocess テスト: stdout に表示内容、stderr にはチェック診断のみ（あれば）が出力されることを検証

**Acceptance Criteria**:
- 3 フロンティア表示のテストが存在する
- 退化表示のテストが存在する
- stdout/stderr 分離のテストが存在する

## T-09: main.ts への 3 コマンド登録

`src/cli/main.ts` に `init` / `scaffold` / `status` コマンドを登録する。

- [x] `import { handleInit } from "./commands/init.ts"` を追加
- [x] `import { handleScaffold } from "./commands/scaffold.ts"` を追加
- [x] `import { handleStatus } from "./commands/status.ts"` を追加
- [x] `register(registry, "init", handleInit, "initialize a design directory")` を追加
- [x] `register(registry, "scaffold", handleScaffold, "create a new design document from template")` を追加
- [x] `register(registry, "status", handleStatus, "show design frontiers and summary")` を追加

**Acceptance Criteria**:
- `aozu --help` の出力に init / scaffold / status が表示される
- `aozu init --help` / `aozu scaffold --help` / `aozu status --help` がそれぞれ usage を表示する

## T-10: 全体回帰テスト

既存テストと設計整合性の確認。

- [x] `tsc --noEmit` が green であることを確認する
- [x] `bun test` が全テスト green（既存 247 + 新規テスト）であることを確認する
- [x] `bun src/cli/main.ts check` が exit 0 であることを確認する（本リポジトリの design/ に対して）
- [x] `bun src/cli/main.ts export rules --verify` が exit 0 であることを確認する
- [x] `package.json` の `dependencies` が空のままであることを確認する
- [x] `src/cli/commands/init.ts`、`scaffold.ts`、`status.ts` からの import が `design/static/dependencies.md` の許可依存に違反しないことを確認する。3 ファイルはすべて `src/cli/` 配下であり `mod-cli` に属する。import 先:
  - `mod-parse`（`validateId`）: `mod-cli` → `mod-parse` は許可済み
  - `mod-graph`（`buildGraph`）: `mod-cli` → `mod-graph` は許可済み
  - `mod-check`（`parseManifest`, `runCheck`, `isLayerEnabled`）: `mod-cli` → `mod-check` は許可済み
  - `mod-state`（`readState`）: `mod-cli` → `mod-state` は許可済み
  - `mod-fsread`（`readMarkdownFiles`）: `mod-cli` → `mod-fsread` は許可済み

**Acceptance Criteria**:
- 既存 247 テストが無変更で green
- `tsc --noEmit` green
- `check` exit 0、`export rules --verify` exit 0
- `dependencies` 空
