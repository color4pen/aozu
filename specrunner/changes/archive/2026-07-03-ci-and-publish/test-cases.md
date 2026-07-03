# Test Cases: ci-and-publish

<!-- FORMAT REQUIREMENTS:
Test Case heading format: `### TC-{NNN}: {Name}` (3-digit zero-padded, e.g. TC-001)

Required fields per test case:
  **Category**: unit | integration | manual
  **Priority**: must | should | could
  **Source**: reference to spec Scenario (spec.md > Requirement: <name> > Scenario: <name>) or design.md / tasks.md section

GIVEN/WHEN/THEN structure (mixed format — depends on TC type):
  Scenario 由来 TC (Source = spec.md > Requirement: <name> > Scenario: <name>):
    GWT は記述しない。Source 参照のみ。behavior の正典は spec の Scenario。
  非 Scenario 由来 TC (Source = design.md or tasks.md section):
    GWT は必須:
    **GIVEN** <preconditions>
    **WHEN** <action>
    **THEN** <expected result>

Category determination:
  unit        — pure logic, validation, helper functions (automated)
  integration — DB operations, API endpoints, multi-module interaction (automated)
  manual      — UI/UX confirmation, visual verification, build artifact check (not automated)

Priority determination:
  must   — core functionality; if broken, the feature does not work
  should — important but core still works; edge cases, error handling
  could  — nice to have; performance, UX details

Summary section MUST appear immediately after the title with ALL 4 items:
  ## Summary
  - **Total**: {count} cases
  - **Automated** (unit/integration): {count}
  - **Manual**: {count}
  - **Priority**: must: {count}, should: {count}, could: {count}

Result section MUST appear at the very end as a YAML code block:
  ## Result
  ```yaml
  result: completed | partial | failed
  total: {count}
  automated: {count}
  manual: {count}
  must: {count}
  should: {count}
  could: {count}
  blocked_reasons: []
  ```

  result determination:
    completed — all testable behaviors are documented
    partial   — some cases could not be derived due to design ambiguity
    failed    — spec is absent AND design.md / tasks.md are also missing
-->

## Summary

- **Total**: 40 cases
- **Automated** (unit/integration): 40
- **Manual**: 0
- **Priority**: must: 26, should: 13, could: 1

---

## CI Workflow

### TC-001: CI workflow YAML が品質ゲート 4 コマンドをすべて含む

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: CI workflow SHALL execute the 4 quality gate commands > Scenario: CI workflow YAML contains all 4 quality gate commands

### TC-002: CI workflow が PR と main push をトリガとして持つ

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-04

**GIVEN** `.github/workflows/ci.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** `on.push.branches` に `main` が含まれ、`pull_request` トリガが定義されている

### TC-003: CI workflow の paths-ignore に specrunner/changes/** が含まれる

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md — T-04

**GIVEN** `.github/workflows/ci.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** `paths-ignore` に `specrunner/changes/**` が含まれている

### TC-004: CI workflow が oven-sh/setup-bun アクションを含む

- **Category**: unit
- **Priority**: should
- **Source**: design.md — D1

**GIVEN** `.github/workflows/ci.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** `oven-sh/setup-bun` アクションへの参照が含まれている

### TC-005: CI ジョブが ubuntu-latest で実行される

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md — T-04

**GIVEN** `.github/workflows/ci.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** ジョブの `runs-on` が `ubuntu-latest` である

---

## Tarball / Packaging

### TC-006: tarball がテストファイルを含まない

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: The tarball SHALL contain only publishable files > Scenario: tarball excludes test files

### TC-007: tarball が非公開ディレクトリを含まない

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: The tarball SHALL contain only publishable files > Scenario: tarball excludes non-publishable directories

### TC-008: tarball が必須ファイルを含む

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: The tarball SHALL contain only publishable files > Scenario: tarball includes required files

### TC-009: tarball 展開後に --help が exit 0 で完了する

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: The packaged binary SHALL be executable > Scenario: --help exits 0 from extracted tarball

### TC-010: .npmignore が存在し必要なパターンを含む

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-02

**GIVEN** プロジェクトルートに `.npmignore` が存在する  
**WHEN** ファイルを読み込む  
**THEN** `**/*.test.ts`、`design/`、`specrunner/`、`tools/`、`tests/` の各パターンが含まれている

---

## package.json

### TC-011: package.json に private フィールドが存在しない

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: package.json SHALL be configured for public publishing > Scenario: package.json has no private field

### TC-012: package.json の version が 0.0.0 のまま変更されていない

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: package.json SHALL be configured for public publishing > Scenario: package.json version is 0.0.0

### TC-013: package.json に engines.bun と files が定義されている

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: package.json SHALL be configured for public publishing > Scenario: package.json has engines.bun and files

### TC-014: package.json に description / repository / license が定義されている

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md — T-01

**GIVEN** `package.json` を JSON としてパースする  
**WHEN** 各フィールドを参照する  
**THEN** `description`、`repository`、`license` がそれぞれ定義されている

### TC-015: package.json の dependencies が空のまま変更されていない

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-01 / T-11 Acceptance Criteria

**GIVEN** `package.json` を JSON としてパースする  
**WHEN** `dependencies` フィールドを参照する  
**THEN** `dependencies` が `{}` （空オブジェクト）である

### TC-016: package.json の files フィールドが src / README.md / LICENSE を含む

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md — T-01

**GIVEN** `package.json` を JSON としてパースする  
**WHEN** `files` フィールドを参照する  
**THEN** `"src"`、`"README.md"`、`"LICENSE"` が含まれている

---

## release-please

### TC-017: release-please config が release-type: node と bump-minor-pre-major: true を持つ

- **Category**: unit
- **Priority**: must
- **Source**: spec.md > Requirement: release-please config SHALL use node release-type with bump-minor-pre-major > Scenario: release-please config has correct settings

### TC-018: release-please manifest が初期バージョン 0.0.0 で存在する

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-05

**GIVEN** `.release-please-manifest.json` が存在する  
**WHEN** ファイルを JSON としてパースする  
**THEN** `"."` キーの値が `"0.0.0"` である

### TC-019: release-please workflow が存在し RELEASE_PLEASE_TOKEN を使用する

- **Category**: unit
- **Priority**: must
- **Source**: design.md — D2 / tasks.md — T-05

**GIVEN** `.github/workflows/release-please.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** `google-github-actions/release-please-action` の参照と `secrets.RELEASE_PLEASE_TOKEN` が含まれている

### TC-020: release-please config に bump-patch-for-minor-pre-major が設定されている

- **Category**: unit
- **Priority**: should
- **Source**: design.md — D2

**GIVEN** `release-please-config.json` を JSON としてパースする  
**WHEN** `packages["."]` を参照する  
**THEN** `bump-patch-for-minor-pre-major` が `true` である

---

## publish workflow

### TC-021: publish workflow が v* タグトリガと workflow_dispatch を持つ

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-06 Acceptance Criteria

**GIVEN** `.github/workflows/publish.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** `on.push.tags` に `"v*"` が含まれ、`workflow_dispatch` トリガが定義されている

### TC-022: publish workflow が NPM_TOKEN を参照する

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-06 Acceptance Criteria

**GIVEN** `.github/workflows/publish.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** `secrets.NPM_TOKEN` への参照が含まれている

### TC-023: publish workflow が npm publish --provenance を実行する

- **Category**: unit
- **Priority**: should
- **Source**: design.md — D3

**GIVEN** `.github/workflows/publish.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** `npm publish --provenance` の文字列が含まれている

### TC-024: publish workflow が id-token: write 権限を持つ

- **Category**: unit
- **Priority**: could
- **Source**: design.md — D3

**GIVEN** `.github/workflows/publish.yml` が存在する  
**WHEN** YAML を読み込む  
**THEN** `permissions` に `id-token: write` が含まれている

---

## LICENSE

### TC-025: LICENSE ファイルが MIT License の全文を含む

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-03 Acceptance Criteria

**GIVEN** プロジェクトルートに `LICENSE` ファイルが存在する  
**WHEN** ファイルを読み込む  
**THEN** `MIT License` または `Permission is hereby granted` を含む MIT License の本文が記載されている

### TC-026: LICENSE ファイルの著作権表記が 2026 / color4pen である

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md — T-03

**GIVEN** `LICENSE` ファイルが存在する  
**WHEN** ファイルを読み込む  
**THEN** `2026` と `color4pen` がそれぞれ含まれている

---

## README

### TC-027: README に ## 導入 セクションが存在する

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md — T-07 Acceptance Criteria

**GIVEN** `README.md` が存在する  
**WHEN** ファイルを読み込む  
**THEN** `## 導入` 見出しが含まれている

### TC-028: README に bunx aozu と bun add -g aozu のコマンド例が含まれる

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md — T-07 Acceptance Criteria

**GIVEN** `README.md` が存在する  
**WHEN** ファイルを読み込む  
**THEN** `bunx aozu` と `bun add -g aozu` がそれぞれ含まれている

### TC-029: README に bun ランタイム必須の記述が含まれる

- **Category**: unit
- **Priority**: should
- **Source**: tasks.md — T-07 Acceptance Criteria

**GIVEN** `README.md` が存在する  
**WHEN** ファイルを読み込む  
**THEN** bun ランタイムが必須であることを示す記述が含まれている

---

## grep テスト（workflow 固定）

### TC-030: packaging.test.ts の CI grep テストが 4 コマンドをすべて検証する

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-09 Acceptance Criteria

**GIVEN** `tests/packaging.test.ts` が存在し、`bun test` を実行する  
**WHEN** `.github/workflows/ci.yml` の内容を読み込む grep テストが実行される  
**THEN** `tsc --noEmit`、`bun test`、`check --dir design`、`export rules --dir design --verify` の 4 文字列をそれぞれ検証するテストが green である

### TC-031: CI workflow から品質ゲートコマンドを削除すると grep テストが fail する

- **Category**: unit
- **Priority**: should
- **Source**: design.md — D6

**GIVEN** `.github/workflows/ci.yml` から `tsc --noEmit` ステップを削除した状態  
**WHEN** `bun test tests/packaging.test.ts` を実行する  
**THEN** grep テストが fail し、欠落が検出される

---

## 既存テスト不変

### TC-032: bun test で 607 件以上のテストが green

- **Category**: integration
- **Priority**: must
- **Source**: spec.md > Requirement: Existing tests SHALL remain unchanged and green > Scenario: existing test count is preserved

### TC-033: src/package.test.ts の既存の歯（name / dependencies）が変更なしで green

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-10 Acceptance Criteria

**GIVEN** `src/package.test.ts` に既存の 2 テスト（`pkg.name === "aozu"` と `dependencies` が空）が存在する  
**WHEN** `bun test src/package.test.ts` を実行する  
**THEN** 既存の 2 テストケースが変更なし・無修正で green である

### TC-034: src/package.test.ts に追加された 4 件の新規テストが green

- **Category**: unit
- **Priority**: must
- **Source**: tasks.md — T-10 Acceptance Criteria

**GIVEN** `src/package.test.ts` に `private` 不在 / `version === "0.0.0"` / `engines.bun` 定義 / `files` 定義 の 4 テストが追加されている  
**WHEN** `bun test src/package.test.ts` を実行する  
**THEN** 新規 4 テストケースがすべて green である

---

## 統合品質ゲート

### TC-035: tsc --noEmit が成功する

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md — T-11 Acceptance Criteria

**GIVEN** ワーキングツリーの全 TypeScript ファイルが存在する  
**WHEN** `tsc --noEmit` を実行する  
**THEN** exit code が 0 であり、型エラーが 0 件である

### TC-036: bun test が全テスト green（失敗 0 件）

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md — T-11 Acceptance Criteria

**GIVEN** 全テストファイルが存在する  
**WHEN** `bun test` を実行する  
**THEN** 失敗テストが 0 件でありすべてのテストが green である

### TC-037: check --dir design が exit 0 で完了する（自己記述の閉包検証）

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md — T-11 Acceptance Criteria

**GIVEN** `design/` ディレクトリが存在する  
**WHEN** `bun src/cli/main.ts check --dir design` を実行する  
**THEN** exit code が 0 であり、未解決の参照エラーが報告されない

### TC-038: export rules --dir design --verify が exit 0 で完了する（rules.json 同期検証）

- **Category**: integration
- **Priority**: must
- **Source**: tasks.md — T-11 Acceptance Criteria

**GIVEN** `design/` ディレクトリと `rules.json` が存在する  
**WHEN** `bun src/cli/main.ts export rules --dir design --verify` を実行する  
**THEN** exit code が 0 であり、rules.json が設計ドキュメントと同期していると判定される

### TC-039: packaging smoke テストがテストスイートの一部として bun test で実行される

- **Category**: integration
- **Priority**: must
- **Source**: design.md — D5

**GIVEN** `tests/packaging.test.ts` が存在する  
**WHEN** `bun test` を実行する  
**THEN** tarball 内容検証テストと --help 動作検証テストが bun test の一部として実行され green である

### TC-040: packaging smoke テスト後に tarball と一時ディレクトリがクリーンアップされる

- **Category**: integration
- **Priority**: should
- **Source**: tasks.md — T-08

**GIVEN** `tests/packaging.test.ts` の --help 動作検証テストが完了した  
**WHEN** テストスイートの teardown が実行される  
**THEN** `npm pack` で生成された tarball（*.tgz）と展開先の一時ディレクトリがプロジェクトルートから削除されている

## Result

```yaml
result: completed
total: 40
automated: 40
manual: 0
must: 26
should: 13
could: 1
blocked_reasons: []
```
