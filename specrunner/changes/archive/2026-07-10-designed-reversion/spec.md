# Spec: designed への戻りの実装

## Requirements

### Requirement: mark implemented はハッシュを記録する

mark implemented SHALL record the SHA-256 hex hash of each element's body range in the `hash` field of the state entry upon transitioning from requested to implemented. The body range for heading elements is defined as lines from the declaration line through the line before the next element declaration in the same file (or end of file). The body range for document elements is the entire file content (including frontmatter). If the element's body cannot be resolved from the design files, the `hash` field SHALL be omitted and the transition SHALL proceed.

#### Scenario: Hash is recorded on transition

**Given** a design directory with element `ent-order` declared at line 5 of `domain/model.md`, in state `requested` with request slug `order-rework`
**When** `aozu mark implemented order-rework` is executed
**Then** `state.json` contains an entry for `ent-order` with `state: "implemented"` and `hash` being a 64-character lowercase hex string

#### Scenario: Hash matches heading element body range (includes declaration line)

**Given** a heading element `ent-order` declared at line 5 of `domain/model.md`, with the next element `ent-billing` declared at line 12
**When** mark implemented records the hash for `ent-order`
**Then** the hash equals SHA-256 hex of lines 5–11 (the declaration line `## 受注 {#ent-order}` through the line before `## 請求 {#ent-billing}`) of `domain/model.md`

#### Scenario: End-of-file element range extends to EOF

**Given** a heading element `ent-last` is the last element declared in `domain/model.md`
**When** mark implemented records the hash for `ent-last`
**Then** the hash covers from `ent-last`'s declaration line through the end of the file

#### Scenario: Document element hashes entire file

**Given** a document element `seq-intake` declared via frontmatter in `dynamic/intake.md`
**When** mark implemented records the hash for `seq-intake`
**Then** the hash equals SHA-256 hex of the entire content of `dynamic/intake.md` (frontmatter included)

#### Scenario: Unresolvable element omits hash

**Given** a state entry for element `ent-deleted` in requested state but no corresponding element declaration exists in design files
**When** mark implemented transitions `ent-deleted` to implemented
**Then** the entry has `state: "implemented"` and `request` but no `hash` field, and exit code is 0

### Requirement: mark の冪等 no-op は state.json を変更しない

mark implemented SHALL NOT modify state.json when all matching elements are already implemented. In particular, it SHALL NOT add or update `hash` fields on existing implemented entries during a no-op execution.

#### Scenario: No-op does not change state.json

**Given** all elements with request slug `order-rework` are already in `implemented` state (some with `hash`, some without)
**When** `aozu mark implemented order-rework` is executed
**Then** state.json content is byte-identical before and after execution, and exit code is 0

### Requirement: check は乖離要素に S1 warning を出す

check SHALL emit a `WARN S1` diagnostic for each implemented element whose recorded `hash` does not match the SHA-256 of its current body range. The S1 diagnostic SHALL NOT cause a non-zero exit code by itself. When S1 warnings exist without any error-level diagnostics, exit code SHALL be 0.

#### Scenario: Body change triggers S1 warning with exit 0

**Given** element `ent-order` is implemented with a recorded hash
**When** one character is added to `ent-order`'s body text and `aozu check` is executed
**Then** stderr contains a line matching `WARN S1 ent-order` with the element's file and line, and exit code is 0 (assuming no other error diagnostics)

#### Scenario: Whitespace-only change triggers S1

**Given** element `ent-order` is implemented with a recorded hash
**When** a trailing space is appended to a line within `ent-order`'s body range and `aozu check` is executed
**Then** stderr contains `WARN S1 ent-order` (no normalization — exact match)

#### Scenario: S1 warning does not override error exit code

**Given** element `ent-order` has a drifted hash (S1 warning) AND there is also a C3 reference resolution error
**When** `aozu check` is executed
**Then** exit code is 1 (from C3 error) and stderr contains both the C3 error line and the S1 warning line

#### Scenario: Hash-less implemented entry produces no S1

**Given** element `mod-cli` is in implemented state without a `hash` field (pre-existing entry from before this feature)
**When** `aozu check` is executed with no other issues
**Then** no S1 diagnostic is emitted for `mod-cli`, and exit code is 0

#### Scenario: Matching hash produces no S1

**Given** element `ent-order` is implemented with a recorded hash that matches the current body
**When** `aozu check` is executed
**Then** no S1 diagnostic is emitted for `ent-order`

#### Scenario: Loop disabled suppresses S1

**Given** loop is not enabled in the manifest AND state.json contains implemented entries with `hash` fields
**When** `aozu check` is executed
**Then** no S1 diagnostic is emitted and exit code is 0 (assuming no other error diagnostics)

#### Scenario: Graph-unresolvable entry is skipped by S1

**Given** state.json contains an implemented entry with a `hash` for element `ent-ghost` that no longer exists in the design documents
**When** `aozu check` is executed
**Then** no S1 diagnostic is emitted for `ent-ghost` (the stale entry itself is reported by C8), and check completes without crashing

### Requirement: check --request は有効状態で R2 を判定する

check --request SHALL evaluate the R2 rule (implemented elements cannot be cover-cited) using the effective state. An implemented element with a drifted hash (body modified since mark) SHALL be treated as designed, allowing it to be cited as a cover citation.

#### Scenario: Drifted element passes R2

**Given** element `ent-order` is implemented with a `hash` that does not match the current body
**When** a request document contains `[[ent-order]]` as a cover citation and `aozu check --request <path>` is executed
**Then** exit code is 0 (no R2 error for `ent-order`)

#### Scenario: Hash-less implemented element blocks R2

**Given** element `mod-cli` is implemented without a `hash` field
**When** a request document contains `[[mod-cli]]` as a cover citation and `aozu check --request <path>` is executed
**Then** exit code is 1 with R2 error for `mod-cli`

#### Scenario: Non-drifted implemented element blocks R2

**Given** element `ent-order` is implemented with a `hash` that matches the current body
**When** a request document contains `[[ent-order]]` as a cover citation and `aozu check --request <path>` is executed
**Then** exit code is 1 with R2 error for `ent-order`

### Requirement: status は乖離要素を Designed フロンティアに注記つきで表示する

status SHALL display drifted implemented elements (hash mismatch) in the Designed frontier with an annotation indicating body drift. Non-drifted designed elements SHALL appear without annotation.

#### Scenario: Drifted element appears in Designed frontier with annotation

**Given** element `ent-order` is implemented with a `hash` that does not match the current body, and loop is enabled
**When** `aozu status` is executed
**Then** stdout contains `ent-order` in the `## Designed` section with a drift annotation (e.g., `(drift: 実装時記録から本文が乖離)`)

#### Scenario: Non-drifted designed element has no annotation

**Given** element `ent-billing` has no state entry (designed by default)
**When** `aozu status` is executed
**Then** `ent-billing` appears in the `## Designed` section without any annotation

### Requirement: coverage は有効状態で WRONG_STATE を判定する

coverage SHALL evaluate the WRONG_STATE check using effective state. A drifted implemented element SHALL be treated as designed, allowing it to pass the state check and be transitioned to requested. The new requested entry SHALL NOT carry the old `hash` field.

#### Scenario: Drifted element passes coverage and transitions to requested

**Given** element `ent-order` is implemented with a drifted hash, and `ent-order` belongs to plan group `grp-rework`, and the draft document cites `[[ent-order]]`
**When** `aozu coverage --group grp-rework --draft <path> --request new-rework` is executed
**Then** coverage passes (exit 0), `ent-order` transitions to state `requested` with request `new-rework`, and the new entry has no `hash` field

#### Scenario: Hash-less implemented element blocks coverage

**Given** element `mod-cli` is implemented without a `hash` field, and belongs to plan group `grp-rework`
**When** `aozu coverage --group grp-rework --draft <path> --request new-rework` is executed
**Then** coverage fails with WRONG_STATE error for `mod-cli` (exit 1)

### Requirement: mark と check のハッシュは共有ヘルパで一致する

The hash computation for mark and check SHALL use the same `computeElementHash` function from src/graph/body.ts. The function SHALL produce identical hashes for the same element content regardless of the calling context.

#### Scenario: Hash equality for heading element in multi-element file

**Given** a heading element `ent-order` in a file with multiple elements
**When** mark computes the hash during transition AND check later computes the current hash for S1 evaluation (element body unchanged)
**Then** both hashes are identical (same 64-character hex string)

#### Scenario: Hash equality for end-of-file element

**Given** a heading element `ent-last` that is the last element in its file
**When** mark computes the hash AND check later computes the hash (body unchanged)
**Then** both hashes are identical

#### Scenario: Hash equality for document element

**Given** a document element `seq-intake`
**When** mark computes the hash AND check later computes the hash (file unchanged)
**Then** both hashes are identical

### Requirement: writer のフィールド順は state, request, pr, hash

The state writer SHALL serialize each entry's fields in the order: `state`, `request`, `pr`, `hash`. Absent optional fields SHALL be omitted (not written as null/undefined). This order SHALL be guaranteed regardless of the input object's property enumeration order.

#### Scenario: Hash field appears after pr

**Given** a state entry `{ state: "implemented", request: "slug", pr: 123, hash: "abc...64hex" }`
**When** written to state.json by `writeDesignState`
**Then** the JSON for that entry reads `{"state":"implemented","request":"slug","pr":123,"hash":"abc...64hex"}`

#### Scenario: Entry without hash omits the field

**Given** a state entry `{ state: "requested", request: "slug" }` with no pr and no hash
**When** written to state.json
**Then** the JSON reads `{"state":"requested","request":"slug"}` with no `hash` or `pr` key
