# Test Cases: binary-distribution

<!-- FORMAT REQUIREMENTS:
Test Case heading format: `### TC-{NNN}: {Name}` (3-digit zero-padded, e.g. TC-001)

Required fields per test case:
  **Category**: unit | integration | manual
  **Priority**: must | should | could
  **Source**: reference to spec Scenario (spec.md > Requirement: <name> > Scenario: <name>) or design.md / tasks.md section

GIVEN/WHEN/THEN structure (mixed format — depends on TC type):
  Scenario 由来 TC (Source = spec.md > Requirement: <name> > Scenario: <name>):
    GWT は記述しない。Source 参照のみ。behavior の正典は spec の Scenario。
  非 Scenario 由来 TC (Source = design.md or tasks.md section):
    GWT は必須:
    **GIVEN** <preconditions>
    **WHEN** <action>
    **THEN** <expected result>

Category determination:
  unit        — pure logic, validation, helper functions (automated)
  integration — DB operations, API endpoints, multi-module interaction (automated)
  manual      — UI/UX confirmation, visual verification, build artifact check (not automated)

Priority determination:
  must   — core functionality; if broken, the feature does not work
  should — important but core still works; edge cases, error handling
  could  — nice to have; performance, UX details

Summary section MUST appear immediately after the title with ALL 4 items:
  ## Summary
  - **Total**: {count} cases
  - **Automated** (unit/integration): {count}
  - **Manual**: {count}
  - **Priority**: must: {count}, should: {count}, could: {count}

Result section MUST appear at the very end as a YAML code block:
  ## Result
  ```yaml
  result: completed | partial | failed
  total: {count}
  automated: {count}
  manual: {count}
  must: {count}
  should: {count}
  could: {count}
  blocked_reasons: []
  ```

  result determination:
    completed — all testable behaviors are documented
    partial   — some cases could not be derived due to design ambiguity
    failed    — spec is absent AND design.md / tasks.md are also missing
-->

## Summary

- **Total**: 31 cases
- **Automated** (unit/integration): 30
- **Manual**: 1
- **Priority**: must: 26, should: 5, could: 0

---

## TC-001: Source execution returns package.json version

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Version output SHALL work identically in source execution and compiled binary > Scenario: Source execution returns package.json version

---

## TC-002: Compiled binary returns injected version

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Version output SHALL work identically in source execution and compiled binary > Scenario: Compiled binary returns injected version

---

## TC-003: Compiled binary --help exits 0

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Version output SHALL work identically in source execution and compiled binary > Scenario: Compiled binary --help exits 0

---

## TC-004: Workflow YAML contains compile matrix for all 5 targets

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: Publish workflow SHALL compile 5 target binaries and attach to GitHub Release > Scenario: Workflow YAML contains compile matrix for all 5 targets

---

## TC-005: Workflow YAML contains gh release upload

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: Publish workflow SHALL compile 5 target binaries and attach to GitHub Release > Scenario: Workflow YAML contains gh release upload

---

## TC-006: Binary build job has contents write permission

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: Publish workflow SHALL compile 5 target binaries and attach to GitHub Release > Scenario: Binary build job has contents write permission

---

## TC-007: npm publish job retains minimal permissions

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: Publish workflow SHALL compile 5 target binaries and attach to GitHub Release > Scenario: npm publish job retains minimal permissions

---

## TC-008: install.sh contains OS detection

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: install.sh SHALL detect OS/arch and download the correct binary > Scenario: install.sh contains OS detection

---

## TC-009: install.sh contains architecture detection

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: install.sh SHALL detect OS/arch and download the correct binary > Scenario: install.sh contains architecture detection

---

## TC-010: install.sh verifies binary checksum

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: install.sh SHALL detect OS/arch and download the correct binary > Scenario: install.sh verifies binary checksum

---

## TC-011: install.sh performs version verification

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: install.sh SHALL detect OS/arch and download the correct binary > Scenario: install.sh performs version verification

---

## TC-012: npm pack tarball content is unchanged

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Existing npm packaging and tests SHALL remain unaffected > Scenario: npm pack tarball content is unchanged

---

## TC-013: All existing tests pass

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: Existing npm packaging and tests SHALL remain unaffected > Scenario: All existing tests pass

---

## TC-014: dependencies remains empty

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: Existing npm packaging and tests SHALL remain unaffected > Scenario: dependencies remains empty

---

## TC-015: version.ts getVersion() checks compile-time constant before runtime fallback

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01: Create version module with compile-time constant support

**GIVEN** `src/cli/version.ts` exists and exports `getVersion(): Promise<string>`
**WHEN** the function body is inspected
**THEN** it first checks `globalThis.__AOZU_VERSION` and returns it if it is a non-empty string, and only falls back to reading `package.json` via `Bun.file()` when the constant is absent

---

## TC-016: TypeScript declaration for globalThis.__AOZU_VERSION exists

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-01: Create version module with compile-time constant support

**GIVEN** the codebase contains `src/cli/version.ts` (or a companion `.d.ts` file)
**WHEN** the TypeScript declarations are inspected
**THEN** `declare var __AOZU_VERSION: string | undefined` (or equivalent) is present so that TypeScript does not report an error for the `globalThis.__AOZU_VERSION` access

---

## TC-017: tsc --noEmit passes with new version module

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-01: Create version module with compile-time constant support

**GIVEN** `src/cli/version.ts` and its TypeScript declarations are in place
**WHEN** `tsc --noEmit` is run against the project
**THEN** exit code is 0 and no type errors are reported

---

## TC-018: binary.test.ts cleans up temp binary in afterAll

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-02: Add binary smoke test

**GIVEN** `tests/binary.test.ts` compiles a binary to a temporary directory
**WHEN** the test suite finishes (afterAll hook is called)
**THEN** the temporary binary file and its containing directory are removed so no leftover artifacts remain in the CI workspace

---

## TC-019: build-binaries job uses needs: publish

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03: Add binary build job to publish workflow

**GIVEN** `.github/workflows/publish.yml` contains a `build-binaries` job
**WHEN** its `needs` field is inspected
**THEN** it declares `needs: publish` (or equivalent), ensuring binary compilation only starts after successful npm publish

---

## TC-020: upload-binaries generates SHA256SUMS covering all 5 binaries

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03: Add binary build job to publish workflow

**GIVEN** `.github/workflows/publish.yml` contains an `upload-binaries` (or equivalent) job
**WHEN** its steps are inspected
**THEN** there is a step that generates a `SHA256SUMS` file (via `sha256sum aozu-*` or equivalent) and the `gh release upload` step uploads both the binaries and `SHA256SUMS`

---

## TC-021: install.sh starts with bash shebang

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05: Create install.sh

**GIVEN** `install.sh` exists at the repository root
**WHEN** its first line is inspected
**THEN** it equals `#!/bin/bash` or `#!/usr/bin/env bash`

---

## TC-022: install.sh contains set -euo pipefail

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05: Create install.sh

**GIVEN** `install.sh` exists at the repository root
**WHEN** its content is inspected
**THEN** it contains `set -euo pipefail` (strict mode), ensuring any unhandled error aborts the script immediately

---

## TC-023: install.sh prints PATH guidance when ~/.local/bin not in PATH

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-05: Create install.sh

**GIVEN** `install.sh` exists at the repository root
**WHEN** its content is inspected
**THEN** it contains a conditional check for `~/.local/bin` in `$PATH` and a guidance message instructing the user to add it when it is absent

---

## TC-024: ci.yml binary-smoke job contains bun build --compile

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-07: Add binary smoke step to CI workflow

**GIVEN** `.github/workflows/ci.yml` exists
**WHEN** its content is inspected
**THEN** it contains `bun build --compile` (indicating the binary-smoke job is defined) and references `--version` verification against the native binary

---

## TC-025: ci.yml existing quality gate steps remain unchanged

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-07: Add binary smoke step to CI workflow

**GIVEN** `.github/workflows/ci.yml` has been modified to add the binary-smoke job
**WHEN** its content is inspected
**THEN** it still contains all pre-existing quality gate commands (`tsc --noEmit`, `bun test`, `check --dir design`, `export rules --dir design --verify`) with no modifications

---

## TC-026: README contains curl | bash install one-liner

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-08: Update README installation section

**GIVEN** `README.md` exists
**WHEN** its content is inspected
**THEN** it contains `curl -fsSL https://raw.githubusercontent.com/color4pen/aozu/main/install.sh | bash`

---

## TC-027: README mentions both npm and binary distribution channels

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-08: Update README installation section

**GIVEN** `README.md` exists
**WHEN** the installation section is inspected
**THEN** it describes both the npm installation path (`npm install` / `npx`) and the single-binary path (install.sh), and existing npm installation instructions are preserved

---

## TC-028: Binary asset names strip the bun- prefix

**Category**: unit
**Priority**: must
**Source**: design.md > D5: Binary naming convention

**GIVEN** `.github/workflows/publish.yml` contains the compile steps
**WHEN** the asset naming logic is inspected (via grep or YAML parse)
**THEN** the produced filenames follow the `aozu-<os>-<arch>` pattern (e.g., `aozu-darwin-arm64`, `aozu-linux-x64`) with no `bun-` prefix in the asset name that gets uploaded to the release

---

## TC-029: Windows binary asset has .exe extension

**Category**: unit
**Priority**: must
**Source**: design.md > D5: Binary naming convention

**GIVEN** `.github/workflows/publish.yml` contains the compile matrix
**WHEN** the step that derives the asset name for the `bun-windows-x64` target is inspected
**THEN** it produces `aozu-windows-x64.exe` (the `.exe` suffix is explicitly appended for the Windows target)

---

## TC-030: install.sh maps aarch64 to arm64

**Category**: unit
**Priority**: should
**Source**: design.md > D3: install.sh in repository root

**GIVEN** `install.sh` exists at the repository root
**WHEN** the architecture detection block is inspected
**THEN** it treats `aarch64` (Linux ARM64 alias) as equivalent to `arm64` and constructs the binary name with the `arm64` suffix so that Linux ARM64 hosts download the correct asset

---

## TC-031: GitHub Release contains all 5 binary assets and SHA256SUMS after publish workflow runs

**Category**: manual
**Priority**: must
**Source**: design.md > D2: Separate workflow job for binary compilation and release attachment

**GIVEN** a new version tag is pushed and the publish workflow completes successfully
**WHEN** the corresponding GitHub Release page is inspected
**THEN** the release contains exactly 5 binary assets (`aozu-darwin-arm64`, `aozu-darwin-x64`, `aozu-linux-x64`, `aozu-linux-arm64`, `aozu-windows-x64.exe`) and a `SHA256SUMS` file, all attached by the `upload-binaries` job

---

## Result

```yaml
result: completed
total: 31
automated: 30
manual: 1
must: 26
should: 5
could: 0
blocked_reasons: []
```
