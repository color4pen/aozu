# Design: cli-check-wiring

## Context

R1（パーサ）と R2（参照グラフ + 閉包検証 C1〜C11）が merge 済み。ロジック層（`src/parse/`, `src/graph/`, `src/check/`）は揃っており、`runCheck(graph, manifest, stateKeys?)` が `CheckDiagnostic[]` を返す純関数として確立している。

残っている gap:

- `src/cli/main.ts` はスタブ（`console.log` 1 行）。コマンド解釈・結線・出力整形がない
- `CheckDiagnostic` → 契約形式文字列（`<LEVEL> <CODE> <id> <message>`）への変換が未実装
- `check --request`（交換面契約 §1 の入口ゲート）が未実装
- state.json の読み込み（`mod-state` の read 側）が未実装
- `tools/check.sh` が暫定チェッカとして存在するが、本実装で同等判定を達成する必要がある

制約:

- 実行時依存ゼロ（`package.json` の `dependencies` は空を維持）
- CLI framework 不使用（ADR-0009 で決定済み）
- 診断は stderr、成果物は stdout（`spec/integration.md` §5 が正本）
- 許可依存: `mod-cli` は全モジュールへ依存可、`mod-state` への辺もある（`design/static/dependencies.md`）
- `check --request` の引用抽出は `src/parse/references.ts` の `extractReferences` を再利用する（コード除外規則の二重実装を避ける）

## Goals / Non-Goals

**Goals**:

- `src/cli/` に自前の command registry を実装し、`aozu check` と `aozu check --request` を結線する
- `aozu check [--dir <path>]`: design ディレクトリの閉包検証を実行し、診断を契約形式で stderr に出力する
- `aozu check --request <path>`: 交換面契約 §1 の入口ゲートを実装する（引用検証 + 状態検証）
- `src/state/` に state.json の read 側を最小実装する
- `CheckDiagnostic` → 契約形式文字列の整形を CLI 層に置く
- exit code 規約（0 = 違反なし / 1 = 違反あり / 2 = 入力不正）を実装する
- `tools/check.sh` と同等判定を達成し、テストで固定する

**Non-Goals**:

- `mark implemented` / `export rules` / `diff` / `status` / `prompt` / `plan` / `init` / `scaffold` コマンド
- `src/state/` の書き込み側と状態遷移
- 出力の JSON 形式・カラー等の装飾
- `tools/check.sh` の削除

## Decisions

### D1: command registry の設計 — コマンド名 → handler の表

`src/cli/` に素朴な command registry を置く。構成:

```
src/cli/
  main.ts        # エントリポイント: argv 解析 → registry dispatch → process.exit
  registry.ts    # コマンド登録テーブルと dispatch ロジック
  commands/
    check.ts     # aozu check の handler
```

registry は `Map<string, CommandHandler>` で、`CommandHandler` は `(args: string[]) => Promise<number>` のシグネチャ（戻り値が exit code）。`main.ts` は `process.argv` からコマンド名を取り出し、registry から handler を引いて呼び出し、戻り値で `process.exit` する。

フラグ解釈は汎用パーサを作らず、各 handler 内で `args` 配列を直接走査する。`--dir <path>` は `args.indexOf("--dir")` + 次の要素で取得する。

`--help` は registry レベルで処理し、登録済みコマンド一覧を stderr に出力する（exit 0）。

**Rationale**: コマンド数は十数個、フラグ数も少数。外部 CLI framework は過剰（ADR-0009）。handler が exit code を返す設計により、テスト時に `process.exit` をモックせず handler の戻り値で判定できる。

**代替**: commander / yargs 等 — 実行時依存が生じ、dependencies 空の制約に抵触する。

### D2: `aozu check` の結線パイプライン

handler 内で以下のパイプラインを実行する:

1. `--dir` フラグから design ディレクトリのパスを決定（デフォルト `./design`）
2. ディレクトリ存在確認 → 不在なら stderr に診断を出力し exit 2
3. `readMarkdownFiles(dir)` でファイル読み込み
4. `parseFiles(files)` でパース
5. manifest.md のパス特定（`join(dir, "manifest.md")`）→ `parseManifest(frontmatters, manifestPath)` で manifest 解析
6. `buildGraph(parsed, manifestPath)` でグラフ構築
7. state.json の読み込み（`readState(join(dir, "state.json"))`）→ キー配列を取得
8. `runCheck(graph, manifest, stateKeys)` で検証
9. 診断を契約形式で stderr に出力
10. exit code を返す（0 / 1）

**Rationale**: 各ステップが既存モジュールの公開 API をそのまま呼ぶだけの直列パイプライン。CLI 層はロジックを持たず composition root として結線のみを行う（`design/static/modules.md` の mod-cli の責務定義に合致）。

**代替**: check handler 内に parse / graph / manifest ロジックをインラインで書く — 既存モジュールの API と重複し、乖離の温床になる。

### D3: `aozu check --request` の実装方針

`check --request <path>` は `check` コマンドの handler 内でフラグ分岐する。`--request` が存在すれば request モードに入り、なければ通常の design check を実行する。

request モードの処理:

1. `<path>` のファイル存在確認 → 不在なら exit 2
2. design ディレクトリの読み込み + パース + グラフ構築（通常 check と同じ前半パイプライン）
3. request 文書の読み込み → `extractReferences(content, path)` で `[[id]]` を抽出（コード除外規則を適用）
4. 検証 (a): 全引用が `graph.elements` に実在するか確認
5. state.json の読み込み → 検証 (b): 引用要素の状態が designed または requested であるか確認（implemented のみの引用を拒否）
6. `--require-citation` フラグ: 引用が 0 件なら不合格
7. 診断を stderr に出力、exit code を返す

引用検証の診断は `CheckDiagnostic` と同じ構造体を使い、code は `"REQ"` とする（C1〜C11 とは区別する）。

**Rationale**: `extractReferences` を再利用することで、コード除外規則の二重実装を避ける（architect 評価済み）。design ディレクトリの読み込みは通常 check と共通化し、request 文書のみが追加入力となる。

**代替**: CLI 内に独自の `[[id]]` 正規表現を書く — 除外規則が乖離する温床。

### D4: state.json 読み込みの最小実装を `src/state/` に置く

`src/state/reader.ts` に以下を実装する:

```
interface StateEntry {
  state: "designed" | "requested" | "implemented";
  request?: string;
  pr?: number;
}

type StateMap = Record<string, StateEntry>;

async function readState(path: string): Promise<StateMap>
```

- ファイルが存在すれば `JSON.parse` してエントリを返す
- ファイルが不在なら空オブジェクトを返す（= 全要素 designed とみなす）
- 書き込み側・状態遷移はスコープ外

`src/state/index.ts` で re-export する。

**Rationale**: state 読み込みは `mod-state` の責務（`design/static/modules.md`）。CLI 内に JSON.parse を書くと mod-state の責務を侵食し、後続の書き込み実装の置き場が不明確になる（architect 評価済み）。

**代替**: `src/cli/` 内で直接 JSON.parse — mod-state の責務境界が曖昧になり、後続 request（mark implemented）で再配置が必要になる。

### D5: 診断の整形を CLI 層に置く

`CheckDiagnostic` → 契約形式文字列（`<LEVEL> <CODE> <id> <message>`）への変換は `src/cli/` に置く。フォーマッタ関数:

```
function formatDiagnostic(d: CheckDiagnostic): string
  → `${d.level.toUpperCase()} ${d.code} ${d.elementId ?? "-"} ${d.message} (${d.file}:${d.line})`
```

出力先は stderr（`console.error` または `Bun.stderr.write`）。stdout には何も出力しない（check は成果物を持たないため）。

**Rationale**: R2 の設計（D5）で「出力整形は CLI 層の責務」と決定済み。check モジュールは構造体を返すのみ。

**代替**: check モジュールが整形済み文字列を返す — CLI 側の柔軟性が失われ、check の純関数性が損なわれる。

### D6: exit code の規約

| exit code | 意味 |
|-----------|------|
| 0 | 違反なし（check）/ 合格（check --request） |
| 1 | 違反あり / 不合格 |
| 2 | 入力不正（design ディレクトリ不在、manifest 不在、request ファイル不在） |

`main.ts` が handler の戻り値を `process.exit` に渡す。handler 自体は `process.exit` を呼ばない（テスト容易性）。

**Rationale**: `spec/integration.md` §1 の規定に準拠。

### D7: `check --request` における状態検証の詳細

契約 §1 の検証 (b): 引用要素の状態が designed または requested であることを確認する。

- state.json にエントリがない要素は designed とみなす（spec/format.md §9「エントリが無い要素は designed とみなす」）
- 状態が implemented **のみ**の引用は不合格とする（「設計 delta を経ていない疑い」）
- 引用要素に designed / requested のものが 1 つでもあれば、implemented の引用があっても合格（request が複数要素を引用し、一部が既に implemented でも許容する）

ただし上記の最後の条件は契約 §1 の「引用要素の状態が designed または requested である」の解釈に依存する。契約の文言は「引用要素の状態が designed または requested である」であり、**各**引用要素について個別に判定する読みが自然。すなわち、implemented な引用があれば**その引用に対して**診断を出す。

**Rationale**: 契約 §1 (b) の要素単位の判定。implemented のみの要素を引用する request は、すでに実装済みの要素を再度 request する意図であり、設計 delta を経ていない疑いがある。

## Risks / Trade-offs

- **[Risk] `extractReferences` の再利用で request 文書の特殊構文がある場合** → request 文書は通常の Markdown であり、`[[id]]` 抽出のコード除外規則は設計文書と同一。特殊構文は存在しない。リスクは低い。
- **[Risk] design ディレクトリの相対パス解決** → `--dir` で渡されたパスをそのまま `readMarkdownFiles` に渡す。相対パスは process の CWD に対して解決される。Bun の `Bun.file` と Node.js の `readdir` は同じ CWD を見るため不整合は起きない。
- **[Trade-off] `check --request` が design ディレクトリも読む** → request の引用検証には design ディレクトリの要素表が必要。design ディレクトリの読み込みコストが追加されるが、要素表なしでは実在性検証ができない。`--dir` フラグで design ディレクトリを指定可能にすることで柔軟性を確保する。
- **[Risk] state.json のスキーマ検証が最小** → JSON.parse のみでスキーマ検証をしない。不正な state.json（キーが非文字列、state フィールドが欠損等）はランタイムエラーになりうる。本 request は read 側の最小実装であり、スキーマ検証の厳密化は後続の書き込み実装時に行う。

## Open Questions

（なし — architect 評価済みの設計判断により主要な技術選択は確定済み）
