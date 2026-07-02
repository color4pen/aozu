# Tasks: export-rules-and-teeth

## T-01: ParseResult と Graph に implementations データを伝搬する

- [ ] `src/parse/types.ts` の `ParseResult` に `implementations` フィールドを追加する。型は `{ paths: string[]; file: string; line: number }[]`
- [ ] `src/parse/parser.ts` の `parseFiles` で、`extractStructuredLines` の戻り値から `implementations` を `ParseResult` に伝搬する。初期値は空配列、各ファイルの結果を `push(...structured.implementations)` で追加
- [ ] `src/graph/types.ts` の `Graph` に `implementations` フィールドを追加する。型は `ParseResult["implementations"]`
- [ ] `src/graph/builder.ts` の `buildGraph` で `parsed.implementations` を `Graph.implementations` にコピーする（`[...parsed.implementations]` で shallow copy）
- [ ] `src/parse/parser.test.ts` に、`実装:` 行を含むファイルを parseFiles に渡し、`result.implementations` に伝搬されることを確認するテストを追加する
- [ ] `src/graph/builder.test.ts` に、`implementations` を含む ParseResult から buildGraph を呼び、`graph.implementations` に伝搬されることを確認するテストを追加する

**Acceptance Criteria**:
- `parseFiles` の戻り値の `implementations` に、入力ファイルの `実装:` 行の情報が含まれる
- `buildGraph` の戻り値の `implementations` に、ParseResult の `implementations` が含まれる
- `tsc --noEmit` が成功する
- `bun test src/parse/parser.test.ts src/graph/builder.test.ts` が green

## T-02: 既知の依存違反を解消する

- [ ] `src/graph/index.ts` に `export type { ParseResult } from "../parse/types.ts";` を追加する（既存の parse re-export の並びに追加）
- [ ] `src/check/manifest.ts` の `import type { ParseResult } from "../parse/types.ts"` を `import type { ParseResult } from "../graph/index.ts"` に変更する
- [ ] `tsc --noEmit` が成功することを確認する
- [ ] `bun test` が全テスト green であることを確認する（既存テストが壊れていないこと）

**Acceptance Criteria**:
- `src/check/manifest.ts` に `../parse/` への直接 import が存在しない
- `src/graph/index.ts` が `ParseResult` を re-export している
- `tsc --noEmit && bun test` が green

## T-03: export モジュールの実装（`src/export/`）

- [ ] `src/export/types.ts` を作成し、以下の型を定義する:
  - `Ruleset`: `{ "format-version": number; modules: string[]; paths: Record<string, string[]>; allowed: [string, string][] }`
  - `ExportDiagnostic`: `{ level: "error"; code: string; moduleId: string; message: string }`
  - `GenerateResult`: `{ json: string | null; diagnostics: ExportDiagnostic[] }`
- [ ] `src/export/generator.ts` を作成し、`generateRuleset(graph: Graph): GenerateResult` を実装する:
  1. `graph.elements` から prefix が `mod` の要素をすべて収集する
  2. `graph.implementations` と mod 要素を同一ファイル内の行番号で紐づける（各 `実装:` 行をその直前の最も近い mod 要素に割り当てる）
  3. `実装:` 行を持たない mod 要素があれば、その mod の診断を生成し、`{ json: null, diagnostics }` を返す
  4. `modules` 配列: mod ID を辞書順ソート
  5. `paths` オブジェクト: `modules` の順序でキーを挿入し、各キーに `実装:` 行のパス配列を設定
  6. `allowed` 配列: `graph.dependencyEdges` から `[from, to]` ペアを生成し、`from` の辞書順 → 同一 `from` 内は `to` の辞書順でソート
  7. `JSON.stringify(ruleset, null, 2) + "\n"` で JSON 文字列を生成
  8. `{ json, diagnostics: [] }` を返す
- [ ] `src/export/index.ts` を作成し、以下を re-export する:
  - `Ruleset`, `ExportDiagnostic`, `GenerateResult` from `./types.ts`
  - `generateRuleset` from `./generator.ts`
- [ ] `src/export/generator.test.ts` を作成し、以下のテストを実装する:
  - 正常な Graph（2+ mod、`実装:` 行あり、依存辺あり）から ruleset JSON を生成し、`format-version` / `modules` / `paths` / `allowed` の構造を検証する
  - `modules` が辞書順であることを検証する
  - `allowed` がソートされた順序であることを検証する
  - 同一入力に対して 2 回呼び出し、同一のバイト列が返ることを検証する（決定的出力）
  - `実装:` 行が欠落した mod を含む Graph で、`json` が null かつ診断に欠落 mod の情報が含まれることを検証する
  - mod 要素が 0 個の Graph（空の design）で動作することを検証する

**Acceptance Criteria**:
- `generateRuleset` が `spec/format.md` §11 のスキーマに適合する JSON を返す
- 同一入力に対して常に同一バイト列が返る（決定的）
- `実装:` 欠落時に `json: null` と診断が返る
- `tsc --noEmit` が成功する
- `bun test src/export/generator.test.ts` が green

## T-04: CLI に `export rules` コマンドを結線する

- [ ] `src/cli/commands/export.ts` を作成し、`handleExport(args: string[]): Promise<number>` を実装する:
  - `args[0]` がサブコマンド名。`rules` 以外（または未指定）は usage を stderr に出力し exit 2（未知サブコマンド）/ exit 0（`--help`）
  - `--dir <path>` フラグ: design ディレクトリのパス（デフォルト `./design`）
  - `export rules` の処理:
    1. design ディレクトリの存在確認 → 不在なら stderr に出力し exit 2
    2. `readMarkdownFiles` → `parseFiles` → `buildGraph` で Graph 構築
    3. `generateRuleset(graph)` を呼び出す
    4. 診断あり → stderr に出力し exit 1
    5. `--verify` フラグ処理（後述）
    6. 通常モード: `--out <path>` があればファイル書き込み、なければ stdout に出力し exit 0
  - `--verify [<path>]` フラグの処理:
    1. 比較対象ファイルのパスを決定する。`--verify <path>` で明示指定、省略時は `<designDir>/rules.json`（ただし `--dir` が `./design` デフォルトなら `design/rules.json`）
    2. 比較対象ファイルの存在確認 → 不在なら stderr に出力し exit 2
    3. ファイルの内容を読み込み、生成した JSON とバイト単位で比較
    4. 一致 → exit 0、乖離 → stderr に乖離の旨を出力し exit 1
- [ ] `src/cli/main.ts` に `export` コマンドを registry に登録する:
  - `import { handleExport } from "./commands/export.ts"` を追加
  - `register(registry, "export", handleExport, "export design artifacts")` を追加
- [ ] `src/cli/commands/export.test.ts` を作成し、以下のテストを実装する:
  - 本リポジトリの `design/` で `handleExport(["rules"])` が exit 0 を返す
  - `handleExport(["rules", "--dir", "/nonexistent"])` が exit 2 を返す
  - `handleExport([])` が exit 0 を返す（usage 表示）
  - `handleExport(["unknown"])` が exit 2 を返す
  - subprocess テスト: `bun src/cli/main.ts export rules` の stdout が有効な JSON であることを検証する
  - subprocess テスト: stdout の JSON が `format-version` / `modules` / `paths` / `allowed` を含むことを検証する
- [ ] verify テスト用の fixture を作成し、以下をテストする:
  - 一致する rules.json を置いて `--verify` が exit 0
  - 内容が異なる rules.json を置いて `--verify` が exit 1
  - rules.json が存在しない状態で `--verify` が exit 2
- [ ] `実装:` 行が欠落した fixture で `handleExport(["rules", "--dir", "<fixture>"])` が exit 1 を返すことをテストする

**Acceptance Criteria**:
- `aozu export rules` が stdout に有効な ruleset JSON を出力する
- `--verify` が一致 exit 0 / 乖離 exit 1 / 不在 exit 2 を返す
- `実装:` 欠落で exit 1 + stderr に診断
- design ディレクトリ不在で exit 2
- `tsc --noEmit` が成功する
- `bun test src/cli/commands/export.test.ts` が green

## T-05: architecture test（歯）の実装

- [ ] `tsconfig.json` の `include` に `"tests/**/*.ts"` を追加する: `"include": ["src/**/*.ts", "tests/**/*.ts"]`
- [ ] `tests/architecture.test.ts` を作成し、以下のヘルパー関数を実装する:
  - `scanImports(filePath: string, content: string): { from: string; line: number }[]`: ファイル内容から import/export 文を行指向で走査し、相対パスの import 元を抽出する。パターン: `import` または `export` を含み、`from ["'](.+)["']` にマッチする行。Node.js 組み込みモジュールやパッケージ import（`./` / `../` で始まらないもの）は除外する
  - `resolveImportPath(importingFile: string, importPath: string): string`: 相対 import パスを importing ファイルの位置から解決し、リポジトリルートからの相対パスに正規化する
  - `findModule(filePath: string, paths: Record<string, string[]>): string | null`: ファイルパスを `paths` の最長一致で照合し、モジュール ID を返す。マッチしなければ null
- [ ] メインのテストケースを実装する:
  1. `design/` を読み込み、parse → graph → generateRuleset で ruleset を取得する
  2. `src/` 配下の全 `*.ts` ファイルを再帰列挙する（`*.test.ts` を除外）
  3. 各ファイルについて:
     a. `findModule` でモジュールを特定する。null なら unmapped 違反として記録する
     b. `scanImports` で import 先を抽出する
     c. 各 import について `resolveImportPath` でパスを解決し、`findModule` で import 先モジュールを特定する
     d. import 先モジュールが同一モジュールなら skip
     e. import 先モジュールが異なり、`allowed` に含まれなければ違反として記録する
  4. 全違反を collect し、expect で assert する（違反配列が空であること）。違反がある場合は、ファイルパス・行番号・from→to モジュールの詳細を含むエラーメッセージを出す
- [ ] ヘルパー関数の単体テストを同一ファイル内に実装する:
  - `scanImports` が `import { Foo } from "./bar.ts"` を検出する
  - `scanImports` が `import type { Foo } from "../baz/qux.ts"` を検出する
  - `scanImports` が `export { Foo } from "./bar.ts"` を検出する
  - `scanImports` が `import { join } from "path"` を除外する（パッケージ import）
  - `scanImports` がコードフェンス内の import 行を除外しない（TypeScript ファイルにコードフェンスはない。Markdown 走査ではないため除外不要）
  - `resolveImportPath` が相対パスを正しく解決する
  - `findModule` が最長一致で正しいモジュールを返す
  - `findModule` がどのパスにもマッチしないファイルに null を返す
- [ ] 違反検出のテスト（fixture ベース）:
  - `import type` を含む fixture で違反が検出されることをテストする
  - unmapped ファイル（どのモジュールにも属さない `src/` ファイル）が違反として報告されることをテストする

**Acceptance Criteria**:
- 本リポジトリで歯が green（T-02 の違反解消後）
- `import type` を含む違反が検出されることがテストで固定される
- unmapped ファイルが違反になることがテストで固定される
- `src/check/` から `src/parse/` への直接 import が存在しない
- `tsc --noEmit` が成功する
- `bun test tests/architecture.test.ts` が green

## T-06: `design/rules.json` の生成と最終検証

- [ ] `bun src/cli/main.ts export rules --out design/rules.json` を実行し、`design/rules.json` を生成する
- [ ] 生成された JSON が `spec/format.md` §11 のスキーマ（`format-version` / `modules` / `paths` / `allowed`）に適合していることを目視確認する
- [ ] `bun src/cli/main.ts export rules --verify` が exit 0 を返すことを確認する
- [ ] `bun src/cli/main.ts check` が exit 0 のままであることを確認する
- [ ] `tsc --noEmit` が成功することを確認する
- [ ] `bun test` が全テスト green であることを確認する（既存テスト + 新規テストすべて）
- [ ] `package.json` の `dependencies` が `{}` のままであることを確認する
- [ ] `design/rules.json` をコミットに含める

**Acceptance Criteria**:
- `design/rules.json` がコミットされている
- `bun src/cli/main.ts export rules --verify` が exit 0
- `bun src/cli/main.ts check` が exit 0
- `tsc --noEmit && bun test` が green
- `package.json` の `dependencies` が `{}`
