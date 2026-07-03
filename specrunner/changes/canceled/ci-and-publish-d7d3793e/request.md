# CI と npm publish の経路を立てる（ADR-0016 の実施）

## Meta

- **type**: new-feature
- **slug**: ci-and-publish
- **base-branch**: main
- **adr**: false

<!-- adr 判断基準: 新しい port/adapter 追加、既存パターンと異なる設計選択、振る舞い/契約を変える修正、構造的リファクタリング → true。いずれにも該当しない → false -->
<!-- リリース方針の決定は ADR-0016 に既存。本 request はその実施であり新たな構造判断を伴わないため false -->

## 背景

ADR-0016 はツール本体のリリースを「semver + release-please + conventional commits + npm publish（実装パイプラインと同じリリース基盤）」と決定し、publish 前に CI（test + check + `export rules --verify` + release-please）の整備が必要としている。現状はどちらも存在せず、他リポジトリ（消費者プロジェクトの CI・実装パイプラインの結線）から aozu を呼ぶ配布手段がない。本 request で CI と publish の経路を立てる。

## 現状コードの前提

<!-- 書く直前に grep で再検証する。 -->

- package.json — `version: 0.0.0` / `private: true` / `bin: { "aozu": "./src/cli/main.ts" }` / `dependencies: {}`（空）/ `scripts` なし
- src/package.test.ts — 歯が既に 2 本ある: `dependencies` が空であること、`pkg.name === "aozu"` かつ `bin["aozu"]` が定義されていること
- src/cli/main.ts:1 — `#!/usr/bin/env bun` shebang 済み
- src/ 全域で Bun API（`Bun.file` 等）を使用（src/fs/reader.ts、src/state/reader.ts・writer.ts、src/cli/commands/*.ts）。node では動かず、**bun ランタイム必須の配布**になる（ADR-0009 の帰結）
- .github/workflows は不在
- 品質ゲートのローカル実体: `tsc --noEmit` + `bun test`（受け入れ基準の定型）。自己記述の検証は `bun src/cli/main.ts check --dir design` と `bun src/cli/main.ts export rules --dir design --verify`
- tools/check.sh は本実装が立つ前の暫定チェッカ（ヘッダに明記）。CI は本実装の check を使う
- 参照実装: spec-runner リポジトリ（同一作者の実装パイプライン）の `.github/workflows/ci.yml` / `release-please.yml` / `publish.yml` と `release-please-config.json`（release-type: node、`bump-minor-pre-major: true`）
- npm レジストリ: パッケージ名 `aozu` は未登録（2026-07-03 時点で取得可能）

## 要件

<!-- 実装の最重量部を名指しする。 -->

1. **CI workflow（最重量部）**: PR と main push で次を全部回し、いずれかの失敗で fail する: (a) `tsc --noEmit`、(b) `bun test`、(c) 自己記述の閉包検証 `check --dir design`（exit 0）、(d) `export rules --dir design --verify`（rules.json の同期検証）。runner には bun のセットアップを含める
2. **release-please**: conventional commits から release PR を生成する workflow + config。pre-1.0 運用は `bump-minor-pre-major: true`（spec-runner と同型）。初回リリースは 0.1.0
3. **publish workflow**: release 作成をトリガに npm publish。認証は `NPM_TOKEN` secret 参照（secret の登録自体は人側の作業でスコープ外）
4. **package.json の整備**: `private` を外し、`description` / `repository` / `license` / `files`（src と README・LICENSE のみ。テストファイルは除外してよい）/ `engines.bun` を追加。`dependencies` は空のまま（既存の歯を壊さない）
5. **LICENSE**: MIT を追加（実装パイプラインと同じ）
6. **README に導入節を追加**: `bunx aozu` / `bun add -g aozu` と、bun ランタイム必須である旨
7. **packaging smoke**: `npm pack` の tarball から `--help` が動くことを検証するテスト（または CI ステップ）を足し、「publish したが動かない」を封じる

## スコープ外

- npm アカウント・`NPM_TOKEN` secret の登録（人側の作業）
- 初回 publish の実行そのもの（release PR の merge 後に CI が行う）
- format-version の移行手段・複数バージョン読みの窓（論点 7。最初の破壊的変更が視野に入った時点で決める）
- node 互換ビルド（Bun API の置換を伴う大改修。設計判断参照）
- tools/check.sh の廃止判断（暫定チェッカの扱いは別途）

## 受け入れ基準

<!-- 機械検証できる文にする。 -->

- [ ] CI と同一のコマンド列（`tsc --noEmit` && `bun test` && `check --dir design` && `export rules --dir design --verify`）がローカルで green
- [ ] workflow YAML が上記 4 コマンドをジョブ定義に含むことを grep テストで固定する
- [ ] `npm pack` の tarball に src・README・LICENSE・package.json のみが含まれる（`.test.ts`・design/・specrunner/ 等が混入しない）ことをテストで固定する
- [ ] tarball から展開したパッケージで `bun <bin> --help` が exit 0 になることを検証する（packaging smoke）
- [ ] package.json: `private` フィールドが存在せず、`version` が `0.1.0`、`engines.bun` と `files` が定義されている
- [ ] src/package.test.ts の既存の歯（name = "aozu"・dependencies 空）が無変更で green
- [ ] release-please config と workflow が存在し、release-type: node / `bump-minor-pre-major: true` である
- [ ] 既存テスト無変更で green / `tsc --noEmit && bun test` green / dependencies 空

## architect 評価済みの設計判断

- **パッケージ名は unscoped `aozu`**。bin 名・既存の歯（src/package.test.ts の name assert）と一致し、レジストリで取得可能なことを確認済み。却下した代替: `@color4pen/aozu`（specrunner との scope 一貫性はあるが、既存テストの改変が必要になり、ツール名とパッケージ名の不一致を生む）
- **bun ランタイム必須の配布とし、TS ソースを bin 直指しのまま publish する**。却下した代替: tsup 等での node 向けビルド — Bun API を Node API に置換する大改修になり ADR-0009（Bun 選定・依存ゼロ・ビルドなし）に反する。想定消費者（実装パイプライン系エコシステム）は bun 前提であり、`engines.bun` と README で要件を明示すれば足りる
- **リリース基盤は spec-runner と同型**（release-please / bump-minor-pre-major / publish workflow 分離）。ADR-0016 の「実装パイプラインと同じリリース基盤」の忠実な実施であり、二系統のリリース運用を作らない
- **publish の品質ゲートは CI の 4 コマンド + packaging smoke に限る**。却下した代替: publish 前の手動チェックリスト — 判断場面を消す原理（ADR-0007 系）に従い、ゲートはすべて機械にする
