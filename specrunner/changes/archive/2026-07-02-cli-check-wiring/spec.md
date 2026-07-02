# Spec: cli-check-wiring

## Requirements

### Requirement: CLI SHALL dispatch commands via a self-contained registry

The CLI SHALL resolve the first positional argument as a command name, look it up in an internal registry, and delegate to the matched handler. Unknown commands SHALL cause an error message on stderr and exit 2. When no command is given, the CLI SHALL print usage to stderr and exit 0.

#### Scenario: known command dispatches to handler

**Given** the CLI is invoked with `aozu check`
**When** the registry contains a handler for `check`
**Then** the `check` handler is invoked with the remaining arguments

#### Scenario: unknown command prints error

**Given** the CLI is invoked with `aozu foobar`
**When** `foobar` is not a registered command
**Then** an error message is written to stderr and exit code is 2

#### Scenario: no command prints usage

**Given** the CLI is invoked with `aozu` (no arguments)
**When** the registry is consulted
**Then** usage text is written to stderr and exit code is 0

### Requirement: `aozu check` SHALL run closure verification on a design directory

The `check` command SHALL read all `.md` files from the design directory (default `./design`, overridable via `--dir <path>`), parse them, build the reference graph, load state.json, run `runCheck`, and output diagnostics to stderr in the contract format. Exit code SHALL be 0 when no violations exist, 1 when violations exist, and 2 when the design directory or manifest is missing.

#### Scenario: self-check on this repository yields exit 0

**Given** the current repository with `design/` containing a valid closure
**When** `aozu check` is invoked (or `aozu check --dir design`)
**Then** exit code is 0 and stderr has no diagnostic output

#### Scenario: violations produce exit 1 with contract-format diagnostics on stderr

**Given** a design directory fixture containing a closure violation
**When** `aozu check --dir <fixture>` is invoked
**Then** exit code is 1 and stderr contains lines in the format `<LEVEL> <CODE> <id> <message> (<file>:<line>)`

#### Scenario: missing design directory produces exit 2

**Given** `--dir` points to a non-existent directory
**When** `aozu check --dir /nonexistent` is invoked
**Then** exit code is 2 and an error message is written to stderr

#### Scenario: stdout remains empty

**Given** any invocation of `aozu check`
**When** the command completes
**Then** stdout is empty (all output goes to stderr)

### Requirement: `aozu check --request` SHALL validate request document citations

The `check --request <path>` mode SHALL extract `[[id]]` references from the request document (applying code fence and inline code exclusions per spec/format.md §6), then verify: (a) every cited ID resolves to an existing element in the design directory, and (b) every cited element's state is `designed` or `requested` (not solely `implemented`). Exit code SHALL be 0 for pass, 1 for fail, 2 for input error (file not found, design directory missing).

#### Scenario: valid citations produce exit 0

**Given** a request document citing `[[mod-parse]]` and `[[mod-graph]]` which exist in the design directory, and state.json has no entries (all designed)
**When** `aozu check --request <path>` is invoked
**Then** exit code is 0

#### Scenario: non-existent citation produces exit 1

**Given** a request document citing `[[mod-nonexistent]]` which does not exist in the design directory
**When** `aozu check --request <path>` is invoked
**Then** exit code is 1 and stderr reports the unresolved citation

#### Scenario: request file not found produces exit 2

**Given** `--request` points to a non-existent file
**When** `aozu check --request /nonexistent.md` is invoked
**Then** exit code is 2

#### Scenario: citation in code fence is excluded

**Given** a request document where `[[mod-parse]]` appears only inside a code fence
**When** `aozu check --request <path>` is invoked
**Then** the citation is not extracted (zero citations, treated as pass unless `--require-citation`)

### Requirement: `--require-citation` SHALL reject zero citations

When `--require-citation` is specified with `check --request`, the command SHALL fail (exit 1) if the request document contains zero `[[id]]` citations after code exclusion.

#### Scenario: zero citations with --require-citation

**Given** a request document with no `[[id]]` citations
**When** `aozu check --request <path> --require-citation` is invoked
**Then** exit code is 1 and stderr reports that no citations were found

#### Scenario: zero citations without --require-citation

**Given** a request document with no `[[id]]` citations
**When** `aozu check --request <path>` is invoked (without `--require-citation`)
**Then** exit code is 0 (zero citations is acceptable)

### Requirement: `check --request` SHALL reject citations to implemented-only elements

Per contract §1 (b), the command SHALL verify that each cited element's state is `designed` or `requested`. An element whose state is `implemented` SHALL produce a diagnostic and contribute to exit 1.

#### Scenario: implemented-only citation produces exit 1

**Given** a request document citing `[[mod-cli]]`, and state.json contains `{"mod-cli": {"state": "implemented", "request": "prev", "pr": 1}}`
**When** `aozu check --request <path>` is invoked
**Then** exit code is 1 and stderr reports that `mod-cli` is in implemented state

#### Scenario: designed element citation passes

**Given** a request document citing `[[mod-parse]]`, and state.json has no entry for `mod-parse` (defaults to designed)
**When** `aozu check --request <path>` is invoked
**Then** exit code is 0

#### Scenario: requested element citation passes

**Given** a request document citing `[[mod-graph]]`, and state.json contains `{"mod-graph": {"state": "requested", "request": "some-slug"}}`
**When** `aozu check --request <path>` is invoked
**Then** exit code is 0

### Requirement: state.json reader SHALL return an empty map when the file is absent

The state reader in `src/state/` SHALL return an empty `StateMap` when `design/state.json` does not exist, causing all elements to be treated as `designed`. When the file exists, it SHALL parse it as JSON and return the entries.

#### Scenario: state.json absent

**Given** no `state.json` file exists in the design directory
**When** `readState(path)` is called
**Then** an empty `StateMap` is returned

#### Scenario: state.json present

**Given** a `state.json` file with entries `{"mod-cli": {"state": "implemented", "request": "x", "pr": 1}}`
**When** `readState(path)` is called
**Then** a `StateMap` containing the entry for `mod-cli` is returned

### Requirement: diagnostics SHALL be written to stderr, never stdout

Per contract §5, all diagnostic output SHALL go to stderr. The `check` command produces no artifacts, so stdout SHALL always be empty. This separation SHALL be verifiable in tests.

#### Scenario: stderr/stdout separation

**Given** any `aozu check` invocation that produces diagnostics
**When** stdout and stderr are captured separately
**Then** stdout is empty and stderr contains the diagnostic lines
