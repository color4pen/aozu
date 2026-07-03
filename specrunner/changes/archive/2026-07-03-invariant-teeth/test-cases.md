# Test Cases: invariant-teeth

## Summary

- **Total**: 32 cases
- **Automated** (unit/integration): 27
- **Manual**: 5
- **Priority**: must: 22, should: 9, could: 1

---

## Coverage Table Completeness

### TC-001: 現在の 5 本の inv が対応表のキーにすべて存在する

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: Coverage table SHALL include all invariants declared in invariants.md > Scenario: All 5 current invariants are present in the coverage table

---

### TC-002: 対応表に存在しない inv が invariants.md に追加された場合にテストが失敗する

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: Coverage table SHALL include all invariants declared in invariants.md > Scenario: Missing invariant in coverage table causes test failure

---

### TC-003: 対応表の各エントリの status が有効な CoverageStatus 値である

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01

**GIVEN** `CoverageStatus` 型が `"tested" | "covered" | "not-mechanizable"` と定義されており、対応表に 5 エントリが存在する
**WHEN** 各エントリの `status` フィールドを検査する
**THEN** すべてのエントリの `status` が `CoverageStatus` の有効な値のいずれかに一致する

---

### TC-004: extractInvariantIds が `{#inv-*}` パターンを正しく抽出する

**Category**: unit
**Priority**: must
**Source**: design.md > D1: 対応表のデータ構造と完全性検証

**GIVEN** `{#inv-deterministic-verdict}` や `{#inv-immutable-id}` などの ID マーカーを含む Markdown 文字列
**WHEN** `extractInvariantIds(content)` を呼び出す
**THEN** 文字列内のすべての `inv-*` ID が配列として返される（順不同・重複なし）

---

## File Scan Utility

### TC-005: collectNonTestTsFiles が *.test.ts ファイルを除外する

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-02

**GIVEN** `.ts` ファイルと `.test.ts` ファイルが混在するディレクトリ
**WHEN** `collectNonTestTsFiles(dir)` を呼び出す
**THEN** 結果配列に `.test.ts` で終わるファイルが含まれない

---

## inv-tool-writes-state

### TC-006: 現在の src/ が違反ゼロで green になる（src/state/ 除外）

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: inv-tool-writes-state test SHALL detect co-occurrence of write API and state.json > Scenario: Current src/ passes (no violations)

---

### TC-007: Bun.write と state.json が共起する fixture を違反として検出する

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: inv-tool-writes-state test SHALL detect co-occurrence of write API and state.json > Scenario: Fixture with co-occurrence is detected as violation

---

### TC-008: 書き込み API のみ（state.json なし）は違反でない

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: inv-tool-writes-state test SHALL detect co-occurrence of write API and state.json > Scenario: Write API without state.json is not a violation

---

### TC-009: state.json のみ（書き込み API なし）は違反でない

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: inv-tool-writes-state test SHALL detect co-occurrence of write API and state.json > Scenario: state.json without write API is not a violation

---

### TC-010: writeFile と state.json が共起する fixture を違反として検出する

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03

**GIVEN** `writeFile(path, data)` と `"state.json"` を含む文字列 fixture
**WHEN** `detectStateWriteViolation(fixture)` を呼び出す
**THEN** `true`（違反）を返す

---

### TC-011: detectStateWriteViolation が空文字列で false を返す

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** 空文字列 `""`
**WHEN** `detectStateWriteViolation("")` を呼び出す
**THEN** `false` を返す

---

## inv-single-reference-grammar

### TC-012: 現在の src/ が違反ゼロで green になる（src/parse/ 除外）

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: inv-single-reference-grammar test SHALL detect regex interpretation of `[[` outside src/parse/ > Scenario: Current src/ passes (regex patterns only in src/parse/)

---

### TC-013: regex リテラルで `\[\[` を含む fixture を違反として検出する

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: inv-single-reference-grammar test SHALL detect regex interpretation of `[[` outside src/parse/ > Scenario: Fixture with regex `\[\[` is detected as violation

---

### TC-014: テンプレート文字列の `[[mod-xxx]]` は違反でない

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: inv-single-reference-grammar test SHALL detect regex interpretation of `[[` outside src/parse/ > Scenario: Template string `[[mod-xxx]]` is not a violation

---

### TC-015: RegExp コンストラクタで `\\[\\[` を含む fixture を違反として検出する

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04

**GIVEN** `new RegExp("\\[\\[")` を含む文字列 fixture
**WHEN** `detectReferenceGrammarViolation(fixture)` を呼び出す
**THEN** `true`（違反）を返す

---

### TC-016: コメント内の `[[mod-parse]]` は違反でない

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04

**GIVEN** `// see [[mod-parse]]` のようなコメントのみを含む文字列 fixture（バックスラッシュなし）
**WHEN** `detectReferenceGrammarViolation(fixture)` を呼び出す
**THEN** `false` を返す

---

### TC-017: detectReferenceGrammarViolation が空文字列で false を返す

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04

**GIVEN** 空文字列 `""`
**WHEN** `detectReferenceGrammarViolation("")` を呼び出す
**THEN** `false` を返す

---

## inv-deterministic-verdict

### TC-018: 現在の verdict-owning modules が違反ゼロで green になる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: inv-deterministic-verdict test SHALL detect subprocess and network calls in verdict modules > Scenario: Current verdict modules pass (no subprocess or fetch)

---

### TC-019: Bun.spawn を含む fixture を違反として検出する

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: inv-deterministic-verdict test SHALL detect subprocess and network calls in verdict modules > Scenario: Fixture with Bun.spawn is detected as violation

---

### TC-020: fetch を含む fixture を違反として検出する

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: inv-deterministic-verdict test SHALL detect subprocess and network calls in verdict modules > Scenario: Fixture with fetch is detected as violation

---

### TC-021: subprocess/fetch を含まない通常コードは違反でない

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: inv-deterministic-verdict test SHALL detect subprocess and network calls in verdict modules > Scenario: Regular code without subprocess/fetch is not a violation

---

### TC-022: child_process import を含む fixture を違反として検出する

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05

**GIVEN** `import { exec } from "child_process"` を含む文字列 fixture
**WHEN** `detectNondeterministicViolation(fixture)` を呼び出す
**THEN** `true`（違反）を返す

---

### TC-023: Bun.$ シェルテンプレートを含む fixture を違反として検出する

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05

**GIVEN** `Bun.$\`ls -la\`` を含む文字列 fixture
**WHEN** `detectNondeterministicViolation(fixture)` を呼び出す
**THEN** `true`（違反）を返す

---

### TC-024: regex の `.exec()` 呼び出しは違反でない

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-05

**GIVEN** `REF_RE.exec(line)` のような regex exec 呼び出しのみを含む文字列 fixture
**WHEN** `detectNondeterministicViolation(fixture)` を呼び出す
**THEN** `false` を返す（`.exec(` は subprocess パターンにマッチしない）

---

### TC-025: detectNondeterministicViolation が空文字列で false を返す

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-05

**GIVEN** 空文字列 `""`
**WHEN** `detectNondeterministicViolation("")` を呼び出す
**THEN** `false` を返す

---

### TC-026: src/plan/ が存在する場合に verdict-owning modules リストへ動的追加される

**Category**: unit
**Priority**: could
**Source**: design.md > D5: inv-deterministic-verdict の検出ロジック

**GIVEN** `src/plan/` ディレクトリが存在するか否かで走査対象が変わるロジック
**WHEN** `src/plan/` が実装された状態でテストが実行される
**THEN** `src/plan/` が verdict-owning modules リストに自動的に追加され、走査対象に含まれる

---

### TC-027: src/cli/ と src/prompt/ が inv-deterministic-verdict の走査対象に含まれない

**Category**: integration
**Priority**: must
**Source**: design.md > D5: inv-deterministic-verdict の検出ロジック

**GIVEN** verdict-owning modules リストが `["src/check", "src/export", "src/state"]`（+ `src/plan/` 動的）で定義されている
**WHEN** 走査対象ディレクトリを確認する
**THEN** `src/cli/` と `src/prompt/` がリストに含まれない

---

## Final Verification

### TC-028: tsc --noEmit が成功する

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** `tests/invariants.test.ts` を含む変更後のコードベース
**WHEN** `tsc --noEmit` を実行する
**THEN** 型エラーなしで exit 0 となる

---

### TC-029: bun test が全テスト green である（既存 336 テスト無変更）

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** 新規 `tests/invariants.test.ts` と既存テスト群が共存する状態
**WHEN** `bun test` を実行する
**THEN** 既存 336 テストが全て green のまま、新規テストも green で通る

---

### TC-030: `check` コマンドが exit 0 で完了する

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** 変更後のコードベース
**WHEN** `bun src/cli/main.ts check` を実行する
**THEN** exit 0 で完了する

---

### TC-031: `export rules --verify` が exit 0 で完了する

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** 変更後のコードベース
**WHEN** `bun src/cli/main.ts export rules --verify` を実行する
**THEN** exit 0 で完了する

---

### TC-032: package.json の dependencies が空のままである

**Category**: manual
**Priority**: must
**Source**: tasks.md > T-06

**GIVEN** 変更後の `package.json`
**WHEN** `dependencies` フィールドを確認する
**THEN** `{}` であり、新たな実行時依存が追加されていない

---

## Result

```yaml
result: completed
total: 32
automated: 27
manual: 5
must: 22
should: 9
could: 1
blocked_reasons: []
```
