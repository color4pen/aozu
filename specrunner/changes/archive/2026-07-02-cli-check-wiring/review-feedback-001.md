# Code Review Feedback — iteration 001

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
- iteration line format (exact): `- **iteration**: NNN` (3-digit zero-padded integer)
- Findings table MUST have exactly 7 columns in this order:
  # | Severity | Category | File | Description | How to Fix | Fix
  - Fix column: yes = fixer should address this finding; no = skip (pre-existing / out-of-scope)
- Scores table columns: Category | Score | Weight
  - Valid Category values: correctness | security | architecture | performance | maintainability | testing
  - Score: integer 1-10
  - Weight: decimal as defined below
- total line format (exact): `- **total**: <decimal>`
- Default weights: correctness=0.30, security=0.25, architecture=0.15, performance=0.10, maintainability=0.10, testing=0.10
- Scores table is optional but recommended.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | LOW | maintainability | src/cli/commands/check.ts:96 | `handleCheckRequest` destructures `manifest` from `buildPipeline` return value but never reads it. `parseManifest` is called unnecessarily in request mode — only `graph.elements` is needed. TypeScript does not flag this (no `noUnusedLocals`). | Rename to `_manifest` to signal intentional non-use, or split `buildPipeline` into a graph-only variant for request mode. | no |
| 2 | LOW | maintainability | src/cli/commands/check.ts:133–156 | All `check --request` diagnostics hard-code `line: 1`. `extractReferences` already returns per-reference `line` numbers, but the deduplication step (`uniqueIds`) discards the `Reference` objects, losing source location information. | During deduplication, store the first `Reference` per `targetId` in a `Map<string, Reference>` and use `ref.line` when constructing R1/R2 diagnostics. | no |
| 3 | LOW | testing | src/cli/commands/check-request.test.ts | TC-029 ("mixed citations: implemented + designed in same request → exit 1 with diagnostic only for the implemented element") is listed as "should" priority in test-cases.md but has no corresponding test. The D7 per-element logic is correctly implemented but unprotected against future refactoring. | Add a test citing both `mod-cli` (state=implemented) and `mod-parse` (no state entry → designed); assert exit 1 and a diagnostic for `mod-cli` only with no diagnostic for `mod-parse`. | no |
| 4 | LOW | architecture | spec/integration.md §1 | The integration contract specifies the output format as `<LEVEL> <CODE> <id> <message>` (4 fields). The implementation (design.md D5, spec.md) intentionally extends this to `<LEVEL> <CODE> <id> <message> (<file>:<line>)`. The extension is correct and more useful, but `spec/integration.md` — the external-facing contract — has not been updated to reflect it. | Update `spec/integration.md §1` 出力 bullet to read: `` `<LEVEL> <CODE> <id> <message> (<file>:<line>)` ``. No code change required. | no |
| 5 | LOW | maintainability | specrunner/changes/cli-check-wiring/design.md D7 | D7's first paragraph ("引用要素に designed / requested のものが 1 つでもあれば、implemented の引用があっても合格") contradicts the per-element judgment stated in the Rationale and implemented in code. The first paragraph was not removed after being superseded, and leaves a misleading interpretation for future readers. | Remove the first paragraph of D7. The Rationale paragraph ("各引用要素について個別に判定する読みが自然") is the sole authoritative policy statement. | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 9 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 8 | 0.10 |
| testing | 8 | 0.10 |

- **total**: 8.80

## Summary

All acceptance criteria are met. The implementation faithfully follows all design decisions (D1–D7), passes `tsc --noEmit` cleanly, and achieves 210/210 tests green (184 pre-existing + 26 new). All 19 must-priority test cases from test-cases.md are covered. `package.json dependencies` remains empty.

**Positive highlights:**

- `process.exit` is confined exclusively to `main.ts`; handlers return exit codes, making them directly testable without mocking (D6).
- `extractReferences` from `src/parse/` is correctly reused for request-document citation extraction, avoiding code-fence-exclusion rule duplication (D3).
- `src/state/` is placed as a dedicated module per `mod-state` responsibilities; no inline `JSON.parse` in CLI layer (D4).
- The subprocess test in `check.test.ts` verifies stderr/stdout separation at the process boundary, not just by convention (TC-026).
- Dependency direction is clean: `mod-cli → mod-state` and `mod-cli → mod-parse` edges are both permitted by `design/static/dependencies.md`.

**Findings summary:** 5 LOW-severity observations (1 unused variable, 1 diagnostic precision gap, 1 missing "should" test case, 1 integration.md doc drift, 1 design.md self-contradiction). No CRITICAL, HIGH, or MEDIUM findings. All findings are marked `Fix: no` — optional improvements only.

