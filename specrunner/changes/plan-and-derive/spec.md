# Spec: plan / prompt derive

## Requirements

### Requirement: plan SHALL generate a spec-conformant plan document from designed elements

`aozu plan <slug> [--dir <path>]` SHALL enumerate designed elements (identical to the designed frontier computed by `status`) and generate `design/plans/<slug>.md`. The generated file SHALL conform to spec/format.md §8: frontmatter with `id: plan-<slug>` and `status: open`, and a single initial group containing all designed elements in its `elements:` line. No `request:` line SHALL be written (ADR-0018-2).

#### Scenario: plan generates a valid plan file from a fixture with designed elements

**Given** a design directory with loop enabled, containing designed elements `mod-app` and `ent-order`
**When** `aozu plan my-batch --dir <path>` is executed
**Then** `plans/my-batch.md` is created with frontmatter `id: plan-my-batch`, `status: open`, and a group `{#grp-my-batch}` whose `elements:` line contains `[[mod-app]]` and `[[ent-order]]`

#### Scenario: generated plan file does not break check

**Given** a design directory with loop enabled and check exit 0
**When** `aozu plan my-batch --dir <path>` is executed
**Then** `aozu check --dir <path>` still returns exit 0 (C1, C2, C10 are not violated by the new document)

### Requirement: plan SHALL include judgment annotations for reference edges, mod grounding, and requested elements

The generated plan file SHALL include a free-form Markdown section (not interfering with machine-readable lines) containing: (a) reference edges between designed elements, (b) module grounding for each element (which mod owns or references each element), (c) list of currently requested elements (in-flight duplication material). All annotations SHALL be deterministically derived from the reference graph and state.json.

#### Scenario: plan annotations include reference edges between designed elements

**Given** a design directory where designed element `seq-a` references `[[mod-b]]` and both are designed
**When** `aozu plan test --dir <path>` is executed
**Then** the generated plan file contains a reference edge notation showing `seq-a -> mod-b` (or equivalent)

#### Scenario: plan annotations include module grounding

**Given** a design directory with designed element `inv-no-negative` that is referenced from file belonging to `mod-app`
**When** `aozu plan test --dir <path>` is executed
**Then** the generated plan file contains module grounding showing `inv-no-negative` is referenced by `mod-app`

#### Scenario: plan annotations include requested elements list

**Given** a design directory with `ent-order` in state.json as `state: requested, request: order-rework`
**When** `aozu plan test --dir <path>` is executed
**Then** the generated plan file contains a requested elements section listing `ent-order (request: order-rework)`

### Requirement: plan SHALL fail-closed with exit 1 for gate violations

Plan SHALL check the following gates and return exit 1 without writing any file: (a) loop not enabled in manifest, (b) plan file `plans/<slug>.md` already exists, (c) designed elements count is 0.

#### Scenario: plan rejects when loop is not enabled

**Given** a design directory with `enabled: static, domain, dynamic` (no loop)
**When** `aozu plan my-batch --dir <path>` is executed
**Then** exit code is 1, stderr contains a message about loop being required, and no file is created

#### Scenario: plan rejects when slug already exists

**Given** a design directory with loop enabled and existing `plans/my-batch.md`
**When** `aozu plan my-batch --dir <path>` is executed
**Then** exit code is 1, stderr contains a message about existing plan, and the existing file is not modified

#### Scenario: plan rejects when no designed elements exist

**Given** a design directory with loop enabled but all elements are requested or implemented in state.json
**When** `aozu plan my-batch --dir <path>` is executed
**Then** exit code is 1, stderr contains a message about no designed elements, and no file is created

### Requirement: prompt derive SHALL output instruction text to stdout containing all required sections

`aozu prompt derive --group <grp-id> [--dir <path>]` SHALL output to stdout an instruction text containing: (a) request template content delimited by explicit markers, (b) full body text of group target elements, (c) body text of elements within 2 hops in/out in the reference graph, (d) full text of all terms and invariants, (e) citation convention instructing to use `[[id]]` references, (f) output directory path.

#### Scenario: derive output contains all required sections

**Given** a design directory with loop enabled, a plan containing group `grp-my-batch` with elements `[[mod-app]]`, manifest with `request-template` pointing to a valid file, and `request-output-dir` set
**When** `aozu prompt derive --group grp-my-batch --dir <path>` is executed
**Then** stdout contains: template content between delimiters, body of `mod-app`, 2-hop neighbor bodies, all term/inv text, citation convention text mentioning `[[id]]`, and the output directory path

### Requirement: derive SHALL support dual-mode template resolution

When `request-template` is a path to an existing file, derive SHALL read that file's content. When the value is not an existing file, derive SHALL execute it as a shell command and use stdout as the template content.

#### Scenario: derive resolves template from file path

**Given** a manifest with `request-template: templates/request.md` and the file exists relative to design directory
**When** `aozu prompt derive --group grp-test --dir <path>` is executed
**Then** stdout contains the content of `templates/request.md` between template delimiters

#### Scenario: derive resolves template from command execution

**Given** a manifest with `request-template: echo "template from command"` and no file matches that path
**When** `aozu prompt derive --group grp-test --dir <path>` is executed
**Then** stdout contains `template from command` between template delimiters

### Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input

Derive SHALL return exit 2 with diagnostic on stderr for: (a) loop not enabled, (b) `request-template` missing from manifest, (c) `request-output-dir` missing from manifest, (d) plan file not found, (e) specified group ID not found in any plan, (f) group elements that do not resolve to existing elements in the graph.

#### Scenario: derive rejects when request-template is missing

**Given** a manifest with loop enabled but no `request-template` key
**When** `aozu prompt derive --group grp-test --dir <path>` is executed
**Then** exit code is 2 and stderr contains a diagnostic mentioning `request-template`

#### Scenario: derive rejects when request-output-dir is missing

**Given** a manifest with loop enabled and `request-template` set but no `request-output-dir` key
**When** `aozu prompt derive --group grp-test --dir <path>` is executed
**Then** exit code is 2 and stderr contains a diagnostic mentioning `request-output-dir`

#### Scenario: derive rejects when plan file is not found

**Given** a design directory with loop enabled and no plan files
**When** `aozu prompt derive --group grp-nonexistent --dir <path>` is executed
**Then** exit code is 2 and stderr contains a diagnostic about plan not found

#### Scenario: derive rejects when group is not found

**Given** a design directory with a plan file but no group matching `grp-nonexistent`
**When** `aozu prompt derive --group grp-nonexistent --dir <path>` is executed
**Then** exit code is 2 and stderr contains a diagnostic about group not found

### Requirement: derive SHALL NOT write any files or modify state

`aozu prompt derive` SHALL produce output only on stdout and stderr. It SHALL NOT create, modify, or delete any files on the filesystem, and SHALL NOT modify state.json.

#### Scenario: derive produces no file system side effects

**Given** a valid design directory with a plan and group
**When** `aozu prompt derive --group grp-test --dir <path>` is executed
**Then** the filesystem state is identical before and after execution (no new files, no modified files)

### Requirement: spec and integration documents SHALL be updated to reflect new manifest keys

spec/format.md §3 SHALL be updated to document `request-template` and `request-output-dir` as optional manifest keys. spec/integration.md §4 SHALL be updated to specify that the injection point for derive settings is the manifest frontmatter.

#### Scenario: format spec documents new manifest keys

**Given** the spec/format.md file after this change
**When** a reader looks at §3
**Then** `request-template` and `request-output-dir` are documented as optional keys with their semantics

### Requirement: all commands SHALL separate stdout and stderr per spec/integration.md §5

Diagnostics and error messages SHALL go to stderr. Plan's success confirmation SHALL go to stderr. Derive's instruction text SHALL go to stdout.

#### Scenario: plan writes success to stderr, not stdout

**Given** a successful plan generation
**When** the command is run via subprocess
**Then** stdout is empty and stderr contains the success message

#### Scenario: derive writes instruction to stdout, errors to stderr

**Given** a valid derive invocation
**When** the command is run via subprocess
**Then** stdout contains the instruction text and stderr is empty (or contains only diagnostics)
