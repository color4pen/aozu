# Code Review Feedback — binary-distribution — iter 1

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
- iteration line format (exact): `- **iteration**: NNN` (3-digit zero-padded integer)
- Findings table MUST have exactly 7 columns in this order:
  # | Severity | Category | File | Description | How to Fix | Fix
  - Fix column: yes = fixer should address this finding; no = skip (pre-existing / out-of-scope)
- Scores table columns: Category | Score | Weight
  - Valid Category values: correctness | security | architecture | performance | maintainability | testing
  - Score: integer 1-10
  - Weight: decimal as defined below
- total line format (exact): `- **total**: <decimal>`
- Default weights: correctness=0.30, security=0.25, architecture=0.15, performance=0.10, maintainability=0.10, testing=0.10
- Scores table is optional but recommended.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | MEDIUM | testing | `tests/binary-distribution.test.ts` | **7 must-priority TCs have no automated test implementation**: TC-019 (`build-binaries` declares `needs: publish`), TC-020 (workflow `upload-binaries` job generates SHA256SUMS), TC-024 (`ci.yml` contains `bun build --compile`), TC-025 (`ci.yml` existing quality gates unchanged), TC-026 (README contains `curl \| bash` one-liner), TC-028 (asset names strip `bun-` prefix), TC-029 (Windows asset has `.exe` extension) are all `unit / must` in test-cases.md but have no corresponding test code. The verification pipeline reported "26/26 must TCs covered" because its test-coverage phase is a document-level count of test-cases.md entries, not a code-level check. | Add content-inspection tests to `binary-distribution.test.ts` using the existing pattern (`readFile` → `expect(content).toContain(...)`). Specifically: `expect(publishYml).toContain("needs: publish")` (TC-019), `expect(publishYml).toContain("sha256sum aozu-")` (TC-020), add a new `ciYml` describe block with `expect(ciYml).toContain("bun build --compile")` (TC-024) and checks for `tsc --noEmit` / `bun test` (TC-025), `expect(readme).toContain("install.sh \| bash")` (TC-026), `expect(publishYml).toContain("aozu-${TARGET#bun-}")` or `toContain("aozu-darwin-arm64")` (TC-028), `expect(publishYml).toContain(".exe")` (TC-029). | yes |
| 2 | MEDIUM | verification | `specrunner/changes/binary-distribution/verification-result.md` | **Verification pipeline skipped build / typecheck / test / lint / security phases**: All 5 phases show `skipped — script not found in package.json`. The acceptance criteria requires `tsc --noEmit && bun test` to pass. Manual inspection finds no obvious type errors (`declare global { var __AOZU_VERSION }` is correct, `getVersion()` is well-typed, test files are syntactically valid), but formal confirmation is absent. | Re-run the verification step with the correct package.json script configuration so that `typecheck` and `test` phases execute. Confirm `tsc --noEmit && bun test` exits 0 before PR merge. | no |
| 3 | MEDIUM | security | `.github/workflows/publish.yml` | **`build-binaries` job declares `contents: write` but does not interact with GitHub Releases**: The job performs checkout + compile + `actions/upload-artifact`. None of these require `contents: write`; only the downstream `upload-binaries` job calls `gh release upload`. The implementation follows tasks T-03 as written, but T-03 over-specifies the permission for this job relative to the design's stated least-privilege intent ("権限を job 単位で最小化する"). | Change the `build-binaries` job permission to `contents: read`. Update tasks.md T-03 to reflect the corrected permission. The `upload-binaries` job retains `contents: write`. | yes |
| 4 | LOW | robustness | `install.sh` | **GitHub API tag parsing with `grep \| sed` is fragile**: `grep '"tag_name"' \| sed -E 's/.*"tag_name": *"([^"]+)".*/\1/'` assumes pretty-printed JSON with `tag_name` on its own line. If the API returns compact JSON the sed pattern produces an empty string; the existing `[ -z "$TAG" ]` guard then aborts with a clear error — so the script doesn't silently misbehave — but the error message doesn't indicate JSON parsing failure. | Optional: probe for `jq` and prefer `jq -r '.tag_name'`, falling back to `grep \| sed`. If unchanged, add a comment like `# relies on GitHub's stable pretty-printed JSON format` so the fragility is explicit. No action required unless the guard fires in the wild. | no |
| 5 | LOW | maintainability | `tests/binary.test.ts` | **macOS codesign commands ignore exit codes**: `await strip.exited` and `await sign.exited` are not checked. If `codesign --remove-signature` or `codesign -s -` fails silently, the subsequent `--help` / `--version` assertions fail with an opaque "exit 137 (SIGKILL)" error rather than a clear "codesigning failed" diagnostic. | Check exit codes and throw early: `const code = await strip.exited; if (code !== 0) throw new Error(\`codesign --remove-signature failed (exit ${code})\`);`. Same pattern for the `codesign -s -` step. | yes |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 7 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 8 | 0.10 |
| testing | 6 | 0.10 |

- **total**: 8.15

## Summary

The implementation is functionally complete and correct across all 8 tasks. All core behaviours are implemented as designed: the `globalThis.__AOZU_VERSION` compile-time injection with runtime fallback, the three-job publish workflow (`publish` → `build-binaries` matrix × 5 targets → `upload-binaries` with SHA256SUMS), the `install.sh` with OS/arch detection and checksum verification, the `binary-smoke` CI job, and the README update.

No CRITICAL or HIGH findings. Three MEDIUM findings address test coverage gaps (7 must-priority TCs without test code), the unverified verification pipeline, and an over-privileged job permission. Two LOW findings cover robustness and debuggability details. The verdict is `approved`; the MEDIUM findings should be resolved by the code-fixer before PR merge.

### Acceptance Criteria Status

| Criterion | Status |
|-----------|--------|
| Workflow: 5 targets + `bun build --compile` + `gh release upload`, pinned by grep tests | Partial — publish.yml tested ✅; ci.yml not tested (TC-024 gap) |
| Native binary `--help` + `--version` exit 0, pinned by test | ✅ `binary.test.ts` |
| `--version` identical in source and binary, pinned by test | ✅ `binary.test.ts` + existing package test |
| install.sh OS/arch detection, pinned by grep test | ✅ `binary-distribution.test.ts` |
| npm publish path unchanged | ✅ no changes to npm path |
| `tsc --noEmit && bun test` green / dependencies empty | Unverified (pipeline skipped — Finding #2) |

