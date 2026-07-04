# Regression Gate Result — binary-distribution — iter 1

- **verdict**: needs-fix

## Summary

3 of 4 findings are confirmed fixed. 1 finding has a regression.

---

## Finding Verification

### [MEDIUM] 7 must-priority TCs have no automated test implementation
- **file**: tests/binary-distribution.test.ts
- **status**: fixed
- **evidence**: All 7 TCs now have corresponding test implementations:
  - TC-019 → `"build-binaries job declares needs: publish (TC-019)"` checks `needs: publish`
  - TC-020 → `"upload-binaries job generates SHA256SUMS file (TC-020)"` checks for `SHA256SUMS` and `sha256sum`
  - TC-024 → `"ci.yml contains bun build --compile (TC-024)"` checks ci.yml
  - TC-025 → three tests verify `tsc --noEmit`, `bun test`, `check --dir design`, `export rules --dir design --verify` are all retained
  - TC-026 → `"README contains curl | bash install one-liner (TC-026)"` checks the full URL
  - TC-028 → `"asset naming strips bun- prefix from target name (TC-028)"` checks `${TARGET#bun-}`
  - TC-029 → `"Windows asset appends .exe extension (TC-029)"` checks `.exe`

### [MEDIUM] build-binaries job declares contents: write but only needs contents: read
- **file**: .github/workflows/publish.yml
- **status**: fixed
- **evidence**: The `build-binaries` job now declares `contents: read` (line 54). The `contents: write` permission appears only on the `upload-binaries` job (line 97), which is the only job that calls `gh release upload`.

### [MEDIUM] Verification pipeline skipped build/typecheck/test/lint/security phases
- **file**: specrunner/changes/binary-distribution/verification-result.md
- **status**: fixed
- **evidence**: verification-result.md (iter 2) shows typecheck passed (`bunx tsc --noEmit`, exit 0) and test passed (`774 pass, 0 fail`, exit 0). Build/lint/security are intentionally skipped because no corresponding scripts exist in package.json, which is acceptable per the project's Bun-native setup.

### [LOW] macOS codesign commands ignore exit codes
- **file**: tests/binary.test.ts
- **status**: regression
- **severity**: high
- **resolution**: fixable
- **evidence**: Lines 69 and 75 of `tests/binary.test.ts` still read:
  ```typescript
  await strip.exited;   // return value discarded
  await sign.exited;    // return value discarded
  ```
  Neither exit code is captured in a variable nor checked with a conditional. If either `codesign --remove-signature` or `codesign -s -` fails, the test continues and the subsequent `--help` / `--version` assertions fail with opaque exit 137 (SIGKILL) rather than a diagnostic indicating codesigning failed.
- **required fix**: Capture the exit codes and throw a descriptive error if non-zero, for example:
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
