# Regression Gate Result — invariant-teeth / iteration 001

- **verdict**: needs-fix
- **iteration**: 001

## Ledger Item Verification

### [MEDIUM] TC-004/TC-005/TC-027 が未実装

- **Status**: ✅ Fixed — no regression
- **Evidence**:
  - TC-004 (`extractInvariantIds` unit tests with synthetic fixture): `describe("extractInvariantIds — unit tests (TC-004)", ...)` at lines 253–279
  - TC-005 (`collectNonTestTsFiles` excludes `.test.ts`): `describe("collectNonTestTsFiles — excludes *.test.ts (TC-005)", ...)` at lines 285–320
  - TC-027 (`src/cli/` and `src/prompt/` not in verdict-owning modules): `describe("inv-deterministic-verdict — verdict module exclusions (TC-027)", ...)` at lines 514–544

### [LOW] collectNonTestTsFiles の不要な export

- **Status**: ❌ Regression — export is still present
- **File**: tests/invariants.test.ts:84
- **Evidence**: Line 84 reads `export async function collectNonTestTsFiles(dir: string): Promise<string[]>`. The `export` keyword was not removed. No external file imports from this test file; the export is unnecessary.

## Findings

| # | Severity | File | Line | Title | Resolution |
|---|----------|------|------|-------|------------|
| 1 | low | tests/invariants.test.ts | 84 | collectNonTestTsFiles に不要な export が残存 | fixable |

## Detail

### Finding 1 — collectNonTestTsFiles 不要 export（regression）

`collectNonTestTsFiles` は `export` されているが、テストファイル外からの利用はなく不要な public API である。レビューフィードバック finding #3 で `export` キーワードの削除が指示されたにもかかわらず、現在の `tests/invariants.test.ts:84` に `export` が残っている。

**Fix**: `export async function collectNonTestTsFiles` → `async function collectNonTestTsFiles`
