# Regression Gate Result — Iteration 002

- **change**: invariant-teeth
- **iteration**: 2
- **date**: 2026-07-03
- **verdict**: approved

## Summary

Both findings from the previous review have been correctly fixed. No regressions detected.

## Finding Verification

### [MEDIUM] TC-004/TC-005/TC-027 が未実装

**Status**: ✅ Fixed

All three test cases are now implemented in `tests/invariants.test.ts`:

- **TC-004** (`extractInvariantIds` unit test with synthetic fixture): Lines 253–279.
  Three sub-tests cover: extraction of multiple IDs, empty input, and non-`inv-*` anchors.
- **TC-005** (`collectNonTestTsFiles` excludes `.test.ts` files): Lines 285–320.
  Two sub-tests use a `mkdtemp` temporary directory: one with a mixed `.ts`/`.test.ts` set, one with only `.test.ts` files.
- **TC-027** (`src/cli/` and `src/prompt/` not in verdict-owning modules list): Lines 514–544.
  Explicitly asserts that `getVerdictModuleDirs()` excludes both `src/cli/` and `src/prompt/`, and confirms `src/check/`, `src/export/`, `src/state/` remain present.

### [LOW] collectNonTestTsFiles の不要な export

**Status**: ✅ Fixed

`collectNonTestTsFiles` at line 84 no longer carries the `export` keyword. It is a module-private helper used only within `tests/invariants.test.ts`. The previously exported detection functions (`extractInvariantIds`, `detectStateWriteViolation`, `detectReferenceGrammarViolation`, `detectNondeterministicViolation`, `getVerdictModuleDirs`) retain their exports for legitimate test-internal use.

## Findings

None. No regressions found.
