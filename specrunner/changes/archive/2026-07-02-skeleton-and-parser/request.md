# プロジェクト骨格と strict プロファイルパーサを確立する

## Meta

- **type**: new-feature
- **slug**: skeleton-and-parser
- **base-branch**: main
- **adr**: false

## 背景

aozu は設計文書の閉包検証・差分計算・request 導出支援を行う決定的 CLI である。形式仕様（`spec/format.md` v0）と自己記述の設計（`design/`、25 要素）は完成しているが、コードがまだ存在しない。第一弾として、ビルド・テスト基盤と、全機能の土台になる strict プロファイルパーサ（`design/static/modules.md` の [[mod-parse]] に相当）を確立する。

## 現状コードの前提

- `src/` と `package.json` は存在しない（greenfield）
- `design/` に本ツール自身の設計が `spec/format.md` v0 準拠で存在し、`tools/check.sh`（bash の暫定チェッカ）が宣言 25 要素・参照 15 種を検出する
- `design/domain/invariants.md` にインラインコード内 `[[id]]`（参照として扱ってはならない実例）が含まれる

## 要件

1. TypeScript + Bun のプロジェクト骨格を確立する: `package.json`（name / bin。**dependencies は空 = 実行時依存ゼロ**、devDependencies は可）、strict な `tsconfig.json`、`bun test` によるテスト、`tsc --noEmit` による型検査
2. strict プロファイルパーサを `src/parse/` に実装する。抽出対象は `spec/format.md` の以下:
   - §5 宣言構文: 見出し要素 `## 表示名 {#id}`（`^#{2,3}` レベル）、文書要素の frontmatter `id:`
   - §6 参照: 本文中の `[[id]]`。コードフェンス（``` トグル）とインラインコード（バッククォート内）は除外
   - §7 frontmatter: flat な `key: value` のみ。値は文字列またはカンマ区切りリスト
   - §8 構造化行: `責務:` 行、`実装:` 行、依存辺 `- [[a]] -> [[b]]`、`## 登場要素` 配下の `- [[id]]`、`elements:` 行
3. パース結果のデータ型を定義する: 要素（id・型 prefix・表示名・ファイル・行番号）、参照（出現位置・対象 id）、依存辺、構文診断（ID 文法違反・flat でない frontmatter 等、位置つき）
4. パーサは純関数とする: 入力は（ファイルパス, 内容）の列、出力は上記データ構造。ファイル I/O は呼び出し側の薄い層（`src/fs/` 等）に分離する
5. 構文違反は診断として返し、例外で落とさない（後続の閉包検証が診断を集約する前提）

## スコープ外

- 参照グラフ構築と閉包規則 C1〜C11 の評価（次 request）
- CLI コマンド結線（check / status / diff 等）
- rules export / prompt 系 / plan / state.json
- lint ツールの導入（任意。導入する場合も devDependencies のみ）

## 受け入れ基準

- [ ] `design/` 全文書のパースで宣言 25 要素・参照 15 種（`tools/check.sh` の出力と同数）が抽出されることをテストで固定する
- [ ] コードフェンス内・インラインコード内の `[[id]]` が参照として抽出されないことをテストで固定する（`design/domain/invariants.md` を fixture に使える）
- [ ] ID 文法違反（大文字・不正文字）と flat でない frontmatter が位置つき診断として報告されることをテストで固定する
- [ ] `package.json` の dependencies が空であることをテストまたは検証スクリプトで固定する
- [ ] `tsc --noEmit && bun test` が green

## architect 評価済みの設計判断

- 汎用 Markdown パーサ（remark 系）を使わず、行指向の自前パースとする（`adr/0003`）。却下理由: 依存ゼロ方針に反し、strict プロファイルに対して過剰
- CLI framework を使わない（`adr/0009`）。本 request では CLI 結線自体をスコープ外とし、判断の適用は次 request 以降
- パーサは throw せず診断を返す。却下した代替: fail-fast 例外 — 複数違反の一括報告（check の UX）と相性が悪い
