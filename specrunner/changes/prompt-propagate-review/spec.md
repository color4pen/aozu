# Spec: prompt propagate / prompt review

## Requirements

### Requirement: The system SHALL output a propagation instruction to stdout when invoked with `prompt propagate --adr <adr-id>`

The CLI SHALL read the design directory, locate the specified ADR element, extract its body and `[[id]]` citations as seeds, compute the 2-hop neighborhood from seeds, assemble the always-full context frame (inv/term full, static mod condensed, enabled layers, format rules summary), and output the complete propagation instruction to stdout. The instruction SHALL include propagation guidance telling the consumer to reflect the decision across all relevant design layers, run check after each reflection, and declare completion when check exits 0 and the decision is consistent across all layers.

#### Scenario: Propagation instruction contains all required sections for an ADR with citations

**Given** a design directory with an ADR element `adr-0001` whose body contains `[[ent-order]]`, and `ent-order` references `[[inv-order-valid]]` (1-hop), and `inv-order-valid` references `[[ent-hop2]]` (2-hop), and `ent-hop2` references `[[ent-hop3]]` (3-hop), and term/inv elements exist, and static mod elements exist
**When** `aozu prompt propagate --adr adr-0001 --dir <design-dir>` is invoked
**Then** exit code is 0, stdout contains: the ADR body text, the seed element body (`ent-order`), the 1-hop neighbor body (`inv-order-valid`), the 2-hop neighbor body (`ent-hop2`), all term/inv bodies, static mod condensed summaries, enabled layers, format rules summary, and propagation guidance text

#### Scenario: 3-hop elements are excluded from propagation instruction

**Given** the same fixture as the previous scenario where `ent-hop3` is at 3 hops from the seed
**When** `aozu prompt propagate --adr adr-0001 --dir <design-dir>` is invoked
**Then** exit code is 0, stdout does NOT contain the body text unique to `ent-hop3`

#### Scenario: ADR with zero citations produces a valid instruction with empty seed/neighborhood placeholders

**Given** a design directory with an ADR element `adr-0002` whose body contains no `[[id]]` citations
**When** `aozu prompt propagate --adr adr-0002 --dir <design-dir>` is invoked
**Then** exit code is 0, stdout contains the ADR body text, seed section contains a placeholder indicating no citations, neighborhood section contains a placeholder indicating no neighbors

### Requirement: The system SHALL reject invalid propagate inputs with exit code 2

The CLI SHALL exit with code 2 and write a diagnostic to stderr when the design directory does not exist, the specified ADR ID does not exist in the graph, or the specified ID has a prefix other than `adr`.

#### Scenario: Non-existent ADR ID exits with code 2

**Given** a valid design directory with no ADR element `adr-nonexistent`
**When** `aozu prompt propagate --adr adr-nonexistent --dir <design-dir>` is invoked
**Then** exit code is 2, stderr contains a diagnostic mentioning `adr-nonexistent`, stdout is empty

#### Scenario: Non-adr prefix ID exits with code 2

**Given** a valid design directory with element `ent-order`
**When** `aozu prompt propagate --adr ent-order --dir <design-dir>` is invoked
**Then** exit code is 2, stderr contains a diagnostic, stdout is empty

#### Scenario: Design directory not found exits with code 2

**Given** a non-existent directory path
**When** `aozu prompt propagate --adr adr-0001 --dir /nonexistent/design` is invoked
**Then** exit code is 2, stderr contains a diagnostic, stdout is empty

### Requirement: The system SHALL NOT impose a loop gate on prompt propagate

The propagate sub-command SHALL succeed (exit 0) when the manifest does not include `loop` in its enabled list, because ADR is an always-layer type that does not require loop enablement.

#### Scenario: propagate succeeds with loop disabled

**Given** a design directory with manifest `enabled: static, domain` (loop not enabled) and an ADR element `adr-0001`
**When** `aozu prompt propagate --adr adr-0001 --dir <design-dir>` is invoked
**Then** exit code is 0, stdout contains the propagation instruction

### Requirement: The system SHALL output a review instruction to stdout when invoked with `prompt review`

The CLI SHALL read the design directory, extract all element bodies in ID lexicographic order, and output a review instruction to stdout. The instruction SHALL include format rules summary and findings format guidance. The guidance SHALL state that check's structural violations (broken references, duplicate IDs, link obligation failures — C1 through C11) are excluded from the review scope, and that verdict (accept/reject) is the human's responsibility.

#### Scenario: Review instruction contains all element bodies and guidance

**Given** a design directory with elements `ent-order`, `inv-order-valid`, `mod-core`, `term-status`
**When** `aozu prompt review --dir <design-dir>` is invoked
**Then** exit code is 0, stdout contains bodies of all four elements in ID lexicographic order, format rules summary text, findings format guidance, and the "check exclusion" directive

#### Scenario: Review instruction explicitly states check violations are out of scope

**Given** a valid design directory
**When** `aozu prompt review --dir <design-dir>` is invoked
**Then** stdout contains text indicating that structural violations detected by check (C1-C11) are not to be included in findings

### Requirement: The system SHALL NOT impose a loop gate on prompt review

The review sub-command SHALL succeed (exit 0) when the manifest does not include `loop` in its enabled list.

#### Scenario: review succeeds with loop disabled

**Given** a design directory with manifest `enabled: static` (loop not enabled) and at least one element
**When** `aozu prompt review --dir <design-dir>` is invoked
**Then** exit code is 0, stdout contains the review instruction

### Requirement: Both propagate and review SHALL produce deterministic output

Given the same design directory state, repeated invocations of `prompt propagate` or `prompt review` SHALL produce byte-identical stdout. Element listings SHALL be in ID lexicographic order. Diagnostics SHALL be written to stderr only. No files SHALL be written to the design directory.

#### Scenario: Deterministic propagate output

**Given** a fixed design directory
**When** `aozu prompt propagate --adr adr-0001 --dir <design-dir>` is invoked twice
**Then** the two stdout outputs are byte-identical, stderr is empty on both runs, and no files are created or modified in the design directory

#### Scenario: Deterministic review output

**Given** a fixed design directory
**When** `aozu prompt review --dir <design-dir>` is invoked twice
**Then** the two stdout outputs are byte-identical, stderr is empty on both runs, and no files are created or modified in the design directory

### Requirement: Shared helper extraction SHALL NOT change session or derive output

The refactoring of common context-assembly logic into shared helpers SHALL preserve byte-identical output of `prompt session` and `prompt derive` for all existing test fixtures. No existing test in `src/prompt/session.test.ts`, `src/prompt/derive.test.ts`, or `src/cli/commands/prompt.test.ts` SHALL be modified.

#### Scenario: Session tests pass without modification after shared extraction

**Given** the shared helpers have been extracted and session handler refactored to use them
**When** `bun test src/prompt/session.test.ts` is run
**Then** all tests pass without any test file modifications

#### Scenario: Derive tests pass without modification after shared extraction

**Given** the shared helpers have been extracted
**When** `bun test src/prompt/derive.test.ts` is run
**Then** all tests pass without any test file modifications
