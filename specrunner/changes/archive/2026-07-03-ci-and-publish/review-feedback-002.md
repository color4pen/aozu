# Code Review Feedback — iteration 002

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

- **verdict**: approved
- **iteration**: 002

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | low | testing | `tests/packaging.test.ts` | grep テストの検索文字列 `"tsc --noEmit"` は、CI YAML が `bunx tsc --noEmit` に変更された後も部分文字列一致で pass する。意図どおり動作しており実害はないが、将来 `tsc` を別コマンドに置き換えた際に grep テストが誤 pass する可能性がある（例: `npx tsc --noEmit` も `tsc --noEmit` を含む）。 | grep 対象を `"bunx tsc --noEmit"` に更新するか、このまま部分文字列として許容する（CI コマンド列の骨格を固定する用途では十分）。どちらでも動作上の問題はない。 | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 9 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 9 | 0.10 |

- **total**: 9.00

## Summary

iteration 001 で指摘した 2 件の finding がいずれも正確に修正されている。

**修正確認（iteration 001 → 002）**

| Finding | 内容 | 修正 |
|---------|------|------|
| #1 (high) | `run: tsc --noEmit` が CI で "command not found" になる可能性 | `run: bunx tsc --noEmit` に変更済み ✓ |
| #2 (medium) | デバッグ用 `.npmignore.bak` / `.npmignore.test` がコミットに残存 | `git rm` で削除済み ✓ |

**実装品質**

- **CI workflow** — `bunx tsc --noEmit` で型チェック、`bun test`、自己記述検証 2 コマンドの 4 ステップ構成。`paths-ignore: ["specrunner/changes/**"]` により投機的 CI 実行を抑制。✓
- **release-please** — `release-type: node` / `bump-minor-pre-major: true` / `RELEASE_PLEASE_TOKEN` 採用（tag 連鎖 workflow のため PAT 必須）。spec-runner と同型。✓
- **publish workflow** — `v*` tag + `workflow_dispatch` トリガ、`npm publish --provenance`、`NPM_TOKEN` 参照、`id-token: write` 権限。ビルドステップなし（ADR-0009 準拠）。✓
- **package.json** — `private` 削除、`description` / `repository` / `license` / `files` / `engines.bun` 追加、`version = "0.0.0"` 維持、`dependencies = {}` 維持。✓
- **src/.npmignore** — `*.test.ts`（gitignore パターン意味論で `src/` 配下のすべての深さに適用）。`src/parse/parser.test.ts` 等サブディレクトリのテストファイルも除外対象になる。✓
- **packaging smoke / grep テスト** — `npm pack --dry-run --json` によるファイル一覧検証、tarball 展開後 `bun --help` exit 0 検証、CI YAML 4 コマンド grep 固定。すべてのロジックが正しい。✓
- **src/package.test.ts** — 既存の 2 テスト（name / dependencies）無変更、新規 4 テスト（private / version / engines.bun / files）追加。✓

**Must TC カバレッジ（26/26）**

| TC | 実装 | 判定 |
|----|------|------|
| TC-001: CI YAML に 4 コマンドが含まれる | `packaging.test.ts` grep（`"tsc --noEmit"` は `bunx tsc --noEmit` の部分文字列として pass） | ✓ |
| TC-002: CI が PR / main push トリガを持つ | `ci.yml` on 節 | ✓ |
| TC-006: tarball に `.test.ts` なし | `src/.npmignore` + `packaging.test.ts` 検証 | ✓ |
| TC-007: tarball に非公開ディレクトリなし | `files` + `.npmignore` + `packaging.test.ts` 検証 | ✓ |
| TC-008: tarball に必須ファイルが含まれる | `packaging.test.ts` | ✓ |
| TC-009: `--help` が exit 0 | `packaging.test.ts` smoke test | ✓ |
| TC-010: `.npmignore` に必要パターンが含まれる | `.npmignore` 14 パターン | ✓ |
| TC-011: `private` フィールドが存在しない | `package.json` + `src/package.test.ts` | ✓ |
| TC-012: `version` が 0.0.0 | `package.json` + `src/package.test.ts` | ✓ |
| TC-013: `engines.bun` と `files` が定義されている | `package.json` + `src/package.test.ts` | ✓ |
| TC-015: `dependencies` が空 | `package.json` + 既存の歯 | ✓ |
| TC-017: release-please config が正しい | `release-please-config.json` | ✓ |
| TC-018: manifest が `"0.0.0"` | `.release-please-manifest.json` | ✓ |
| TC-019: release-please workflow が `RELEASE_PLEASE_TOKEN` を使用 | `release-please.yml` | ✓ |
| TC-021: publish workflow が `v*` + `workflow_dispatch` を持つ | `publish.yml` | ✓ |
| TC-022: publish workflow が `NPM_TOKEN` を参照 | `publish.yml` | ✓ |
| TC-025: LICENSE に MIT 全文が含まれる | `LICENSE` | ✓ |
| TC-030: grep テストが 4 コマンドを検証 | `packaging.test.ts` | ✓ |
| TC-032: 607 件以上のテストが green | 既存テスト無変更 | ✓ |
| TC-033: `src/package.test.ts` 既存の歯が変更なし | 既存 describe ブロック無変更 | ✓ |
| TC-034: 新規 4 テストが green | `src/package.test.ts` 新 describe | ✓ |
| TC-035: `tsc --noEmit` が成功 | 型変更なし・型エラーなし | ✓ |
| TC-036: `bun test` 全 green | 既存テスト無変更 + 新規テスト green | ✓ |
| TC-037: `check --dir design` exit 0 | 設計文書変更なし | ✓ |
| TC-038: `export rules --dir design --verify` exit 0 | rules.json 変更なし | ✓ |
| TC-039: packaging smoke テストが `bun test` で実行される | `tests/packaging.test.ts` | ✓ |

26/26 must TC 実装確認済み。Finding #1（low）は実害なく fix=no。ブロッカーなし。
