# Spec: invariant-teeth

## Requirements

### Requirement: Coverage table SHALL include all invariants declared in invariants.md

`tests/invariants.test.ts` の対応表（`Record<string, CoverageEntry>`）は `design/domain/invariants.md` で宣言された全ての `inv-*` ID をキーとして含まなければならない（SHALL）。invariants.md に ID が追加された場合、対応表にそのキーが存在しなければテストは失敗しなければならない（MUST）。

#### Scenario: All 5 current invariants are present in the coverage table

**Given** `design/domain/invariants.md` に 5 本の不変条件 (`inv-deterministic-verdict`, `inv-immutable-id`, `inv-tool-writes-state`, `inv-fail-closed-deps`, `inv-single-reference-grammar`) が宣言されている
**When** テストが invariants.md をパースし、`{#inv-*}` パターンで ID を抽出する
**Then** 抽出された 5 ID すべてが対応表のキーに存在する

#### Scenario: Missing invariant in coverage table causes test failure

**Given** invariants.md に新しい `inv-new-rule` が追加された（将来の想定）
**When** テストが invariants.md をパースし、対応表のキー集合と突合する
**Then** `inv-new-rule` が対応表に存在しないため、テストは失敗する

### Requirement: inv-tool-writes-state test SHALL detect co-occurrence of write API and state.json

`src/state/` 以外の `src/` 配下の非テスト `.ts` ファイルにおいて、ファイル書き込み API（`Bun.write`, `writeFile`, `createWriteStream`, `appendFile`）と文字列 `state.json` が同一ファイルに共起する場合、テストは違反として検出しなければならない（SHALL）。

#### Scenario: Current src/ passes (no violations)

**Given** 現在の `src/` コードベースで、`src/state/` 以外のファイルに書き込み API と `state.json` の共起がない
**When** 検出関数が `src/` 配下の非テスト `.ts` ファイル（`src/state/` 除外）を走査する
**Then** 違反は 0 件であり、テストは green になる

#### Scenario: Fixture with co-occurrence is detected as violation

**Given** `Bun.write(path, data)` と `"state.json"` を含む文字列 fixture
**When** 検出関数に fixture を渡す
**Then** 違反として検出される（`true` を返す）

#### Scenario: Write API without state.json is not a violation

**Given** `Bun.write(path, data)` のみを含み `state.json` を含まない文字列 fixture
**When** 検出関数に fixture を渡す
**Then** 違反として検出されない（`false` を返す）

#### Scenario: state.json without write API is not a violation

**Given** `readState(join(dir, "state.json"))` のみを含み書き込み API を含まない文字列 fixture
**When** 検出関数に fixture を渡す
**Then** 違反として検出されない（`false` を返す）

### Requirement: inv-single-reference-grammar test SHALL detect regex interpretation of `[[` outside src/parse/

`src/parse/` 以外の `src/` 配下の非テスト `.ts` ファイルにおいて、`\[\[` （正規表現で `[[` にマッチさせるエスケープパターン）が出現する場合、テストは違反として検出しなければならない（SHALL）。テンプレート文字列での `[[id]]` テキスト生成は違反としてはならない（MUST NOT）。

#### Scenario: Current src/ passes (regex patterns only in src/parse/)

**Given** `\[\[` を含む regex リテラルが `src/parse/references.ts` と `src/parse/structured-lines.ts` にのみ存在する
**When** 検出関数が `src/` 配下の非テスト `.ts` ファイル（`src/parse/` 除外）を走査する
**Then** 違反は 0 件であり、テストは green になる

#### Scenario: Fixture with regex `\[\[` is detected as violation

**Given** `const RE = /\[\[([a-z]+)\]\]/g;` を含む文字列 fixture
**When** 検出関数に fixture を渡す
**Then** 違反として検出される（`true` を返す）

#### Scenario: Template string `[[mod-xxx]]` is not a violation

**Given** `` `- [[mod-xxx]] -> [[mod-yyy]]` `` のようなテンプレート文字列のみを含む fixture
**When** 検出関数に fixture を渡す
**Then** 違反として検出されない（`false` を返す）

### Requirement: inv-deterministic-verdict test SHALL detect subprocess and network calls in verdict modules

verdict-owning modules（`src/check/`, `src/export/`, `src/state/`、および `src/plan/` が存在すれば含む）配下の非テスト `.ts` ファイルにおいて、subprocess 実行（`Bun.spawn`, `spawnSync`, `child_process`, `Bun.$`）またはネットワーク呼び出し（`fetch(`）が出現する場合、テストは違反として検出しなければならない（SHALL）。`src/cli/` と `src/prompt/` は検査対象に含めてはならない（MUST NOT）。

#### Scenario: Current verdict modules pass (no subprocess or fetch)

**Given** `src/check/`, `src/export/`, `src/state/` の非テストファイルに subprocess/fetch 呼び出しがない
**When** 検出関数が verdict-owning modules の非テスト `.ts` ファイルを走査する
**Then** 違反は 0 件であり、テストは green になる

#### Scenario: Fixture with Bun.spawn is detected as violation

**Given** `const proc = Bun.spawn(["ls"]);` を含む文字列 fixture
**When** 検出関数に fixture を渡す
**Then** 違反として検出される（`true` を返す）

#### Scenario: Fixture with fetch is detected as violation

**Given** `const res = await fetch("https://example.com");` を含む文字列 fixture
**When** 検出関数に fixture を渡す
**Then** 違反として検出される（`true` を返す）

#### Scenario: Regular code without subprocess/fetch is not a violation

**Given** `const result = checker.check(graph);` のような通常のコードのみを含む fixture
**When** 検出関数に fixture を渡す
**Then** 違反として検出されない（`false` を返す）
