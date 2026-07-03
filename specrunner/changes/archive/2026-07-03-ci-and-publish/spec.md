# Spec: ci-and-publish

## Requirements

### Requirement: CI workflow SHALL execute the 4 quality gate commands

The CI workflow SHALL execute the following commands in order, and the job SHALL fail if any command exits non-zero: (1) `tsc --noEmit`, (2) `bun test`, (3) `bun src/cli/main.ts check --dir design`, (4) `bun src/cli/main.ts export rules --dir design --verify`.

#### Scenario: CI workflow YAML contains all 4 quality gate commands

**Given** `.github/workflows/ci.yml` exists
**When** the file content is read
**Then** the content contains the strings `tsc --noEmit`, `bun test`, `check --dir design`, and `export rules --dir design --verify`

### Requirement: The tarball SHALL contain only publishable files

The `npm pack` tarball SHALL include `src/` (excluding `*.test.ts`), `README.md`, `LICENSE`, and `package.json`. It SHALL NOT include `design/`, `specrunner/`, `tools/`, `tests/`, `adr/`, `docs/`, `spec/`, or any `*.test.ts` files.

#### Scenario: tarball excludes test files

**Given** `.npmignore` is configured to exclude `**/*.test.ts`
**When** `npm pack --json` is executed
**Then** the file list contains no entries matching `*.test.ts`

#### Scenario: tarball excludes non-publishable directories

**Given** `.npmignore` is configured to exclude `design/`, `specrunner/`, `tools/`, `tests/`
**When** `npm pack --json` is executed
**Then** the file list contains no entries with paths starting with `design/`, `specrunner/`, `tools/`, or `tests/`

#### Scenario: tarball includes required files

**Given** `files` field in package.json is `["src", "README.md", "LICENSE"]`
**When** `npm pack --json` is executed
**Then** the file list contains `package.json`, `README.md`, `LICENSE`, and at least one file under `src/`

### Requirement: The packaged binary SHALL be executable

The CLI entry point packaged in the tarball SHALL produce exit code 0 when invoked with `--help` via the bun runtime.

#### Scenario: --help exits 0 from extracted tarball

**Given** `npm pack` has produced a tarball and it is extracted to a temporary directory
**When** `bun <extracted>/src/cli/main.ts --help` is executed
**Then** the process exits with code 0

### Requirement: package.json SHALL be configured for public publishing

The package.json SHALL NOT contain `private: true`. It SHALL contain `engines.bun`, `files`, `description`, `repository`, `license`. The `version` SHALL remain `0.0.0` (release-please will bump it). The `dependencies` SHALL remain empty.

#### Scenario: package.json has no private field

**Given** the package.json file exists
**When** its content is parsed as JSON
**Then** the `private` field is `undefined`

#### Scenario: package.json version is 0.0.0

**Given** the package.json file exists
**When** its content is parsed as JSON
**Then** the `version` field equals `"0.0.0"`

#### Scenario: package.json has engines.bun and files

**Given** the package.json file exists
**When** its content is parsed as JSON
**Then** `engines.bun` is defined and `files` is defined

### Requirement: release-please config SHALL use node release-type with bump-minor-pre-major

The release-please configuration SHALL specify `release-type: "node"` and `bump-minor-pre-major: true` to ensure feat commits produce minor bumps during pre-1.0 development.

#### Scenario: release-please config has correct settings

**Given** `release-please-config.json` exists
**When** its content is parsed as JSON
**Then** `packages["."]["release-type"]` equals `"node"` and `packages["."]["bump-minor-pre-major"]` equals `true`

### Requirement: Existing tests SHALL remain unchanged and green

All 607 existing tests SHALL pass without modification. The existing teeth in `src/package.test.ts` (package name = "aozu" and dependencies empty) SHALL continue to pass.

#### Scenario: existing test count is preserved

**Given** the test suite runs with `bun test`
**When** all tests complete
**Then** at least 607 tests pass and 0 tests fail
