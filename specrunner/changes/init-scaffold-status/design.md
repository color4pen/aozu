# Design: init / scaffold / status

## Context

aozu の検証系（check・export rules）は自給自足している。CLI registry に `check` と `export` が結線済みで、パーサ・グラフ・閉包検証のパイプラインが稼働する。state.json の read 側も最小実装済み。

次のステップとして、導入の入口（`init` / `scaffold`）と設計継続の観測面（`status`）を追加する。これにより「install してすぐ使える」と「次にやることが 1 コマンドで出る」が成立する。

既存の依存グラフ上、3 コマンドはいずれも `mod-cli` に属する command handler として実装される。`init` と `scaffold` はファイル書き出しを行うが、既存の `mod-fsread`（読み取り専用）とは責務が異なるため、`fs/promises` と `Bun.write` を直接使い、`mod-fsread` には依存しない。`status` は既存パイプライン（fsread → parse → graph → check → state）を組み合わせる。

## Goals / Non-Goals

**Goals**:

- G1: `aozu init` で最小プロファイル（static のみ）の設計ディレクトリを生成する。生成直後に `aozu check` が exit 0 で通る
- G2: `aozu scaffold <type> <id>` で文書要素型（topic / plan / seq / adr）のテンプレートファイルを生成する
- G3: `aozu status` で ADR-0005 のフロンティア 3 種を表示する。loop 無効時は要約に退化する
- G4: テンプレートをコード内埋め込みとし、実行時ファイル参照を持たない
- G5: stdout / stderr の分離を全コマンドで保つ

**Non-Goals**:

- `diff` / `prompt` / `plan`（コマンド）/ `coverage` / `mark implemented`
- ビュー型（uc / scr 等）の scaffold
- status の JSON 出力・整形オプション
- `mod-gitread` への依存追加

## Decisions

### D1: init のテンプレート構造 — 3 ファイル固定

`init` は以下の 3 ファイルを生成する:

1. `design/manifest.md` — frontmatter に `format-version: 0` / `enabled: static`
2. `design/static/modules.md` — プレースホルダ 1 モジュール（`{#mod-app}`）+ 書き方コメント
3. `design/static/dependencies.md` — 空の許可依存（コメントのみ）

**Rationale**: ADR-0010 段階①（静的構造のみ）で最小価値が出る。3 ファイルは `check` が exit 0 を返す最小セットであり、プレースホルダモジュールが 1 つあることで `export rules` も即座に動作可能になる（ただし `実装:` 行の値はユーザーが書き換える前提）。

**Alternatives considered**: フル 3 層生成 → ADR-0010 に反する。不足ファイル補完 → fail-closed 原則に反する。

### D2: init の fail-closed — ディレクトリ存在チェック

`init` は対象パス（デフォルト `./design`）が既に存在する場合、何も書かずに exit 1 を返す。ディレクトリ内の部分状態は検査しない。

**Rationale**: 「どこまでが生成物か」の判断を排除し、決定的処理に留める。

**Alternatives considered**: 不足ファイルのみ補完 → 部分生成の曖昧さが入る。

### D3: scaffold の対象型 — 文書要素型のみ

対象: `topic` / `plan` / `seq` / `adr`（1 ファイル 1 要素の型）。  
対象外: `mod` / `term` / `ent` / `inv`（見出し要素型。既存ファイルへの追記が必要）。

見出し要素型が指定された場合は exit 1 で、追記先ファイルパスを案内するメッセージを stderr に出力する。

**Rationale**: 追記位置の判断はツールが持つべきでない（request に記載の設計判断）。

### D4: scaffold の型名→prefix・ディレクトリ・ファイル名のマッピング

| CLI 型名 | prefix | ディレクトリ | ファイル名 |
|---------|--------|------------|-----------|
| `topic` | `top` | `topics/` | `<slug>.md`（ID から prefix を除いた部分） |
| `plan` | `plan` | `plans/` | `<slug>.md` |
| `seq` | `seq` | `dynamic/` | `<slug>.md` |
| `adr` | `adr` | `adr/` | `<NNNN>-<slug>.md`（既存 adr の最大番号 + 1） |

**Rationale**: spec/format.md §2 のディレクトリ規約に直接対応する。adr の番号は既存ファイルの `NNNN` 部分をスキャンして決定する。

### D5: scaffold のバリデーション順序

1. ID 文法検証（`validateId`）→ 不合格: exit 1
2. prefix が CLI 型名と一致するか検証 → 不一致: exit 1
3. manifest の `enabled` で当該型が有効か検証 → 無効: exit 1
4. 既存 ID との衝突検証（グラフ構築して `elements.has(id)`）→ 衝突: exit 1
5. ファイル書き出し

**Rationale**: 安い検証から順に実行し、無駄な I/O を避ける。グラフ構築は step 4 で初めて必要になる。

### D6: scaffold のテンプレート内容 — spec/format.md §8 準拠

各テンプレートは §8 のスキーマに示される最小構造を含む:

- **topic**: frontmatter（`id`, `status: open`）+ 本文プレースホルダ
- **plan**: frontmatter（`id`, `status: open`）+ グループ見出しプレースホルダ（`{#grp-...}`）+ `elements:` 行
- **seq**: frontmatter（`id`）+ `# タイトル` + `## 登場要素` + `## 流れ`
- **adr**: frontmatter（`id`）+ `# タイトル`。loop 有効時は `topics: [[top-xxx]]` をプレースホルダとして含む

### D7: status の表示モード — loop 有効/無効で分岐

loop 有効時（manifest の `enabled` に `loop` を含む）:

```
=== Open Topics ===
  top-xxx    (source: gh#123)
  top-yyy

=== Designed (not yet requested) ===
  mod-aaa
  ent-bbb

=== Requested (awaiting implementation) ===
  mod-ccc    request: order-model
```

loop 無効時:

```
=== Design Summary ===
  Elements: 12
  References: 34
  Check: OK
```

**Rationale**: ADR-0010「段階①のプロジェクトが実在する前提で status が縮退集合でも意味を持つ」。loop 無効時はフロンティア (a)(c) が定義上存在しないため、設計の基本統計と check 合否のみを表示する。designed 要素の一覧 (b) も loop 無効時は省略する — state.json が存在しない段階①ではすべてが designed であり、一覧は要素リストの再表示に過ぎない。

### D8: status のデータ取得 — 既存パイプラインの再利用

`status` は以下の既存関数を組み合わせる:

1. `readMarkdownFiles` → `parseFiles` → `buildGraph` — 要素・参照の取得
2. `parseManifest` → `isLayerEnabled("loop")` — loop 有効判定
3. `readState` — state.json の読み取り
4. `runCheck` — check 合否（退化表示用）

新規のドメインロジックは、graph + state + manifest を入力としてフロンティアを算出する純粋関数のみ。

### D9: ファイル書き出し — Bun.write + fs/promises 直接使用

`init` と `scaffold` のファイル書き出しは `Bun.write` と `fs/promises.mkdir` を直接使用する。`mod-fsread` は読み取り専用モジュールであり、書き込み責務を持たない。

**Rationale**: 書き込みは `init` / `scaffold` の command handler 内に閉じた一時的な操作であり、専用モジュールを設ける複雑さに見合わない。`mod-cli` → `mod-fsread` の依存方向で書き込みを行うのは `mod-fsread` の責務定義（読み取りの唯一の seam）に反する。

**Alternatives considered**: `mod-fswrite` モジュールの新設 → 書き出し先が `init`/`scaffold` に限定される現時点では過剰。

### D10: コマンド登録 — main.ts の registry に 3 エントリ追加

`src/cli/main.ts` の registry に `init` / `scaffold` / `status` を追加する。各 handler は `src/cli/commands/` 配下に個別ファイルとして配置する。

## Risks / Trade-offs

- [Risk] init のプレースホルダモジュール名 `mod-app` がユーザーにとって直感的でない場合がある → Mitigation: コメントで変更を案内する。名前は最小限の意味を持つ中立な名称とする
- [Risk] scaffold で adr 番号が既存ファイルのスキャンに依存し、ファイル名の乱れに弱い → Mitigation: `NNNN-` パターンに一致しないファイルは無視し、0001 から開始する。番号の衝突はファイル存在チェックで検出する
- [Risk] status の退化表示（loop 無効時）が情報量不足に感じられる → Mitigation: 段階①の価値は歯パイプラインであり、status は「check OK + 要素数」が最小有用情報。JSON 出力は将来スコープ

## Open Questions

- なし（設計判断は request の architect 評価で解決済み）
