# Design: ci-and-publish

## Context

ADR-0016 はツール本体のリリースを「semver + release-please + conventional commits + npm publish」と決定し、publish 前に CI（test + check + `export rules --verify` + release-please）の整備が必要としている。現状 `.github/workflows` は不在であり、CI・リリース・配布の経路がすべて欠落している。

現状コード:

- `package.json` — `version: 0.0.0` / `private: true` / `bin: { "aozu": "./src/cli/main.ts" }` / `dependencies: {}` / `scripts: {}`
- `src/package.test.ts` — 既存の歯 2 本: `dependencies` が空であること、`pkg.name === "aozu"` かつ `bin["aozu"]` が定義されていること
- `src/cli/main.ts:1` — `#!/usr/bin/env bun` shebang 済み
- `.github/workflows` — 不在
- LICENSE — 不在
- 品質ゲートのローカル実体: `tsc --noEmit` + `bun test` + `bun src/cli/main.ts check --dir design` + `bun src/cli/main.ts export rules --dir design --verify`
- 参照実装: spec-runner リポジトリの `.github/workflows/ci.yml` / `release-please.yml` / `publish.yml` と `release-please-config.json`（release-type: node、`bump-minor-pre-major: true`）
- bun ランタイム必須（ADR-0009。src/ 全域で Bun API を使用）
- 既存テスト: 607 件 green

## Goals / Non-Goals

**Goals**:

- CI workflow を追加し、PR と main push で品質ゲート 4 コマンド（tsc --noEmit / bun test / check --dir design / export rules --dir design --verify）を回す
- release-please workflow + config を追加し、conventional commits から release PR を自動生成する
- publish workflow を追加し、release tag をトリガに npm publish する
- package.json を公開可能な状態に整備する（`private` 削除、`description` / `repository` / `license` / `files` / `engines.bun` 追加）
- MIT LICENSE ファイルを追加する
- README に導入節（インストール手順と bun ランタイム要件）を追加する
- packaging smoke テストを追加し、tarball の内容と `--help` の動作を検証する
- workflow YAML の内容を grep テストで固定する

**Non-Goals**:

- npm アカウント・`NPM_TOKEN` / `RELEASE_PLEASE_TOKEN` secret の登録（人側の作業）
- 初回 publish の実行（release PR の merge 後に自動実行される）
- node 互換ビルド（Bun API 依存のため ADR-0009 に反する）
- tools/check.sh の廃止判断
- format-version の移行手段

## Decisions

### D1: CI workflow — bun セットアップ + 4 コマンドの直列実行

`.github/workflows/ci.yml` に単一ジョブを定義し、以下を順に実行する:

1. `actions/checkout`
2. `oven-sh/setup-bun`（bun のセットアップ）
3. `bun install --frozen-lockfile`
4. `tsc --noEmit`
5. `bun test`
6. `bun src/cli/main.ts check --dir design`（自己記述の閉包検証）
7. `bun src/cli/main.ts export rules --dir design --verify`（rules.json の同期検証）

トリガは `push: branches: [main]`（`paths-ignore: specrunner/changes/**`）と `pull_request`。

Node.js のセットアップは不要。aozu は bun ランタイム専用であり、ビルドステップも存在しない。spec-runner の CI が node + bun の両方をセットアップするのは node 向けビルド（tsup）があるため。aozu にはそれがないので bun のみで足りる。

**Rationale**: 4 コマンドはローカルの品質ゲートと完全一致させる。CI とローカルのコマンド列が乖離すると「CI では通るがローカルでは落ちる」（またはその逆）が発生する。

**代替**: ステップ 6・7 を省略し tsc + test のみにする — 自己記述の整合が壊れた PR がマージ可能になる。request の要件 1 に反する。

### D2: release-please — spec-runner と同型の設定

`release-please-config.json` と `.release-please-manifest.json` を追加する:

- `release-type: "node"` — package.json の version を自動更新する
- `bump-minor-pre-major: true` — feat コミットで minor bump（pre-1.0 運用）
- `bump-patch-for-minor-pre-major: true` — fix コミットで patch bump
- manifest の初期値: `{ ".": "0.0.0" }`

workflow は `google-github-actions/release-please-action@v4` を使用し、`RELEASE_PLEASE_TOKEN`（PAT）で認証する。PAT を使う理由は spec-runner と同じ: `GITHUB_TOKEN` で作成した tag は連鎖 workflow（publish.yml）を発火しないため。

**Rationale**: ADR-0016 の「実装パイプラインと同じリリース基盤」の忠実な実施。二系統のリリース運用を作らない。

**代替**: `GITHUB_TOKEN` を使い、publish を release-please ジョブ内で直接実行する — tag-push トリガの publish workflow が発火しなくなり、手動再実行（workflow_dispatch）の経路が失われる。spec-runner で実証済みの PAT 方式を採用する。

### D3: publish workflow — tag トリガ + NPM_TOKEN + provenance

`.github/workflows/publish.yml` を以下の構成で追加する:

- トリガ: `push: tags: ["v*"]` + `workflow_dispatch`（手動再実行用）
- bun セットアップ + `bun install --frozen-lockfile`
- `npm publish --provenance`（npm provenance attestation 付き）
- 認証: `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

aozu は TS ソースを直接 publish するため、ビルドステップは不要。spec-runner の publish workflow にある `bun run build` は省略する。

Node.js のセットアップは `registry-url` 設定のために必要（npm publish が `.npmrc` の registry 設定を参照するため）。

**Rationale**: ビルドなし配布は ADR-0009（依存ゼロ・ビルドなし）の帰結。publish 前のビルドステップを省くことで、CI パイプラインの複雑性を下げる。

**代替**: publish 前に packaging smoke を CI ステップとして実行する — tarball の内容と --help の動作はテストで固定済み（D5）であり、`bun test` が CI で green なら publish 前に再検証する必要はない。

### D4: package.json 整備 — `private` 削除と publish 用メタデータ追加

- `private: true` を削除する
- `description`: `"設計レイヤ CLI — 設計文書の閉包検証・差分計算・request 導出支援"`
- `repository`: `{ "type": "git", "url": "git+https://github.com/color4pen/aozu.git" }`
- `license`: `"MIT"`
- `files`: `["src", "README.md", "LICENSE"]` — tarball に含める対象を明示する
- `engines`: `{ "bun": ">=1.3.14" }` — devDependencies の `@types/bun: ^1.3.14` に整合

`version` は `0.0.0` のまま変更しない。初回リリース 0.1.0 は release-please の release PR が `bump-minor-pre-major` の帰結として生成する。

`dependencies` は空のまま。既存の歯（`src/package.test.ts`）が検証しており、追加は不要。

**`.npmignore` でテストファイルを除外する**。npm の `files` フィールドは `src` ディレクトリを指定した場合、その配下の `*.test.ts` を自動除外しない。request-review（Finding #1）で指摘された通り、`.npmignore` に `**/*.test.ts` を追加してテストファイルの混入を防ぐ。

**Rationale**: `files` + `.npmignore` の組み合わせが最も宣言的。`files` に精細な glob を列挙する代替は、新規ディレクトリ追加時に漏れが生じやすい。

**代替**: `files` に `"src/**/*.ts"` + `"!src/**/*.test.ts"` を列挙する — npm の `files` フィールドは否定パターンを正式にはサポートしていない（動作は npm バージョン依存）。`.npmignore` のほうが確実。

### D5: packaging smoke テスト — tarball 内容検証 + --help 動作検証

`tests/packaging.test.ts` に以下の 2 テストを追加する:

1. **tarball 内容検証**: `npm pack --json` で tarball のファイル一覧を取得し、以下を検証する:
   - `src/` 配下の `.ts` ファイル（テストファイル以外）が含まれる
   - `README.md` / `LICENSE` / `package.json` が含まれる
   - `*.test.ts` が含まれない
   - `design/` / `specrunner/` / `tools/` / `tests/` が含まれない

2. **--help 動作検証**: `npm pack` で tarball を生成し、展開後に `bun <展開先>/src/cli/main.ts --help` が exit 0 になることを検証する

テストは `bun test` の一部として実行される。CI ステップではなくテストファイルに落とすことで、ローカルでも同じ検証が走る。

**Rationale**: テストファイルに統合することで、CI とローカルの検証範囲を一致させる。CI ステップとして分離する場合、ローカルでの packaging smoke 実行が手動になる。

**代替**: CI ステップとして `npm pack` + `tar` + `bun --help` を記述する — ローカルでの再現手順が別途必要になる。request-review（Finding #2）の指摘を踏まえ、テストファイル方式を採用する。

### D6: workflow YAML の grep テスト — CI コマンド列の固定

`tests/packaging.test.ts`（D5 と同一ファイル）に、`.github/workflows/ci.yml` のファイル内容を読み込み、品質ゲートの 4 コマンド文字列が含まれることを grep テストで固定する:

- `tsc --noEmit`
- `bun test`
- `check --dir design`
- `export rules --dir design --verify`

これにより、CI workflow から品質ゲートコマンドが意図せず削除された場合にテストが検出する。

**Rationale**: workflow YAML は手動編集されやすいファイルであり、コマンドの削除や変更が見落とされやすい。テストで固定することで、変更時に意識的な判断を強制する。

### D7: README 導入節 — インストール手順と bun ランタイム要件

README の「使い方」セクションの前に「導入」セクションを追加する:

- `bunx aozu`（npx 相当でインストール不要の実行）
- `bun add -g aozu`（グローバルインストール）
- bun ランタイム必須である旨（`engines.bun` に対応）

**Rationale**: npm パッケージとして公開する以上、導入手順が README にないと消費者が迷う。bun 必須の明示は node 環境での実行エラーを事前に防ぐ。

## Risks / Trade-offs

- **[Risk] `.npmignore` の漏れで不要ファイルが tarball に混入する** → D5 の tarball 内容テストが混入を検出する。CI で `bun test` が回るため、混入は merge 前にブロックされる
- **[Risk] `RELEASE_PLEASE_TOKEN` / `NPM_TOKEN` が未登録のまま merge されると workflow が失敗する** → secret 登録は人側の作業でスコープ外。workflow 失敗は GitHub Actions の通知で検出可能。README や PR description で secret 要件を言及し、登録忘れを防ぐ
- **[Risk] bun のバージョン差で CI とローカルの挙動が異なる** → `setup-bun` は最新の bun をインストールする。`engines.bun: ">=1.3.14"` で最低バージョンを明示。CI の bun バージョンを固定する場合は将来の改善として対応する
- **[Trade-off] packaging smoke テストが `npm pack` を実行するためテスト実行時間が増加する** → tarball 生成は数秒程度であり、packaging 事故の防止効果に比べて許容範囲

## Open Questions

（なし — ADR-0016 で設計判断確定済み。request-review の Finding #1（.npmignore）は D4 で対処、Finding #2（packaging smoke の形式）は D5 で対処済み）
