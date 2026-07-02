# Test Cases: actor-type-support

## Summary

- **Total**: 26 cases
- **Automated** (unit/integration): 22
- **Manual**: 4
- **Priority**: must: 17, should: 8, could: 1

---

### TC-001: act prefix is valid

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: KNOWN_PREFIXES SHALL include act > Scenario: act prefix is valid

---

### TC-002: act prefix appears in KNOWN_PREFIXES

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: KNOWN_PREFIXES SHALL include act > Scenario: act prefix appears in KNOWN_PREFIXES

---

### TC-003: LAYER_MAP maps act to domain

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: act SHALL belong to the domain layer in LAYER_MAP > Scenario: LAYER_MAP maps act to domain

---

### TC-004: LAYER_TO_PREFIXES.domain includes act

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: act SHALL belong to the domain layer in LAYER_MAP > Scenario: LAYER_TO_PREFIXES.domain includes act

---

### TC-005: seq with act-only actors passes C5

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C5 SHALL accept mod or act as seq actor prefixes > Scenario: seq with act-only actors passes C5

---

### TC-006: seq with mixed mod and act actors passes C5

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C5 SHALL accept mod or act as seq actor prefixes > Scenario: seq with mixed mod and act actors passes C5

---

### TC-007: seq with ent actor fails C5

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C5 SHALL accept mod or act as seq actor prefixes > Scenario: seq with ent actor fails C5

---

### TC-008: domain element references act — C11 allowed

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C11 SHALL allow references to act from domain, static, and dynamic layers > Scenario: domain element references act — allowed

---

### TC-009: mod element references act — C11 allowed

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C11 SHALL allow references to act from domain, static, and dynamic layers > Scenario: mod element references act — allowed

---

### TC-010: seq element references act — C11 allowed

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C11 SHALL allow references to act from domain, static, and dynamic layers > Scenario: seq element references act — allowed

---

### TC-011: act element references mod — C11 rejected

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: C11 SHALL allow references to act from domain, static, and dynamic layers > Scenario: act element references mod — rejected

---

### TC-012: reference to non-existent act element produces C3

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: Unresolved act references SHALL be detected by C3 > Scenario: reference to non-existent act element produces C3

---

### TC-013: act reference with domain disabled produces no C3

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: act references SHALL be silenced by graceful degradation when domain is disabled > Scenario: act reference with domain disabled produces no C3

---

### TC-014: Full verification — tsc && bun test exit 0

**Category**: manual
**Priority**: must
**Source**: spec.md > Requirement: Existing tests SHALL pass without modification > Scenario: Full verification

---

### TC-015: getEnabledPrefixes with domain enabled includes act

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-02

**GIVEN** `getEnabledPrefixes` is called with a manifest containing `enabled: ["static", "domain"]`
**WHEN** the returned prefix set is inspected
**THEN** `"act"` is included in the set

---

### TC-016: getEnabledPrefixes with domain disabled excludes act

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-02

**GIVEN** `getEnabledPrefixes` is called with a manifest containing `enabled: ["static"]` (domain not included)
**WHEN** the returned prefix set is inspected
**THEN** `"act"` is NOT included in the set

---

### TC-017: C5 empty actor list produces error

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** a seq element whose `## 登場要素` section is empty (no actor entries)
**WHEN** C5 check is run
**THEN** a C5 error diagnostic is produced for the empty actor list

---

### TC-018: C5 error message reads "is not a mod or act element"

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03

**GIVEN** a seq element whose `## 登場要素` section lists an `ent-order` actor
**WHEN** C5 check is run and produces a diagnostic
**THEN** the diagnostic message contains the text `"is not a mod or act element"`

---

### TC-019: act and ent mixed actors — only ent produces C5 error

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-06

**GIVEN** a seq element whose `## 登場要素` section lists both `[[act-approver]]` and `[[ent-order]]`
**WHEN** C5 check is run
**THEN** exactly one C5 diagnostic is produced, referencing `ent-order`, and no diagnostic is produced for `act-approver`

---

### TC-020: act element references domain element (term) — C11 allowed

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-05

**GIVEN** an act element that references `[[term-status]]`
**WHEN** C11 check is run
**THEN** no C11 diagnostic is produced (domain → domain reference is permitted)

---

### TC-021: domain disabled — seq with act actor produces no C5 diagnostic

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-07

**GIVEN** a manifest with `enabled: ["static"]` (domain and dynamic are not enabled) and a seq element whose actor list includes an `act-*` entry
**WHEN** check is run
**THEN** no C5 diagnostic is produced (dynamic layer is disabled, so C5 is skipped entirely)

---

### TC-022: resolved act reference produces no C3 diagnostic

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-08

**GIVEN** a mod element that references `[[act-approver]]` where `act-approver` exists as a registered act element, and domain is enabled
**WHEN** C3 check is run
**THEN** no C3 diagnostic is produced

---

### TC-023: Integration — actors.md fixture with act in seq passes check

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-09

**GIVEN** an in-memory ParseResult containing:
  - a mod element (`mod-cli`),
  - an act element (`act-approver` from actors.md with `{#act-approver}` heading),
  - a seq element whose `## 登場要素` lists both `[[mod-cli]]` and `[[act-approver]]`,
  - a manifest with `enabled: ["static", "domain", "dynamic"]`
**WHEN** `runCheck` is called on this fixture
**THEN** zero diagnostics are returned (check exits cleanly)

---

### TC-024: package.json dependencies field remains empty

**Category**: manual
**Priority**: should
**Source**: tasks.md > T-10

**GIVEN** the completed implementation
**WHEN** `package.json` is inspected
**THEN** the `dependencies` field is `{}` (no runtime dependencies were added)

---

### TC-025: export rules --verify exits 0

**Category**: manual
**Priority**: should
**Source**: tasks.md > T-10

**GIVEN** the completed implementation with `design/rules.json` committed
**WHEN** `export rules --verify` is executed
**THEN** the command exits with status 0 (act is not a module, so the ruleset is unaffected)

---

### TC-026: C5 source file docstring updated to reflect mod or act

**Category**: manual
**Priority**: could
**Source**: design.md > Risks / Trade-offs

**GIVEN** the file `src/check/rules/c05-seq-actors.ts`
**WHEN** the file header comment is inspected
**THEN** the description references "mod or act elements" (not "mod elements" only), making the intent clear for future readers

---

## Result

```yaml
result: completed
total: 26
automated: 22
manual: 4
must: 17
should: 8
could: 1
blocked_reasons: []
```
