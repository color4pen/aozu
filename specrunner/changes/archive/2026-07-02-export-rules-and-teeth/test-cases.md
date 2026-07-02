# Test Cases: export-rules-and-teeth

## Summary

- **Total**: 34 cases
- **Automated** (unit/integration): 32
- **Manual**: 2
- **Priority**: must: 30, should: 4, could: 0

---

### TC-001: 正常な Graph から ruleset を生成する

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: generateRuleset は spec/format.md §11 のスキーマに適合する決定的な JSON を出力する > Scenario: 正常な Graph から ruleset を生成する

### TC-002: 同一入力から決定的な出力を返す

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: generateRuleset は spec/format.md §11 のスキーマに適合する決定的な JSON を出力する > Scenario: 同一入力に対して決定的な出力を返す

### TC-003: modules が辞書順に並ぶ

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-03

**GIVEN** ID が `mod-z`, `mod-a`, `mod-m` の 3 つの mod 要素を持つ Graph がある（すべて `実装:` 行あり、依存辺なし）  
**WHEN** `generateRuleset(graph)` を呼び出す  
**THEN** 出力 JSON の `modules` フィールドが `["mod-a", "mod-m", "mod-z"]` の辞書順で並んでいる

### TC-004: allowed が from→to の辞書順に並ぶ

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-03

**GIVEN** `mod-c -> mod-a`, `mod-a -> mod-b`, `mod-a -> mod-c` の 3 本の依存辺を持つ Graph がある（すべて `実装:` 行あり）  
**WHEN** `generateRuleset(graph)` を呼び出す  
**THEN** 出力 JSON の `allowed` が `[["mod-a","mod-b"],["mod-a","mod-c"],["mod-c","mod-a"]]` の順序で並んでいる

### TC-005: paths のキーが modules の辞書順と同じ順序

- **Category**: unit
- **Priority**: should
- **Source**: design.md > D2

**GIVEN** 複数の mod 要素を持つ有効な Graph がある  
**WHEN** `generateRuleset(graph)` を呼び出す  
**THEN** 出力 JSON を `JSON.parse` したとき `Object.keys(result.paths)` の順序が `result.modules` の順序と完全に一致する

### TC-006: mod 要素が 0 個の空グラフで正常動作する

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md > T-03

**GIVEN** `elements`, `implementations`, `dependencyEdges` がすべて空の Graph がある  
**WHEN** `generateRuleset(graph)` を呼び出す  
**THEN** `diagnostics` が空配列であり、`json` が `{ "format-version": 0, "modules": [], "paths": {}, "allowed": [] }` に相当する JSON 文字列（末尾改行あり）である

### TC-007: `実装:` 行が欠落した mod で診断を返す

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: `実装:` 行が欠落した mod 要素がある場合、generateRuleset は診断を返しJSON を生成しない > Scenario: `実装:` 行が欠落した mod がある

### TC-008: stdout に ruleset JSON を出力する

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: `export rules` コマンドは stdout に ruleset を出力する > Scenario: stdout への出力

### TC-009: --out でファイルに書き込む

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: `export rules` コマンドは stdout に ruleset を出力する > Scenario: `--out` でファイルに書き込む

### TC-010: `実装:` 欠落で exit 1 + stderr 診断

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: `export rules` コマンドは stdout に ruleset を出力する > Scenario: `実装:` 欠落で exit 1

### TC-011: design ディレクトリ不在で exit 2

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: `export rules` コマンドは stdout に ruleset を出力する > Scenario: design ディレクトリ不在で exit 2

### TC-012: サブコマンドなしで exit 0（usage 表示）

- **Category**: integration
- **Priority**: should
- **Source**: tasks.md > T-04

**GIVEN** CLI がセットアップされている  
**WHEN** `handleExport([])` を呼び出す  
**THEN** 戻り値が `0` であり、stderr または stdout に usage テキストが出力される

### TC-013: 未知サブコマンドで exit 2

- **Category**: integration
- **Priority**: should
- **Source**: tasks.md > T-04

**GIVEN** CLI がセットアップされている  
**WHEN** `handleExport(["unknown-subcommand"])` を呼び出す  
**THEN** 戻り値が `2` である

### TC-014: subprocess stdout が有効な JSON

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md > T-04

**GIVEN** 本リポジトリの `design/` ディレクトリが存在する  
**WHEN** `bun src/cli/main.ts export rules` をサブプロセスで実行する  
**THEN** stdout の文字列が `JSON.parse` で例外なく解析できる

### TC-015: subprocess stdout の JSON が必須フィールドを含む

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md > T-04

**GIVEN** 本リポジトリの `design/` ディレクトリが存在する  
**WHEN** `bun src/cli/main.ts export rules` をサブプロセスで実行して stdout を解析する  
**THEN** 解析した JSON オブジェクトが `format-version`, `modules`, `paths`, `allowed` のフィールドをすべて持つ

### TC-016: --verify: 一致で exit 0

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: `--verify` は再生成した ruleset とコミット済みファイルをバイト単位で比較する > Scenario: verify 一致で exit 0

### TC-017: --verify: 乖離で exit 1 + stderr 診断

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: `--verify` は再生成した ruleset とコミット済みファイルをバイト単位で比較する > Scenario: verify 乖離で exit 1

### TC-018: --verify: 対象ファイル不在で exit 2

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: `--verify` は再生成した ruleset とコミット済みファイルをバイト単位で比較する > Scenario: verify 対象ファイル不在で exit 2

### TC-019: `import type` の違反を検出する

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: architecture test は型のみの import を含む違反を検出する > Scenario: `import type` の違反を検出する

### TC-020: `export ... from` の import 辺を検出する

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-05

**GIVEN** `export { Foo } from "../y/bar.ts"` の行を含むファイルの内容を用意する  
**WHEN** `scanImports(filePath, content)` を呼び出す  
**THEN** `from` フィールドに `../y/bar.ts` が含まれるエントリが結果に存在する

### TC-021: パッケージ import を除外する

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-05

**GIVEN** `import { join } from "path"` および `import { foo } from "some-package"` の行を含む内容を用意する  
**WHEN** `scanImports(filePath, content)` を呼び出す  
**THEN** 結果が空配列である（`./` または `../` で始まらない import は除外される）

### TC-022: resolveImportPath が相対パスを正しく解決する

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-05

**GIVEN** importing ファイルが `src/check/manifest.ts` であり、import パスが `../graph/index.ts` である  
**WHEN** `resolveImportPath("src/check/manifest.ts", "../graph/index.ts")` を呼び出す  
**THEN** 戻り値がリポジトリルートからの相対パス `src/graph/index.ts` に正規化されている

### TC-023: findModule が最長一致で正しいモジュールを返す

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-05

**GIVEN** `paths` に `{ "src/cli/": ["<id-a>"], "src/cli/commands/": ["<id-b>"] }` のように短いプレフィックスと長いプレフィックスが両方含まれる  
**WHEN** `findModule("src/cli/commands/check.ts", paths)` を呼び出す  
**THEN** より長いプレフィックス `src/cli/commands/` に対応するモジュール ID が返る

### TC-024: findModule が未マッチ時に null を返す

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-05

**GIVEN** `paths` のいずれのプレフィックスにもマッチしないファイルパス `src/unknown/foo.ts` がある  
**WHEN** `findModule("src/unknown/foo.ts", paths)` を呼び出す  
**THEN** 戻り値が `null` である

### TC-025: unmapped ファイルが違反として報告される

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: architecture test はどのモジュールにも属さない src/ ファイルを違反として報告する > Scenario: unmapped ファイルの違反

### TC-026: 違反解消後に歯が green になる

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: 既知の依存違反が解消された状態で architecture test が green になる > Scenario: 違反解消後に歯が green

### TC-027: parseFiles が implementations を ParseResult に伝搬する

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-01

**GIVEN** `実装: src/foo/` を含む行が記述された Markdown ファイルを fixture として用意する  
**WHEN** `parseFiles([fixture])` を呼び出す  
**THEN** 戻り値の `implementations` 配列に、そのファイルの `実装:` 行の `paths`・`file`・`line` 情報を持つエントリが存在する

### TC-028: buildGraph が implementations を Graph に伝搬する

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md > T-01

**GIVEN** `implementations` フィールドに 1 件以上のエントリを持つ `ParseResult` がある  
**WHEN** `buildGraph(parsed)` を呼び出す  
**THEN** 戻り値の `graph.implementations` に、`ParseResult.implementations` と同じ内容が含まれる

### TC-029: check/manifest.ts に parse への直接 import がない

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md > T-02

**GIVEN** `src/check/manifest.ts` が graph 経由の import に修正されている  
**WHEN** `src/check/manifest.ts` の全行を検索する  
**THEN** `../parse/` を含む import 文が 0 件である

### TC-030: graph/index.ts が ParseResult を re-export する

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md > T-02

**GIVEN** `src/graph/index.ts` に `export type { ParseResult }` の行が追加されている  
**WHEN** `import type { ParseResult } from "../graph/index.ts"` を含むファイルを `tsc --noEmit` でコンパイルする  
**THEN** コンパイルエラーが発生しない

### TC-031: design/rules.json がコミットされ --verify が exit 0

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: `design/rules.json` がコミットされ `export rules --verify` が exit 0 になる > Scenario: verify が exit 0

### TC-032: aozu check が exit 0 のまま

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md > T-06

**GIVEN** 本 PR の全変更がコミットされている  
**WHEN** `bun src/cli/main.ts check` を実行する  
**THEN** exit code が 0 である（既存機能のリグレッションがない）

### TC-033: tsc --noEmit が成功する

- **Category**: manual
- **Priority**: must
- **Source**: tasks.md > T-06

**GIVEN** 本 PR の全変更がコミットされており、`tsconfig.json` の `include` に `"tests/**/*.ts"` が追加されている  
**WHEN** `tsc --noEmit` を実行する  
**THEN** 型エラーが 0 件で正常終了する

### TC-034: package.json の dependencies が空のまま

- **Category**: manual
- **Priority**: must
- **Source**: tasks.md > T-06

**GIVEN** 本 PR の全変更がコミットされている  
**WHEN** `package.json` の `dependencies` フィールドを確認する  
**THEN** `dependencies` が `{}` のままである（新規実行時依存が追加されていない）

---

## Result

```yaml
result: completed
total: 34
automated: 32
manual: 2
must: 30
should: 4
could: 0
blocked_reasons: []
```
