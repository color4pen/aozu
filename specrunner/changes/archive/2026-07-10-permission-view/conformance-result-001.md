# Conformance Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:   implementation conforms to tasks.md, design.md, spec.md, and request.md
  - needs-fix:  one or more upstream artifacts are not satisfied by the implementation
  - escalation: conformance cannot be determined (missing artifacts, unresolvable ambiguity)
- The Findings table records the per-artifact judgment.
-->

- **verdict**: approved

## Conformance Findings

| Artifact | Conforms | Notes |
|----------|----------|-------|
| tasks.md | ✅ yes | All 15 tasks (T-01〜T-15) have every checkbox marked [x]. No incomplete items. |
| design.md | ✅ yes | All design decisions D1–D7 correctly implemented. See detail below. |
| spec.md | ✅ yes | All Requirements (SHALL/MUST) and Scenarios satisfied. See detail below. |
| request.md | ✅ yes | All 9 acceptance criteria met. `tsc --noEmit` clean; 858 tests pass, 0 fail. |

---

## Detail: Task Completeness

All 15 tasks have all checkboxes checked:

- T-01 `LAYER_PREREQUISITES` permission → `["domain"]` ✅
- T-02 `SUPPORTED_VIEW_TYPES` constant in `manifest.ts` ✅
- T-03 `getEnabledPrefixes` extended for supported view types ✅
- T-04 perm structured-line types and parse ✅
- T-05 `Graph` perm fields ✅
- T-06 C6 two-phase dispatch ✅
- T-07 C6 perm validation (non-empty / uniqueness / act prefix) ✅
- T-08 C11 views direction restriction ✅
- T-09 `export permissions` subcommand ✅
- T-10 structured-line parse unit tests ✅
- T-11 C6 unit tests ✅
- T-12 C7 / C11 / C3 / degradation tests ✅
- T-13 export permissions tests ✅
- T-14 conformance fixture integration test ✅
- T-15 final verification (`tsc --noEmit && bun test` green; `dependencies {}` preserved; `export rules --verify` exit 0) ✅

---

## Detail: Spec Compliance

### R1 — SUPPORTED_VIEW_TYPES SHALL gate C6 two-phase dispatch

`SUPPORTED_VIEW_TYPES = new Set(["permission"])` lives in `manifest.ts:131` (alongside type tables). `checkC6` in `c06-view-links.ts` dispatches: supported → `checkPermission(graph)`; unsupported → C6 error with original message preserved.

Scenarios: "permission enabled triggers perm link validation, not blanket error" ✅ · "unsupported view type still produces C6 error" ✅

### R2 — LAYER_PREREQUISITES for permission SHALL be domain

`manifest.ts:101`: `permission: ["domain"]`. C7 reads this constant automatically — no C7 code change required.

Scenarios: "permission enabled without domain triggers C7" ✅ · "permission enabled with domain satisfies C7" ✅

### R3 — structured-lines SHALL recognize perm operation lines and target lines

`PERM_OPERATION_LINE_RE = /^- ([^\s:]+): (\[\[.+)$/` and `PERM_TARGET_LINE_RE = /^対象: \[\[([a-z0-9-]+)\]\]$/` added to `structured-lines.ts`. Code-fence skip is handled by the existing `inCodeFence` flag. Evaluation order: dep-edge → 責務: → 実装: → elements: → perm-op → perm-target — no collision with existing recognizers. Results flow through `ParseResult` → `Graph` via `parser.ts` aggregation and `builder.ts`.

Scenarios: "operation line parsed correctly" ✅ · "target line parsed correctly" ✅ · "operation line inside code fence is ignored" ✅

### R4 — C6 perm validation SHALL enforce non-empty operations, uniqueness, and act prefix

`checkPermission(graph)` uses `findOwningElement` for line-based attribution (correctly handles multiple perm elements per file). Three checks: (a) `ops.length === 0` → C6 error; (b) duplicate `op.operation` within same perm → C6 error; (c) `extractPrefix(actorId) !== "act"` → C6 error. No resolution check — deferred to C3 (D4).

Scenarios: all 5 scenarios ✅ (valid pass · zero-ops fail · duplicate-op fail · non-act prefix fail · unresolved act → no C6 error)

### R5 — C11 SHALL restrict views layer reference direction

`LAYER_ALLOWED_TARGET_PREFIXES.views` added with all views prefixes + `mod / term / ent / inv / act / seq`. JSDoc and inline comment updated — `views` removed from "unlisted (no restriction)" note.

Scenarios: "perm → act allowed" ✅ · "perm → ent allowed" ✅ · "domain element → perm forbidden" ✅

### R6 — getEnabledPrefixes SHALL include supported view type prefixes

`getEnabledPrefixes` iterates `manifest.enabled` and adds `VIEW_ENABLED_NAME_TO_PREFIX[name]` only when `SUPPORTED_VIEW_TYPES.has(name)`. Unsupported types (screen etc.) are still excluded.

Scenarios: "permission enabled includes perm in enabledPrefixes" ✅ · "unsupported view type does not add prefix" ✅

### R7 — export permissions SHALL produce spec-compliant JSON

`generatePermissions(graph)` in `src/export/permissions.ts` is a pure function. Sort contracts: perm elements by id ascending (`Array.sort`); operation keys lexicographic; act arrays by id ascending. `target` field emitted only when `対象:` line exists (`targetByPermId` map, first-wins). Exit codes in `export.ts`: dir not found → 2; permission not enabled → 1; success → 0.

Scenarios: "valid permission design produces JSON" ✅ · "permission not enabled returns exit 1" ✅ · "design directory not found returns exit 2" ✅ · "--out writes to file" ✅

### R8 — perm declarations in non-enabled design SHALL degenerate silently

When "permission" ∉ `manifest.enabled`: `getEnabledPrefixes` excludes "perm"; C3 skips perm-prefix references; C6 never enters `checkPermission`; C11 skips disabled prefixes. Net effect: zero new diagnostics for perm declarations in non-permission designs.

Scenario: "perm declaration with permission not enabled → no diagnostic" ✅ (`degradation.test.ts` T-12)

### R9 — aozu self-hosting check SHALL remain unchanged

aozu's `design/manifest.md` has `enabled: static, domain, dynamic` — "permission" absent. No perm elements exist in aozu's design/. Integration test "design/ has zero check diagnostics" continues to pass.

Scenario: "design/ self-check" ✅

---

## Detail: Design Decision Compliance

| Decision | Verdict | Evidence |
|----------|---------|----------|
| D1: SUPPORTED_VIEW_TYPES in manifest.ts (with type tables) | ✅ | `manifest.ts:131` next to LAYER_MAP / VIEW_TYPE_NAMES |
| D2: getEnabledPrefixes includes supported view prefix only | ✅ | `manifest.ts:233–241`; `SUPPORTED_VIEW_TYPES.has(name)` gate |
| D3: perm parse in structured-lines.ts (not separate parser) | ✅ | Two regex patterns added to existing file |
| D4: C6 checks act prefix only; resolution deferred to C3 | ✅ | `checkPermission` uses `extractPrefix`; no `graph.elements.has()` lookup |
| D5: PermOperation / PermTarget in parse/types.ts; Graph fields | ✅ | Types defined; `Graph.permOperations` / `Graph.permTargets`; `findOwningElement` for line-based attribution |
| D6: C11 views entry with all views + static/domain/dynamic prefixes | ✅ | Prefix set in c11-layer-direction.ts matches spec §10 and T-08 |
| D7: generatePermissions as pure function in export/; export.ts dispatches | ✅ | Mirrors generator.ts pattern; permissions.ts contains no I/O |

---

## Detail: Acceptance Criteria

| Criterion | Status |
|-----------|--------|
| spec §8 fixture (permission + domain enabled) → check exit 0 | ✅ T-14 in integration.test.ts |
| C6 errors: non-act prefix / zero ops / duplicate op; C3 for unresolved act | ✅ c06-view-links.test.ts, c03-ref-resolved.test.ts |
| permission enabled without domain → C7 violation | ✅ c07-manifest-prerequisites.test.ts |
| Unsupported view type (screen) → C6 error (existing tests unchanged) | ✅ "all unsupported view types trigger C6 (permission excluded)" |
| perm declaration with permission not enabled → no diagnostics (縮退) | ✅ degradation.test.ts T-12 |
| Core layer → `[[perm-*]]` → C11 error; perm → ent/act → C11 pass | ✅ c11-layer-direction.test.ts |
| `export permissions` JSON schema + deterministic order + --out + exit 1/2 | ✅ export.test.ts, permissions.test.ts |
| aozu own design/ check result unchanged | ✅ integration.test.ts self-check |
| `typecheck && test` green | ✅ tsc --noEmit (no errors); bun test: 858 pass, 0 fail |

---

## Supplementary Checks

- **`export rules --verify`**: exit 0 confirmed — `design/rules.json` remains consistent after this change.
- **`dependencies {}`**: `package.json` has no runtime dependencies added.
- **Scope**: No out-of-scope items implemented. `--verify` flag for `export permissions` is correctly absent (ADR-0023 D4). Scaffold, prompt injection, state.json, loop mechanism all unchanged.
- **Known low-severity items (deferred, no fix required)**:
  - Variable shadowing: inner `actorIds` in `structured-lines.ts:160` shadows outer `actorIds`. Functionally correct.
  - Missing direct unit tests for `getEnabledPrefixes` + permission and `SUPPORTED_VIEW_TYPES.has()`. Behavior verified indirectly via conformance fixture and C6 tests.
