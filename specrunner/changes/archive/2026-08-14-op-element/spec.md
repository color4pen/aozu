# Spec: op 要素の実装 — op 型の追加と perm 操作行の op 参照化

## Requirements

### Requirement: op prefix SHALL be recognized as a valid domain-layer element type

The system SHALL accept `op` as a known prefix in the ID grammar (C1), resolve `[[op-*]]` references against existing op elements (C3), and apply domain-layer direction rules (C11). op elements SHALL be declarable as heading elements (`## <display-name> {#op-<slug>}`).

#### Scenario: op heading element declaration passes check

**Given** a design with domain layer enabled and a file containing `## 受注を確定する {#op-confirm-order}`
**When** `check` is run
**Then** exit code is 0 and no C1/C2/C3 diagnostics are emitted for `op-confirm-order`

#### Scenario: op reference from domain element resolves without C11 violation

**Given** a design with an op element `op-confirm-order` and an ent element `ent-order` that references `[[op-confirm-order]]` in its body
**When** `check` is run
**Then** exit code is 0 and no C11 diagnostic is emitted (domain-to-domain reference is allowed)

#### Scenario: op reference to static-layer element violates C11

**Given** a design with an op element `op-confirm-order` whose body references `[[mod-cli]]` (static layer)
**When** `check` is run
**Then** exit code is 1 and a C11 error diagnostic is emitted for `op-confirm-order`

#### Scenario: unresolved op reference triggers C3

**Given** a design where `[[op-nonexistent]]` is referenced but no op element with that ID exists
**When** `check` is run
**Then** exit code is 1 and a C3 error diagnostic is emitted for `op-nonexistent`

### Requirement: op target line SHALL support multiple comma-separated references

The system SHALL recognize `対象:` lines under op elements as comma-separated reference lists (`対象: [[id-a]], [[id-b]]`). Each `[[id]]` on the line SHALL be subject to C3 general reference resolution. The op target line SHALL NOT produce an error when multiple references are present.

#### Scenario: op target line with multiple references

**Given** a design with `op-manage-order` containing `対象: [[ent-order]], [[ent-customer]]` and both ent elements exist
**When** `check` is run
**Then** exit code is 0 and no diagnostic is emitted

#### Scenario: op target line with unresolved reference triggers C3

**Given** a design with `op-manage-order` containing `対象: [[ent-order]], [[ent-nonexistent]]` where `ent-nonexistent` does not exist
**When** `check` is run
**Then** exit code is 1 and a C3 error diagnostic is emitted for `ent-nonexistent`

### Requirement: perm target line SHALL reject multiple references as C6 error

The system SHALL enforce perm `対象:` lines to contain exactly one reference (perm schema in spec/format.md §8, made explicit by this change; ADR-0023 does not constrain the reference count of `対象:` lines). A perm `対象:` line with multiple references SHALL produce a C6 error diagnostic with line number. The existing single-reference behavior and diagnostics SHALL remain unchanged.

#### Scenario: perm target line with single reference passes

**Given** a perm element `perm-deal` with `対象: [[ent-deal]]` and a valid operation line
**When** `check` is run
**Then** exit code is 0 and no C6 diagnostic about the target line is emitted

#### Scenario: perm target line with multiple references triggers C6 error

**Given** a perm element `perm-deal` with `対象: [[ent-a]], [[ent-b]]` and a valid operation line
**When** `check` is run
**Then** exit code is 1 and a C6 error diagnostic with the target line's line number is emitted

### Requirement: perm operation line SHALL reference op elements

The system SHALL require perm operation lines to use the format `- [[op-id]]: [[act-id]](, [[act-id]])*`. The op reference MUST resolve to an existing element with prefix `op`. Act references MUST have prefix `act` (existing rule). Op references MUST be unique within a single perm element.

#### Scenario: valid operation line with op and act references

**Given** a perm element with `- [[op-create-deal]]: [[act-admin]]` where `op-create-deal` and `act-admin` exist
**When** `check` is run
**Then** exit code is 0 and no C6 diagnostic is emitted

#### Scenario: unresolved op reference in operation line triggers C6 error

**Given** a perm element with `- [[op-nonexistent]]: [[act-admin]]` where `op-nonexistent` does not exist
**When** `check` is run
**Then** exit code is 1 and a C6 error diagnostic is emitted indicating the op reference is unresolved

#### Scenario: non-op prefix in operation line triggers C6 error

**Given** a perm element with `- [[ent-order]]: [[act-admin]]` where `ent-order` exists but is not an op element
**When** `check` is run
**Then** exit code is 1 and a C6 error diagnostic is emitted indicating the operation reference is not an op element

#### Scenario: duplicate op reference within same perm triggers C6 error

**Given** a perm element with two operation lines both referencing `[[op-create-deal]]`
**When** `check` is run
**Then** exactly one C6 error diagnostic is emitted for the duplicate (no spurious prefix-violation errors)

### Requirement: free-token operation lines SHALL be rejected as malformed (fail-closed)

The system SHALL detect operation lines of the form `- <token>: [[...]]` where `<token>` is not a `[[op-id]]` reference and report them as C6 error diagnostics with line numbers. Malformed operation lines SHALL NOT count toward the non-empty obligation. A perm with only malformed operation lines SHALL produce both the malformed error(s) and a non-empty obligation error.

#### Scenario: free-token operation line triggers error

**Given** a perm element with `- create: [[act-admin]]` (free token, not an op reference)
**When** `check` is run
**Then** exit code is 1 and a C6 error diagnostic is emitted for the malformed operation line

#### Scenario: perm with only malformed lines produces two errors

**Given** a perm element whose only operation-like line is `- create: [[act-admin]]`
**When** `check` is run
**Then** exactly 2 C6 error diagnostics are emitted: one for the malformed line, one for the non-empty obligation

### Requirement: op elements SHALL participate in implementation tracking

The system SHALL include `op` in `IMPLEMENTATION_PREFIXES` so that op elements with `実装:` lines are eligible for mark-implemented, frontier computation, and hash recording.

#### Scenario: op element with implementation line appears in designed frontier

**Given** a design with `op-confirm-order` declared and an `実装:` line, with no state.json entry
**When** frontier computation runs
**Then** `op-confirm-order` appears in the designed frontier

### Requirement: export permissions SHALL use op ID as operation key

The `export permissions` command SHALL output op IDs (e.g., `"op-create-deal"`) as the keys in the `operations` object. Key ordering (lexicographic) and output determinism SHALL be maintained.

#### Scenario: export permissions outputs op ID keys

**Given** a design with perm element `perm-deal` having operation lines `- [[op-create-deal]]: [[act-admin]]` and `- [[op-list-deals]]: [[act-admin]]`
**When** `export permissions` is run
**Then** the output JSON contains `"operations": { "op-create-deal": [...], "op-list-deals": [...] }` with keys in lexicographic order

### Requirement: spec/format.md SHALL reflect op in C11 domain listing and perm target constraint

spec/format.md §10 C11 SHALL list op among domain prefixes. §8 perm SHALL document that `対象:` accepts single reference only and multiple references are a C6 violation. §10 C6 SHALL list the perm target single-reference constraint.

#### Scenario: C11 domain listing includes op

**Given** the current spec/format.md
**When** the C11 row is inspected
**Then** it reads `domain（term / ent / inv / act / op）`

#### Scenario: perm target single-reference constraint is documented

**Given** the current spec/format.md
**When** §8 perm schema and §10 C6 are inspected
**Then** both sections mention the perm `対象:` single-reference constraint

### Requirement: JSDoc and test names SHALL be updated for new grammar

PermOperation JSDoc in src/parse/types.ts SHALL show the new `- [[op-id]]: [[act-id]]` format. The export permissions test previously titled with "spec §8 example" SHALL have the spec §8 reference removed from its name.

#### Scenario: PermOperation JSDoc reflects new grammar

**Given** the source file src/parse/types.ts
**When** the PermOperation interface comment is inspected
**Then** it shows `- [[op-id]]: [[act-id]](, [[act-id]])*`

#### Scenario: export permissions test name updated

**Given** the test file src/export/permissions.test.ts
**When** the test previously named "spec §8 example: perm-deal with list and create" is inspected
**Then** the test name no longer references "spec §8"
