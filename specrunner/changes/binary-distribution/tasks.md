# Tasks: binary-distribution

## T-01: Create version module with compile-time constant support

- [ ] Create `src/cli/version.ts` that exports an async `getVersion(): Promise<string>` function
- [ ] The function checks `globalThis.__AOZU_VERSION` first (compile-time injected constant)
- [ ] If `globalThis.__AOZU_VERSION` is a non-empty string, return it directly
- [ ] Otherwise, fall back to reading `package.json` version via `Bun.file()` (current logic from `main.ts`)
- [ ] Add a TypeScript declaration for `globalThis.__AOZU_VERSION` (e.g., `declare var __AOZU_VERSION: string | undefined;` in the module or a `.d.ts` file) so `tsc --noEmit` passes
- [ ] Refactor `src/cli/main.ts` lines 41-47: replace the inline `package.json` reading with a call to `getVersion()` from the new module

**Acceptance Criteria**:
- `bun src/cli/main.ts --version` prints the `package.json` version and exits 0 (existing behavior preserved)
- `tsc --noEmit` passes with the new module and global declaration
- The existing test in `src/package.test.ts` ("prints the package.json version and exits 0") continues to pass without modification

## T-02: Add binary smoke test

- [ ] Create `tests/binary.test.ts` with tests that:
  1. Read the version from `package.json`
  2. Run `bun build --compile --define 'globalThis.__AOZU_VERSION="<version>"' src/cli/main.ts --outfile <tmpdir>/aozu` to compile a native binary
  3. Execute the compiled binary with `--help` and assert exit code 0
  4. Execute the compiled binary with `--version` and assert exit code 0 and stdout equals the `package.json` version
- [ ] Clean up the temporary binary in `afterAll`
- [ ] Ensure the test file is excluded from `npm pack` (already covered by existing `files` field in `package.json` which only includes `src`, `README.md`, `LICENSE`)

**Acceptance Criteria**:
- `bun test tests/binary.test.ts` passes: compiled binary `--help` exits 0, `--version` exits 0 and outputs the correct version
- `bun test` (full suite) passes including the new test
- The test is deterministic and self-contained (creates and cleans up its own temp files)

## T-03: Add binary build job to publish workflow

- [ ] Edit `.github/workflows/publish.yml`:
  - Move the top-level `permissions` block into per-job `permissions` declarations
  - The existing `publish` job gets `permissions: { contents: read, id-token: write }`
  - Add a new `build-binaries` job with `permissions: { contents: write }`
  - The `build-binaries` job uses `needs: publish` (runs after successful npm publish)
- [ ] The `build-binaries` job steps:
  1. `actions/checkout@v4` (with the tag ref, same pattern as publish job)
  2. `oven-sh/setup-bun@v2`
  3. Read version from `package.json` (e.g., `jq -r .version package.json`) and set as an env var
  4. Use a matrix strategy with the 5 targets: `bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-windows-x64`
  5. Derive the asset name by stripping the `bun-` prefix from the matrix target: `ASSET="aozu-${TARGET#bun-}"` where `TARGET=${{ matrix.target }}` (e.g. `bun-darwin-arm64` → `aozu-darwin-arm64`; append `.exe` for the windows target). Then run `bun build --compile --target=${{ matrix.target }} --define "globalThis.__AOZU_VERSION='\"$VERSION\"'" src/cli/main.ts --outfile "$ASSET"`. The asset name MUST NOT contain the `bun-` prefix (install.sh constructs URLs as `aozu-${os}-${arch}`)
  6. Upload the binary as a GitHub Actions artifact (for the upload step)
- [ ] Add a final `upload-binaries` job that:
  1. Uses `needs: build-binaries`
  2. Downloads all artifacts
  3. Generates a `SHA256SUMS` file covering all 5 binaries (`sha256sum aozu-* > SHA256SUMS`)
  4. Runs `gh release upload <tag> <all binaries> SHA256SUMS --clobber` to attach to the GitHub Release
  5. Uses `permissions: { contents: write }`

**Acceptance Criteria**:
- `.github/workflows/publish.yml` contains `bun build --compile` and all 5 target triples
- The publish (npm) job has `contents: read` and `id-token: write` only
- The binary build job has `contents: write`
- `gh release upload` is present in the workflow
- The workflow YAML is valid (no syntax errors)

## T-04: Add workflow grep tests

- [ ] Add tests to `tests/packaging.test.ts` (or a new `tests/binary-distribution.test.ts`) that grep `.github/workflows/publish.yml` for:
  1. `bun build --compile` is present
  2. All 5 target triples (`bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-windows-x64`) are present
  3. `gh release upload` is present
  4. `contents: write` is present (in the binary job section)

**Acceptance Criteria**:
- All grep tests pass against the workflow YAML
- The test pattern matches the existing CI workflow grep tests in `tests/packaging.test.ts`

## T-05: Create install.sh

- [ ] Create `install.sh` at the repository root
- [ ] The script must start with `#!/bin/bash` and `set -euo pipefail`
- [ ] Detect OS: `uname -s` mapped to `darwin` or `linux`; abort with error message for unsupported OS
- [ ] Detect architecture: `uname -m` mapped to `arm64` (for `arm64`/`aarch64`) or `x64` (for `x86_64`/`amd64`); abort with error message for unsupported architecture
- [ ] Construct the binary name: `aozu-${os}-${arch}`
- [ ] Fetch the latest release tag from GitHub API: `https://api.github.com/repos/color4pen/aozu/releases/latest`
- [ ] Download the binary: `https://github.com/color4pen/aozu/releases/download/${tag}/${binary_name}`
- [ ] Download `SHA256SUMS` from the same release and verify the downloaded binary's SHA-256 hash (`sha256sum -c` on linux / `shasum -a 256 -c` on darwin, filtered to the target binary); abort with an error message on mismatch
- [ ] Create `~/.local/bin` if it does not exist
- [ ] Place the binary at `~/.local/bin/aozu` and `chmod +x` it
- [ ] Run `~/.local/bin/aozu --version` and print the output as a connectivity check
- [ ] If `~/.local/bin` is not in `$PATH`, print a guidance message suggesting the user add it

**Acceptance Criteria**:
- `install.sh` is a valid bash script with `set -euo pipefail`
- Contains `uname -s` and `uname -m` based OS/arch detection
- Contains branches for `darwin`, `linux`, `arm64`/`aarch64`, `x86_64`
- Contains `aozu --version` post-install verification
- The script is executable (`chmod +x` or has the shebang)

## T-06: Add install.sh validation test

- [ ] Add a test (in `tests/binary-distribution.test.ts` or `tests/packaging.test.ts`) that:
  1. Reads `install.sh` and verifies it contains `uname -s` and `uname -m`
  2. Verifies it contains OS branches (`darwin`, `linux`)
  3. Verifies it contains architecture branches (`arm64` or `aarch64`, and `x86_64` or `x64`)
  4. Verifies it contains `aozu --version`
  5. Verifies it starts with `#!/bin/bash` (or `#!/usr/bin/env bash`)
  6. Verifies it contains `set -euo pipefail` (or equivalent strict mode)

**Acceptance Criteria**:
- All install.sh content validation tests pass
- Tests are grep/content-based (no need to actually execute the script)

## T-07: Add binary smoke step to CI workflow

- [ ] Edit `.github/workflows/ci.yml`: add a `binary-smoke` job that:
  1. Reads version from `package.json`
  2. Compiles the native binary: `bun build --compile --define "globalThis.__AOZU_VERSION='\"$VERSION\"'" src/cli/main.ts --outfile aozu`
  3. Runs `./aozu --help` and asserts exit 0
  4. Runs `./aozu --version` and asserts the output matches the version
- [ ] This runs on every PR and push to main (existing CI trigger)

**Acceptance Criteria**:
- `.github/workflows/ci.yml` contains `bun build --compile`
- The smoke step validates `--help` and `--version` of the compiled binary
- Existing CI steps (type check, test, self-check) are not modified

## T-08: Update README installation section

- [ ] Add a "Single Binary" subsection to the "## 導入" section of `README.md`
- [ ] Include the one-liner: `curl -fsSL https://raw.githubusercontent.com/color4pen/aozu/main/install.sh | bash`
- [ ] Briefly explain the two-channel distribution (npm for JS ecosystem, binary for language-agnostic use)
- [ ] Link to the GitHub Releases page for manual download

**Acceptance Criteria**:
- README.md contains the `curl | bash` install command
- README.md mentions both npm and binary distribution channels
- Existing README content (npm installation instructions) is preserved
