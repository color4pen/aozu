# CLI を結線し check / check --request を交換面契約どおりに実装する

## Meta

- **type**: new-feature
- **slug**: cli-check-wiring
- **base-branch**: main
- **adr**: false

## 背景

R1（#1: パーサ）、R2（#2: 参照グラフ + 閉包検証 C1〜C11）が merge 済みで、ロジック層は揃った。本 request で CLI を結線し、aozu を初めて実行可能なツールにする。`tools/check.sh`（暫定 bash チェッカ）を本実装で置き換え可能にし、実装パイプラインが呼ぶ入口ゲート `check --request` を交換面契約どおりに提供する。

## 現状コードの前提

- `src/parse/`・`src/graph/`・`src/check/` が存在し、`runCheck(graph, manifest, stateKeys?)`（src/check/checker.ts）が `CheckDiagnostic[]` を返す
- `src/cli/main.ts:1` はスタブ（console.log 1 行のみ）。`package.json` の bin は `aozu → ./src/cli/main.ts`
- `src/fs/reader.ts:1` がファイル読み込みの薄い層
- 診断の出力形式・exit code の正本は `spec/integration.md` §1（check --request）と §5（共通規約: 診断は stderr、成果物は stdout）
- 参照抽出のコード除外規則は `src/parse/references.ts` に実装済み（request 文書の引用抽出に再利用できる）
- `design/static/dependencies.md` の許可依存: `mod-cli` は全モジュールへ依存可、`mod-state` への辺もある

## 要件

1. 自前の command registry を `src/cli/` に実装する（CLI framework 不使用 / adr/0009）。コマンド名 → handler の表、素朴なフラグ解釈、`--help` 出力
2. `aozu check [--dir <path>]`: design ディレクトリ（デフォルト `./design`）を読み、parse → graph → manifest → runCheck を結線する。診断は `<LEVEL> <CODE> <id> <message>`（ファイル:行 を含む）で **stderr** に出力。exit code: 0 = 違反なし / 1 = 違反あり / 2 = 入力不正（design ディレクトリ不在・manifest 不在）
3. `aozu check --request <path>`: 契約 §1 の入口ゲート。request 文書から `[[id]]` を抽出（コード除外規則を適用）し、(a) 全引用が実在要素に解決される、(b) 引用要素の状態が designed または requested である、を検証。`--require-citation` で引用 0 件を不合格にする。exit code は同上（ファイル不在は 2）
4. state 読み込みの最小実装を `src/state/` に置く（`design/static/modules.md` の [[mod-state]] の read 側のみ）: `state.json` が存在すれば `JSON.parse` してエントリを返し、無ければ空（= 全要素 designed とみなす）。書き込み側・状態遷移はスコープ外
5. `CheckDiagnostic` → 契約形式文字列への整形は CLI 層に置く（R2 の設計どおり check モジュールは構造体のみ）

## スコープ外

- `mark implemented` / `export rules` / `diff` / `status` / `prompt` / `plan` / `init` / `scaffold`
- `src/state/` の書き込み側と状態遷移
- 出力の JSON 形式・カラー等の装飾

## 受け入れ基準

- [ ] 本リポジトリ自身で `bun src/cli/main.ts check` が exit 0・stderr 出力なしになる（`tools/check.sh` と同判定）ことをテストで固定する
- [ ] 違反を含む fixture で exit 1 になり、stderr に契約形式の診断が出ることをテストで固定する
- [ ] design ディレクトリ不在で exit 2 になることをテストで固定する
- [ ] `check --request`: 実在 ID を引用する request で exit 0 / 架空 ID の引用で exit 1 / `--require-citation` かつ引用 0 件で exit 1 / ファイル不在で exit 2 をテストで固定する
- [ ] implemented のみを引用する request が不合格になることをテストで固定する（契約 §1 (b)。state.json fixture を使用）
- [ ] stdout に診断が混ざらない（stderr / stdout の分離。契約 §5）ことをテストで固定する
- [ ] `package.json` の dependencies が空のまま
- [ ] `tsc --noEmit && bun test` が green（既存 184 テスト無変更で green）

## architect 評価済みの設計判断

- CLI framework を使わない（adr/0009 で決定済み）。却下した代替: commander 等 — 動詞十数個・フラグ少数に外部抽象は過剰
- 診断は stderr、成果物は stdout（`spec/integration.md` §5 が正本）。check は成果物を持たないため stdout は常に空
- request 文書の引用抽出は `src/parse/` の参照抽出（コード除外込み）を再利用する。却下した代替: CLI 内の独自 regex — 除外規則の二重実装は乖離の温床
- state 読み込みを `src/cli/` 内に書かず `src/state/` に置く。却下した代替: CLI 内 JSON.parse — [[mod-state]] の責務であり、後続の書き込み実装の置き場を先に確保する
