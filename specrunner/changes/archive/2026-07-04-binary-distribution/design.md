# Design: binary-distribution

## Context

ADR-0021 established a two-channel distribution strategy: npm for the JS ecosystem and single-binary via GitHub Releases for language-agnostic consumers. The npm channel is live (`@color4pen/aozu`), but the binary channel is unimplemented. Developers without a JS toolchain cannot install aozu.

Current state:
- `.github/workflows/publish.yml` handles npm publish on `v*` tag push with `contents: read` + `id-token: write` (provenance). Release creation is handled by release-please (`.github/workflows/release-please.yml`)
- `src/cli/main.ts` implements `--version` by reading `package.json` at runtime via `Bun.file()` with `import.meta.url` resolution. This approach fails in compiled binaries because `package.json` is not embedded
- `bun build --compile --target=<triple>` supports cross-compilation for 5 targets: `bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64`, `bun-linux-arm64`, `bun-windows-x64`
- `bun build --compile` accepts `--define` for compile-time constant injection

## Goals / Non-Goals

**Goals**:
- Compile aozu into standalone executables for 5 platforms (macOS arm64/x64, Linux x64/arm64, Windows x64) and automatically attach them to GitHub Releases
- Provide `install.sh` for one-command installation on Unix systems
- Fix `--version` to work in both source execution and compiled binary contexts
- Add CI smoke tests for compiled binaries

**Non-Goals**:
- Homebrew tap, winget, or other package manager integrations (ADR-0021: demand-driven)
- Node API migration (ADR-0021: deferred with explicit triggers)
- Changes to npm publish path (bin, files, publish procedure unchanged)
- Code signing / notarization (separate request if needed)

## Decisions

### D1: Version injection via `--define` with runtime fallback

The `--version` handler currently reads `package.json` at runtime. In compiled binaries, the file is not available. Use `bun build --compile --define 'globalThis.__AOZU_VERSION="<version>"'` to inject the version at compile time.

In source code, introduce a `src/cli/version.ts` module that:
1. Checks for the compile-time constant `globalThis.__AOZU_VERSION`
2. If defined (compiled binary), returns it directly
3. If undefined (source execution via `bun run`), falls back to reading `package.json`

This preserves the current behavior for npm-distributed source execution while enabling compiled binaries to report their version.

**Rationale**: The `--define` approach is the canonical way to inject build-time constants in Bun's bundler. Alternatives — embedding `package.json` in the binary (breaks single-file property) or hardcoding the version in source (diverges from release-please's version management) — were rejected per the architect's evaluation.

### D2: Separate workflow job for binary compilation and release attachment

Add a `build-binaries` job to `publish.yml` that runs after the `publish` (npm) job succeeds. The new job:
- Uses a matrix strategy for the 5 target triples
- Runs on `ubuntu-latest` (Bun cross-compilation does not require native runners)
- Has `contents: write` permission (scoped to the job, not the workflow top-level)
- Reads the version from `package.json` and passes it to `--define`
- Produces binaries named `aozu-<target>` (`aozu-<target>.exe` for Windows)
- Attaches all binaries to the GitHub Release via `gh release upload`

The npm `publish` job retains its current permissions (`contents: read`, `id-token: write`). The top-level workflow permissions are moved to per-job declarations to maintain least privilege.

**Rationale**: Separating jobs isolates the `contents: write` scope from the provenance signing context of npm publish. A single job combining both would grant unnecessary write permissions during the npm publish step.

### D3: install.sh in repository root

Place `install.sh` at the repository root (not `scripts/`) for URL brevity: `curl -fsSL https://raw.githubusercontent.com/color4pen/aozu/main/install.sh | bash`.

The script:
1. Detects OS (`uname -s` → `darwin` / `linux`) and architecture (`uname -m` → `arm64` / `x86_64` → mapped to `arm64` / `x64`)
2. Resolves the latest release tag from the GitHub API (`/repos/color4pen/aozu/releases/latest`)
3. Downloads the matching binary from the release assets
4. Places it in `~/.local/bin/aozu` (creating the directory if needed)
5. Runs `aozu --version` as a connectivity check
6. Prints PATH guidance if `~/.local/bin` is not in `$PATH`

Windows is excluded from install.sh (manual download from Releases page).

**Rationale**: Root placement follows the convention of `bun.sh` and similar tools. `~/.local/bin` is the XDG-aligned user binary location, avoiding `sudo` requirements.

### D4: CI smoke test via native compilation in existing CI workflow

Add a `binary-smoke` job to `ci.yml` that:
1. Builds the native-target binary using `bun build --compile`
2. Runs `./aozu --help` and verifies exit 0
3. Runs `./aozu --version` and verifies exit 0 and output matches `package.json` version

This runs on every PR and push to main, ensuring binary compilation does not regress.

**Rationale**: Testing in CI workflow (not just publish workflow) catches compilation regressions before they reach a release. Only the native target is built (no cross-compilation matrix) to keep CI fast.

### D5: Binary naming convention

Binary names follow the pattern `aozu-<os>-<arch>` matching `bun build --compile --target` triples:
- `aozu-darwin-arm64`
- `aozu-darwin-x64`
- `aozu-linux-x64`
- `aozu-linux-arm64`
- `aozu-windows-x64.exe`

**Rationale**: Aligns with Bun's own target naming convention. The `.exe` suffix for Windows is required for Windows executable recognition.

## Risks / Trade-offs

- [Risk] Binary size is ~60MB per target (Bun runtime is embedded) → Acceptable for a developer tool. ADR-0021 explicitly noted this as within tolerance.
- [Risk] Cross-compilation on `ubuntu-latest` may produce binaries that fail on edge-case native environments → Mitigated by the fact that `bun build --compile` cross-compilation is a supported Bun feature. Smoke test on native CI runner catches regressions for the linux-x64 target.
- [Risk] `globalThis.__AOZU_VERSION` could be inadvertently set by user code → The identifier is sufficiently namespaced (`__AOZU_` prefix) and is only checked in the version module. Risk is negligible.
- [Risk] `install.sh` depends on GitHub API rate limits for unauthenticated requests → 60 req/hr is sufficient for installation. If rate-limited, the error from `curl` will be visible.

## Open Questions

None. All design decisions are derived from ADR-0021 and the architect's evaluated judgments in the request.
