# act 型（アクター）をコアに実装し、C5 を mod|act に改訂する

## Meta

- **type**: spec-change
- **slug**: actor-type-support
- **base-branch**: main
- **adr**: false

## 背景

業務系ドッグフーディング（docs/findings/clearflow-2026-07-02.md の findings 1）で、seq の登場要素が mod 限定のためシナリオの主語（ロール・承認者）を書けない構造的欠落が確認された。設計判断は adr/0015 で確定済み: act 型（アクター）をコアの domain 層に追加し、C5 を「mod または act に解決される」に改訂する。仕様（spec/format.md §2・§4・§8・§10）は更新済みであり、本 request は実装を仕様に追随させる。

## 現状コードの前提

- `src/parse/id.ts` に `KNOWN_PREFIXES` があり、act は含まれていない
- `src/check/manifest.ts` に `LAYER_MAP`（prefix → layer）があり、domain 層は term / ent / inv の 3 prefix
- `src/check/rules/c05-seq-actors.ts` が C5 を実装し、登場要素が mod のみに解決されることを検証している
- `src/check/rules/c11-layer-direction.ts` が層間参照方向を検証し、domain の許可参照集合は term / ent / inv
- `design/rules.json` がコミット済みで `export rules --verify` は exit 0（act はモジュールではないため ruleset に影響しない）
- 既存テストは 310 件 green

## 要件

1. `KNOWN_PREFIXES` に `act` を追加する（ID 文法: `act-<slug>`）
2. `LAYER_MAP` の domain 層に `act` を追加する（C3 の enabledPrefixes・C11 の層判定・段階縮退がテーブル経由で一貫して効くこと）
3. C5 を改訂する: seq の登場要素リストが空でなく、すべて **mod または act** に解決される
4. C11 の domain 層の許可参照集合に `act` を追加する（spec/format.md §10 の表が正本）
5. 未知の act 参照（実在しない `act-*`）が C3 / C5 で検出されること（既存の解決検証がそのまま効くこと）

## スコープ外

- permission ビュー（act × 操作のマトリクス）— ビュー機構の実装は別 request
- scaffold への actors.md 対応（act は見出し要素型であり scaffold の対象外。既存方針どおり）
- init テンプレートへの actors.md 追加（任意ファイルのため生成しない）
- clearflow 側の design/ の書き直し

## 受け入れ基準

- [ ] actors.md（`{#act-*}` 見出し要素）+ act を登場要素に含む seq の fixture で `check` が exit 0 になることをテストで固定する
- [ ] 実在しない act 参照が C3 で、mod / act 以外の登場要素（例: ent）が C5 で検出されることをテストで固定する
- [ ] domain 無効の manifest では act 参照が段階縮退で診断されないことをテストで固定する
- [ ] domain の要素から act への参照が C11 で許可され、act から mod への参照が C11 で拒否されることをテストで固定する
- [ ] 本リポジトリで `check` exit 0・`export rules --verify` exit 0 のまま / 既存 310 テスト無変更で green / dependencies 空 / `tsc --noEmit && bun test` green

## architect 評価済みの設計判断

- act は domain 層のコア型（adr/0015 で確定済み）。却下した代替: ビュー前提・散文回避 — 根拠は ADR に記載
- 型テーブル（LAYER_MAP）への追加だけで C3 / C11 / 縮退が波及する既存構造を使い、規則ごとの個別対応を書かない。テーブル駆動が崩れる実装（act の特別扱い分岐）はレビューで拒否してよい
