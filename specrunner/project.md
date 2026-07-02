# aozu — project context

## 概要

aozu（青図）は設計レイヤ CLI。プロダクトリポジトリ内の `design/` 配下の設計文書を正本として、閉包検証・差分計算・request 導出支援を行う決定的ツール。agent 実行を内蔵しない。

## 正本ドキュメント

- `spec/format.md` — 形式仕様 v0（ID 文法・宣言/参照構文・型スキーマ・閉包規則 C1〜C11・state.json・rules export）
- `spec/integration.md` — 交換面契約（check --request / mark implemented / export rules）
- `adr/` — 決定記録。特に 0003（strict Markdown・行指向パース）、0009（技術選定）、0012（導出の消費者非依存）
- `design/` — aozu 自身の設計の自己記述。モジュール分割と許可依存は `design/static/modules.md`・`design/static/dependencies.md` に従う

## 技術方針

- TypeScript + Bun。実行時依存ゼロ（package.json の dependencies を空に保つ。devDependencies は可）
- CLI framework 不使用（引数解釈は自前の小さな registry）
- 汎用 Markdown パーサ・図処理ライブラリ不使用（strict プロファイルを行指向で読む）
- 検証: `tsc --noEmit` と `bun test`

## 規律

- 設計と実装の乖離を作らない。モジュール構成・依存方向は `design/static/` が正。乖離が必要になったら実装ではなく設計を先に直す
- 合否判定は決定的処理のみが出す。agent の出力テキストを解釈して verdict を導出するコードを書かない
- `tools/check.sh` は本実装が立つまでの暫定チェッカ（bash）。本実装の期待値の参考になる
