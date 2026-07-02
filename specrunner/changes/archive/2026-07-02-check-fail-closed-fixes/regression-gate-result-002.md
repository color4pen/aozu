# Regression Gate Result — Iteration 2

- **change**: check-fail-closed-fixes
- **iteration**: 2
- **date**: 2026-07-02
- **verdict**: approved

## Summary

Both findings from the ledger are confirmed fixed. No regressions detected. All 10 tests in `src/check/rules/c03-ref-resolved.test.ts` pass.

## Finding Verification

### TC-009: unknown prefix メッセージ形式の assertion が不十分

- **File**: src/check/rules/c03-ref-resolved.test.ts:122–123
- **Status**: ✅ Fixed — no regression

The formerly weak `toContain("zzz")` (which would pass even for "zzz-typo" as a substring) has been replaced with two explicit assertions:

```typescript
expect(diags[0]!.message).toContain("zzz-typo");
expect(diags[0]!.message).toContain('(unknown prefix "zzz")');
```

The second assertion pins the exact D3-specified annotation format `(unknown prefix "zzz")`, so any deviation in message formatting would now cause the test to fail.

### TC-010: 参照元自身が未知 prefix の場合の縮退スキップ非適用テストが未カバー

- **File**: src/check/rules/c03-ref-resolved.test.ts:128–139
- **Status**: ✅ Fixed — no regression

A new test case is present:

```typescript
it("reference from unknown-prefix source (zzz-bad) → degenerate skip NOT applied, C3 raised", () => {
  const graph = makeGraph(
    [{ id: "zzz-bad", prefix: "zzz", displayName: "Bad", file: "zzz.md", line: 1 }],
    [{ targetId: "mod-nonexist", file: "zzz.md", line: 5 }]
  );
  const enabledStatic = new Set(["mod", "adr"]);
  const diags = checkC3(graph, enabledStatic);
  expect(diags).toHaveLength(1);
  expect(diags[0]!.code).toBe("C3");
  expect(diags[0]!.level).toBe("error");
});
```

This verifies that when the source element itself has an unknown prefix (`zzz`), `KNOWN_PREFIXES.has(sourcePrefix)` returns false and the degenerate skip is not triggered — C3 is raised as required.

## Test Run

```
bun test src/check/rules/c03-ref-resolved.test.ts
 10 pass
 0 fail
 22 expect() calls
```
