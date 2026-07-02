# Design: export-rules-and-teeth

## Context

R1〜R3 で parse → graph → check → CLI が揃い、`aozu check` が動く。次は出口ゲートの供給側（`export rules`）と、その最初の消費者としての aozu 自身の architecture test を実装する。

現在の状態:

- `src/parse/structured-lines.ts` は `実装:` 行を既にパースしているが、`parseFiles` は `implementations` データを `ParseResult` に伝搬しておらず、`Graph` にも含まれない（破棄されている）
- `design/static/modules.md` の全 11 モジュールに `実装:` 行が存在する
- `design/static/dependencies.md` に 19 本の許可依存辺がある
- `spec/format.md` §11 が ruleset JSON のスキーマを、`spec/integration.md` §3 が `export rules` / `--verify` の CLI 契約を定義済み
- `src/check/manifest.ts:8` に `import type { ParseResult } from "../parse/types.ts"` があり、許可依存 `mod-check -> mod-parse` の辺が存在しないため既知の違反
- `src/graph/index.ts` は parse モジュールの公開 API（`validateId` / `KNOWN_PREFIXES` 等）を re-export する確立済みパターンを持つ
- CLI は自前の command registry（`Map<string, CommandDef>`）で `check` コマンドを登録・dispatch する。`export` は未登録
- テストは全て `src/**/*.test.ts` に配置。ルートの `tests/` ディレクトリは存在しない
- `tsconfig.json` の `include` は `["src/**/*.ts"]` のみ

制約:

- 実行時依存ゼロ（`package.json` の `dependencies` を空に保つ）
- CLI framework 不使用（ADR-0009）
- 行指向パース、AST パーサ不使用（ADR-0003・0009）
- 許可依存: `mod-export -> mod-graph`、`mod-cli -> mod-export`（`design/static/dependencies.md`）
- 診断は stderr、成果物は stdout（`spec/integration.md` §5）

## Goals / Non-Goals

**Goals**:

- `src/export/` に ruleset 生成ロジックを実装し、`spec/format.md` §11 の JSON を決定的に出力する
- CLI に `aozu export rules` を結線し、`--out` / `--verify` フラグを実装する
- `tests/architecture.test.ts` に aozu 自身の歯を実装し、設計の許可依存と実装の import の一致を機械検証する
- 既知の依存違反（`src/check/manifest.ts` → `src/parse/types.ts`）を解消する
- `design/rules.json` を生成・コミットし、`export rules --verify` が exit 0 になる状態にする

**Non-Goals**:

- `diff` / `status` / `prompt` / `plan` / `mark implemented` / `init` / `scaffold` コマンド
- `mod-gitread`（`src/gitread/`）の実装
- CI workflow の追加
- 他リポジトリ向けの歯の雛形配布

## Decisions

### D1: `implementations` データを ParseResult → Graph へ伝搬する

`src/parse/structured-lines.ts` は `実装:` 行を `{ paths, file, line }[]` として既にパースしている。しかし `parseFiles` は `implementations` を `ParseResult` に伝搬しておらず、結果として `Graph` にも含まれない。

変更:

1. `ParseResult`（`src/parse/types.ts`）に `implementations` フィールドを追加する。型は `{ paths: string[]; file: string; line: number }[]`（`StructuredLineResult` と同型）
2. `parseFiles`（`src/parse/parser.ts`）で `extractStructuredLines` の `implementations` を `ParseResult` に伝搬する
3. `Graph`（`src/graph/types.ts`）に `implementations` フィールドを追加する
4. `buildGraph`（`src/graph/builder.ts`）で `ParseResult.implementations` を `Graph.implementations` に伝搬する

export モジュールは `Graph.implementations` と `Graph.elements`（mod 要素の file/line）を組み合わせ、各 `実装:` 行をその直前の mod 要素に紐づける（同一ファイル内で `実装:` の行番号より手前にある最も近い mod 要素）。

**Rationale**: `actorIds` / `elementItems` が同じ経路（structured-lines → ParseResult → Graph）で伝搬される確立済みパターンに従う。export モジュールは `mod-graph` にのみ依存し、parse モジュールを直接触らない。

**代替案**: export モジュールが modules.md を独自にパースする — parse ロジックの重複が生じ、`mod-export -> mod-parse` の暗黙依存が発生する。

### D2: export モジュールの構成

```
src/export/
  types.ts       # Ruleset 型、ExportDiagnostic 型
  generator.ts   # generateRuleset(graph) → { json: string, diagnostics }
  index.ts       # 公開 API の re-export
```

`generateRuleset` は純関数。入力は `Graph`、出力は JSON 文字列と診断の配列。

Ruleset 型:

```typescript
interface Ruleset {
  "format-version": number;
  modules: string[];
  paths: Record<string, string[]>;
  allowed: [string, string][];
}
```

決定的出力のための安定順序:
- `modules`: ID の辞書順（`Array.sort()`）
- `paths`: `modules` と同じ辞書順のキー順序で `JSON.stringify` に渡す（ES2015+ の insertion-order 保証を利用）
- `allowed`: `[from, to]` のペアを `from` の辞書順、同一 `from` 内は `to` の辞書順でソート

`JSON.stringify(ruleset, null, 2)` + 末尾改行で出力。同一入力から常に同一バイト列。

診断:
- `実装:` 行が欠落した mod 要素がある場合、その mod ID と診断メッセージを返す
- 診断がある場合、JSON は生成しない（不完全な ruleset を出力しない）

**Rationale**: 出力の決定的性は `--verify` の前提。JSON.stringify の安定性は入力オブジェクトのキー挿入順序で保証する。

### D3: mod 要素と `実装:` 行の紐づけロジック

`generator.ts` 内で以下の手順で紐づける:

1. `graph.elements` から prefix が `mod` の要素をすべて収集する
2. `graph.implementations` のうち、mod 要素と同一ファイルに属するものを選ぶ
3. 各 `実装:` 行について、同一ファイル内でその行番号より手前にある mod 要素のうち最も近いものに紐づける
4. `実装:` 行を持たない mod 要素があれば診断を生成する

この紐づけは `modules.md` の構造（`## Name {#mod-id}` の直後に `責務:` と `実装:` が並ぶ）に依存しており、`spec/format.md` §8 のスキーマ定義と整合する。

**Rationale**: 紐づけを export モジュール内の純関数に閉じることで、Graph の型を「紐づけ済みマップ」で汚さない。紐づけロジックが必要なのは export だけであり、他のモジュールが modules.md の `実装:` 行を意味的に使うことはない。

### D4: CLI コマンドの結線 — `export` コマンドとサブコマンド `rules`

`src/cli/commands/export.ts` に `handleExport(args: string[]): Promise<number>` を実装する。

コマンド解釈:
- `args[0]` がサブコマンド名。`rules` 以外は未知サブコマンドとして exit 2
- サブコマンドなし / `--help` は usage を stderr に出力し exit 0

`export rules` のフラグ:
- `--dir <path>`: design ディレクトリ（デフォルト `./design`）
- `--out <path>`: 出力先ファイルパス。省略時は stdout
- `--verify [<path>]`: 再生成した ruleset とコミット済みファイルを比較。`<path>` 省略時は `design/rules.json`（`--dir` からの相対）

exit code:
- 0: 成功（出力完了 / verify 一致）
- 1: 不合格（`実装:` 欠落 / verify 乖離）
- 2: 入力不正（design ディレクトリ不在等）

パイプライン:
1. design ディレクトリの存在確認 → 不在なら exit 2
2. `readMarkdownFiles` → `parseFiles` → `buildGraph` で Graph 構築（`check` コマンドと同じ前半パイプライン）
3. `generateRuleset(graph)` で ruleset 生成
4. 診断あり（`実装:` 欠落等）→ stderr に出力し exit 1
5. `--verify` モード: コミット済みファイルを読み、生成結果とバイト単位で比較。一致 exit 0 / 乖離 exit 1 / ファイル不在 exit 2
6. 通常モード: `--out` があればファイル書き込み、なければ stdout に出力し exit 0

`main.ts` で `export` コマンドを registry に登録する。

**Rationale**: サブコマンド方式は将来の `export` 派生（例: `export deps`）への拡張性を確保する。handler が exit code を返す既存パターンに合わせ、`process.exit` は `main.ts` のみが呼ぶ。

### D5: 既知の依存違反の解消

`src/check/manifest.ts` の `import type { ParseResult } from "../parse/types.ts"` を graph 経由に修正する。

手順:
1. `src/graph/index.ts` に `export type { ParseResult } from "../parse/types.ts"` を追加する
2. `src/check/manifest.ts` の import を `import type { ParseResult } from "../graph/index.ts"` に変更する

`ParseResult` の re-export は、graph が既に `validateId` / `KNOWN_PREFIXES` を parse から re-export しているパターンと同一。check → graph は許可依存として存在し（`design/static/dependencies.md`）、graph → parse も許可されている。

**Rationale**: re-export による経路変更は、型のみの import であっても設計上の依存辺を正しく表現するため。request で明示された修正方法。

### D6: architecture test（歯）の設計

`tests/architecture.test.ts` に実装する。`tsconfig.json` の `include` に `"tests/**/*.ts"` を追加し、型検査の対象にする。

テストの処理:

1. `design/` ディレクトリを読み込み、parse → graph → generateRuleset で ruleset を生成する
2. `src/` 配下の `*.ts` ファイルを列挙する（`*.test.ts` を除外）
3. 各ファイルの import 文を行指向で走査する:
   - パターン: `import` または `export` を含み、`from "..."` または `from '...'` で終わる行
   - `import type` も対象（型のみの import も依存辺に数える — `spec/integration.md` §3）
4. import パスの解決: 相対パスを importing ファイルの位置から解決し、リポジトリルートからの相対パスに正規化する
5. ファイル → モジュールの対応: ruleset の `paths` を最長一致で照合する。どのモジュールにも属さないファイルは違反（fail-closed）
6. モジュール間の import 辺がすべて `allowed` の部分集合であることを assert する。同一モジュール内の import は検査対象外
7. 違反があれば、ファイル・行番号・import 元モジュール → import 先モジュールの情報を含む明確なエラーメッセージを出す

import パスの正規化:
- 相対パスのみを対象とする（`./` / `../` で始まるもの）。Node.js 組み込みモジュール（`path`, `fs/promises` 等）やパッケージ import（`bun-types` 等）は無視する
- `.ts` 拡張子の有無を正規化する

最長一致アルゴリズム:
- `paths` のすべてのエントリを prefix 長の降順でソートし、ファイルパスに対して最初にマッチするものを採用する
- 例: `src/cli/commands/check.ts` は `src/cli/` にマッチし `mod-cli` に属する

**Rationale**: 行指向走査は ADR-0003・0009 の方針に従い、TypeScript AST パーサを導入しない。fail-closed は `spec/integration.md` §3 末尾の意味論に準拠する。

### D7: `design/rules.json` の生成

実装完了後、`aozu export rules --out design/rules.json` を実行して生成する。コミットに含め、`export rules --verify` が exit 0 になることを検証する。

**Rationale**: コミット済み ruleset を `design/` 配下に管理し、`--verify` で設計文書との乖離を検出する（architect 評価済み）。

## Risks / Trade-offs

- **[Risk] `実装:` 行と mod 要素の紐づけが modules.md の構造に依存** → `spec/format.md` §8 で「`実装:` 行は mod 要素の見出し配下に記述する」構造が定義されており、パーサが正しく行番号を記録する限り紐づけは安定する。別ファイルに `実装:` 行が現れた場合は紐づかず、欠落として診断される（fail-safe）
- **[Risk] import 文の行指向走査の網羅性** → TypeScript の `import` / `export ... from` 構文は行指向でほぼ網羅できる。複数行にまたがる import 文は本リポジトリでは使われておらず、ADR-0003 の方針として AST パーサを使わない。万が一見落とす import があれば、それは依存辺の欠落（= 安全側の見逃し）ではなく、検査漏れだが、実用上のリスクは低い
- **[Risk] `tsconfig.json` の `include` 変更で予期しないファイルが型検査対象に入る** → `tests/**/*.ts` のみを追加するため、影響は architecture test ファイルに限定される
- **[Trade-off] verify はバイト単位比較** → JSON の意味的同値ではなくバイト列の一致を検査する。決定的出力を前提とするため、意味的に同値でもフォーマットが異なれば乖離と判定する。これは意図的な設計（手で書き換えた ruleset を検出するため）

## Open Questions

（なし — architect 評価済みの設計判断により主要な技術選択は確定済み）
