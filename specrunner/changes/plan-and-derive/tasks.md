# Tasks: plan / prompt derive

## T-01: computeFrontier を mod-plan に移設する

src/cli/commands/status.ts から `computeFrontier`・`Frontier` 型・`IMPLEMENTATION_PREFIXES` 定数を src/plan/frontier.ts に移設する。mod-plan -> mod-graph と mod-plan -> mod-state はいずれも許可済み。mod-cli -> mod-plan も許可済みで status.ts からの import に問題はない。

- [x] src/plan/frontier.ts を新規作成し、`computeFrontier` / `Frontier` / `IMPLEMENTATION_PREFIXES` を移動する
- [x] `computeFrontier` の import 文を調整する: `Graph` は `../graph/types.ts` から、`StateMap` は `../state/types.ts` から import する。`getEnabledPrefixes` は `../check/manifest.ts` から import するが、**mod-plan -> mod-check は不許可**のため、`getEnabledPrefixes` の呼び出しを caller 側（mod-cli）で行い、enabledPrefixes: Set<string> を引数として受け取る形にリファクタリングする
- [x] `computeFrontier` のシグネチャを `computeFrontier(graph, stateMap, enabledPrefixes, frontmatters)` に変更する（manifest の代わりに enabledPrefixes を受け取る）
- [x] `ParseResult["frontmatters"]` 型は mod-parse 由来。mod-plan -> mod-parse は不許可のため、frontmatters の型を `Map<string, Record<string, string | string[]>>` としてインラインで記述するか、mod-graph の re-export（`ParseResult` は graph/index.ts で re-export 済み）経由で取得する（mod-plan -> mod-graph は許可済み）
- [x] src/cli/commands/status.ts の import を src/plan/frontier.ts に差し替え、`getEnabledPrefixes(manifest)` を呼び出して結果を `computeFrontier` に渡すよう修正する
- [x] src/plan/frontier.ts から Frontier 型と computeFrontier を export する
- [x] 既存の status.test.ts が全て green であることを確認する

**Acceptance Criteria**:
- `computeFrontier` が src/plan/frontier.ts に存在する
- src/cli/commands/status.ts が src/plan/frontier.ts を import している
- mod-plan -> mod-check の依存が発生していない（enabledPrefixes を引数として受け取る）
- mod-plan -> mod-parse の依存が発生していない（型は mod-graph 経由で取得）
- 既存の status.test.ts が全て green

## T-02: findOwningElement を mod-graph に移設する

src/check/attribution.ts の `findOwningElement` を src/graph/attribution.ts に移設する。

- [x] src/graph/attribution.ts を新規作成し、`findOwningElement` を移動する
- [x] src/check/attribution.ts を src/graph/attribution.ts からの re-export に書き換える（`export { findOwningElement } from "../graph/attribution.ts"`）
- [x] src/graph/index.ts に `findOwningElement` の re-export を追加する
- [x] 既存の attribution.test.ts が全て green であることを確認する

**Acceptance Criteria**:
- `findOwningElement` が src/graph/attribution.ts に存在する
- src/check/attribution.ts が re-export として機能する
- 既存の attribution.test.ts が全て green
- architecture test が green（mod-check -> mod-graph は許可済み）

## T-03: 要素本文の切り出しロジックを mod-graph に新設する

src/graph/body.ts に要素本文を切り出す関数を実装する。

- [x] `extractElementBody(elementId: string, graph: Graph, files: FileInput[]): string | null` を実装する
  - Element.file と Element.line から開始位置を特定する
  - 見出し要素（prefix が mod / term / ent / inv / act / grp）: 宣言行の次の行から、同じファイル内の次の同レベル以上の見出し（`^#{2,3} ` で始まる行）の直前まで、またはファイル末尾まで
  - 文書要素（prefix が seq / top / plan / adr）: frontmatter 終了後の本文全体（id 宣言行からではなくファイル内容全体を返す。frontmatter 部分は除外する）
  - 対象ファイルが files 内に見つからない場合は null を返す
- [x] `extractAllBodies(ids: string[], graph: Graph, files: FileInput[]): Map<string, string>` を実装する（複数要素の本文を一括取得する便利関数）
- [x] body.ts のテストを作成する（src/graph/body.test.ts）:
  - 見出し要素の本文が正しく切り出されるケース
  - 文書要素の本文が正しく切り出されるケース
  - 存在しない要素 ID で null が返るケース
  - 同じファイル内の複数見出し要素の境界が正しいケース

**Acceptance Criteria**:
- `extractElementBody` が見出し要素と文書要素の両方に対応する
- ファイル境界と見出し境界で正しく切り出される
- テストが 4 ケース以上存在し green

## T-04: 2 hop 近傍計算を mod-graph に新設する

src/graph/neighborhood.ts に近傍計算の関数を実装する。

- [x] `computeNeighborhood(seedIds: string[], graph: Graph, maxHops: number): Set<string>` を実装する
  - 参照グラフ上で seedIds から in 方向（参照元）と out 方向（参照先）の両方向に maxHops ホップ以内の要素 ID を返す
  - seedIds 自身は結果に含めない（呼び出し側が既に持っているため）
  - 存在しない要素 ID は無視する
  - グラフの参照（graph.references）を辿る。帰属計算（findOwningElement）を使って参照の所有要素を特定し、要素間の辺として解釈する
- [x] neighborhood.ts のテストを作成する（src/graph/neighborhood.test.ts）:
  - 1 hop 近傍が正しく返るケース
  - 2 hop 近傍が正しく返るケース
  - seedIds を含まないことの検証
  - 循環参照がある場合に無限ループしないことの検証

**Acceptance Criteria**:
- `computeNeighborhood` が双方向に maxHops 以内の要素を返す
- seedIds を含まない
- テストが 4 ケース以上存在し green

## T-05: mod-plan のコアロジック — generatePlan の実装

src/plan/generator.ts に plan 文書の生成ロジックを実装する。

- [x] 注釈の入力型を定義する:
  ```typescript
  interface PlanAnnotations {
    referenceEdges: Array<{ from: string; to: string }>;
    modGrounding: Map<string, string[]>; // elementId -> [modId, ...]
    requestedElements: Array<{ id: string; request: string }>;
  }
  ```
- [x] `generatePlan(slug: string, designed: string[], annotations: PlanAnnotations): string` を実装する:
  - frontmatter: `id: plan-<slug>`, `status: open`
  - frontmatter 直後に H1 見出し `# <slug>` を出力する（spec/format.md §5 で文書要素の表示名は先頭の # 見出しとする規約に準拠）
  - 単一グループ: `## グループ {#grp-<slug>}` + `- elements: [[id1]], [[id2]], ...` + `- parallel: no`
  - 注釈節: `## 注釈` 配下に参照辺・モジュール接地・実行中の要素を自由 Markdown で記述
  - `request:` 行は書かない
- [x] generator.ts のテストを作成する（src/plan/generator.test.ts）:
  - 生成された plan が spec §8 の frontmatter スキーマに適合する
  - frontmatter 直後に `# <slug>` の H1 見出しが含まれる
  - 全 designed 要素が elements 行に含まれる
  - 注釈節に参照辺・mod 接地・requested 一覧が含まれる
  - `request:` 行が含まれない

**Acceptance Criteria**:
- `generatePlan` が spec §8 適合の plan 文書文字列を返す
- frontmatter 直後に `# <slug>` の H1 見出しがある
- 注釈 3 種が含まれる
- `request:` 行が含まれない
- テストが 4 ケース以上存在し green

## T-06: plan コマンド handler の実装

src/cli/commands/plan.ts を新規作成する。

- [x] `handlePlan(args: string[]): Promise<number>` を実装する:
  - `--help` / `-h` で usage を stderr に出力して return 0
  - `args[0]` を slug として取得。不足は stderr にエラー出力して return 2
  - slug が `[a-z0-9]+(-[a-z0-9]+)*` の形式に適合しない場合は stderr にエラー出力して return 2（spec §4 の slug 文法を実行時に強制する。`../` 等のパストラバーサルを防ぐためにも必要）
  - `--dir <path>` フラグをパース（デフォルト: `./design`）
  - design ディレクトリ存在チェック → 不在は return 2
- [x] 段階ゲートの実装:
  - `isLayerEnabled("loop", manifest)` → false なら stderr に案内出力して return 1
  - `plans/<slug>.md` が既存なら stderr にエラー出力して return 1（ファイルを書かない）
  - designed 要素が 0 件なら stderr にエラー出力して return 1
- [x] パイプライン実行:
  - `readMarkdownFiles` → `parseFiles` → `buildGraph` → `parseManifest`
  - `readState` → `computeFrontier` で designed 要素を取得
  - 注釈素材の組み立て: 参照辺（designed 要素間の参照をグラフから抽出）、mod 接地（帰属計算で各要素が属する mod を特定）、requested 一覧（frontier.requested）
  - `generatePlan` で plan 文書を生成
  - `plans/` ディレクトリを mkdir → `Bun.write` でファイル書き出し
  - 成功メッセージを stderr に出力して return 0
- [x] stdout には何も書かないことを確認する（成果物はファイル。成功メッセージは stderr）

**Acceptance Criteria**:
- `handlePlan` が export されている
- slug が `[a-z0-9]+(-[a-z0-9]+)*` に適合しない場合は exit 2 を返す（spec §4 の形式検証）
- 段階ゲート（loop 無効 / 既存 slug / designed 0 件）がそれぞれ正しい exit code を返す
- 生成ファイルが spec §8 に適合する
- stdout に何も出力しない

## T-07: plan コマンドのテスト

src/cli/commands/plan.test.ts を新規作成する。

- [x] loop 有効・designed 要素ありの fixture を作成するヘルパー関数を定義する（要素間参照・requested 要素を含む）
- [x] 正常系テスト:
  - `handlePlan(["my-batch", "--dir", dir])` で plan ファイルが生成される
  - 生成ファイルの frontmatter に `id: plan-my-batch` / `status: open` が含まれる
  - 生成ファイルの frontmatter 直後に `# my-batch` の H1 見出しが含まれる
  - 生成ファイルに `{#grp-my-batch}` グループが含まれる
  - `elements:` 行に designed 要素が含まれる
  - 注釈節に参照辺・mod 接地・requested 一覧が含まれる
- [x] 生成後に check が exit 0 であることをテストする（C1 / C2 / C10 を新文書が破らない）
- [x] 段階ゲートのテスト:
  - 不正な slug 形式（例: `../evil`, `My Batch`, `UPPER`）で exit 2、ファイルが生成されない
  - loop 無効の fixture で exit 1、ファイルが生成されない
  - 既存 slug の fixture で exit 1、既存ファイルが変更されない
  - designed 0 件の fixture で exit 1、ファイルが生成されない
- [x] subprocess テスト: stdout が空、stderr にメッセージ

**Acceptance Criteria**:
- plan 生成 → check exit 0 のテストが存在する
- 注釈 3 種の存在テストが存在する
- 段階ゲート 3 種のテストが存在する
- stdout/stderr 分離のテストが存在する

## T-08: mod-prompt のコアロジック — buildDeriveInstruction の実装

src/prompt/derive.ts を新規作成する。

- [x] 入力型を定義する:
  ```typescript
  interface DeriveInput {
    groupId: string;
    groupElements: string[];
    elementBodies: Map<string, string>;
    neighborBodies: Map<string, string>;
    termsAndInvariants: string;
    templateContent: string;
    outputDir: string;
  }
  ```
- [x] `buildDeriveInstruction(input: DeriveInput): string` を実装する:
  - 指示テキストを組み立てる:
    - テンプレート節: `---TEMPLATE BEGIN---` / `---TEMPLATE END---` で区切って templateContent を埋め込む
    - 対象要素節: groupElements の各要素の本文（elementBodies から取得）
    - 近傍要素節: neighborBodies から取得
    - 用語・不変条件節: termsAndInvariants の全文
    - 引用規約: 「変更対象の設計要素を `[[id]]` で本文に引用せよ。引用は被覆の宣言であり coverage が検証する」
    - 出力先: outputDir のパス
- [x] derive.ts のテストを作成する（src/prompt/derive.test.ts）:
  - 出力にテンプレートがデリミタで囲まれて含まれる
  - 出力に対象要素の本文が含まれる
  - 出力に近傍要素の本文が含まれる
  - 出力に term/inv テキストが含まれる
  - 出力に引用規約が含まれる
  - 出力に出力先パスが含まれる

**Acceptance Criteria**:
- `buildDeriveInstruction` が全 6 節を含む指示テキストを返す
- テンプレートがデリミタで明示的に区切られている
- テストが 6 ケース以上存在し green

## T-09: prompt derive コマンド handler の実装

src/cli/commands/prompt.ts を新規作成する。

- [x] `handlePrompt(args: string[]): Promise<number>` を実装する:
  - `--help` / `-h` で usage を stderr に出力して return 0
  - `args[0]` をサブコマンドとして取得。`derive` 以外 / 不足は stderr にエラー出力して return 2
  - `derive` サブコマンドの場合、`handleDerive(args.slice(1))` に委譲
- [x] `handleDerive(args: string[]): Promise<number>` を実装する:
  - `--group <grp-id>` をパース。不足は stderr にエラー出力して return 2
  - `--dir <path>` をパース（デフォルト: `./design`）
  - design ディレクトリ存在チェック → 不在は return 2
- [x] 段階ゲートの実装:
  - `isLayerEnabled("loop", manifest)` → false なら stderr に案内出力して return 2（derive にとって loop 無効は設定不備 = 入力不正であり exit 2）
  - manifest frontmatter に `request-template` がなければ stderr に診断出力して return 2
  - manifest frontmatter に `request-output-dir` がなければ stderr に診断出力して return 2
- [x] plan ファイルの探索:
  - `plans/` ディレクトリ内の全 plan ファイルをパースし、指定 grp-id を持つグループを探す
  - plan 不在 → exit 2 + stderr 診断
  - グループ不在 → exit 2 + stderr 診断
  - グループの elements の全 ID がグラフ上で解決できることを検証 → 未解決 → exit 2 + stderr 診断
- [x] テンプレート取得:
  - `request-template` の値を design ディレクトリからの相対パスとして解決
  - ファイルが存在すれば内容を読み取る
  - ファイルが存在しなければコマンドとして `Bun.spawn({ cmd: value, shell: true })` で実行し stdout を取得（`shell: true` はスペース区切りコマンドの動作保証に必要 — D7 参照）。非ゼロ exit → return 2 + stderr 診断
- [x] 指示テキストの組み立て:
  - グループの elements から対象要素の本文を `extractAllBodies` で取得
  - `computeNeighborhood(groupElements, graph, 2)` で 2 hop 近傍を計算
  - 近傍要素の本文を `extractAllBodies` で取得
  - term / inv の全量を取得（graph.elements から prefix が term / inv の要素の本文を抽出）
  - `buildDeriveInstruction` で指示テキストを生成
  - `process.stdout.write` で出力して return 0
- [x] ファイルシステムに何も書かないことを確認する

**Acceptance Criteria**:
- `handlePrompt` が export されている
- `prompt derive --group <id>` で指示テキストが stdout に出力される
- 設定欠落 / plan 不在 / グループ不在 / 未解決要素がそれぞれ exit 2
- loop 無効が exit 2（derive では設定不備として扱う）
- ファイルシステムへの書き込みがない

## T-10: prompt derive コマンドのテスト

src/cli/commands/prompt.test.ts を新規作成する。

- [x] loop 有効・plan あり・テンプレートファイルありの fixture を作成するヘルパー関数を定義する
  - manifest に `request-template` と `request-output-dir` を含める
  - plan ファイルにグループとelements を含める
  - テンプレートファイルを作成する
  - 対象要素・参照先要素・term/inv を含む設計文書を作成する
- [x] 正常系テスト（subprocess で stdout を検証）:
  - stdout にテンプレート内容がデリミタで囲まれて含まれる
  - stdout に対象要素の本文が含まれる
  - stdout に 2 hop 近傍の本文が含まれる
  - stdout に term/inv テキストが含まれる
  - stdout に引用規約テキストが含まれる
  - stdout に出力先パスが含まれる
- [x] テンプレートのデュアルモードテスト:
  - `request-template` がファイルパスの場合: ファイル内容がテンプレートとして使われる
  - `request-template` がコマンドの場合: コマンド stdout がテンプレートとして使われる
- [x] 段階ゲートのテスト:
  - loop 無効 → exit 2（derive では loop 無効は設定不備 = exit 2）
  - `request-template` 欠落 → exit 2 + stderr 診断
  - `request-output-dir` 欠落 → exit 2 + stderr 診断
  - plan 不在 → exit 2 + stderr 診断
  - グループ不在 → exit 2 + stderr 診断
- [x] ファイルシステム非書き込みテスト:
  - 実行前後でファイルシステムの内容が同一であることを検証する（tmpdir のファイル一覧のスナップショット比較）

**Acceptance Criteria**:
- stdout の全 6 節存在テストが存在する
- テンプレートのデュアルモード（ファイル / コマンド）テストが存在する
- loop 無効が exit 2 であるテストが存在する
- 設定欠落 / plan 不在 / グループ不在のテストが存在する
- ファイルシステム非書き込みテストが存在する

## T-11: main.ts への plan / prompt コマンド登録

src/cli/main.ts に `plan` と `prompt` コマンドを登録する。

- [x] `import { handlePlan } from "./commands/plan.ts"` を追加
- [x] `import { handlePrompt } from "./commands/prompt.ts"` を追加
- [x] `register(registry, "plan", handlePlan, "generate a plan from designed elements")` を追加
- [x] `register(registry, "prompt", handlePrompt, "generate prompts for design workflows")` を追加

**Acceptance Criteria**:
- `aozu --help` の出力に plan / prompt が表示される
- `aozu plan --help` / `aozu prompt --help` がそれぞれ usage を表示する

## T-12: 正本の追随 — spec/format.md, spec/integration.md, design/static/modules.md

正本文書を更新し、rules.json を再 export する。

- [x] spec/format.md §3 の manifest セクションに以下を追補する:
  - `request-template`（任意キー。値がファイルパスならその内容を、存在しなければコマンドとして実行し stdout をテンプレートとして使用する）
  - `request-output-dir`（任意キー。derive が指示に含める草稿の出力先パス）
- [x] spec/integration.md §4 の「設定で注入され」の箇所に注入点を明記する:
  - 「manifest frontmatter の `request-template` と `request-output-dir` で注入される」
- [x] design/static/modules.md の mod-plan 責務行を更新する:
  - 旧: `責務: plan の生成・coverage 検証・グループへの request 記録。`
  - 新: `責務: plan の生成・coverage 検証。`
- [x] `bun src/cli/main.ts export rules --out design/rules.json` を実行して rules.json を更新する
- [x] `bun src/cli/main.ts export rules --verify` が exit 0 であることを確認する

**Acceptance Criteria**:
- spec/format.md に `request-template` / `request-output-dir` の記述がある
- spec/integration.md に manifest frontmatter の注入点が明記されている
- design/static/modules.md の mod-plan 責務行から「グループへの request 記録」が除去されている
- `export rules --verify` が exit 0

## T-13: 全体回帰テスト

既存テストと設計整合性の最終確認。

- [x] `tsc --noEmit` が green であることを確認する
- [x] `bun test` が全テスト green（既存 336 + 新規テスト）であることを確認する
- [x] `bun src/cli/main.ts check` が exit 0 であることを確認する（本リポジトリの design/ に対して）
- [x] `bun src/cli/main.ts export rules --verify` が exit 0 であることを確認する
- [x] `package.json` の `dependencies` が空のままであることを確認する
- [x] 新規ファイルの import が許可依存に違反しないことを確認する:
  - src/plan/frontier.ts（mod-plan）: mod-plan -> mod-graph（Graph 型, ParseResult 型）は許可済み。mod-plan -> mod-state（StateMap 型）は許可済み。enabledPrefixes は引数として受け取るため mod-check への依存なし
  - src/graph/attribution.ts（mod-graph）: 内部移設のため依存追加なし
  - src/graph/body.ts（mod-graph）: Graph / FileInput は mod-graph 内 / mod-parse の型。mod-graph -> mod-parse は許可済み
  - src/graph/neighborhood.ts（mod-graph）: Graph は mod-graph 内の型。attribution は同モジュール内
  - src/plan/generator.ts（mod-plan）: 外部依存なし（引数を受け取る純粋関数）
  - src/prompt/derive.ts（mod-prompt）: 外部依存なし（引数を受け取る純粋関数）
  - src/cli/commands/plan.ts（mod-cli）: mod-cli -> mod-plan / mod-graph / mod-check / mod-state / mod-fsread（全て許可済み）
  - src/cli/commands/prompt.ts（mod-cli）: mod-cli -> mod-prompt / mod-graph / mod-check / mod-state / mod-fsread（全て許可済み）
- [x] architecture.test.ts（歯テスト）が green であることを確認する

**Acceptance Criteria**:
- 既存 336 テストが無変更で green
- 新規テストも green
- `tsc --noEmit` green
- `check` exit 0、`export rules --verify` exit 0
- `dependencies` 空
- architecture test green

## 依存関係

```
T-01 (frontier 移設) ──┐
T-02 (attribution 移設) ┤
T-03 (body 切り出し) ───┤
T-04 (neighborhood) ────┤
                        ├─ T-05 (generatePlan) ─── T-06 (plan handler) ─── T-07 (plan テスト)
                        │
                        ├─ T-08 (buildDeriveInstruction) ─── T-09 (derive handler) ─── T-10 (derive テスト)
                        │
T-01〜T-10 ─────────────┴─ T-11 (main.ts 登録) ─── T-12 (正本追随) ─── T-13 (全体回帰)
```

T-01〜T-04 は互いに独立で並列実行可能。T-05 は T-01 に依存（designed 要素の取得に frontier を使う）。T-06 は T-05 + T-02 に依存。T-08 は T-03 + T-04 に依存。T-09 は T-08 + T-01 に依存。T-11〜T-13 は全タスク完了後。
