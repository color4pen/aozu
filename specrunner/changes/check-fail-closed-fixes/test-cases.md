# Test Cases: check-fail-closed-fixes

## Summary

- **Total**: 13 cases
- **Automated** (unit/integration): 12
- **Manual**: 1
- **Priority**: must: 7, should: 5, could: 1

---

### TC-001: 未知 prefix 参照の fail-closed

**Category**: unit  
**Priority**: must  
**Source**: spec.md > Requirement: C3 は未知 prefix を持つ参照を常にエラーとして診断する > Scenario: 未知 prefix 参照の fail-closed

---

### TC-002: 既知 prefix・無効な型への参照は縮退スキップ

**Category**: unit  
**Priority**: must  
**Source**: spec.md > Requirement: C3 は未知 prefix を持つ参照を常にエラーとして診断する > Scenario: 既知 prefix・無効な型への参照は従来どおりスキップ

---

### TC-003: 複数要素ファイルの後方要素への帰属

**Category**: unit  
**Priority**: must  
**Source**: spec.md > Requirement: 参照の帰属要素を「参照行を含むセクションの所有要素」で決定する > Scenario: 複数要素ファイルの後方要素への帰属

---

### TC-004: ファイル先頭要素の参照は先頭要素に帰属

**Category**: unit  
**Priority**: should  
**Source**: spec.md > Requirement: 参照の帰属要素を「参照行を含むセクションの所有要素」で決定する > Scenario: ファイル先頭要素の参照は先頭要素に帰属

---

### TC-005: 参照行より前に要素がない場合は undefined

**Category**: unit  
**Priority**: should  
**Source**: spec.md > Requirement: 参照の帰属要素を「参照行を含むセクションの所有要素」で決定する > Scenario: 参照行より前に要素がない場合は undefined

---

### TC-006: 未知 prefix 宣言は C1 エラー（現状維持）

**Category**: unit  
**Priority**: must  
**Source**: spec.md > Requirement: C1 の既存挙動（未知 prefix 宣言の検出）を維持する > Scenario: 未知 prefix 宣言は C1 エラー（現状維持）

---

### TC-007: findOwningElement が複数ファイル混在リストで対象ファイルの要素のみを候補にする

**Category**: unit  
**Priority**: should  
**Source**: tasks.md > T-01

**GIVEN** `elements` に `file-A` の要素 `act-a`（行 1）と `file-B` の要素 `act-b`（行 5）が混在している  
**WHEN** `findOwningElement(elements, "file-A", 3)` を呼ぶ  
**THEN** `file-A` の `act-a` が返され、`file-B` の `act-b` は候補から除外される

---

### TC-008: findOwningElement が対象ファイルを elements に持たない場合に undefined を返す

**Category**: unit  
**Priority**: should  
**Source**: tasks.md > T-01

**GIVEN** `elements` に `file-A` の要素 `act-a`（行 1）のみが含まれる  
**WHEN** `findOwningElement(elements, "file-B", 5)` を呼ぶ  
**THEN** `undefined` が返される

---

### TC-009: C3 未知 prefix 診断メッセージに prefix 名が付記される

**Category**: unit  
**Priority**: should  
**Source**: design.md > D3 / tasks.md > T-03

**GIVEN** `enabled: static`（`enabledPrefixes = {mod, adr}`）の環境で、`mod-intake` 要素が存在するファイル内に `[[zzz-typo]]` 参照がある  
**WHEN** `checkC3` が評価される  
**THEN** 返された診断の `message` が `unresolved reference "[[zzz-typo]]" (unknown prefix "zzz")` の形式であり、`"zzz-typo"` と `"zzz"` の両文字列を含む

---

### TC-010: C3 参照元が未知 prefix を持つ場合は縮退スキップしない

**Category**: unit  
**Priority**: could  
**Source**: tasks.md > T-02

**GIVEN** 未知 prefix（`zzz`）を持つ要素 `zzz-bad` が参照元として存在し、`enabled: static` の環境で `[[seq-x]]` を参照しているが `seq-x` は未宣言  
**WHEN** `checkC3` が評価される  
**THEN** 参照元の prefix が `KNOWN_PREFIXES` に存在しないため縮退スキップが適用されず、`code: "C3"` の診断が返される（旧実装ではスキップされていた参照が評価される）

---

### TC-011: tsc --noEmit && bun test が全件 green

**Category**: integration  
**Priority**: must  
**Source**: tasks.md > T-06

**GIVEN** 今回の変更（T-01〜T-05）がすべて適用されたリポジトリ状態  
**WHEN** `tsc --noEmit && bun test` を実行する  
**THEN** 型エラーゼロ・全テスト（既存 326 件 + 今回追加分）が green で exit 0 となる

---

### TC-012: design/ フィクスチャ群での統合チェックが真の違反ゼロを維持する

**Category**: integration  
**Priority**: must  
**Source**: tasks.md > T-06

**GIVEN** `design/` 配下に存在するすべての fixture デザイン（C3 の縮退変更前には違反がなかったもの）  
**WHEN** `src/check/integration.test.ts` を実行する  
**THEN** 今回の変更によって新たな C3 違反診断が追加されず、check 結果が変更前と同一である

---

### TC-013: package.json の dependencies が空のまま

**Category**: manual  
**Priority**: must  
**Source**: tasks.md > T-06

**GIVEN** 今回の変更がすべて適用されたリポジトリ状態  
**WHEN** `package.json` の `dependencies` フィールドを確認する  
**THEN** `dependencies` が `{}` のまま（実行時依存がゼロ）であり、新たなパッケージが追加されていない

---

## Result

```yaml
result: completed
total: 13
automated: 12
manual: 1
must: 7
should: 5
could: 1
blocked_reasons: []
```
