# rules export と aozu 自身の歯（architecture test）を実装する

## Meta

- **type**: new-feature
- **slug**: export-rules-and-teeth
- **base-branch**: main
- **adr**: false

## 背景

R1〜R3 で parse → graph → check → CLI が揃い、`aozu check` が動く。次は出口ゲートの供給側 [[mod-export]]（`export rules`）と、その最初の消費者としての **aozu 自身の歯**（設計の許可依存と実装の import の一致を機械検証する architecture test）を実装する。これにより aozu は「自分の設計と自分の実装の乖離」を自分で見張れるようになる。

## 現状コードの前提

- `design/static/modules.md` の全 11 モジュールに `実装:` 行がある（直近の設計更新で追加済み。未実装モジュールは将来パスを指す）
- `spec/format.md` §11 が ruleset の JSON スキーマ（`format-version` / `modules` / `paths` / `allowed`）を定義する
- `spec/integration.md` §3 が `export rules` / `--verify` の契約を、同 §3 末尾が依存の意味論（**型のみの import も依存辺に数える**、unmapped ファイルは fail-closed で違反）を定義する
- `src/check/manifest.ts:8` に `import type { ParseResult } from "../parse/types.ts"` があり、許可依存に `mod-check -> mod-parse` の辺がないため、上記意味論では**既知の違反**である
- `src/graph/index.ts` は `validateId` / `KNOWN_PREFIXES` を re-export 済み（R2 で確立した経路パターン）
- 既存テストは 210 件 green。`bun src/cli/main.ts check` は exit 0

## 要件

1. ruleset 生成ロジックを `src/export/`（[[mod-export]]）に実装する: graph から `spec/format.md` §11 の JSON を生成。`modules` は ID 辞書順、`allowed` は安定順序（決定的出力）。`実装:` 行が欠落した mod があれば診断を返す
2. CLI に `aozu export rules` を結線する: 既定は stdout へ出力（成果物は stdout / 契約 §5）。`--out <path>` でファイル書き込み。`--verify [<path>]` は再生成した ruleset とコミット済みファイル（既定パス `design/rules.json`）を比較し、一致 exit 0 / 乖離 exit 1。`実装:` 欠落は exit 1、design 不在等の入力不正は exit 2
3. **aozu 自身の歯**を `tests/architecture.test.ts` に実装する: design/ から ruleset を生成し、`src/` の実装ファイル（`*.test.ts` を除く）の import 文（`import type` を含む）を行指向で走査、ファイル → モジュールの対応を `paths` の最長一致で解決し、モジュール間の import 辺がすべて `allowed` の部分集合であることを assert する。どのモジュールにも属さない `src/` ファイルは違反として報告する（fail-closed）
4. 既知の違反を解消する: `src/graph/index.ts` に `ParseResult` 型の re-export を追加し、`src/check/manifest.ts` の import を graph 経由に変更する（`mod-check -> mod-graph -> mod-parse` の許可経路）
5. `design/rules.json` を生成してコミットし、`export rules --verify` が exit 0 になる状態で PR を作る

## スコープ外

- `diff` / `status` / `prompt` / `plan` / `mark implemented` / `init` / `scaffold`
- `mod-gitread`（`src/gitread/`）の実装
- CI workflow の追加（リポジトリにまだ CI がない）
- 他リポジトリ向けの歯の雛形配布

## 受け入れ基準

- [ ] `export rules` の出力が `spec/format.md` §11 のスキーマと一致し、同一入力から常に同一バイト列が出る（決定的）ことをテストで固定する
- [ ] `実装:` 行が欠落した fixture で exit 1 + 診断が出ることをテストで固定する
- [ ] `--verify`: 一致で exit 0 / 乖離（設計だけ変えた状態）で exit 1 をテストで固定する
- [ ] 歯: `import type` を含む違反 fixture が検出されることをテストで固定する
- [ ] 歯: どのモジュールにも属さない `src/` ファイルが違反になることをテストで固定する
- [ ] 本リポジトリで歯が green（要件 4 の修正後）。`src/check/` から `src/parse/` への直接 import が存在しない
- [ ] `design/rules.json` がコミットされ、本リポジトリで `export rules --verify` が exit 0
- [ ] `bun src/cli/main.ts check` が exit 0 のまま / `package.json` の dependencies が空のまま / `tsc --noEmit && bun test` が green

## architect 評価済みの設計判断

- **型のみの import も依存辺に数える**（`spec/integration.md` §3 で決定済み）。却下した代替: 実行時 import のみ — 型結合も知識の依存であり、境界破りの入口になる
- **unmapped ファイルは fail-closed で違反**（同上で決定済み）。却下した代替: 無言 skip — 新規ディレクトリが検査から漏れる「歯のスコープ穴」を最初から作らない
- コミット済み ruleset の既定パスは `design/rules.json`（設計の一部として管理し、`--verify` で乖離を検出する）。却下した代替: リポジトリルート — design 成果物は design/ に集約する
- 歯は import 文の行指向走査で実装し、TypeScript の AST パーサを導入しない（adr/0003・0009 の方針一貫。`import ... from "..."` / `export ... from "..."` の行パターンで足りる）
