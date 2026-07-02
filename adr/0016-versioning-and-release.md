# ADR-0016: バージョニングとリリース — ツールと形式の二軸分離

- Status: accepted
- Date: 2026-07-02

## Context

バージョンを持つ対象が二つある: ツール本体（CLI 実装）と、形式仕様（format-version）である。ツールのリリース都合で形式が動くと、他リポジトリの正本（design/）が人質になる。逆に形式の安定性要求でツールのリリースを凍らせると、修正が届かない。

## Decision

二軸を分離する:

- **ツール本体**: semver。release-please + conventional commits + npm publish（実装パイプラインと同じリリース基盤）
- **format-version**: 形式仕様のバージョン（manifest に保持）。ツールの minor / patch では触れない。増分は破壊的な文法・スキーマ変更のときのみで、**移行手段の提供とセット**でしか行わない。形式は他リポジトリの正本を人質に取るため、ツールの都合より安定性を優先する

## Consequences

- publish 前に CI（test + check + `export rules --verify` + release-please）の整備が必要
- 移行手段の具体（migrate コマンドか手順書か）と、ツールが複数 format-version を読む後方互換の窓は、最初の破壊的変更が視野に入った時点で決める（docs/open-questions.md 論点 7）
