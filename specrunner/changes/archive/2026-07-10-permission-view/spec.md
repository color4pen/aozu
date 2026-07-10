# Spec: permission-view

## Requirements

### Requirement: SUPPORTED_VIEW_TYPES SHALL gate C6 two-phase dispatch

C6 SHALL distinguish supported and unsupported view types. Supported view types (currently `{"permission"}`) SHALL be validated by their type-specific link obligation rules. Unsupported view types in `enabled` SHALL produce an error diagnostic with code "C6" (current behavior preserved).

#### Scenario: permission enabled triggers perm link validation, not blanket error

**Given** a manifest with `enabled: static, domain, permission`
**When** checkC6 is invoked
**Then** C6 does not produce the "unsupported view type" error for "permission"; instead it validates perm elements' link obligations

#### Scenario: unsupported view type still produces C6 error

**Given** a manifest with `enabled: static, screen`
**When** checkC6 is invoked
**Then** C6 produces an error diagnostic containing "unsupported view type" for "screen"

### Requirement: LAYER_PREREQUISITES for permission SHALL be domain

The prerequisite for the `permission` type SHALL be `["domain"]`, not `["static"]`. C7 reads LAYER_PREREQUISITES and enforces this automatically.

#### Scenario: permission enabled without domain triggers C7

**Given** a manifest with `enabled: static, permission`
**When** checkC7 is invoked
**Then** a C7 diagnostic reports that "permission" requires "domain"

#### Scenario: permission enabled with domain satisfies C7

**Given** a manifest with `enabled: static, domain, permission`
**When** checkC7 is invoked
**Then** no C7 diagnostic is produced for "permission"

### Requirement: structured-lines SHALL recognize perm operation lines and target lines

The parser SHALL recognize two new structured line forms:
- Operation line: `- <operation>: [[act-id]](, [[act-id]])*` where operation is a token without whitespace or `:`
- Target line: `対象: [[<id>]]`

Parse results SHALL be available in ParseResult and Graph for downstream consumers.

#### Scenario: operation line parsed correctly

**Given** a file containing `- create: [[act-admin]], [[act-manager]]`
**When** extractStructuredLines is invoked
**Then** the result contains an operation entry with operation "create" and actorIds ["act-admin", "act-manager"]

#### Scenario: target line parsed correctly

**Given** a file containing `対象: [[ent-deal]]`
**When** extractStructuredLines is invoked
**Then** the result contains a target entry with targetId "ent-deal"

#### Scenario: operation line inside code fence is ignored

**Given** a file containing an operation line inside a code fence
**When** extractStructuredLines is invoked
**Then** no operation entry is produced for that line

### Requirement: C6 perm validation SHALL enforce non-empty operations, uniqueness, and act prefix

When permission is a supported enabled view type, C6 SHALL validate each perm element:
(a) At least one operation line exists (non-empty obligation)
(b) Operation names are unique within each perm element
(c) All actor references in operation lines have prefix `act`

Reference resolution (whether the act element exists) SHALL NOT be checked by C6; that is C3's responsibility.

#### Scenario: perm element with valid operations passes C6

**Given** a perm element `perm-deal` with operation lines `- create: [[act-admin]]` and `- list: [[act-admin]], [[act-member]]`
**When** checkC6 is invoked with permission enabled
**Then** no C6 diagnostic is produced for `perm-deal`

#### Scenario: perm element with zero operation lines fails C6

**Given** a perm element `perm-empty` with no operation lines
**When** checkC6 is invoked with permission enabled
**Then** a C6 error diagnostic reports that `perm-empty` has no operations

#### Scenario: duplicate operation in same perm fails C6

**Given** a perm element `perm-deal` with two `- create:` operation lines
**When** checkC6 is invoked with permission enabled
**Then** a C6 error diagnostic reports duplicate operation "create" in `perm-deal`

#### Scenario: operation line referencing non-act prefix fails C6

**Given** a perm element `perm-deal` with `- create: [[ent-order]]`
**When** checkC6 is invoked with permission enabled
**Then** a C6 error diagnostic reports that reference `ent-order` is not an act element

#### Scenario: unresolved act reference is NOT reported by C6 (C3's responsibility)

**Given** a perm element with `- create: [[act-nonexistent]]` where `act-nonexistent` does not exist
**When** checkC6 is invoked
**Then** C6 does not produce a diagnostic for `act-nonexistent` (C3 handles resolution)

### Requirement: C11 SHALL restrict views layer reference direction

LAYER_ALLOWED_TARGET_PREFIXES SHALL include a `views` entry. Views elements MAY reference views, static, domain, and dynamic prefixes. Core layer elements (domain, static, dynamic) SHALL NOT reference views prefixes.

#### Scenario: perm referencing act (domain) is allowed

**Given** a perm element referencing `[[act-admin]]`
**When** checkC11 is invoked
**Then** no C11 diagnostic is produced

#### Scenario: perm referencing ent (domain) is allowed

**Given** a perm element referencing `[[ent-order]]`
**When** checkC11 is invoked
**Then** no C11 diagnostic is produced

#### Scenario: domain element referencing perm is forbidden

**Given** an ent element referencing `[[perm-deal]]`
**When** checkC11 is invoked with both domain and permission enabled
**Then** a C11 error diagnostic is produced

### Requirement: getEnabledPrefixes SHALL include supported view type prefixes

When a supported view type is in manifest.enabled, `getEnabledPrefixes` SHALL include that type's prefix in its return set. Unsupported view type prefixes SHALL NOT be included.

#### Scenario: permission enabled includes perm in enabledPrefixes

**Given** a manifest with `enabled: static, domain, permission`
**When** getEnabledPrefixes is called
**Then** the result contains "perm"

#### Scenario: unsupported view type does not add prefix

**Given** a manifest with `enabled: static, screen`
**When** getEnabledPrefixes is called
**Then** the result does not contain "scr"

### Requirement: export permissions SHALL produce spec-compliant JSON

`export permissions` SHALL output JSON conforming to spec/format.md section 11. Output order SHALL be deterministic: permissions sorted by id ascending, operations keys in lexicographic order, act arrays in id ascending order. The `target` field SHALL be included only when a `対象:` line exists.

#### Scenario: valid permission design produces JSON

**Given** a design with permission enabled and perm elements with operation lines
**When** `export permissions` is invoked
**Then** exit code 0 and stdout contains the permissions JSON with deterministic ordering

#### Scenario: permission not enabled returns exit 1

**Given** a design without permission in enabled
**When** `export permissions` is invoked
**Then** exit code 1

#### Scenario: design directory not found returns exit 2

**Given** a non-existent design directory
**When** `export permissions --dir /nonexistent` is invoked
**Then** exit code 2

#### Scenario: --out writes to file

**Given** a valid permission design
**When** `export permissions --out /tmp/perms.json` is invoked
**Then** exit code 0 and the JSON is written to the specified file

### Requirement: perm declarations in non-enabled design SHALL degenerate silently

When permission is not in manifest.enabled, perm element declarations SHALL be treated as "known but disabled type" by C3 degeneration. Check diagnostics SHALL be identical to current behavior.

#### Scenario: perm declaration with permission not enabled

**Given** a design with `enabled: static, domain` and a file containing `{#perm-deal}`
**When** check is run
**Then** no diagnostic mentioning perm-deal is produced (degeneration)

### Requirement: aozu self-hosting check SHALL remain unchanged

The design/ directory of aozu itself (enabled: static, domain, dynamic) SHALL produce zero check diagnostics after this change.

#### Scenario: design/ self-check

**Given** aozu's own design/ directory
**When** runCheck is invoked
**Then** zero diagnostics are returned
