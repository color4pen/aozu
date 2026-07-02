# Spec: init / scaffold / status

## Requirements

### Requirement: init SHALL generate a minimal design directory that passes check

`aozu init [--dir <path>]` SHALL create a design directory at the specified path (default `./design`) containing `manifest.md`, `static/modules.md`, and `static/dependencies.md`. The generated files SHALL conform to spec/format.md §2, §3, §8 such that `aozu check --dir <path>` returns exit 0 immediately after generation.

#### Scenario: init creates a valid design directory in an empty location

**Given** a directory with no `design/` subdirectory  
**When** `aozu init` is executed  
**Then** `design/manifest.md`, `design/static/modules.md`, and `design/static/dependencies.md` are created, and `aozu check --dir design` returns exit 0

#### Scenario: init respects --dir flag

**Given** an empty directory `/tmp/mydesign`  
**When** `aozu init --dir /tmp/mydesign` is executed  
**Then** files are created under `/tmp/mydesign/` (not `./design/`)

### Requirement: init SHALL fail-closed when design directory already exists

When the target design directory already exists, `aozu init` SHALL write nothing and return exit 1.

#### Scenario: init refuses to overwrite existing design directory

**Given** a directory that already contains `design/`  
**When** `aozu init` is executed  
**Then** no files are created or modified, and the exit code is 1

#### Scenario: init refuses even if design directory is partially populated

**Given** a directory containing `design/` with only `manifest.md` (missing `static/`)  
**When** `aozu init` is executed  
**Then** no files are created or modified, and the exit code is 1

### Requirement: scaffold SHALL generate type-conformant template files for document element types

`aozu scaffold <type> <id> [--dir <path>]` SHALL create a file conforming to spec/format.md §8 for the given document element type. Supported types: `topic`, `plan`, `seq`, `adr`.

#### Scenario: scaffold creates a topic file

**Given** a design directory with `enabled: static, domain, dynamic, loop`  
**When** `aozu scaffold topic top-my-feature` is executed  
**Then** `topics/my-feature.md` is created with frontmatter containing `id: top-my-feature` and `status: open`

#### Scenario: scaffold creates a seq file

**Given** a design directory with `enabled: static, domain, dynamic`  
**When** `aozu scaffold seq seq-order-intake` is executed  
**Then** `dynamic/order-intake.md` is created with frontmatter containing `id: seq-order-intake`, `## 登場要素` section, and `## 流れ` section

#### Scenario: scaffold creates an adr file with auto-numbering

**Given** a design directory with no existing adr files  
**When** `aozu scaffold adr adr-0001-my-decision` is executed  
**Then** `adr/0001-my-decision.md` is created with frontmatter containing `id: adr-0001-my-decision`

### Requirement: scaffold SHALL reject invalid inputs with exit 1

Scaffold SHALL validate inputs in order: ID grammar, prefix-type match, manifest enablement, ID collision. Each failure returns exit 1 with a diagnostic on stderr.

#### Scenario: scaffold rejects malformed ID

**Given** a valid design directory  
**When** `aozu scaffold topic INVALID_ID` is executed  
**Then** exit code is 1 and stderr contains an error message about ID grammar

#### Scenario: scaffold rejects ID with wrong prefix for type

**Given** a valid design directory  
**When** `aozu scaffold topic seq-something` is executed  
**Then** exit code is 1 and stderr contains an error about prefix mismatch

#### Scenario: scaffold rejects type disabled in manifest

**Given** a design directory with `enabled: static` (loop not enabled)  
**When** `aozu scaffold topic top-my-feature` is executed  
**Then** exit code is 1 and stderr contains an error about topic type being disabled

#### Scenario: scaffold rejects duplicate ID

**Given** a design directory containing an element with id `seq-order-intake`  
**When** `aozu scaffold seq seq-order-intake` is executed  
**Then** exit code is 1 and stderr contains an error about ID collision

### Requirement: scaffold SHALL guide users for heading element types

When a heading element type (`mod`, `term`, `ent`, `inv`) is specified, scaffold SHALL exit 1 and write a message to stderr indicating which file to edit for manual addition.

#### Scenario: scaffold guides for mod type

**Given** a valid design directory  
**When** `aozu scaffold mod mod-new-module` is executed  
**Then** exit code is 1 and stderr contains a message mentioning `static/modules.md`

### Requirement: status SHALL display three frontiers when loop is enabled

`aozu status [--dir <path>]` SHALL display to stdout: (a) open topics, (b) designed elements (no state.json entry or state=designed), (c) requested elements (with request slug). Output goes to stdout; any diagnostics go to stderr.

#### Scenario: status shows all three frontiers

**Given** a design directory with loop enabled, containing:
  - topic `top-a` with `status: open`, topic `top-b` with `status: addressed`
  - element `mod-x` with no state.json entry (designed)
  - element `mod-y` with `state: requested, request: my-req` in state.json  
**When** `aozu status` is executed  
**Then** stdout contains `top-a` under open topics, `mod-x` under designed elements, `mod-y` with `my-req` under requested elements; `top-b` does not appear under open topics

### Requirement: status SHALL degrade to summary when loop is disabled

When the manifest does not include `loop` in its `enabled` list, status SHALL display only element count, reference count, and check pass/fail.

#### Scenario: status shows summary for static-only project

**Given** a design directory with `enabled: static` and 3 modules  
**When** `aozu status` is executed  
**Then** stdout contains element count, reference count, and check result (OK or FAIL); no frontier sections are displayed

### Requirement: all three commands SHALL maintain stdout/stderr separation

`init`, `scaffold`, and `status` SHALL write diagnostics and errors to stderr. `init` and `scaffold` write success confirmations to stderr. `status` writes its display output to stdout.

#### Scenario: init error goes to stderr

**Given** a directory with existing `design/`  
**When** `aozu init` is executed (via subprocess)  
**Then** stdout is empty and stderr contains the error message

#### Scenario: status output goes to stdout

**Given** a valid design directory  
**When** `aozu status` is executed (via subprocess)  
**Then** the frontier/summary display appears on stdout; any check diagnostics appear on stderr
