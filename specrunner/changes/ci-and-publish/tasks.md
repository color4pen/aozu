# Tasks: ci-and-publish

## T-01: package.json を公開用に整備する

- [ ] `private: true` を削除する
- [ ] `description` を追加する: `"設計レイヤ CLI — 設計文書の閉包検証・差分計算・request 導出支援"`
- [ ] `repository` を追加する: `{ "type": "git", "url": "git+https://github.com/color4pen/aozu.git" }`
- [ ] `license` を追加する: `"MIT"`
- [ ] `files` を追加する: `["src", "README.md", "LICENSE"]`
- [ ] `engines` を追加する: `{ "bun": ">=1.3.14" }`
- [ ] `version` が `"0.0.0"` のまま変更されていないことを確認する
- [ ] `dependencies` が `{}` のまま変更されていないことを確認する

**Acceptance Criteria**:
- `private` フィールドが package.json に存在しない
- `version` が `"0.0.0"` である
- `description` / `repository` / `license` / `files` / `engines.bun` が定義されている
- `dependencies` が `{}` のまま
- `src/package.test.ts` の既存の歯（name = "aozu"・dependencies 空）が変更なしで green
- `tsc --noEmit` が成功する

## T-02: .npmignore を追加する

- [ ] プロジェクトルートに `.npmignore` を作成する
- [ ] 以下のパターンを記載する:
  - `**/*.test.ts` — テストファイルを除外
  - `design/` — 設計文書を除外
  - `specrunner/` — specrunner 関連を除外
  - `tools/` — 暫定ツールを除外
  - `tests/` — テストディレクトリを除外
  - `adr/` — ADR を除外
  - `docs/` — ドキュメントを除外
  - `spec/` — 仕様ドキュメントを除外
  - `tsconfig.json` — TypeScript 設定を除外
  - `bun.lock` — lockfile を除外
  - `.github/` — GitHub 設定を除外
  - `.gitignore` — gitignore を除外
  - `.specrunner/` — specrunner ローカル設定を除外
  - `.claude/` — Claude 設定を除外

**Acceptance Criteria**:
- `.npmignore` が存在する
- `npm pack --json` の出力に `*.test.ts` ファイルが含まれない
- `npm pack --json` の出力に `design/` / `specrunner/` / `tools/` / `tests/` のファイルが含まれない

## T-03: LICENSE ファイルを追加する

- [ ] プロジェクトルートに `LICENSE` を作成する（MIT License）
- [ ] 年は `2026`、著作権者は `color4pen` とする

**Acceptance Criteria**:
- `LICENSE` ファイルが存在する
- MIT License の全文が含まれている
- `npm pack --json` の出力に `LICENSE` が含まれる

## T-04: CI workflow を追加する

- [ ] `.github/workflows/ci.yml` を作成する
- [ ] トリガ: `push: branches: [main]` に `paths-ignore: ["specrunner/changes/**"]` を設定、`pull_request` も設定する
- [ ] ジョブ `ci` を `ubuntu-latest` で定義する
- [ ] ステップ:
  1. `actions/checkout@v4`
  2. `oven-sh/setup-bun@v2`
  3. `bun install --frozen-lockfile`
  4. `tsc --noEmit`（名前付きステップ: `Type check`）
  5. `bun test`（名前付きステップ: `Test`）
  6. `bun src/cli/main.ts check --dir design`（名前付きステップ: `Self-check (closure verification)`）
  7. `bun src/cli/main.ts export rules --dir design --verify`（名前付きステップ: `Self-check (rules sync verification)`）

**Acceptance Criteria**:
- `.github/workflows/ci.yml` が存在する
- YAML が上記 4 コマンド（`tsc --noEmit` / `bun test` / `check --dir design` / `export rules --dir design --verify`）をステップとして含む
- `paths-ignore` に `specrunner/changes/**` が含まれる
- `tsc --noEmit` が成功する

## T-05: release-please の config と workflow を追加する

- [ ] `release-please-config.json` を作成する:
  ```json
  {
    "packages": {
      ".": {
        "release-type": "node",
        "bump-minor-pre-major": true,
        "bump-patch-for-minor-pre-major": true
      }
    }
  }
  ```
- [ ] `.release-please-manifest.json` を作成する:
  ```json
  {
    ".": "0.0.0"
  }
  ```
- [ ] `.github/workflows/release-please.yml` を作成する:
  - トリガ: `push: branches: [main]`
  - permissions: `contents: write`, `pull-requests: write`
  - `google-github-actions/release-please-action@v4` を使用
  - `token: ${{ secrets.RELEASE_PLEASE_TOKEN }}`（PAT。GITHUB_TOKEN では tag-push が連鎖 workflow を発火しないため）
  - `config-file: release-please-config.json`
  - `manifest-file: .release-please-manifest.json`

**Acceptance Criteria**:
- `release-please-config.json` が存在し、`release-type: "node"` / `bump-minor-pre-major: true` である
- `.release-please-manifest.json` が存在し、初期値 `{ ".": "0.0.0" }` である
- `.github/workflows/release-please.yml` が存在する
- `tsc --noEmit` が成功する

## T-06: publish workflow を追加する

- [ ] `.github/workflows/publish.yml` を作成する:
  - トリガ: `push: tags: ["v*"]` + `workflow_dispatch`（手動再実行用、tag 入力あり）
  - permissions: `contents: read`, `id-token: write`（provenance 用）
  - ステップ:
    1. `actions/checkout@v4`（ref: tag）
    2. `actions/setup-node@v4`（`registry-url: "https://registry.npmjs.org"`。npm publish の認証設定に必要）
    3. `oven-sh/setup-bun@v2`
    4. `bun install --frozen-lockfile`
    5. `npm publish --provenance`（`NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`）
  - publish 成否の step summary を出力する

**Acceptance Criteria**:
- `.github/workflows/publish.yml` が存在する
- tag `v*` トリガと `workflow_dispatch` が定義されている
- `npm publish --provenance` ステップが `NPM_TOKEN` secret を参照している
- `tsc --noEmit` が成功する

## T-07: README に導入節を追加する

- [ ] README.md の「使い方」セクション（`## 使い方`）の直前に「導入」セクション（`## 導入`）を追加する
- [ ] 内容:
  - bun ランタイムが必須である旨
  - `bunx aozu`（npx 相当でインストール不要の実行）
  - `bun add -g aozu`（グローバルインストール）

**Acceptance Criteria**:
- README.md に `## 導入` セクションが存在する
- `bunx aozu` と `bun add -g aozu` のコマンド例が含まれる
- bun ランタイム必須の記述がある

## T-08: packaging smoke テストを追加する

- [ ] `tests/packaging.test.ts` を作成する
- [ ] **tarball 内容検証テスト**: `npm pack --json` を実行し、tarball のファイル一覧を検証する:
  - `package.json` が含まれる
  - `README.md` が含まれる
  - `LICENSE` が含まれる
  - `src/cli/main.ts` が含まれる（bin エントリポイント）
  - `*.test.ts` ファイルが 1 つも含まれない
  - `design/` / `specrunner/` / `tools/` / `tests/` / `adr/` / `docs/` / `spec/` 配下のファイルが含まれない
- [ ] **--help 動作検証テスト**: `npm pack` で tarball を生成し、一時ディレクトリに展開後、`bun <展開先>/src/cli/main.ts --help` が exit 0 になることを検証する
- [ ] テスト実行後に生成した tarball と一時ディレクトリをクリーンアップする

**Acceptance Criteria**:
- `tests/packaging.test.ts` が存在する
- tarball 内容テストが `bun test` で green
- --help 動作テストが `bun test` で green
- `tsc --noEmit` が成功する

## T-09: workflow YAML の grep テストを追加する

- [ ] `tests/packaging.test.ts`（T-08 と同一ファイル）に workflow YAML の grep テストを追加する
- [ ] `.github/workflows/ci.yml` の内容を読み込み、以下の 4 文字列が含まれることを検証する:
  - `tsc --noEmit`
  - `bun test`
  - `check --dir design`
  - `export rules --dir design --verify`

**Acceptance Criteria**:
- grep テストが `bun test` で green
- CI workflow から品質ゲートコマンドを削除すると grep テストが fail する

## T-10: 既存テストの不変検証 + package.json の歯の追加

- [ ] `src/package.test.ts` に以下のテストケースを **新規追加** する（既存テストは一切変更しない）:
  - `private` フィールドが `undefined` であること（公開パッケージとして `private` が削除されていること）
  - `version` が `"0.0.0"` であること（release-please に bump を委ねるため未変更であること）
  - `engines.bun` が定義されていること
  - `files` が定義されていること
- [ ] 既存の 2 テスト（dependencies 空 / name + bin 定義）が無変更であることを確認する

**Acceptance Criteria**:
- 新規テストケースが green
- 既存テストケース（dependencies 空 / name + bin）が変更なしで green
- `bun test src/package.test.ts` が green

## T-11: 最終検証

- [ ] `tsc --noEmit` が成功する
- [ ] `bun test` が全テスト green（既存 607 件 + 新規テスト）
- [ ] `bun src/cli/main.ts check --dir design` が exit 0
- [ ] `bun src/cli/main.ts export rules --dir design --verify` が exit 0
- [ ] `package.json` の `dependencies` が `{}` のまま
- [ ] `package.json` の `version` が `"0.0.0"` のまま
- [ ] `package.json` に `private` フィールドが存在しない
- [ ] `src/package.test.ts` の既存の歯が無変更で green

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- `bun src/cli/main.ts check --dir design && bun src/cli/main.ts export rules --dir design --verify` が exit 0
- 既存 607 テストが変更なしで green
- `dependencies` が空
- `version` が `0.0.0`
- `private` が不在
