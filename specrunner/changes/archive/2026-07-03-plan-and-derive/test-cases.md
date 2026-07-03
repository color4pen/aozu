# Test Cases: plan / prompt derive

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

- **Total**: 49 cases
- **Automated** (unit/integration): 49
- **Manual**: 0
- **Priority**: must: 37, should: 11, could: 1

---

## plan コマンド — 正常系

### TC-001: plan generates a valid plan file from a fixture with designed elements

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL generate a spec-conformant plan document from designed elements > Scenario: plan generates a valid plan file from a fixture with designed elements

---

### TC-002: generated plan file does not break check

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL generate a spec-conformant plan document from designed elements > Scenario: generated plan file does not break check

---

## plan コマンド — 注釈

### TC-003: plan annotations include reference edges between designed elements

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL include judgment annotations for reference edges, mod grounding, and requested elements > Scenario: plan annotations include reference edges between designed elements

---

### TC-004: plan annotations include module grounding

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL include judgment annotations for reference edges, mod grounding, and requested elements > Scenario: plan annotations include module grounding

---

### TC-005: plan annotations include requested elements list

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL include judgment annotations for reference edges, mod grounding, and requested elements > Scenario: plan annotations include requested elements list

---

## plan コマンド — ゲート違反

### TC-006: plan rejects when loop is not enabled

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL fail-closed with exit 1 for gate violations > Scenario: plan rejects when loop is not enabled

---

### TC-007: plan rejects when slug already exists

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL fail-closed with exit 1 for gate violations > Scenario: plan rejects when slug already exists

---

### TC-008: plan rejects when no designed elements exist

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: plan SHALL fail-closed with exit 1 for gate violations > Scenario: plan rejects when no designed elements exist

---

## prompt derive コマンド — 正常系

### TC-009: derive output contains all required sections

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: prompt derive SHALL output instruction text to stdout containing all required sections > Scenario: derive output contains all required sections

---

### TC-010: derive resolves template from file path

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL support dual-mode template resolution > Scenario: derive resolves template from file path

---

### TC-011: derive resolves template from command execution

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL support dual-mode template resolution > Scenario: derive resolves template from command execution

---

## prompt derive コマンド — ゲート違反

### TC-012: derive rejects when loop is not enabled

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 1 when loop is not enabled > Scenario: derive rejects when loop is not enabled

---

### TC-013: derive rejects when request-template is missing

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when request-template is missing

---

### TC-014: derive rejects when request-output-dir is missing

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when request-output-dir is missing

---

### TC-015: derive rejects when plan file is not found

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when plan file is not found

---

### TC-016: derive rejects when group is not found

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when group is not found

---

### TC-017: derive rejects when group elements do not resolve

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input > Scenario: derive rejects when group elements do not resolve

---

## prompt derive コマンド — ファイルシステム非書き込み

### TC-018: derive produces no file system side effects

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive SHALL NOT write any files or modify state > Scenario: derive produces no file system side effects

---

## 正本更新

### TC-019: format spec documents new manifest keys

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: spec and integration documents SHALL be updated to reflect new manifest keys > Scenario: format spec documents new manifest keys

---

## stdout / stderr 分離

### TC-020: plan writes success to stderr, not stdout

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: all commands SHALL separate stdout and stderr per spec/integration.md §5 > Scenario: plan writes success to stderr, not stdout

---

### TC-021: derive writes instruction to stdout, errors to stderr

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: all commands SHALL separate stdout and stderr per spec/integration.md §5 > Scenario: derive writes instruction to stdout, errors to stderr

---

## computeFrontier 移設 (T-01)

### TC-022: computeFrontier が src/plan/frontier.ts に存在する

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-01

**GIVEN** ソースコードが変更済みの状態
**WHEN** src/plan/frontier.ts の export を確認する
**THEN** `computeFrontier`、`Frontier` 型、`IMPLEMENTATION_PREFIXES` が src/plan/frontier.ts から export されている

---

### TC-023: status.ts が src/plan/frontier.ts を import している

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-01

**GIVEN** ソースコードが変更済みの状態
**WHEN** src/cli/commands/status.ts の import 宣言を確認する
**THEN** `computeFrontier` の import 元が `src/plan/frontier.ts` になっており、`status.ts` 内に `computeFrontier` の独自定義が存在しない

---

### TC-024: mod-plan から mod-check への依存が発生していない

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-01 / design.md > D1

**GIVEN** src/plan/frontier.ts が実装済みの状態
**WHEN** src/plan/frontier.ts の import 宣言を確認する
**THEN** `../check/` 配下へのパスを持つ import が存在しない（enabledPrefixes は引数として受け取るため）

---

### TC-025: IMPLEMENTATION_PREFIXES に 'act' が含まれる

**Category**: unit
**Priority**: must
**Source**: design.md > D1（adversarial-consistency finding 1）

**GIVEN** src/plan/frontier.ts の `IMPLEMENTATION_PREFIXES` 定数
**WHEN** その値を確認する
**THEN** `"act"` が含まれている（ADR-0015 の act 一級化への追随）

---

## findOwningElement 移設 (T-02)

### TC-026: findOwningElement が src/graph/attribution.ts に存在する

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-02

**GIVEN** ソースコードが変更済みの状態
**WHEN** src/graph/attribution.ts の export を確認する
**THEN** `findOwningElement` が src/graph/attribution.ts から export されている

---

### TC-027: check/attribution.ts が graph/attribution.ts を re-export している

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-02

**GIVEN** ソースコードが変更済みの状態
**WHEN** src/check/attribution.ts の内容を確認する
**THEN** `findOwningElement` を `../graph/attribution.ts` から re-export しており、実装の重複がない

---

## extractElementBody (T-03)

### TC-028: 見出し要素の本文が正しく切り出される

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** `mod-app` 要素が line 5 に宣言されており、line 10 に次の `## ` 見出しがあるファイルの FileInput
**WHEN** `extractElementBody("mod-app", graph, files)` を呼ぶ
**THEN** line 6 から line 9 の本文テキストが返され、次の見出し以降は含まれない

---

### TC-029: 文書要素の本文が正しく切り出される

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** `plan-my-batch` 要素のファイルが frontmatter と本文テキストを持つ FileInput
**WHEN** `extractElementBody("plan-my-batch", graph, files)` を呼ぶ
**THEN** frontmatter 部分を除いた本文全体が返される

---

### TC-030: 存在しない要素 ID で null が返る

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** files 内に対応ファイルが存在しない要素 ID `ent-nonexistent`
**WHEN** `extractElementBody("ent-nonexistent", graph, files)` を呼ぶ
**THEN** `null` が返される

---

### TC-031: 同一ファイル内の複数見出し要素の境界が正しい

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** 同一ファイルに `mod-a`（line 3）、`mod-b`（line 8）、`mod-c`（line 15）が宣言されている FileInput
**WHEN** `extractElementBody("mod-b", graph, files)` を呼ぶ
**THEN** line 9 から line 14 のテキストのみが返され、`mod-a` と `mod-c` の本文は含まれない

---

## computeNeighborhood (T-04)

### TC-032: 1 hop 近傍が正しく返る

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** `mod-a` が `mod-b` を参照し、`mod-c` が `mod-a` を参照するグラフ
**WHEN** `computeNeighborhood(["mod-a"], graph, 1)` を呼ぶ
**THEN** `{"mod-b", "mod-c"}` が返され、`"mod-a"` 自身は含まれない

---

### TC-033: 2 hop 近傍が正しく返る

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** `mod-a -> mod-b -> mod-c` の参照チェーンを持つグラフ
**WHEN** `computeNeighborhood(["mod-a"], graph, 2)` を呼ぶ
**THEN** `{"mod-b", "mod-c"}` が返され（out 方向 2 hop）、`"mod-a"` 自身は含まれない

---

### TC-034: seedIds が結果に含まれない

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** `mod-a -> mod-b` の参照を持つグラフ、seedIds = `["mod-a"]`
**WHEN** `computeNeighborhood(["mod-a"], graph, 2)` を呼ぶ
**THEN** 返された Set に `"mod-a"` が含まれない

---

### TC-035: 循環参照がある場合に無限ループしない

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** `mod-a -> mod-b -> mod-a` の循環参照を持つグラフ
**WHEN** `computeNeighborhood(["mod-a"], graph, 2)` を呼ぶ
**THEN** 有限時間で終了し `{"mod-b"}` が返される（`mod-a` は seed のため除外）

---

## generatePlan 純粋関数 (T-05)

### TC-036: frontmatter 直後に H1 見出しが含まれる

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05 / design.md > D5

**GIVEN** slug = `"my-batch"`、designed = `["mod-app", "ent-order"]`、空の annotations
**WHEN** `generatePlan("my-batch", designed, annotations)` を呼ぶ
**THEN** 出力文字列の frontmatter 終了（`---`）の直後の行が `# my-batch` である

---

### TC-037: 生成 plan に request: 行が含まれない

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05 / design.md > D5（ADR-0018-2）

**GIVEN** slug = `"my-batch"`、designed = `["mod-app"]`、空の annotations
**WHEN** `generatePlan("my-batch", designed, annotations)` を呼ぶ
**THEN** 出力文字列に `request:` で始まる行が一切存在しない

---

## plan handler — バリデーション (T-06)

### TC-038: 不正な slug 形式で exit 2 を返す

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-06 / T-07

**GIVEN** design ディレクトリが存在する状態
**WHEN** `handlePlan(["../evil", "--dir", dir])` を呼ぶ（パストラバーサル形式の slug）
**THEN** return value が `2` であり、ファイルが生成されない。同様に `My Batch`（スペース含む）や `UPPER`（大文字含む）でも exit 2

---

### TC-039: help フラグで usage を stderr に出力して exit 0

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-06

**GIVEN** 任意の状態
**WHEN** `handlePlan(["--help"])` を呼ぶ
**THEN** return value が `0` であり、stderr に usage テキストが含まれる

---

## buildDeriveInstruction 純粋関数 (T-08)

### TC-040: テンプレートがデリミタで明示的に区切られる

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-08 / design.md > D6

**GIVEN** templateContent = `"## template content"`、その他フィールドを適切に埋めた DeriveInput
**WHEN** `buildDeriveInstruction(input)` を呼ぶ
**THEN** 出力文字列に `---TEMPLATE BEGIN---` と `---TEMPLATE END---` が含まれ、その間に `"## template content"` が含まれる

---

## prompt handler — サブコマンド dispatch (T-09)

### TC-041: 不明なサブコマンドで exit 2 を返す

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-09 / design.md > D12

**GIVEN** 任意の設計ディレクトリ
**WHEN** `handlePrompt(["unknown-subcommand"])` を呼ぶ
**THEN** return value が `2` であり、stderr にサブコマンド不明のエラーメッセージが含まれる

---

### TC-042: derive でテンプレートコマンドが非ゼロで終了した場合 exit 2

**Category**: integration
**Priority**: should
**Source**: design.md > D7（Risk: テンプレートコマンド失敗）

**GIVEN** manifest の `request-template` が `"exit 1"` のように必ず失敗するコマンドである
**WHEN** `aozu prompt derive --group grp-test --dir <path>` を実行する
**THEN** exit code が `2` であり、stderr にコマンド失敗の診断メッセージが含まれる

---

## main.ts 登録 (T-11)

### TC-043: aozu --help に plan と prompt が表示される

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-11

**GIVEN** src/cli/main.ts に plan / prompt が登録済みの状態
**WHEN** `aozu --help` を実行する
**THEN** 出力に `plan` と `prompt` の両コマンドが列挙されている

---

## 正本更新 (T-12)

### TC-044: spec/integration.md §4 に manifest frontmatter の注入点が明記されている

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-12

**GIVEN** spec/integration.md が更新済みの状態
**WHEN** §4 の内容を確認する
**THEN** `request-template` と `request-output-dir` の注入点として manifest frontmatter が明示されている

---

### TC-045: design/static/modules.md の mod-plan 責務行から「グループへの request 記録」が除去されている

**Category**: integration
**Priority**: could
**Source**: tasks.md > T-12（ADR-0018-2 追随）

**GIVEN** design/static/modules.md が更新済みの状態
**WHEN** mod-plan の責務行を確認する
**THEN** 「グループへの request 記録」の記述が存在せず、「plan の生成・coverage 検証」に修正されている

---

### TC-046: export rules --verify が exit 0

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-12 / T-13

**GIVEN** rules.json が再 export 済み、modules.md が更新済みの状態
**WHEN** `aozu export rules --verify` を実行する
**THEN** exit code が `0` である

---

## 全体回帰 (T-13)

### TC-047: 既存テストが全て green のまま

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-13

**GIVEN** 本変更が適用済みの状態
**WHEN** `bun test` を実行する
**THEN** 既存 336 テスト（+ 新規テスト）が全て green であり、テスト数が変更前より少なくなっていない

---

### TC-048: architecture test が green

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-13

**GIVEN** 本変更が適用済みの状態
**WHEN** architecture.test.ts を実行する（`bun test` の一部として）
**THEN** 許可依存の違反が検出されない（mod-plan -> mod-check 等の不許可依存が存在しない）

---

### TC-049: package.json の dependencies が空のまま

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-13

**GIVEN** 本変更が適用済みの状態
**WHEN** package.json の `dependencies` フィールドを確認する
**THEN** `dependencies` が空オブジェクト `{}` のままであり、新規パッケージが追加されていない

---

## Result

```yaml
result: completed
total: 49
automated: 49
manual: 0
must: 37
should: 11
could: 1
blocked_reasons: []
```
