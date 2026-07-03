# Code Review Feedback — iteration 001

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
- iteration line format (exact): `- **iteration**: NNN` (3-digit zero-padded integer)
- Findings table MUST have exactly 7 columns in this order:
  # | Severity | Category | File | Description | How to Fix | Fix
  - Fix column: yes = fixer should address this finding; no = skip (pre-existing / out-of-scope)
- Scores table columns: Category | Score | Weight
  - Valid Category values: correctness | security | architecture | performance | maintainability | testing
  - Score: integer 1-10
  - Weight: decimal as defined below
- total line format (exact): `- **total**: <decimal>`
- Default weights: correctness=0.30, security=0.25, architecture=0.15, performance=0.10, maintainability=0.10, testing=0.10
- Scores table is optional but recommended.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: needs-fix
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | high | correctness | `.github/workflows/ci.yml` | `run: tsc --noEmit` が GitHub Actions の `run:` ステップで失敗する可能性がある。`oven-sh/setup-bun@v2` + `bun install --frozen-lockfile` の後、`tsc` は `node_modules/.bin/tsc` に存在するが、GitHub Actions の `run:` ステップは `node_modules/.bin` を自動的に PATH に追加しない。`oven-sh/setup-bun` は `~/.bun/bin`（グローバルインストール用）のみを PATH に追加する。実際の CI 実行で "tsc: command not found" が発生し、Type check ステップで失敗する。 | `run: tsc --noEmit` を `run: bunx tsc --noEmit` に変更する。`bunx` は `node_modules/.bin` を参照するため確実に動作する。 | yes |
| 2 | medium | maintainability | `.npmignore.bak`, `.npmignore.test` | 開発中に作成されたデバッグ用ファイル 2 件がコミットされている。`.npmignore.bak` は `.npmignore` の完全な複製（バックアップ）、`.npmignore.test` は `src/` のみを含む npm pack 動作確認用ファイル。tarball には含まれない（`files` 外）が、git 履歴に不要なノイズを残す。 | `git rm .npmignore.bak .npmignore.test` でリポジトリから削除する。 | yes |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 6 | 0.30 |
| security | 9 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 7 | 0.10 |
| testing | 9 | 0.10 |

- **total**: 8.00

## Summary

全体として設計と実装の品質は高い。CI / release-please / publish の 3 workflow 分離はデザインの意図に忠実で、package.json の整備・LICENSE・README 導入節・`src/.npmignore` によるテストファイル除外もすべて要件を満たしている。`tests/packaging.test.ts` は tarball 内容の grep テストと `--help` smoke テストを兼ね備えており、受け入れ基準の大半を自動検証する。

ブロッカーは Finding #1（高深刻）のみ：`tsc --noEmit` を `bunx tsc --noEmit` へ修正することで CI が確実に動作するようになる。Finding #2（`.npmignore.bak` / `.npmignore.test` の削除）はリポジトリの清潔さに関わる should fix。

### Must TC カバレッジ確認（26 件）

| TC | 実装 | 判定 |
|----|------|------|
| TC-001: CI YAML に 4 コマンドが含まれる | `tests/packaging.test.ts` grep テスト | ✓ |
| TC-002: CI が PR / main push トリガを持つ | `ci.yml` on 節 | ✓ |
| TC-006: tarball に `.test.ts` なし | `packaging.test.ts` + `src/.npmignore` | ✓ |
| TC-007: tarball に非公開ディレクトリなし | `packaging.test.ts` + `.npmignore` | ✓ |
| TC-008: tarball に必須ファイルが含まれる | `packaging.test.ts` | ✓ |
| TC-009: `--help` が exit 0 | `packaging.test.ts` smoke test | ✓ |
| TC-010: `.npmignore` に必要パターンが含まれる | `.npmignore` | ✓ |
| TC-011: `private` フィールドが存在しない | `package.json` + `src/package.test.ts` | ✓ |
| TC-012: `version` が 0.0.0 | `package.json` + `src/package.test.ts` | ✓ |
| TC-013: `engines.bun` と `files` が定義されている | `package.json` + `src/package.test.ts` | ✓ |
| TC-015: `dependencies` が空 | `package.json` + `src/package.test.ts` | ✓ |
| TC-017: release-please config が `release-type: node` / `bump-minor-pre-major: true` | `release-please-config.json` | ✓ |
| TC-018: manifest が `"0.0.0"` | `.release-please-manifest.json` | ✓ |
| TC-019: release-please workflow が `RELEASE_PLEASE_TOKEN` を使用 | `release-please.yml` | ✓ |
| TC-021: publish workflow が `v*` タグトリガ + `workflow_dispatch` を持つ | `publish.yml` | ✓ |
| TC-022: publish workflow が `NPM_TOKEN` を参照 | `publish.yml` | ✓ |
| TC-025: LICENSE に MIT 全文が含まれる | `LICENSE` | ✓ |
| TC-030: grep テストが 4 コマンドを検証 | `packaging.test.ts` | ✓ |
| TC-032: 607 件以上のテストが green | 既存テスト無変更 | ✓ |
| TC-033: `src/package.test.ts` 既存の歯が変更なし | 既存 describe ブロック無変更 | ✓ |
| TC-034: 新規 4 テストが green | `src/package.test.ts` 新 describe | ✓ |
| TC-035: `tsc --noEmit` が成功 | 型追加なし・型エラーなし | ✓ |
| TC-036: `bun test` 全 green | 既存テスト無変更 + 新規テスト green | ✓ |
| TC-037: `check --dir design` exit 0 | 設計文書変更なし | ✓ |
| TC-038: `export rules --dir design --verify` exit 0 | `rules.md` 変更なし | ✓ |
| TC-039: packaging smoke テストが `bun test` で実行 | `tests/packaging.test.ts` | ✓ |

26/26 must TC 実装確認済み。
