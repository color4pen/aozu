# Test Cases: aosora findings fixes — format-version fence / topics 書式統一 / CLI ergonomics

## Summary

- **Total**: 34 cases
- **Automated** (unit/integration): 31
- **Manual**: 3
- **Priority**: must: 26, should: 5, could: 3

---

## format-version フェンス（T-01）

### TC-001: 未知 format-version の design/ で check が不合格になる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: format-version が対応集合外の manifest は全動詞で error になる > Scenario: 未知 format-version の design/ で check が不合格になる

---

### TC-002: format-version キーが欠落した design/ で check が不合格になる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: format-version が対応集合外の manifest は全動詞で error になる > Scenario: format-version キーが欠落した design/ で check が不合格になる

---

### TC-003: format-version: 0 の design/ で check が影響を受けない

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: format-version が対応集合外の manifest は全動詞で error になる > Scenario: format-version: 0 の design/ で check が影響を受けない

---

### TC-004: 未知 format-version の design/ で status が error になる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: format-version が対応集合外の manifest は全動詞で error になる > Scenario: 未知 format-version の design/ で status が error になる

---

### TC-005: 未知 format-version の design/ で plan が error になる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: format-version が対応集合外の manifest は全動詞で error になる > Scenario: 未知 format-version の design/ で plan が error になる

---

### TC-006: 未知 format-version の design/ で prompt session が error になる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: format-version が対応集合外の manifest は全動詞で error になる > Scenario: 未知 format-version の design/ で prompt session が error になる

---

### TC-007: 未知 format-version の design/ で mark implemented が error になる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: format-version が対応集合外の manifest は全動詞で error になる > Scenario: 未知 format-version の design/ で mark implemented が error になる

---

### TC-008: validateFormatVersion が対応バージョンで null を返す

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01 ステップ5

**GIVEN** `manifest.formatVersion` が `"0"` の Manifest オブジェクト
**WHEN** `validateFormatVersion(manifest, manifestPath)` を呼び出す
**THEN** 戻り値が `null` になる

---

### TC-009: validateFormatVersion が未知バージョンで C12 を返す

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01 ステップ5

**GIVEN** `manifest.formatVersion` が `"99"` の Manifest オブジェクト
**WHEN** `validateFormatVersion(manifest, manifestPath)` を呼び出す
**THEN** `code: "C12"` かつ `level: "error"` の CheckDiagnostic が返る

---

### TC-010: validateFormatVersion が空文字列センチネルで C12 を返す

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01 ステップ5

**GIVEN** `manifest.formatVersion` が `""` の Manifest オブジェクト（format-version キー欠落のセンチネル）
**WHEN** `validateFormatVersion(manifest, manifestPath)` を呼び出す
**THEN** `code: "C12"` かつ `level: "error"` の CheckDiagnostic が返る

---

### TC-011: C12 診断メッセージに対応バージョンとツール更新の旨が含まれる

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01 ステップ5

**GIVEN** `manifest.formatVersion` が `"99"` の Manifest オブジェクト
**WHEN** `validateFormatVersion(manifest, manifestPath)` を呼び出す
**THEN** 返却された CheckDiagnostic の `message` に `"0"` という文字列と `"update"` または `"更新"` に相当する文字列が含まれる

---

### TC-012: parseManifest がファイル不在の場合 formatVersion:"0" を返す

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01 ステップ5

**GIVEN** manifest ファイルが存在しないパス
**WHEN** `parseManifest(manifestPath)` を呼び出す
**THEN** 返却される Manifest の `formatVersion` が `"0"` になる（従来挙動と変わらない）

---

### TC-013: parseManifest がファイル在り・format-version キー欠落で formatVersion:"" を返す

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01 ステップ5

**GIVEN** `format-version:` キーを含まない manifest ファイルが存在する
**WHEN** `parseManifest(manifestPath)` を呼び出す
**THEN** 返却される Manifest の `formatVersion` が `""` （空文字列センチネル）になる

---

### TC-014: coverage コマンドで未知 format-version が非 0 exit になる

**Category**: integration
**Priority**: should
**Source**: design.md > D1（全動詞に parseManifest 直後のゲートを設ける）

**GIVEN** `format-version: 99` の manifest を持つ design/
**WHEN** `aozu coverage`（または `handleCoverage`）を実行する
**THEN** 非 0 exit になり、stderr にエラーメッセージが出力される

---

### TC-015: scaffold コマンドで未知 format-version が非 0 exit になる

**Category**: integration
**Priority**: should
**Source**: design.md > D1（全動詞に parseManifest 直後のゲートを設ける）

**GIVEN** `format-version: 99` の manifest を持つ design/
**WHEN** `aozu scaffold topic top-foo`（または `handleScaffold`）を実行する
**THEN** 非 0 exit になり、stderr にエラーメッセージが出力される

---

### TC-016: spec/format.md §10 に C12 規則が追記されている

**Category**: manual
**Priority**: could
**Source**: tasks.md > T-01 ステップ4

**GIVEN** spec/format.md を開く
**WHEN** §10 の閉包検証規則表を確認する
**THEN** C12 行が存在し、`format-version` が対応集合（`{"0"}`）に属することを記述している

---

## topics 書式統一（T-02）

### TC-017: SESSION_GUIDANCE がブラケット形式を含む

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: topics の正書式はブラケット付きで SESSION_GUIDANCE に例示される > Scenario: SESSION_GUIDANCE がブラケット形式を含む

---

### TC-018: SESSION_GUIDANCE が plain 形式を含まない

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: topics の正書式はブラケット付きで SESSION_GUIDANCE に例示される > Scenario: SESSION_GUIDANCE が plain 形式を含まない

---

### TC-019: C9 診断メッセージが正書式を示す

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C9 の診断メッセージに frontmatter の正書式への言及が含まれる > Scenario: C9 診断メッセージが正書式を示す

---

## scaffold prefix 補完（T-03）

### TC-020: bare slug で scaffold topic が prefix を補完する

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: scaffold はドキュメント型で prefix を自動補完する > Scenario: bare slug で scaffold topic が prefix を補完する

---

### TC-021: フル ID を渡した scaffold topic も受理される

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: scaffold はドキュメント型で prefix を自動補完する > Scenario: フル ID を渡した scaffold topic も受理される

---

### TC-022: 型と矛盾する prefix は error になる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: scaffold はドキュメント型で prefix を自動補完する > Scenario: 型と矛盾する prefix は error になる

---

### TC-023: scaffold adr で bare slug（ハイフン含む）を補完する

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-03 ステップ3

**GIVEN** loop 有効な design/ が存在する
**WHEN** `scaffold adr 0001-my-decision`（先頭セグメント `0001` は KNOWN_PREFIXES に含まれない bare slug）を実行する
**THEN** exit 0 になり、`id: adr-0001-my-decision` が frontmatter に含まれるファイルが作成される

---

### TC-024: adr 以外の document 型（plan / seq）でも prefix 補完が動作する

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-03 ステップ2（document 型全般への適用）

**GIVEN** loop 有効な design/ が存在する
**WHEN** `scaffold plan my-plan`（または `scaffold seq my-seq`）と bare slug を渡して実行する
**THEN** exit 0 になり、各 document 型の prefix が補完されたフル ID が frontmatter の `id:` に設定される

---

### TC-025: 既存の scaffold フル ID 指定テストに影響しない（回帰）

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-03 AC（既存の scaffold テスト（フル ID 指定のケース）が変更なし）

**GIVEN** prefix 補完ロジック実装前から存在するフル ID 指定の scaffold テスト群
**WHEN** `bun test` で scaffold.test.ts を実行する
**THEN** 既存テストがすべて変更なし・green のまま通過する

---

## derive エラーメッセージ改善（T-04）

### TC-026: request-template 欠落エラーに記入例が含まれる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive の config エラーメッセージに frontmatter の記入例を含める > Scenario: request-template 欠落エラーに記入例が含まれる

---

### TC-027: request-output-dir 欠落エラーに記入例が含まれる

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: derive の config エラーメッセージに frontmatter の記入例を含める > Scenario: request-output-dir 欠落エラーに記入例が含まれる

---

### TC-028: init MANIFEST_TEMPLATE のコメントに導出キーの説明が含まれる

**Category**: manual
**Priority**: could
**Source**: tasks.md > T-04 ステップ2

**GIVEN** `src/cli/commands/init.ts` の `MANIFEST_TEMPLATE` 定数を確認する
**WHEN** テンプレート内のコメント部分を読む
**THEN** `request-template` と `request-output-dir` の用途・値の形式に関する説明が含まれている

---

## mark positional slug（T-05）

### TC-029: positional slug で mark implemented が成功する

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark implemented は positional slug を受理する > Scenario: positional slug で mark implemented が成功する

---

### TC-030: positional slug と --request の食い違いは exit 2

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark implemented は positional slug を受理する > Scenario: positional slug と --request の食い違いは exit 2

---

### TC-031: --request 形式の既存呼び出しに影響しない

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark implemented は positional slug を受理する > Scenario: --request 形式の既存呼び出しに影響しない

---

### TC-032: positional slug と --request が同じ値の場合は正常動作する

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-05 ステップ3

**GIVEN** state.json に `request: "foundation"` で `state: "requested"` のエントリがある
**WHEN** `aozu mark implemented foundation --request foundation`（positional と --request が同じ値）を実行する
**THEN** 対象エントリが `state: "implemented"` に遷移し、exit 0 になる

---

### TC-033: aozu mark --help の出力に主要オプションが含まれる

**Category**: manual
**Priority**: could
**Source**: tasks.md > T-05 ステップ1

**GIVEN** `aozu mark --help` を実行する
**WHEN** 出力を確認する
**THEN** `implemented` サブコマンドの説明行に `--request <slug>` または positional `<slug>` の使い方が含まれている

---

## 回帰・全体確認

### TC-034: format-version: 0 の既存テストが全て green のまま

**Category**: integration
**Priority**: must
**Source**: request.md 受け入れ基準 / tasks.md 最終確認

**GIVEN** format-version フェンスの実装後の状態
**WHEN** `bun test` で全テストスイートを実行する
**THEN** `format-version: 0` を持つ既存 fixture に依存するテストがすべて変更なし・green のまま通過する（C12 診断が余分に生成されない）

---

## Result

```yaml
result: completed
total: 34
automated: 31
manual: 3
must: 26
should: 5
could: 3
blocked_reasons: []
```
