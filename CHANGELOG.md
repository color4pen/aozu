# Changelog

## [0.1.3](https://github.com/color4pen/aozu/compare/v0.1.2...v0.1.3) (2026-07-10)


### Features

* designed への戻りの実装 — mark の本文ハッシュ記録と乖離の計算縮退（ADR-0018 補記） ([#35](https://github.com/color4pen/aozu/issues/35)) ([bee95ab](https://github.com/color4pen/aozu/commit/bee95abe1c24e1774801038b0d23cf20518f5c0a))
* permission ビューの実装 — perm スキーマ・C6 二相化・export permissions（ADR-0023） ([#29](https://github.com/color4pen/aozu/issues/29)) ([85e2878](https://github.com/color4pen/aozu/commit/85e2878b6d73563a50ca3733da1a87517d94e531))
* 依存行の実装 — check --request の依存引用対応と coverage の被覆除外（ADR-0024） ([#34](https://github.com/color4pen/aozu/issues/34)) ([25a0af3](https://github.com/color4pen/aozu/commit/25a0af3a804b220bcaa2c79a3304ee9b2142aaf1))


### Bug Fixes

* aosora findings の即修正群 — format-version フェンス・topics 書式の統一・CLI ergonomics ([#18](https://github.com/color4pen/aozu/issues/18)) ([a084aa3](https://github.com/color4pen/aozu/commit/a084aa3d494f90d3d29a1928bee6986f428711be))

## [0.1.2](https://github.com/color4pen/aozu/compare/v0.1.1...v0.1.2) (2026-07-04)


### Features

* 単一バイナリ配布を立てる（GitHub Releases + install.sh — ADR-0021 の実施） ([#17](https://github.com/color4pen/aozu/issues/17)) ([c1d372f](https://github.com/color4pen/aozu/commit/c1d372f24c40e3a0f699d0295d5d04b677445817))


### Bug Fixes

* --version / -v フラグを実装する（spec-runner doctor の presence 検証と配布インストーラの前提） ([e80372b](https://github.com/color4pen/aozu/commit/e80372b7a638e83f5e0e65bd29080c2c7b872fae))

## [0.1.1](https://github.com/color4pen/aozu/compare/v0.1.0...v0.1.1) (2026-07-04)


### Features

* act 型（アクター）をコアに実装し、C5 を mod|act に改訂する ([#6](https://github.com/color4pen/aozu/issues/6)) ([039692c](https://github.com/color4pen/aozu/commit/039692c0b16a4e21483218fa39f67acef0b3a31a))
* aozu 自身の不変条件に決定的な歯を立てる ([#8](https://github.com/color4pen/aozu/issues/8)) ([a876aa1](https://github.com/color4pen/aozu/commit/a876aa169b874d8b29fdf0adafac70bc1effb081))
* CI と npm publish の経路を立てる（ADR-0016 の実施） ([#12](https://github.com/color4pen/aozu/issues/12)) ([62e4681](https://github.com/color4pen/aozu/commit/62e46816acea14eed0858c691b65f57e5b7a2832))
* CLI を結線し check / check --request を交換面契約どおりに実装する ([#3](https://github.com/color4pen/aozu/issues/3)) ([bc0c58c](https://github.com/color4pen/aozu/commit/bc0c58c4ed64d633ef38b9895ad792a1f18275e3))
* coverage / mark implemented を実装し、状態機械の書き込み経路を立てる ([#10](https://github.com/color4pen/aozu/issues/10)) ([dd15141](https://github.com/color4pen/aozu/commit/dd151413c088f527a98f38f8cc22795cd85cfe6d))
* init / scaffold / status を実装し、導入体験とフロンティア表示を立てる ([#5](https://github.com/color4pen/aozu/issues/5)) ([3dd8780](https://github.com/color4pen/aozu/commit/3dd878065f04f381a35e9a11596a83631ed90fb9))
* plan / prompt derive を実装し、designed 要素から request 草稿までの導出経路を立てる ([#9](https://github.com/color4pen/aozu/issues/9)) ([8029651](https://github.com/color4pen/aozu/commit/8029651b0d2c5bd1a683262b6bf476f116df0967))
* prompt propagate / prompt review を実装し、prompt 動詞群を完成させる ([#13](https://github.com/color4pen/aozu/issues/13)) ([e81e5f3](https://github.com/color4pen/aozu/commit/e81e5f3b4078b87587fdd9428582b7c9887b9b9a))
* prompt session を実装し、topic から設計セッションへの経路を立てる ([#11](https://github.com/color4pen/aozu/issues/11)) ([f1985fc](https://github.com/color4pen/aozu/commit/f1985fca0c468f874b7ba629a472d37a5b7bcb40))
* rules export と aozu 自身の歯（architecture test）を実装する ([#4](https://github.com/color4pen/aozu/issues/4)) ([ec657d8](https://github.com/color4pen/aozu/commit/ec657d8e5e1e868914377192075e0ac1e3c7787f))
* プロジェクト骨格と strict プロファイルパーサを確立する ([#1](https://github.com/color4pen/aozu/issues/1)) ([6e661d7](https://github.com/color4pen/aozu/commit/6e661d78b4340b78ea5c540981c16a03f4ce6158))
* 参照グラフと閉包検証（C1〜C11）を実装する ([#2](https://github.com/color4pen/aozu/issues/2)) ([f673484](https://github.com/color4pen/aozu/commit/f67348457acc32afbc4ef05bf49d3d7212265be0))
* 名称を aozu（青図）に確定し、ADR-0012・framework 不使用・dogfooding runbook を追加 ([df5fd3c](https://github.com/color4pen/aozu/commit/df5fd3c3ec144373e86963729a240729670d07b9))


### Bug Fixes

* check の fail-open（未知 prefix 素通り）と C11 診断の誤帰属を修正する ([#7](https://github.com/color4pen/aozu/issues/7)) ([f819541](https://github.com/color4pen/aozu/commit/f8195419123346e4722b6e2df61208db538c78b7))
* release タグから component 接頭辞を外し publish トリガ（v*）と一致させる ([78ba796](https://github.com/color4pen/aozu/commit/78ba796f022b126074f0a1dc18e96e1e3449aaad))
* version の歯をリテラル固定から release-please manifest との一致検証に直す（release PR が構造的に CI 落ちするのを解消） ([4cca8fb](https://github.com/color4pen/aozu/commit/4cca8fb0bd3538d1b9f95326f33ee46a60ca8749))
* パッケージ名を @color4pen/aozu に変更する（npm の類似名ガードにより unscoped aozu は publish 不可・bin パスの ./ も正規化） ([ef01d53](https://github.com/color4pen/aozu/commit/ef01d53bc86f7d7723a3f3be011e7714750c9350))
* 新規パッケージの provenance publish に --access public を明示する ([d1ecf11](https://github.com/color4pen/aozu/commit/d1ecf11472af3bbe02989609cf2d29984baa9d51))

## 0.1.0 (2026-07-04)


### Features

* act 型（アクター）をコアに実装し、C5 を mod|act に改訂する ([#6](https://github.com/color4pen/aozu/issues/6)) ([039692c](https://github.com/color4pen/aozu/commit/039692c0b16a4e21483218fa39f67acef0b3a31a))
* aozu 自身の不変条件に決定的な歯を立てる ([#8](https://github.com/color4pen/aozu/issues/8)) ([a876aa1](https://github.com/color4pen/aozu/commit/a876aa169b874d8b29fdf0adafac70bc1effb081))
* CI と npm publish の経路を立てる（ADR-0016 の実施） ([#12](https://github.com/color4pen/aozu/issues/12)) ([62e4681](https://github.com/color4pen/aozu/commit/62e46816acea14eed0858c691b65f57e5b7a2832))
* CLI を結線し check / check --request を交換面契約どおりに実装する ([#3](https://github.com/color4pen/aozu/issues/3)) ([bc0c58c](https://github.com/color4pen/aozu/commit/bc0c58c4ed64d633ef38b9895ad792a1f18275e3))
* coverage / mark implemented を実装し、状態機械の書き込み経路を立てる ([#10](https://github.com/color4pen/aozu/issues/10)) ([dd15141](https://github.com/color4pen/aozu/commit/dd151413c088f527a98f38f8cc22795cd85cfe6d))
* init / scaffold / status を実装し、導入体験とフロンティア表示を立てる ([#5](https://github.com/color4pen/aozu/issues/5)) ([3dd8780](https://github.com/color4pen/aozu/commit/3dd878065f04f381a35e9a11596a83631ed90fb9))
* plan / prompt derive を実装し、designed 要素から request 草稿までの導出経路を立てる ([#9](https://github.com/color4pen/aozu/issues/9)) ([8029651](https://github.com/color4pen/aozu/commit/8029651b0d2c5bd1a683262b6bf476f116df0967))
* prompt propagate / prompt review を実装し、prompt 動詞群を完成させる ([#13](https://github.com/color4pen/aozu/issues/13)) ([e81e5f3](https://github.com/color4pen/aozu/commit/e81e5f3b4078b87587fdd9428582b7c9887b9b9a))
* prompt session を実装し、topic から設計セッションへの経路を立てる ([#11](https://github.com/color4pen/aozu/issues/11)) ([f1985fc](https://github.com/color4pen/aozu/commit/f1985fca0c468f874b7ba629a472d37a5b7bcb40))
* rules export と aozu 自身の歯（architecture test）を実装する ([#4](https://github.com/color4pen/aozu/issues/4)) ([ec657d8](https://github.com/color4pen/aozu/commit/ec657d8e5e1e868914377192075e0ac1e3c7787f))
* プロジェクト骨格と strict プロファイルパーサを確立する ([#1](https://github.com/color4pen/aozu/issues/1)) ([6e661d7](https://github.com/color4pen/aozu/commit/6e661d78b4340b78ea5c540981c16a03f4ce6158))
* 参照グラフと閉包検証（C1〜C11）を実装する ([#2](https://github.com/color4pen/aozu/issues/2)) ([f673484](https://github.com/color4pen/aozu/commit/f67348457acc32afbc4ef05bf49d3d7212265be0))
* 名称を aozu（青図）に確定し、ADR-0012・framework 不使用・dogfooding runbook を追加 ([df5fd3c](https://github.com/color4pen/aozu/commit/df5fd3c3ec144373e86963729a240729670d07b9))


### Bug Fixes

* check の fail-open（未知 prefix 素通り）と C11 診断の誤帰属を修正する ([#7](https://github.com/color4pen/aozu/issues/7)) ([f819541](https://github.com/color4pen/aozu/commit/f8195419123346e4722b6e2df61208db538c78b7))
* version の歯をリテラル固定から release-please manifest との一致検証に直す（release PR が構造的に CI 落ちするのを解消） ([4cca8fb](https://github.com/color4pen/aozu/commit/4cca8fb0bd3538d1b9f95326f33ee46a60ca8749))
