# Spec: binary-distribution

## Requirements

### Requirement: Version output SHALL work identically in source execution and compiled binary

The CLI SHALL return the same version string (matching `package.json` version) whether invoked as `bun src/cli/main.ts --version` (source execution) or as a compiled binary `./aozu --version`. The version module SHALL check for a compile-time constant first and fall back to runtime `package.json` reading.

#### Scenario: Source execution returns package.json version

**Given** aozu is executed from source via `bun src/cli/main.ts --version`
**When** the version handler runs
**Then** stdout contains exactly the version from `package.json`, and exit code is 0

#### Scenario: Compiled binary returns injected version

**Given** aozu is compiled with `bun build --compile --define 'globalThis.__AOZU_VERSION="X.Y.Z"'`
**When** the compiled binary is invoked with `--version`
**Then** stdout contains exactly `X.Y.Z`, and exit code is 0

#### Scenario: Compiled binary --help exits 0

**Given** aozu is compiled with `bun build --compile`
**When** the compiled binary is invoked with `--help`
**Then** exit code is 0

### Requirement: Publish workflow SHALL compile 5 target binaries and attach to GitHub Release

The publish workflow SHALL contain a job that builds standalone executables for all 5 supported targets (`bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-windows-x64`) and uploads them to the corresponding GitHub Release. This job SHALL have `contents: write` permission and SHALL be separate from the npm publish job.

#### Scenario: Workflow YAML contains compile matrix for all 5 targets

**Given** the file `.github/workflows/publish.yml` exists
**When** its content is inspected
**Then** it contains `bun build --compile` and all 5 target strings (`bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-windows-x64`)

#### Scenario: Workflow YAML contains gh release upload

**Given** the file `.github/workflows/publish.yml` exists
**When** its content is inspected
**Then** it contains `gh release upload`

#### Scenario: Binary build job has contents write permission

**Given** the file `.github/workflows/publish.yml` exists
**When** its content is inspected
**Then** the binary build job declares `contents: write` in its permissions

#### Scenario: npm publish job retains minimal permissions

**Given** the file `.github/workflows/publish.yml` exists
**When** its content is inspected
**Then** the npm publish job declares `contents: read` and `id-token: write` in its permissions (no `contents: write`)

### Requirement: install.sh SHALL detect OS/arch and download the correct binary

The installer script SHALL detect the operating system and CPU architecture, download the matching binary from the latest GitHub Release, and place it in `~/.local/bin/aozu`. The script SHALL handle `darwin`/`linux` OS and `arm64`/`x64` architectures.

#### Scenario: install.sh contains OS detection

**Given** the file `install.sh` exists at the repository root
**When** its content is inspected
**Then** it contains `uname -s` (or equivalent) and branches for `darwin` and `linux`

#### Scenario: install.sh contains architecture detection

**Given** the file `install.sh` exists at the repository root
**When** its content is inspected
**Then** it contains `uname -m` (or equivalent) and branches for `arm64`/`aarch64` and `x86_64`/`x64`

#### Scenario: install.sh performs version verification

**Given** the file `install.sh` exists at the repository root
**When** its content is inspected
**Then** it contains `aozu --version` as a post-install verification step

### Requirement: Existing npm packaging and tests SHALL remain unaffected

Changes to version handling and workflow files SHALL NOT break the existing npm publish path, tarball contents, or test suite.

#### Scenario: npm pack tarball content is unchanged

**Given** the packaging changes are applied
**When** `npm pack --json --dry-run` is run
**Then** the tarball contains the same files as before (package.json, README.md, LICENSE, src/)

#### Scenario: All existing tests pass

**Given** the version module refactoring is applied
**When** `tsc --noEmit && bun test` is run
**Then** all tests pass and exit code is 0

#### Scenario: dependencies remains empty

**Given** `package.json` exists
**When** the `dependencies` field is inspected
**Then** it is an empty object `{}`
