# Tasks: invariant-teeth

## T-01: 対応表データ構造と完全性検証の実装

- [ ] `tests/invariants.test.ts` を新設する
- [ ] `CoverageStatus` 型（`"tested" | "covered" | "not-mechanizable"`）と `CoverageEntry` インターフェース（`{ status: CoverageStatus; detail: string }`）を定義する
- [ ] 5 本の不変条件の対応表を `Record<string, CoverageEntry>` として定義する:
  - `inv-deterministic-verdict`: `{ status: "tested", detail: "本ファイル内の grep テスト（subprocess/fetch 禁止）" }`
  - `inv-immutable-id`: `{ status: "not-mechanizable", detail: "改名 = 削除 + 新規の意味論は mod-diff 実装まで観測点なし。mod-diff 実装時に再訪" }`
  - `inv-tool-writes-state`: `{ status: "tested", detail: "本ファイル内の grep テスト（write API + state.json 共起禁止）" }`
  - `inv-fail-closed-deps`: `{ status: "covered", detail: "tests/architecture.test.ts — 未マップ = 違反・許可リスト方式" }`
  - `inv-single-reference-grammar`: `{ status: "tested", detail: "本ファイル内の grep テスト（\\[\\[ regex 禁止域）" }`
- [ ] `design/domain/invariants.md` をファイルから読み込み、`{#inv-` で始まる ID を正規表現（`/\{#(inv-[a-z0-9-]+)\}/g`）で抽出する関数 `extractInvariantIds(content: string): string[]` を実装する
- [ ] テストケース: 抽出された ID 集合と対応表のキー集合が完全一致することを assert する。差集合があれば、不足している ID をエラーメッセージに含める
- [ ] テストケース: 対応表の各エントリの `status` が `CoverageStatus` の有効な値であることを assert する

**Acceptance Criteria**:
- invariants.md の 5 本の `inv-*` ID すべてが対応表に存在する
- invariants.md に存在して対応表に無い ID がある場合、テストが失敗しエラーメッセージにその ID が含まれる
- `tsc --noEmit` が成功する
- `bun test tests/invariants.test.ts` の完全性検証テストが green

## T-02: ファイル走査ユーティリティの実装

- [ ] `tests/invariants.test.ts` 内に `collectNonTestTsFiles(dir: string): Promise<string[]>` を実装する。`dir` 配下を再帰走査し、`.ts` で終わり `.test.ts` で終わらないファイルの絶対パスを配列で返す
- [ ] `REPO_ROOT` 定数を `resolve(import.meta.dir, "..")` で定義する
- [ ] `SRC_DIR` 定数を `join(REPO_ROOT, "src")` で定義する

**Acceptance Criteria**:
- `collectNonTestTsFiles(SRC_DIR)` が `src/` 配下の非テスト `.ts` ファイルを全て返す
- `*.test.ts` ファイルが結果に含まれない
- `tsc --noEmit` が成功する

## T-03: inv-tool-writes-state の歯の実装

- [ ] 検出関数 `detectStateWriteViolation(content: string): boolean` を実装する:
  - 書き込み API パターン: `/Bun\.write|writeFile|writeFileSync|createWriteStream|appendFile|appendFileSync/`
  - state.json パターン: `/state\.json/`
  - 両方がファイル内容に存在する場合に `true` を返す
- [ ] fixture テスト（陽性 — 検出される）:
  - `Bun.write` と `state.json` が共起する文字列で `true` を返すことを assert する
  - `writeFile` と `state.json` が共起する文字列で `true` を返すことを assert する
- [ ] fixture テスト（陰性 — 検出されない）:
  - `Bun.write` のみ（`state.json` なし）の文字列で `false` を返すことを assert する
  - `state.json` のみ（書き込み API なし）の文字列で `false` を返すことを assert する
  - 空文字列で `false` を返すことを assert する
- [ ] 実ソースツリー走査テスト:
  - `src/` 配下の非テスト `.ts` ファイルを走査する（`src/state/` 配下を除外）
  - 各ファイルの内容を読み込み、`detectStateWriteViolation` を適用する
  - 違反が 0 件であることを assert する。違反があれば、ファイルパスをエラーメッセージに含める

**Acceptance Criteria**:
- fixture の陽性テストが `true` を返す
- fixture の陰性テストが `false` を返す
- 現在の `src/`（`src/state/` 除外）に対して違反 0 件で green
- `tsc --noEmit` が成功する
- `bun test tests/invariants.test.ts` の inv-tool-writes-state テストが green

## T-04: inv-single-reference-grammar の歯の実装

- [ ] 検出関数 `detectReferenceGrammarViolation(content: string): boolean` を実装する:
  - 検出パターン: `/\\\[\\\[/` — ソースファイル内に文字列 `\[\[`（バックスラッシュ + `[` + バックスラッシュ + `[`）が出現するかを検査する
  - 出現する場合に `true` を返す
- [ ] fixture テスト（陽性 — 検出される）:
  - regex リテラル `const RE = /\[\[([a-z0-9-]+)\]\]/g;` を含む文字列で `true` を返すことを assert する
  - `new RegExp("\\[\\[")` を含む文字列で `true` を返すことを assert する
- [ ] fixture テスト（陰性 — 検出されない）:
  - テンプレート文字列 `` `[[mod-xxx]]` `` を含む文字列で `false` を返すことを assert する
  - コメント内 `// see [[mod-parse]]` を含む文字列で `false` を返すことを assert する
  - 空文字列で `false` を返すことを assert する
- [ ] 実ソースツリー走査テスト:
  - `src/` 配下の非テスト `.ts` ファイルを走査する（`src/parse/` 配下を除外）
  - 各ファイルの内容を読み込み、`detectReferenceGrammarViolation` を適用する
  - 違反が 0 件であることを assert する。違反があれば、ファイルパスをエラーメッセージに含める

**Acceptance Criteria**:
- fixture の陽性テストが `true` を返す（regex リテラルと RegExp 構築の両方）
- fixture の陰性テストが `false` を返す（テンプレート文字列・コメントの `[[]]` は非違反）
- 現在の `src/`（`src/parse/` 除外）に対して違反 0 件で green
- `tsc --noEmit` が成功する
- `bun test tests/invariants.test.ts` の inv-single-reference-grammar テストが green

## T-05: inv-deterministic-verdict の歯の実装

- [ ] 検出関数 `detectNondeterministicViolation(content: string): boolean` を実装する:
  - subprocess パターン: `/Bun\.spawn|spawnSync|child_process|Bun\.\$/`
  - ネットワークパターン: `/\bfetch\s*\(/`
  - いずれかがファイル内容に存在する場合に `true` を返す
- [ ] verdict-owning modules のディレクトリリストを定義する:
  - 固定: `["src/check", "src/export", "src/state"]`
  - 動的追加: `src/plan` が存在すればリストに追加する（`fs.existsSync` またはtry/catch で判定）
- [ ] fixture テスト（陽性 — 検出される）:
  - `Bun.spawn(["ls"])` を含む文字列で `true` を返すことを assert する
  - `await fetch("https://example.com")` を含む文字列で `true` を返すことを assert する
  - `import { exec } from "child_process"` を含む文字列で `true` を返すことを assert する
  - `Bun.$\`ls\`` を含む文字列で `true` を返すことを assert する
- [ ] fixture テスト（陰性 — 検出されない）:
  - `const result = checker.check(graph);` のような通常コードで `false` を返すことを assert する
  - `REF_RE.exec(line)` のような regex exec 呼び出しで `false` を返すことを assert する（`.exec(` は subprocess ではない）
  - 空文字列で `false` を返すことを assert する
- [ ] 実ソースツリー走査テスト:
  - verdict-owning modules 配下の非テスト `.ts` ファイルを走査する
  - 各ファイルの内容を読み込み、`detectNondeterministicViolation` を適用する
  - 違反が 0 件であることを assert する。違反があれば、ファイルパスをエラーメッセージに含める

**Acceptance Criteria**:
- fixture の陽性テストが `true` を返す（Bun.spawn, fetch, child_process, Bun.$ の全パターン）
- fixture の陰性テストが `false` を返す（通常コード・regex exec は非違反）
- 現在の verdict-owning modules に対して違反 0 件で green
- `tsc --noEmit` が成功する
- `bun test tests/invariants.test.ts` の inv-deterministic-verdict テストが green

## T-06: 最終検証

- [ ] `tsc --noEmit` が成功することを確認する
- [ ] `bun test` が全テスト green であることを確認する（既存テスト + 新規テストすべて）
- [ ] `bun src/cli/main.ts check` が exit 0 であることを確認する
- [ ] `bun src/cli/main.ts export rules --verify` が exit 0 であることを確認する
- [ ] `package.json` の `dependencies` が `{}` のままであることを確認する
- [ ] 新規テストの総数を確認し、既存 336 テストに影響がないことを確認する

**Acceptance Criteria**:
- `tsc --noEmit` が成功する
- `bun test` が全テスト green（既存テスト無変更）
- `bun src/cli/main.ts check` が exit 0
- `bun src/cli/main.ts export rules --verify` が exit 0
- `package.json` の `dependencies` が `{}`
