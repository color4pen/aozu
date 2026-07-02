# Design: skeleton-and-parser

## Context

aozu は設計文書の閉包検証・差分計算・request 導出支援を行う決定的 CLI だが、コードがまだ存在しない（greenfield）。形式仕様 `spec/format.md` v0 と自己記述の設計 `design/`（25 要素）が完成しており、暫定チェッカ `tools/check.sh` がパース結果の基準値（宣言 25 要素・参照 15 種）を提供する。

本変更は第一弾として、TypeScript + Bun のビルド・テスト基盤と、全機能の土台となる strict プロファイルパーサ（`design/static/modules.md` の `mod-parse` に対応）を確立する。

現状の制約:

- `package.json` は存在するが `name` / `bin` がなく、devDependencies に typescript のみ
- 実行時依存ゼロ方針（ADR-0009）: `dependencies` は空を維持
- 汎用 Markdown パーサ不使用（ADR-0003）: strict プロファイルを行指向で読む
- `design/domain/invariants.md` にインラインコード内 `[[id]]` が存在し、参照として抽出してはならない

## Goals / Non-Goals

**Goals**:

- TypeScript + Bun のプロジェクト骨格（package.json / tsconfig.json / テストランナー）を確立する
- `spec/format.md` §5〜§8 に準拠した strict プロファイルパーサを `src/parse/` に実装する
- パース結果のデータ型（要素・参照・依存辺・構文診断）を定義する
- `design/` 全文書に対するパースで check.sh と同一の定量結果を再現するテストを書く
- コードフェンス・インラインコード内 `[[id]]` の除外をテストで固定する
- ID 文法違反・flat でない frontmatter の位置つき診断をテストで固定する

**Non-Goals**:

- 参照グラフ構築（`mod-graph`）と閉包規則 C1〜C11 の評価（`mod-check`）
- CLI コマンド結線（check / status / diff 等）
- rules export / prompt / plan / state.json
- lint ツールの導入（biome 等。入れる場合も devDependencies のみ）

## Decisions

### D1: パーサは純関数、I/O は分離

パーサの公開 API は `(files: FileInput[]) => ParseResult` の純関数とする。`FileInput` は `{ path: string; content: string }` で、ファイル読み込みは呼び出し側の薄い層に委ねる。

**Rationale**: テストでファイルシステムをモックせずに文字列を直接渡せる。`mod-parse` の責務境界（`design/static/modules.md`）とも一致する。

**代替**: fs を内部で呼ぶ — テスタビリティ低下、mod-parse の責務を超える。

### D2: 行指向パース、コードフェンス状態はトグル

各ファイルを行単位で走査し、以下の状態を追跡する:

1. **コードフェンス状態**: `` ``` `` で始まる行でトグル。フェンス内の行は参照抽出・構造化行認識をスキップ
2. **frontmatter 状態**: ファイル先頭の `---` で開始、次の `---` で終了。flat `key: value` のみパース
3. **見出し要素検出**: `^#{2,3} (.+) \{#(<id>)\}$` にマッチする行で宣言を記録
4. **参照抽出**: フェンス外の行からインラインコード（`` ` `` 内）を除去した後、`[[<id>]]` をすべて抽出
5. **構造化行**: `責務:` / `実装:` / `- [[a]] -> [[b]]` / `## 登場要素` 配下の `- [[id]]` / `elements:` 行

**Rationale**: ADR-0003 の「行指向の貧弱なパーサで読める」設計制約に合致。check.sh と同じアルゴリズムで信頼性を担保できる。

**代替**: remark AST — 依存ゼロ方針に反し、strict プロファイルには過剰。

### D3: 構文違反は診断として返す（throw しない）

パーサは検出した構文違反（ID 文法違反・flat でない frontmatter 等）を `Diagnostic` 配列に蓄積して返す。例外は投げない。

**Rationale**: 後続の閉包検証（`mod-check`）が複数ファイルからの診断を集約して一括報告する前提。fail-fast 例外では最初の 1 件しか報告できない。

**代替**: fail-fast 例外 — check の UX（複数違反の一括報告）と相性が悪い。

### D4: データ型設計

```
Element {
  id: string           // e.g. "mod-parse"
  prefix: string       // e.g. "mod"
  displayName: string  // e.g. "パーサ"
  file: string         // 宣言元ファイルパス
  line: number         // 宣言行番号（1-based）
}

Reference {
  targetId: string     // 参照先 ID
  file: string         // 出現ファイル
  line: number         // 出現行番号
}

DependencyEdge {
  from: string         // 依存元 ID
  to: string           // 依存先 ID
  file: string
  line: number
}

Diagnostic {
  severity: "error" | "warning"
  message: string
  file: string
  line: number
}

ParseResult {
  elements: Element[]
  references: Reference[]
  dependencyEdges: DependencyEdge[]
  diagnostics: Diagnostic[]
  frontmatters: Map<string, Record<string, string>>
}
```

**Rationale**: 後続モジュール（mod-graph, mod-check, mod-export）が必要とする情報を過不足なく持つ。行番号は診断メッセージに必須。frontmatter は manifest の `enabled` や seq の `id` など、型判定に必要な情報を提供する。

### D5: ファイル構成

```
src/
  parse/
    types.ts           # データ型定義（Element, Reference, etc.）
    parser.ts           # メインパース関数
    frontmatter.ts      # frontmatter パーサ
    references.ts       # 参照抽出（コードフェンス/インラインコード除外ロジック含む）
    declarations.ts     # 宣言抽出（見出し要素 + frontmatter id）
    structured-lines.ts # 構造化行の認識（責務・実装・依存辺・登場要素・elements）
    id.ts               # ID 文法検証
    index.ts            # re-export
  fs/
    reader.ts           # ファイル読み込み（glob + readFile）の薄い層
    index.ts            # re-export
```

**Rationale**: `design/static/modules.md` の `mod-parse`（`src/parse/`）と一致。各関心事を独立ファイルに分離することでテスト単位が明確になる。`src/fs/` は `mod-parse` の外にあり、依存方向は `呼び出し側 -> fs -> parse` ではなく `呼び出し側 -> parse`（純関数）+ `呼び出し側 -> fs`（I/O）の並列呼び出し。

### D6: package.json の構成

- `name`: `"aozu"`
- `bin`: `{ "aozu": "./src/cli/main.ts" }` — CLI 結線は次 request だが bin フィールドは骨格として定義。エントリファイルは最小 stub とする
- `dependencies`: `{}`（空を維持。テストで検証）
- `devDependencies`: `typescript`（既存）+ `@types/bun`（型定義）
- `scripts`: `"typecheck": "tsc --noEmit"`, `"test": "bun test"`

### D7: tsconfig.json の strict 構成

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["bun-types"]
  },
  "include": ["src/**/*.ts"]
}
```

**Rationale**: Bun ランタイム向け。`noEmit: true` で型検査専用。`strict: true` で strictNullChecks / noImplicitAny 等をまとめて有効化。

## Risks / Trade-offs

- **[Risk] check.sh との数値不一致** → check.sh のアルゴリズムを忠実に再現し、同一の design/ に対してテストで数値を固定する。不一致があればテストが検出する。
- **[Risk] インラインコード除外ロジックのエッジケース（ネストしたバッククォート等）** → `spec/format.md` の strict プロファイルは「行指向の貧弱なパーサで読める」を制約とするため、複雑なエッジケースは仕様外。`` ` `` の単純な除去（check.sh と同じ `gsub(/`[^`]*`/, "")` 相当）で十分。
- **[Risk] 構造化行の型スキーマが将来拡張される** → 現時点では `spec/format.md` v0 の §8 に定義された行のみ認識する。未知の構造化行は無視する（forward-compatible）。
- **[Trade-off] bin エントリの stub** → CLI 結線はスコープ外だが bin フィールドは定義する。stub が存在することで `bunx` / `npx` が動作する最小構成を保つ。

## Open Questions

（なし — architect 評価済みの設計判断により主要な技術選択は確定済み）
