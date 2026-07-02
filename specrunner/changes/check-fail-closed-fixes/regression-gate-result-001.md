# Regression Gate Result — check-fail-closed-fixes — iter 1

- **verdict**: needs-fix
- **iteration**: 001

## Verification Summary

Branch `fix/check-fail-closed-fixes-15b0f7ca` was checked against the 2 findings in the ledger.

## Findings

### [LOW] TC-009: unknown prefix メッセージ形式の assertion が不十分 — **NOT FIXED**

- **File**: src/check/rules/c03-ref-resolved.test.ts:123
- **Resolution**: fixable
- **Status**: regression

The test still uses `toContain("zzz")` (line 123) as the second message assertion:

```typescript
expect(diags[0]!.message).toContain("zzz-typo");
expect(diags[0]!.message).toContain("zzz");   // ← 未修正
```

`toContain("zzz")` は `"[[zzz-typo]]"` 単体でも通過する（"zzz" が "zzz-typo" の部分文字列）。
設計 D3 の `(unknown prefix "zzz")` アノテーション形式が assertion で固定されていない。

**必要な修正**: `toContain("zzz")` を `toContain('(unknown prefix "zzz")')` に置き換える。

> **注記**: review-feedback-001.md では `Fix: no`（不要）とされていたが、regression-gate の Findings Ledger には「fixed」として登録されている。実コードには fix が存在しないため regression として報告する。

---

### [LOW] TC-010: 参照元が未知 prefix の場合の縮退スキップ非適用テストが未カバー — **NOT FIXED**

- **File**: src/check/rules/c03-ref-resolved.test.ts
- **Resolution**: fixable
- **Status**: regression

`zzz-bad`（未知 prefix `zzz` を持つ要素）が参照元の場合、縮退スキップが適用されず診断が返ることの回帰テストが存在しない。
`git grep` で `zzz-bad` に対応するテストケースは確認できなかった。

実装は正しく動作している（`KNOWN_PREFIXES.has(sourcePrefix)` が false → `continue` に入らず評価される、`c03-ref-resolved.ts` 行 42–46）。
しかしテストによる固定がないため、将来の変更で誤ってスキップ条件が変わっても検知できない。

**必要な修正**: 以下のテストケースを追加する。

```typescript
it("unknown source prefix (zzz-bad) → no degenerate skip, C3 diagnostic returned", () => {
  const graph = makeGraph(
    [{ id: "zzz-bad", prefix: "zzz", displayName: "Bad", file: "foo.md", line: 1 }],
    [{ targetId: "seq-x", file: "foo.md", line: 5 }]
  );
  const enabledStatic = new Set(["mod", "adr"]);
  const diags = checkC3(graph, enabledStatic);
  // seq-x is undeclared; zzz source prefix is unknown so no degenerate skip
  expect(diags).toHaveLength(1);
  expect(diags[0]!.code).toBe("C3");
});
```

> **注記**: TC-010 は test-cases.md で `could` 優先度。review-feedback-001.md では `Fix: no`（不要）とされていたが、regression-gate の Findings Ledger には「fixed」として登録されている。実コードには fix が存在しないため regression として報告する。

---

## Context

- `review-feedback-001.md` の verdict は `approved`（両 Finding とも `Fix: no`、低優先度の改善提案として扱われた）
- 主機能（C3 fail-closed・C11 帰属修正）は正しく実装済み、`bun test` 335 件全 pass 確認済み
- Regression-gate の Findings Ledger と review-feedback の `Fix: no` の間に矛盾があるため、実コードの状態を優先して報告した
