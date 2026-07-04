# Regression Gate Result — binary-distribution — iter 2

- **verdict**: approved

## Summary

All 4 findings from the iteration-1 review are confirmed fixed. No regressions detected.

---

## Finding Verification

### [MEDIUM] 7 must-priority TCs have no automated test implementation
- **File**: tests/binary-distribution.test.ts
- **Status**: ✅ Fixed

All 7 TCs now have corresponding test code in `tests/binary-distribution.test.ts`:

| TC | Test | Location |
|----|------|----------|
| TC-019 | `build-binaries job declares needs: publish (TC-019)` | describe "publish.yml — job dependencies and asset naming" |
| TC-020 | `upload-binaries job generates SHA256SUMS file (TC-020)` | describe "publish.yml — job dependencies and asset naming" |
| TC-024 | `ci.yml contains bun build --compile (TC-024)` | describe "ci.yml — binary-smoke job and existing quality gates" |
| TC-025 | 4 tests verifying `tsc --noEmit`, `bun test`, `check --dir design`, `export rules --dir design --verify` | describe "ci.yml — binary-smoke job and existing quality gates" |
| TC-026 | `README contains curl \| bash install one-liner (TC-026)` | describe "README — binary installation section" |
| TC-028 | `asset naming strips bun- prefix from target name (TC-028)` | describe "publish.yml — job dependencies and asset naming" |
| TC-029 | `Windows asset appends .exe extension (TC-029)` | describe "publish.yml — job dependencies and asset naming" |

Verification: `bun test` passes with 774 tests across 56 files (per verification-result.md iter 2).

---

### [MEDIUM] build-binaries job declares contents: write but only needs contents: read
- **File**: .github/workflows/publish.yml
- **Status**: ✅ Fixed

`publish.yml` lines 53–54 confirm `build-binaries` job now declares `contents: read`:

```yaml
  build-binaries:
    runs-on: ubuntu-latest
    needs: publish
    permissions:
      contents: read   # ← corrected (was: write)
```

Only `upload-binaries` (the job that calls `gh release upload`) retains `contents: write`.

---

### [MEDIUM] Verification pipeline skipped build/typecheck/test/lint/security phases
- **File**: specrunner/changes/binary-distribution/verification-result.md
- **Status**: ✅ Fixed (typecheck + test now pass; remaining skips are acceptable)

`verification-result.md` for iter 2 shows:

| Phase | Status |
|-------|--------|
| build | skipped — bun compiles TypeScript natively at runtime (no build script needed) |
| typecheck | **passed** (exit 0, `tsc --noEmit`) |
| test | **passed** (exit 0, 774 pass) |
| lint | skipped — no lint script in package.json |
| security | skipped — no security script in package.json |

The acceptance criteria (`tsc --noEmit && bun test` green) is satisfied. The three remaining skips reflect deliberate project structure (bun runtime, no lint/security scripts defined).

---

### [LOW] macOS codesign commands ignore exit codes
- **File**: tests/binary.test.ts
- **Status**: ✅ Fixed

`tests/binary.test.ts` lines 69–87 now check exit codes for both codesign invocations:

```typescript
const stripCode = await strip.exited;
if (stripCode !== 0) {
  const stderr = await new Response(strip.stderr).text();
  throw new Error(`codesign --remove-signature failed (exit ${stripCode}): ${stderr}`);
}

const signCode = await sign.exited;
if (signCode !== 0) {
  const stderr = await new Response(sign.stderr).text();
  throw new Error(`codesign -s - failed (exit ${signCode}): ${stderr}`);
}
```

Both failures now produce a clear diagnostic instead of a silent continuation.

---

## No Regressions

No previously-fixed findings have regressed. No contradictions (fixing A re-introduces B) were detected.
