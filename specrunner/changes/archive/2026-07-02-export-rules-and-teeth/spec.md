# Spec: export-rules-and-teeth

## Requirements

### Requirement: generateRuleset は spec/format.md §11 のスキーマに適合する決定的な JSON を出力する

generateRuleset は Graph を入力として、`format-version` / `modules` / `paths` / `allowed` の 4 フィールドを持つ JSON 文字列を生成する。`modules` は ID 辞書順、`allowed` は from→to の辞書順でソートされ、同一入力に対して常に同一のバイト列を返さなければならない（SHALL）。

#### Scenario: 正常な Graph から ruleset を生成する

**Given** 2 つの mod 要素（`mod-b`, `mod-a`）と対応する `実装:` 行、1 本の許可依存辺 `mod-a -> mod-b` を含む Graph がある
**When** generateRuleset を呼び出す
**Then** JSON 出力の `modules` は `["mod-a", "mod-b"]`（辞書順）、`paths` は `{"mod-a": [...], "mod-b": [...]}`（辞書順キー）、`allowed` は `[["mod-a", "mod-b"]]` を含み、`format-version` は `0` である

#### Scenario: 同一入力に対して決定的な出力を返す

**Given** 任意の有効な Graph
**When** generateRuleset を 2 回呼び出す
**Then** 2 回の出力は同一のバイト列である

### Requirement: `実装:` 行が欠落した mod 要素がある場合、generateRuleset は診断を返しJSON を生成しない

すべての mod 要素に `実装:` 行が存在することを要求する。欠落がある場合、generateRuleset は該当 mod の診断を返し、JSON 文字列は生成しない（SHALL NOT）。

#### Scenario: `実装:` 行が欠落した mod がある

**Given** mod 要素 `mod-foo` に対応する `実装:` 行が存在しない Graph
**When** generateRuleset を呼び出す
**Then** 診断配列に `mod-foo` の欠落を示すエントリが含まれ、JSON 文字列は null である

### Requirement: `export rules` コマンドは stdout に ruleset を出力する

`aozu export rules` は成果物（ruleset JSON）を stdout に出力する（SHALL）。診断は stderr に出力する。`--out <path>` が指定された場合はファイルに書き込む。

#### Scenario: stdout への出力

**Given** 有効な design ディレクトリがある
**When** `aozu export rules` を実行する
**Then** stdout に ruleset JSON が出力され、exit code は 0 である

#### Scenario: `--out` でファイルに書き込む

**Given** 有効な design ディレクトリがある
**When** `aozu export rules --out /tmp/rules.json` を実行する
**Then** `/tmp/rules.json` に ruleset JSON が書き込まれ、exit code は 0 である

#### Scenario: `実装:` 欠落で exit 1

**Given** `実装:` 行が欠落した mod を含む design ディレクトリがある
**When** `aozu export rules` を実行する
**Then** stderr に診断が出力され、exit code は 1 である

#### Scenario: design ディレクトリ不在で exit 2

**Given** 存在しない design ディレクトリのパスがある
**When** `aozu export rules --dir /nonexistent` を実行する
**Then** stderr にエラーメッセージが出力され、exit code は 2 である

### Requirement: `--verify` は再生成した ruleset とコミット済みファイルをバイト単位で比較する

`--verify` フラグが指定された場合、設計文書から ruleset を再生成し、コミット済みファイル（デフォルト `design/rules.json`）とバイト単位で比較する（SHALL）。一致で exit 0、乖離で exit 1 を返す。

#### Scenario: verify 一致で exit 0

**Given** `design/rules.json` が設計文書と一致する内容でコミットされている
**When** `aozu export rules --verify` を実行する
**Then** exit code は 0 である

#### Scenario: verify 乖離で exit 1

**Given** `design/rules.json` の内容が設計文書から再生成した ruleset と異なる
**When** `aozu export rules --verify` を実行する
**Then** stderr に乖離の診断が出力され、exit code は 1 である

#### Scenario: verify 対象ファイル不在で exit 2

**Given** `design/rules.json` が存在しない
**When** `aozu export rules --verify` を実行する
**Then** stderr にファイル不在のエラーが出力され、exit code は 2 である

### Requirement: architecture test は型のみの import を含む違反を検出する

architecture test は `import type` を含む import 文も依存辺として検出し、許可依存にない辺を違反として報告する（SHALL）。

#### Scenario: `import type` の違反を検出する

**Given** ファイル A（モジュール X）に `import type { Foo } from "../y/bar.ts"` があり、モジュール X から モジュール Y への許可依存が存在しない
**When** architecture test を実行する
**Then** この import が違反として検出される

### Requirement: architecture test はどのモジュールにも属さない src/ ファイルを違反として報告する

ruleset の `paths` のいずれにもマッチしない `src/` 配下のファイル（`*.test.ts` を除く）は、fail-closed として違反報告する（SHALL）。

#### Scenario: unmapped ファイルの違反

**Given** `src/unknown/foo.ts` が存在し、ruleset の `paths` に `src/unknown/` が含まれない
**When** architecture test を実行する
**Then** `src/unknown/foo.ts` が unmapped 違反として報告される

### Requirement: 既知の依存違反が解消された状態で architecture test が green になる

`src/check/manifest.ts` の import が graph 経由に修正され、`src/check/` から `src/parse/` への直接 import が存在しない状態で architecture test が通る（SHALL）。

#### Scenario: 違反解消後に歯が green

**Given** `src/check/manifest.ts` の `ParseResult` import が `../graph/index.ts` 経由に修正されている
**When** architecture test を実行する
**Then** テストが green になる

### Requirement: `design/rules.json` がコミットされ `export rules --verify` が exit 0 になる

PR の最終状態で `design/rules.json` がコミットに含まれ、`aozu export rules --verify` が exit 0 を返す（SHALL）。

#### Scenario: verify が exit 0

**Given** 全ての変更がコミットされている
**When** `bun src/cli/main.ts export rules --verify` を実行する
**Then** exit code は 0 である
