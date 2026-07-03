# Design: invariant-teeth

## Context

aozu は自身の設計を `design/` 配下で自己記述し、`tests/architecture.test.ts` で依存構造（import 辺が `design/static/dependencies.md` の許可リストに収まること）を機械検証している。しかし `design/domain/invariants.md` に宣言された 5 本の不変条件（`inv-*`）は依存構造以外の性質を含んでおり、これらは機械検証されていない。

現状の不変条件と検証状態:

| inv ID | 内容 | 現在の検証手段 |
|---|---|---|
| `inv-deterministic-verdict` | 合否は決定的検証のみが出す | なし |
| `inv-immutable-id` | ID は不変 | なし（mod-diff 未実装） |
| `inv-tool-writes-state` | 状態はツールのみが書く | なし |
| `inv-fail-closed-deps` | 許可依存は fail-closed | tests/architecture.test.ts |
| `inv-single-reference-grammar` | 参照は一文法 `[[id]]` のみ | なし |

コードベースの現況（grep 確認済み）:

- `\[\[` を含む regex リテラルは `src/parse/references.ts`（1 箇所）と `src/parse/structured-lines.ts`（3 箇所）のみ。`src/cli/commands/init.ts` / `scaffold.ts` の `[[mod-xxx]]` はテンプレート文字列であり regex ではない
- `Bun.spawn` / `child_process` 等の subprocess 呼び出しは `src/cli/commands/*.test.ts` にのみ存在（非テストの production コードには無い）
- `fetch` は `src/` 全体に存在しない
- `Bun.write` / `writeFile` 等の書き込み API と `state.json` の同一ファイル共起は、非テストファイルでは存在しない（`src/state/reader.ts` は read のみ、`src/cli/commands/check.ts` / `status.ts` は `readState` 呼び出しのみ）
- 実装済みモジュール: `check`, `cli`, `export`, `fs`, `graph`, `parse`, `state`。`plan`, `diff`, `prompt`, `gitread` は未実装

制約:

- 実行時依存ゼロ（`package.json` の `dependencies` 空）
- 行指向の grep で足りる範囲に留める（AST 解析不使用 — architect 評価済み）
- `tests/architecture.test.ts` は変更しない
- `design/domain/invariants.md` は読み取りのみ

## Goals / Non-Goals

**Goals**:

- `tests/invariants.test.ts` を新設し、5 本の不変条件それぞれの検証状態を対応表で宣言する
- 対応表の完全性を invariants.md との機械突合で保証する（inv の追加時に表の更新漏れを検出する）
- `inv-tool-writes-state`、`inv-single-reference-grammar`、`inv-deterministic-verdict` の 3 本に grep ベースの歯を実装する
- 各歯に fixture による検出実証を付ける

**Non-Goals**:

- 不変条件の追加・変更（invariants.md は読み取りのみ）
- `tests/architecture.test.ts` の変更
- `mod-diff` の実装（`inv-immutable-id` の歯は mod-diff 実装時に再訪）
- lint 導入や AST 解析

## Decisions

### D1: 対応表のデータ構造と完全性検証

対応表を TypeScript の `Record<string, CoverageEntry>` として定義する。各エントリは不変条件の検証状態を宣言する:

```typescript
type CoverageStatus =
  | "tested"          // 本テストファイル内に歯を持つ
  | "covered"         // 他テストファイルの歯で担保済み
  | "not-mechanizable"; // 機械化不能（理由を記載）

interface CoverageEntry {
  status: CoverageStatus;
  detail: string; // 歯の名称、カバー元テストの参照、または機械化不能の理由
}
```

完全性検証: テスト内で `design/domain/invariants.md` を読み込み、`{#inv-*}` を正規表現で抽出して ID 集合を得る。対応表のキー集合と比較し、差集合があれば fail する。

**Rationale**: コメントのみの対応表は inv が増えたときに表の更新漏れが検出されない。Record のキーと invariants.md の ID 集合を機械突合することで、宣言漏れを確実に捕まえる。

**代替案**: コメントのみの対応表 — 却下。「全量が表に現れる」保証が腐る。

### D2: ファイル走査のユーティリティ関数

3 本の歯はいずれも「src/ 配下の非テスト `.ts` ファイルを列挙し、各ファイルの内容を行指向で検査する」構造を共有する。共通のユーティリティ関数を `tests/invariants.test.ts` 内に定義する:

```typescript
async function collectNonTestTsFiles(dir: string): Promise<string[]>
```

`*.test.ts` を除外し、絶対パスの配列を返す。`tests/architecture.test.ts` の `collectTsFiles` と同等の実装だが、独立した関数として定義する（architecture.test.ts は変更しない制約）。

**Rationale**: 3 つのテストが同じファイル列挙ロジックを使うため、重複を避ける。テストファイル内のプライベートヘルパーに閉じ、外部からの利用は想定しない。

### D3: inv-tool-writes-state の検出ロジック

「ファイル書き込み API」と「`state.json` 文字列」が同一ソースファイルに共起するかを行指向で検査する。

検出パターン（書き込み API）:
- `Bun.write` — Bun のファイル書き込み API
- `writeFile` — fs/promises の writeFile / writeFileSync
- `createWriteStream` — fs の Stream 系書き込み
- `appendFile` — fs の追記系

検出パターン（state.json 参照）:
- 文字列 `state.json` の出現

走査対象: `src/` 配下の全非テスト `.ts` ファイル。
許可ゾーン: `src/state/` 配下のファイルは検査から除外する。

検出関数:

```typescript
function detectStateWriteViolation(content: string): boolean
```

ファイル内容を受け取り、書き込み API パターンと `state.json` の両方が存在する場合に `true`（違反）を返す。

**Rationale**: 共起検査は「state.json を書く意図のあるコード」を行指向で近似する。`Bun.write(path, data)` と `readState(join(dir, "state.json"))` を区別する必要はない — write API が無ければ `state.json` を書き変える手段が無いため、共起の片方が欠けていれば安全である。

### D4: inv-single-reference-grammar の検出ロジック

`[[...]]` 参照を**解釈する**正規表現が `src/parse/` 以外に存在しないことを検証する。

検出パターン: ソースファイル中に文字列 `\[\[` が出現するかを grep する。

この判定が正しく機能する理由:
- regex リテラル `/\[\[([a-z0-9-]+)\]\]/g` 内の `\[\[` は、ソースファイル上で `\`, `[`, `\`, `[` の 4 文字として現れる
- テンプレート文字列 `` `[[mod-xxx]]` `` はバックスラッシュを含まないため `\[\[` にマッチしない
- コメント内の `[[id]]` も同様にバックスラッシュを含まない
- `new RegExp("\\[\\[")` は `\\[\\[` としてソースに現れるが、これも `\[\[` の部分文字列を含むため捕捉される

走査対象: `src/` 配下の全非テスト `.ts` ファイル。
許可ゾーン: `src/parse/` 配下のファイルは検査から除外する。

検出関数:

```typescript
function detectReferenceGrammarViolation(content: string): boolean
```

ファイル内容を受け取り、`\[\[` が存在する場合に `true`（違反）を返す。

**Rationale**: `\[\[` はエスケープされた `[` であり、正規表現で `[[` にマッチさせる目的でのみ使われる。テンプレート文字列での `[[` 生成はエスケープが不要であり、この判定基準で「解釈」と「生成」を正確に区別できる。grep ベースで十分な精度がある。

**代替案**: AST 解析で RegExp ノードを検出する — 却下。依存極小の方針に対し過剰。

### D5: inv-deterministic-verdict の検出ロジック

合否を所有するモジュール（verdict-owning modules）に subprocess 実行やネットワーク呼び出しが存在しないことを検証する。

verdict-owning modules（現時点で実装済み）:
- `src/check/` — 閉包検証
- `src/export/` — ruleset 出力と同期検証
- `src/state/` — state.json の読み書きと状態遷移

`src/plan/` は設計上 verdict-owning だが現在未実装。テストは存在するディレクトリのみを対象とし、`src/plan/` が実装された時点で自動的に対象に入る構造にする。

明示的に禁止域に**含めない**モジュール:
- `src/cli/` — composition root。並行 request が mod-cli にテンプレート取得のためのコマンド実行を追加する予定がある
- `src/prompt/` — 指示の組み立て。外部通信の可能性を排除する必要はない

検出パターン:
- `Bun.spawn` — Bun の subprocess API（`Bun.spawnSync` もマッチする）
- `child_process` — Node.js の subprocess モジュール import
- `spawnSync` — 関数単体での使用
- `Bun.$` — Bun shell テンプレートタグ
- `fetch(` — ネットワーク呼び出し（`\bfetch\s*\(` で関数呼び出しを検出）

走査対象: verdict-owning modules 配下の非テスト `.ts` ファイル。

検出関数:

```typescript
function detectNondeterministicViolation(content: string): boolean
```

ファイル内容を受け取り、上記パターンのいずれかが存在する場合に `true`（違反）を返す。

**Rationale**: subprocess 禁止域を verdict-owning modules に限定する。src/ 全域禁止は並行 request の mod-cli への変更と衝突する。合否の決定性（inv の本文「合否は決定的検証のみが出す」）が守るべき範囲は verdict を出すモジュールである。

**代替案**: src/ 全域禁止 — 却下。composition root のテンプレート取得を許す必要がある。

### D6: Fixture による検出実証

各検出関数に対して、テスト内に違反を仕込んだ文字列（fixture）を用意し、検出関数がそれを違反と判定することをテストで固定する。

fixture の形式: TypeScript ソースコードを模した文字列定数をテストケース内に直接定義する。一時ファイルの生成やディスク書き込みは行わない。

各 fixture:
- `inv-tool-writes-state`: `Bun.write` と `state.json` が共起する文字列
- `inv-single-reference-grammar`: `\[\[` を含む regex リテラルを持つ文字列
- `inv-deterministic-verdict`: `Bun.spawn` を含む文字列、`fetch(` を含む文字列

fixture は陽性（違反あり）と陰性（違反なし）の両方を含め、false positive がないことも固定する。

**Rationale**: 文字列内蔵の fixture はテストの独立性と並列実行の安全性を保つ。一時ファイル生成は fs の副作用とクリーンアップの複雑さを持ち込む。

**代替案**: 違反ファイルを一時生成 — 却下。テストの独立性・並列実行の安全性が下がる。

## Risks / Trade-offs

- **[Risk] inv-tool-writes-state の共起検出が「読み取り目的の `state.json` 言及 + 無関係な write API」を誤検出する** → 許可ゾーン（`src/state/`）の除外で緩和。`src/state/` 以外のモジュールが `state.json` を書く正当な理由はなく、共起が発生した時点で設計の注意信号として正しく機能する
- **[Risk] `\[\[` パターンの grep 検出が `src/parse/` 以外のコメント内で `\[\[` を言及するケースを誤検出する** → 現在の src/ には該当なし。将来コメントで regex パターンを言及する場合、そのファイルが参照解釈に関わっている可能性が高く、レビューのトリガーとして機能する（安全側の誤検出）
- **[Risk] verdict-owning modules のリストが design/static/modules.md と自動同期しない** → テスト内にハードコードするが、`src/plan/` は存在チェックで動的に対象に入る。新しい verdict-owning module が追加された場合はテストの手動更新が必要。不変条件の inv-id 増加は invariants.md 突合で検出されるが、verdict-owning module の増加は検出されない。ただし、modules.md の変更は architecture.test.ts の歯で依存違反として浮上するため、注意喚起の機会がある
- **[Trade-off] grep ベースの検出は AST 解析より精度が低い** → architect 評価済み。行指向で十分な検出力があり、依存極小の方針に適合する

## Open Questions

（なし — architect 評価済みの設計判断により主要な技術選択は確定済み）
