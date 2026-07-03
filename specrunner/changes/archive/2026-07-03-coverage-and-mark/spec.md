# Spec: coverage / mark implemented

## Requirements

### Requirement: writeDesignState SHALL produce spec §9 compliant output

`writeDesignState(designDir, stateMap)` SHALL write state.json with keys in lexicographic order, one entry per line, and values serialized as standard JSON.

#### Scenario: round-trip with readDesignState

**Given** a StateMap with entries `{ "mod-cli": { state: "implemented", request: "r1", pr: 42 }, "ent-order": { state: "requested", request: "r2" } }`
**When** writeDesignState writes the map and readDesignState reads it back
**Then** the read result is identical to the original map

#### Scenario: lexicographic key order

**Given** a StateMap with keys `"mod-cli"`, `"ent-order"`, `"act-user"`
**When** writeDesignState writes the map
**Then** the output file has keys in order `"act-user"`, `"ent-order"`, `"mod-cli"`

#### Scenario: one entry per line

**Given** a StateMap with 3 entries
**When** writeDesignState writes the map
**Then** each entry occupies exactly one line (opening `{` on line 1, entries on lines 2-4, closing `}` on line 5)

### Requirement: coverage SHALL verify draft coverage of group elements

`aozu coverage --group <grp-id> --draft <path> --request <slug>` SHALL verify that all elements listed in the plan group are cited via `[[id]]` in the draft document, excluding code fences and inline code (spec §6).

#### Scenario: full coverage passes and transitions to requested

**Given** a plan group with elements `[[ent-order]]`, `[[inv-3]]` all in designed state, and a draft citing both `[[ent-order]]` and `[[inv-3]]`
**When** coverage is run
**Then** exit code is 0, and state.json shows both elements as requested with the given slug

#### Scenario: missing citation fails without state change

**Given** a plan group with elements `[[ent-order]]`, `[[inv-3]]`, and a draft citing only `[[ent-order]]`
**When** coverage is run
**Then** exit code is 1, the diagnostic names `inv-3` as uncovered, and state.json is unchanged

#### Scenario: code fence citations are excluded

**Given** a draft where `[[ent-order]]` appears only inside a code fence
**When** coverage is run for a group containing `ent-order`
**Then** exit code is 1 (ent-order is uncovered)

### Requirement: coverage SHALL reject non-designed elements (adr/0018-4)

Coverage SHALL fail (exit 1) if any element in the group has state `requested` or `implemented`. This enforces "an element belongs to at most one request at a time".

#### Scenario: group contains a requested element

**Given** a plan group with `[[ent-order]]` in requested state
**When** coverage is run
**Then** exit code is 1, state.json is unchanged

#### Scenario: group contains an implemented element

**Given** a plan group with `[[mod-cli]]` in implemented state
**When** coverage is run
**Then** exit code is 1, state.json is unchanged

### Requirement: coverage SHALL warn on cross-group reference edges without after

Coverage SHALL emit a warning diagnostic to stderr when a reference edge crosses group boundaries and the two groups are not connected by an `after:` constraint. This warning SHALL NOT cause failure — if coverage is otherwise satisfied, exit code SHALL be 0.

#### Scenario: cross-group edge without after emits warning but passes

**Given** two groups grp-a and grp-b, element `[[ent-order]]` in grp-a references `[[inv-3]]` in grp-b, and no `after:` between them, with full draft coverage
**When** coverage is run for grp-a
**Then** exit code is 0 (coverage satisfied), and stderr contains a warning about the cross-group edge

### Requirement: mark implemented SHALL conform to spec/integration.md §2

`aozu mark implemented --request <slug>` SHALL transition all requested elements matching the slug to implemented. It SHALL be idempotent: re-running after all elements are implemented yields exit 0.

#### Scenario: normal transition with --pr

**Given** state.json has `ent-order` and `inv-3` as requested with slug `my-req`
**When** `mark implemented --request my-req --pr 42` is run
**Then** exit code is 0, both elements are implemented with pr: 42

#### Scenario: idempotent re-run

**Given** state.json has `ent-order` and `inv-3` as implemented with slug `my-req`
**When** `mark implemented --request my-req` is run
**Then** exit code is 0, state.json is unchanged

#### Scenario: unknown slug

**Given** state.json has no entries with slug `unknown-req`
**When** `mark implemented --request unknown-req` is run
**Then** exit code is 1

#### Scenario: mixed states — only requested transitions

**Given** `ent-order` is requested with slug `my-req`, `inv-3` is implemented with slug `my-req`
**When** `mark implemented --request my-req` is run
**Then** exit code is 0, `ent-order` transitions to implemented, `inv-3` remains unchanged

### Requirement: coverage and mark SHALL require loop layer

Both commands SHALL exit 1 when the loop layer is not enabled in the manifest. No state changes SHALL occur.

#### Scenario: coverage with loop disabled

**Given** manifest does not include loop in enabled
**When** coverage is run
**Then** exit code is 1, state.json is unchanged

#### Scenario: mark with loop disabled

**Given** manifest does not include loop in enabled
**When** mark implemented is run
**Then** exit code is 1

### Requirement: openTopics SHALL use computed derivation from ADR topics frontmatter

`status` command SHALL determine open topics by checking which `top-*` elements are NOT cited in any ADR's `topics:` frontmatter value. The frontmatter `status` field SHALL NOT be consulted.

#### Scenario: topic cited in ADR topics is not open

**Given** topic `top-perf` and ADR with `topics: [[top-perf]]` in frontmatter
**When** status is run
**Then** `top-perf` does not appear in the Open Topics list

#### Scenario: topic not cited is open regardless of status frontmatter

**Given** topic `top-perf` with `status: addressed` in its own frontmatter, but no ADR cites it in `topics:`
**When** status is run
**Then** `top-perf` appears in the Open Topics list

### Requirement: scaffold topic template SHALL NOT include status field

The `topicTemplate` function SHALL generate a topic frontmatter without a `status` line, conforming to spec §8.

#### Scenario: generated topic has no status line

**Given** a scaffold topic command
**When** the template is generated
**Then** the output frontmatter contains `id:` but does not contain `status:`
