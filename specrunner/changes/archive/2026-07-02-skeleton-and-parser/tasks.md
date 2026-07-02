# Tasks: skeleton-and-parser

## T-01: プロジェクト骨格の確立

- [x] `package.json` を更新: `name: "aozu"`, `bin: { "aozu": "./src/cli/main.ts" }`, `dependencies: {}` (空オブジェクトを明示), `scripts: { "typecheck": "tsc --noEmit", "test": "bun test" }`
- [x] `devDependencies` に `@types/bun` を追加（`bun add -d @types/bun`）
- [x] `tsconfig.json` を作成: `target: ESNext`, `module: ESNext`, `moduleResolution: bundler`, `strict: true`, `noEmit: true`, `skipLibCheck: true`, `types: ["bun-types"]`, `include: ["src/**/*.ts"]`
- [x] `src/cli/main.ts` を最小 stub として作成（`#!/usr/bin/env bun` + placeholder。CLI 結線は次 request）
- [x] `.gitignore` に `dist/` が含まれることを確認（既存）

**Acceptance Criteria**:
- `tsc --noEmit` が成功する
- `package.json` の `dependencies` が `{}` である
- `bun install` がエラーなく完了する

## T-02: パース結果のデータ型定義

- [x] `src/parse/types.ts` を作成し、以下の型を定義:
  - `FileInput { path: string; content: string }`
  - `Element { id: string; prefix: string; displayName: string; file: string; line: number }`
  - `Reference { targetId: string; file: string; line: number }`
  - `DependencyEdge { from: string; to: string; file: string; line: number }`
  - `Diagnostic { severity: "error" | "warning"; message: string; file: string; line: number }`
  - `ParseResult { elements: Element[]; references: Reference[]; dependencyEdges: DependencyEdge[]; diagnostics: Diagnostic[]; frontmatters: Map<string, Record<string, string | string[]>> }`
- [x] `src/parse/index.ts` を作成し、型とパーサ関数を re-export

**Acceptance Criteria**:
- `tsc --noEmit` が型定義ファイルに対して成功する
- 全型が `src/parse/index.ts` から import 可能

## T-03: ID 文法検証の実装

- [x] `src/parse/id.ts` を作成
- [x] ID 文法 `prefix "-" slug` (`slug = [a-z0-9]+("-"[a-z0-9]+)*`) の検証関数を実装
- [x] 既知の prefix リスト（`mod`, `term`, `ent`, `inv`, `seq`, `top`, `plan`, `grp`, `adr`, `uc`, `scr`, `api`, `dat`, `flow`, `evt`, `ext`, `perm`, `dpl`）を定義
- [x] ID からの prefix 抽出関数を実装
- [x] `src/parse/id.test.ts` を作成:
  - 正常 ID（`mod-parse`, `ent-order`, `seq-closure-check`）が valid
  - 大文字を含む ID（`Mod-Parse`）が invalid
  - 不正文字を含む ID（`mod_parse`, `mod.parse`）が invalid
  - prefix なし（`parse`）が invalid
  - 未知 prefix（`xxx-foo`）が invalid

**Acceptance Criteria**:
- 正常 ID が valid と判定される
- 大文字・不正文字・prefix なし・未知 prefix が invalid と判定される
- `bun test src/parse/id.test.ts` が green

## T-04: frontmatter パーサの実装

- [x] `src/parse/frontmatter.ts` を作成
- [x] ファイル先頭の `---` 〜 `---` 間を flat `key: value` としてパース
- [x] 値がカンマ区切りの場合は文字列配列に変換（例: `enabled: static, domain` → `["static", "domain"]`）
- [x] flat でない行（インデントされた行、`key:` の後に改行して値が続く場合）を検出して `Diagnostic` を返す
- [x] frontmatter が存在しないファイルは空の Record を返す
- [x] `src/parse/frontmatter.test.ts` を作成:
  - 正常な flat frontmatter のパース
  - カンマ区切りリストの配列変換
  - frontmatter なしファイル
  - ネストした frontmatter（インデント行）で diagnostic が返る
  - `---` が閉じない場合の処理

**Acceptance Criteria**:
- flat な `key: value` が正しくパースされる
- カンマ区切りが配列に変換される
- ネスト構造が位置つき diagnostic として報告される
- `bun test src/parse/frontmatter.test.ts` が green

## T-05: 参照抽出の実装（コードフェンス・インラインコード除外）

- [x] `src/parse/references.ts` を作成
- [x] 行単位の参照抽出関数を実装: `[[<id>]]` パターンの全出現を抽出
- [x] コードフェンス状態のトグル: `` ``` `` で始まる行で in/out を切り替え、フェンス内は参照抽出をスキップ
- [x] インラインコード除外: 参照抽出前に行からバッククォート内テキストを除去（check.sh と同じ ``gsub(/`[^`]*`/, "")`` 相当）
- [x] 各参照に file と line（1-based）を付与
- [x] `src/parse/references.test.ts` を作成:
  - 通常行からの `[[id]]` 抽出（1 行に複数の参照を含むケース）
  - コードフェンス内の `[[id]]` が除外される
  - インラインコード内の `[[id]]` が除外される（`` `[[mod-parse]]` `` 形式）
  - 同一行にインラインコードと通常参照が混在するケース
  - フェンス開始行の言語指定（`` ```markdown ``）が正しくトグルする

**Acceptance Criteria**:
- 通常テキスト内の `[[id]]` が正しく抽出される
- コードフェンス内・インラインコード内の `[[id]]` が抽出されない
- `bun test src/parse/references.test.ts` が green

## T-06: 宣言抽出の実装

- [x] `src/parse/declarations.ts` を作成
- [x] 見出し要素の検出: `^#{2,3} (.+) \{#(<id>)\}$` にマッチする行から ID と表示名を抽出
- [x] 文書要素の検出: frontmatter の `id:` フィールドから ID を抽出。表示名はファイル先頭の `# 見出し` から取得
- [x] 各宣言に file・line・prefix を付与
- [x] ID 文法検証（T-03）を適用し、違反は Diagnostic に追加
- [x] `src/parse/declarations.test.ts` を作成:
  - `## パーサ {#mod-parse}` から正しい Element が抽出される
  - `### 小見出し {#inv-foo}` （h3）が抽出される
  - frontmatter `id: seq-closure-check` から正しい Element が抽出される
  - 不正 ID（大文字、不正文字）で Element が抽出されつつ Diagnostic も返る
  - `# 見出し {#id}` （h1）は見出し要素として抽出されない（h2/h3 のみ）

**Acceptance Criteria**:
- 見出し要素（h2/h3）が正しく抽出される
- frontmatter `id:` による文書要素が正しく抽出される
- ID 文法違反が位置つき diagnostic として報告される
- `bun test src/parse/declarations.test.ts` が green

## T-07: 構造化行の認識

- [x] `src/parse/structured-lines.ts` を作成
- [x] `責務:` 行の認識と値テキストの抽出
- [x] `実装:` 行の認識とカンマ区切り値の分割
- [x] 依存辺 `- [[a]] -> [[b]]` の認識と `DependencyEdge` の生成
- [x] `## 登場要素` 配下の `- [[id]]` リストの認識
- [x] `elements:` 行の認識（`[[id]]` のカンマ区切りリスト）
- [x] `src/parse/structured-lines.test.ts` を作成:
  - `責務: コマンド解釈` の値抽出
  - `実装: src/cli/, src/core/` のカンマ区切り分割
  - `- [[mod-cli]] -> [[mod-parse]]` から `{from: "mod-cli", to: "mod-parse"}` の生成
  - `## 登場要素` 後の `- [[mod-cli]]` リストの認識
  - `elements: [[ent-order]], [[inv-3]]` の認識

**Acceptance Criteria**:
- 各構造化行が正しく認識・値抽出される
- 依存辺が `{from, to, file, line}` で返る
- `bun test src/parse/structured-lines.test.ts` が green

## T-08: メインパーサの統合

- [x] `src/parse/parser.ts` を作成
- [x] 公開 API: `parseFiles(files: FileInput[]): ParseResult` を実装
- [x] 各ファイルに対して frontmatter パース → 宣言抽出 → 参照抽出 → 構造化行認識を実行
- [x] 結果を統合して `ParseResult` を返す
- [x] `src/parse/parser.test.ts` を作成:
  - 単一ファイルのパースで全フィールドが返る
  - 複数ファイルのパースで結果が統合される
  - 空ファイル配列で空の結果が返る

**Acceptance Criteria**:
- `parseFiles` が `ParseResult` を返す
- 複数ファイルの結果が正しく統合される
- `bun test src/parse/parser.test.ts` が green

## T-09: ファイル読み込み層の実装

- [x] `src/fs/reader.ts` を作成: 指定ディレクトリから `.md` ファイルを再帰的に列挙し、内容を読み込んで `FileInput[]` を返す関数
- [x] `src/fs/index.ts` を作成し re-export
- [x] Bun の `Bun.file` / Node.js `fs/promises` を使用

**Acceptance Criteria**:
- `design/` を渡すとすべての `.md` ファイルが `FileInput[]` として返る
- `tsc --noEmit` が成功する

## T-10: design/ 全文書に対する統合テスト

- [x] `src/parse/integration.test.ts` を作成
- [x] `src/fs/reader.ts` を使って `design/` の全 `.md` ファイルを読み込み、`parseFiles` に渡す
- [x] 抽出された要素数が 25 であることを assert
- [x] 抽出されたユニークな参照先 ID の種類が 15 であることを assert（`sort -u` 相当。check.sh が「参照 15 種」と呼ぶもの）
- [x] `design/domain/invariants.md` のインラインコード内 `[[id]]` が参照に含まれないことを assert
- [x] 25 要素の ID リストを明示的に assert（回帰検出用）:
  `ent-artifact`, `ent-element`, `ent-manifest`, `ent-reference`, `ent-state-entry`, `inv-deterministic-verdict`, `inv-fail-closed-deps`, `inv-immutable-id`, `inv-single-reference-grammar`, `inv-tool-writes-state`, `mod-check`, `mod-cli`, `mod-diff`, `mod-export`, `mod-gitread`, `mod-graph`, `mod-parse`, `mod-plan`, `mod-prompt`, `mod-state`, `seq-closure-check`, `seq-rules-export`, `term-closure`, `term-degradation`, `term-frontier`
- [x] 15 参照先 ID のリストを明示的に assert:
  `ent-artifact`, `ent-element`, `ent-reference`, `ent-state-entry`, `mod-check`, `mod-cli`, `mod-diff`, `mod-export`, `mod-gitread`, `mod-graph`, `mod-parse`, `mod-plan`, `mod-prompt`, `mod-state`, `term-closure`
- [x] `design/static/dependencies.md` から抽出される `DependencyEdge` が 16 辺であることを assert

**Acceptance Criteria**:
- 宣言 25 要素が抽出される（check.sh と同数）
- 参照 15 種が抽出される（check.sh と同数）
- インラインコード内 `[[id]]` が参照に含まれない
- 依存辺が正しく構造化されて返る
- `bun test src/parse/integration.test.ts` が green

## T-11: 診断テスト

- [x] `src/parse/diagnostics.test.ts` を作成
- [x] 大文字を含む ID（例: `## Foo {#Mod-Parse}`）が位置つき diagnostic として報告されることを test
- [x] 不正文字を含む ID（例: `## Foo {#mod_parse}`）が位置つき diagnostic として報告されることを test
- [x] flat でない frontmatter（インデント行）が位置つき diagnostic として報告されることを test
- [x] 正常な `design/` のパースで diagnostic が 0 件であることを test（design/ 自身は正しいはず）

**Acceptance Criteria**:
- ID 文法違反が file・line つきで diagnostic に含まれる
- flat でない frontmatter が file・line つきで diagnostic に含まれる
- 正常ファイルで誤報がない
- `bun test src/parse/diagnostics.test.ts` が green

## T-12: dependencies ゼロの検証テスト

- [x] `src/package.test.ts` を作成
- [x] `package.json` を読み込み、`dependencies` フィールドが `{}` または存在しないことを assert

**Acceptance Criteria**:
- `dependencies` が空であることがテストで保証される
- `bun test src/package.test.ts` が green

## T-13: 最終検証

- [x] `tsc --noEmit` が成功する
- [x] `bun test` が全テスト green
- [x] `bash tools/check.sh design` が引き続き `OK: 宣言 25 要素 / 参照 15 種` を返す（既存チェッカを壊していない）

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- `tools/check.sh` の出力が変わらない
