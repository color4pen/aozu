# Spec: prompt-session

## Requirements

### Requirement: prompt session SHALL output a design session instruction to stdout

`aozu prompt session --topic <top-id> [--dir <path>]` SHALL read the design directory, locate the topic, assemble context from the reference graph, and write the session instruction text to stdout. The command SHALL NOT write any files.

#### Scenario: Topic with citations produces full instruction

**Given** a design directory with loop enabled, a topic `top-my-topic` whose body contains `[[ent-order]]`, and elements ent-order, inv-order-valid (referenced by ent-order), term-status, mod-core, mod-cli
**When** `aozu prompt session --topic top-my-topic --dir <design-dir>` is executed
**Then** exit code is 0, and stdout contains all of: the topic body, the seed element body (ent-order), the 2-hop neighborhood body (inv-order-valid), term/inv full text, static modules summary, enabled layers, format rules summary, and session guidance

#### Scenario: Topic with no citations produces reduced instruction

**Given** a design directory with loop enabled, a topic `top-greenfield` whose body contains no `[[id]]` citations
**When** `aozu prompt session --topic top-greenfield --dir <design-dir>` is executed
**Then** exit code is 0, and stdout contains: the topic body, a placeholder for seed elements, a placeholder for neighborhood elements, term/inv full text, static modules summary, enabled layers, format rules summary, and session guidance

### Requirement: prompt session SHALL NOT include bodies beyond 2-hop neighborhood

The injection scope SHALL be bounded: only elements within 2 hops (in/out directions) of the seed elements on the reference graph SHALL have their bodies included. Elements beyond 2 hops SHALL be excluded from the output.

#### Scenario: 3-hop element body is excluded

**Given** a reference chain ent-a → ent-b → ent-c → ent-d, and a topic that cites `[[ent-a]]`
**When** `aozu prompt session --topic <topic-id>` is executed
**Then** stdout contains ent-b body (1-hop) and ent-c body (2-hop), but does NOT contain ent-d body (3-hop)

### Requirement: prompt session SHALL inject term/inv full text regardless of neighborhood

All term and inv elements SHALL be included in the output, regardless of whether they appear in the 2-hop neighborhood. This is the "always-full" injection scope for invariants and vocabulary.

#### Scenario: Disconnected inv appears in output

**Given** an inv element inv-isolated that is not referenced by any seed or neighbor element
**When** `aozu prompt session --topic <topic-id>` is executed
**Then** stdout contains inv-isolated's body in the Terms and Invariants section

### Requirement: prompt session SHALL inject static modules in condensed form

The static modules section SHALL contain only the heading (element ID) and the `責務:` line for each mod element. Full body text (including `実装:` lines and sub-headings) SHALL NOT be included.

#### Scenario: Module summary contains only ID and responsibility

**Given** a mod element mod-core with body "責務: コアロジック\n実装: src/core/\n\n### 詳細\n補足情報"
**When** `aozu prompt session --topic <topic-id>` is executed
**Then** stdout contains "mod-core" and "責務: コアロジック" but does NOT contain "実装: src/core/" or "詳細" or "補足情報" in the Static Modules section

### Requirement: prompt session exit codes SHALL match derive

The exit code contract SHALL be identical to `prompt derive`:
- 0 = instruction written to stdout
- 1 = loop layer not enabled (stage gate)
- 2 = input error (design directory not found, topic not found, missing --topic argument)

#### Scenario: Loop disabled returns exit 1

**Given** a design directory with `enabled: static` (loop not enabled)
**When** `aozu prompt session --topic top-any --dir <design-dir>` is executed
**Then** exit code is 1, and stderr contains a diagnostic about loop

#### Scenario: Topic not found returns exit 2

**Given** a design directory with loop enabled but no topic `top-nonexistent`
**When** `aozu prompt session --topic top-nonexistent --dir <design-dir>` is executed
**Then** exit code is 2, and stderr contains a diagnostic mentioning the topic ID

#### Scenario: Design directory not found returns exit 2

**Given** a nonexistent design directory path
**When** `aozu prompt session --topic top-any --dir /nonexistent` is executed
**Then** exit code is 2, and stderr contains a diagnostic about the directory

### Requirement: prompt session output SHALL be deterministic

Given the same design directory content and topic, the output SHALL be byte-identical across invocations. Element listings SHALL use a deterministic ordering (ID lexicographic sort).

#### Scenario: Repeated invocations produce identical output

**Given** a fixed design directory with a topic
**When** `aozu prompt session --topic <topic-id>` is executed twice
**Then** the stdout of both invocations is byte-identical

### Requirement: Diagnostics SHALL go to stderr only

In the success case (exit 0), stdout SHALL contain only the instruction text and stderr SHALL be empty. In error cases (exit 1 or 2), diagnostics SHALL be written to stderr and stdout SHALL be empty.

#### Scenario: Success case has clean stdout

**Given** a valid design directory with a topic
**When** `aozu prompt session --topic <topic-id>` is executed
**Then** exit code is 0, stdout is non-empty, stderr is empty

#### Scenario: Error case has no stdout

**Given** a design directory where loop is disabled
**When** `aozu prompt session --topic top-any` is executed
**Then** exit code is 1, stdout is empty, stderr is non-empty
