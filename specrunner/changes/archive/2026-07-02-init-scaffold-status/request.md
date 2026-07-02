# init / scaffold / status を実装し、導入体験とフロンティア表示を立てる

## Meta

- **type**: new-feature
- **slug**: init-scaffold-status
- **base-branch**: main
- **adr**: false

## 背景

R1〜R4 で check・入口ゲート・rules export・歯が揃い、aozu は検証系が自給自足になった。次は導入の入口（`init` / `scaffold`）と、設計継続の実体であるフロンティア表示（`status`）を実装する。`init` により「install してすぐ使える」が成立し、`status` により「次にやること」が人の暗算からファイルへ移る。

## 現状コードの前提

- `src/cli/` の registry に `check` / `export rules` が結線済み（`src/cli/main.ts`）
- `src/parse/` は任意の Markdown 文書の frontmatter（flat key: value）と要素宣言を汎用に抽出する。topics / plans の文書型も frontmatter `id:` 方式でパース可能
- `src/state/` に state.json の read 側最小実装がある（R3）。エントリが無い要素は designed 扱い
- `design/static/modules.md` の全モジュールに `実装:` 行がある。`design/rules.json` がコミット済みで `export rules --verify` は exit 0
- ディレクトリ規約・manifest・型スキーマの正本は `spec/format.md` §2・§3・§8。動詞の定義は `adr/0008`、フロンティア 3 種は `adr/0005`、最小プロファイルは `adr/0010`

## 要件

1. `aozu init [--dir <path>]`: 設計ディレクトリを規約どおり生成する。manifest は **`enabled: static` の最小プロファイル**（adr/0010 の段階①）、`static/modules.md`・`static/dependencies.md` はプレースホルダ 1 モジュールと書き方のコメントを含む雛形。**生成直後に `aozu check` が exit 0 で通る**こと。既存の設計ディレクトリがある場合は何も書かず exit 1（fail-closed）
2. `aozu scaffold <type> <id> [--dir <path>]`: 文書要素型（`topic` / `plan` / `seq` / `adr`）のテンプレートから新規ファイルを生成する。ID 文法違反は exit 1、既存 ID との衝突は exit 1、manifest で当該型が無効（例: loop 無効で topic）は exit 1。見出し要素型（mod / term / ent / inv）は既存ファイルへの追記であるため対象外とし、エラーメッセージで該当ファイルへの追記を案内する
3. `aozu status [--dir <path>]`: フロンティアを stdout に表示する（adr/0005 の 3 種）: (a) `status: open` の topic 一覧、(b) designed のままの要素（state.json にエントリなし or designed）、(c) requested のままの要素（request slug 付き）。loop が無効な場合は (a)(c) を省略し、要素数・参照数と check 合否の要約のみを表示する
4. テンプレートはコード内埋め込みとする（実行時のテンプレートファイル参照を持たない。依存ゼロと `bunx` 単発実行の両立）
5. 診断・エラーは stderr、成果物・一覧表示は stdout（`spec/integration.md` §5）

## スコープ外

- `diff` / `prompt` 系 / `plan`（コマンド）/ `coverage` / `mark implemented` / `mod-gitread`
- ビュー型（uc / scr 等）の scaffold
- status の JSON 出力・整形オプション

## 受け入れ基準

- [ ] 空ディレクトリで `init` → 生成物に対する `check` が exit 0 になることをテストで固定する
- [ ] 既存設計ディレクトリへの `init` が何も変更せず exit 1 になることをテストで固定する
- [ ] `scaffold topic <id>`（loop 有効 fixture）が `spec/format.md` §8 の topic スキーマに適合するファイルを生成することをテストで固定する
- [ ] `scaffold` の ID 文法違反 / 既存 ID 衝突 / 型無効（loop 無効で topic）がそれぞれ exit 1 になることをテストで固定する
- [ ] `status`: open topic + designed 要素 + requested 要素を含む fixture で 3 フロンティアが表示されることをテストで固定する
- [ ] `status`: loop 無効 fixture（本リポジトリの design/ で可）で退化表示になることをテストで固定する
- [ ] stdout / stderr の分離が保たれることをテストで固定する
- [ ] 本リポジトリで `check` exit 0・`export rules --verify` exit 0 のまま / 既存 247 テスト無変更で green / dependencies 空 / `tsc --noEmit && bun test` green

## architect 評価済みの設計判断

- init は最小プロファイル（static のみ）で生成する。却下した代替: フル 3 層生成 — 導入時の官僚制の押し付けであり、adr/0010 の「各段階は単体で完結した価値を持つ」に反する
- テンプレートはコード内埋め込み。却下した代替: テンプレートファイル同梱 — バンドル後のファイル解決の複雑さと実行時依存を持ち込む
- scaffold は文書要素型のみ。却下した代替: 見出し要素の追記対応 — 追記位置の判断をツールが持つことになり、決定的処理の範囲を超える
- 既存ディレクトリへの init は fail-closed（部分生成・マージをしない）。却下した代替: 不足ファイルのみ補完 — 「どこまでが生成物か」の判断が曖昧になる
