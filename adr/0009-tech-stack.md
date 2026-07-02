# ADR-0009: 技術選定 — TypeScript + Bun、実行時依存ゼロ

- Status: accepted
- Date: 2026-07-02

## Context

本ツールの処理は決定的な文字列処理（strict Markdown プロファイルの行指向パース）と git 呼び出しのみで、言語を選ばない。開発は LLM との共同開発体制で行い、既存の開発資産（規律・CI 構成・architecture test の型・リリースフロー）は TypeScript + Bun 側に蓄積されている。

## Decision

- **TypeScript + Bun** で実装する
- **実行時依存ゼロ**。必要なライブラリは dist にバンドルする
- **npm 配布**（`bunx` / `npx` で install 不要の実行）
- 汎用 Markdown パーサ・図処理ライブラリを持たない（ADR-0003 の strict プロファイルが前提）
- CLI framework（コマンドパーサライブラリ）を使わない。動詞十数個・フラグ少数の表面に外部抽象は過剰であり、引数解釈は自前の小さな registry で持つ

## Consequences

- 「install してすぐ使える・依存極小」を維持できる
- Go / Rust の単一バイナリ配布の利便は失うが、`bunx` で足りる想定利用者には過剰と判断。npm 圏外への配布需要が実在したら再検討する
