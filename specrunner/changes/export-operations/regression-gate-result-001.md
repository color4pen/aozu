# Regression Gate Result — export-operations (iteration 1)

## Findings Verified

### Finding 1: Requirement 8 の '--out writes to file' Scenario に exit code の明示なし

**File**: specrunner/changes/export-operations/spec.md
**Status**: FIXED

spec.md line 101:
```
**Then** `/tmp/ops.json` に JSON が書き出され、stdout には何も出力されず、exit code は 0 である
```
Then 節に `exit code は 0 である` が明示されており、修正済み。

---

### Finding 2: TC-011: stdout 非出力がテストで検証されていない

**File**: src/cli/commands/export.test.ts:447
**Status**: NOT FIXED — still present

TC-011 テスト（lines 446–464）はファイル書き出しと exit 0 のみを検証しており、stdout への誤出力を検出するアサーションが追加されていない。permissions テストにも同様のアサーションは存在せず、プロジェクトの許容水準に照らして未修正のまま。

```typescript
// TC-011 現在のアサーション（stdout チェックなし）
expect(exitCode).toBe(0);
const content = await readFile(outPath, "utf-8");
expect(output["format-version"]).toBe(0);
// stdout 非出力のアサーションなし
```

## Summary

| Finding | Status |
|---------|--------|
| Finding 1: spec.md exit code 明示なし | FIXED |
| Finding 2: TC-011 stdout 非出力未検証 | NOT FIXED |
