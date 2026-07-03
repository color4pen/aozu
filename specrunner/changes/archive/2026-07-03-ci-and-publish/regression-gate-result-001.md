# Regression Gate Result — ci-and-publish / Iteration 1

- **verdict**: approved
- **date**: 2026-07-03

## Summary

All 2 findings from the ledger are confirmed fixed. No regressions detected.

## Finding Verification

### [HIGH] `tsc --noEmit` が GitHub Actions で失敗する可能性
- **File**: .github/workflows/ci.yml:22
- **Status**: ✅ Fixed
- **Evidence**: Line 22 reads `run: bunx tsc --noEmit`. Using `bunx` ensures `tsc` is resolved via Bun's tool runner without relying on `node_modules/.bin` being in PATH.

### [MEDIUM] 開発中のデバッグ用ファイルがコミットされている
- **File**: .npmignore.bak, .npmignore.test
- **Status**: ✅ Fixed
- **Evidence**: `git ls-files` returned "did not match any file(s) known to git" for both `.npmignore.bak` and `.npmignore.test`. Neither file is tracked in the branch.
