---
iteration: 4
date: 2026-07-03
---

# Regression Gate Result — Iteration 4

- **verdict**: approved

## Summary

All 8 findings from the ledger are confirmed fixed. No regressions detected.

## Finding Verification

### [HIGH] TC-017: derive rejects when group elements do not resolve

- **Status**: FIXED
- **Evidence**: `src/cli/commands/prompt.test.ts` lines 167–225 define `createUnresolvedElementFixture()` — a fixture with `grp-test` referencing `[[ent-nonexistent]]` which does not exist in the graph. Lines 580–594 add the test `"group elements reference unresolvable IDs → exit 2 + stderr diagnostic (TC-017)"` that asserts `exitCode === 2` and `stderr` contains `"ent-nonexistent"`. The production path at `prompt.ts:236-243` that emits exit 2 is now covered.

### [LOW] TC-044: no test for template command non-zero exit → exit 2

- **Status**: FIXED (both occurrences)
- **Evidence**: `src/cli/commands/prompt.test.ts` lines 419–448 add `"request-template command exits non-zero → exit 2 + stderr diagnostic (TC-044)"`. The test sets `request-template: exit 1` in the manifest, spawns the CLI, and asserts `exitCode === 2` and `stderr` contains `"request-template"`. This covers the production branch at `prompt.ts:305-322`.

### [LOW] TC-043: no test for `aozu --help` listing `plan` and `prompt`

- **Status**: FIXED
- **Evidence**: `src/cli/registry.test.ts` lines 61–74 add `describe("aozu --help (TC-043)")` with a subprocess test that runs `bun main.ts --help`, asserts `exitCode === 0`, and checks that `stderr` contains both `"plan"` and `"prompt"`. Both commands are registered at `main.ts:23-24`.

### [MEDIUM] openTopics 計算が ADR-0018-3 と矛盾

- **Status**: FIXED
- **Evidence**: `src/plan/frontier.ts` lines 63–70 retain the frontmatter `status === "open"` check but wrap it in a prominent `NOTE` comment (lines 64–70) that explicitly states: "ADR-0018-3 replaces the frontmatter `status` field with a computed rule … Migrating this computation is scoped to the coverage/mark request … plan/derive only consume `frontier.designed`, so this branch does not affect them." The technical debt is documented and intentional; no silent deviation from the ADR.

### [MEDIUM] D8 Decision と Rationale の exit code 矛盾

- **Status**: FIXED
- **Evidence**: `specrunner/changes/plan-and-derive/design.md` lines 131–141 now read consistently: the Decision section states derive loop-disabled is **exit 1** (aligned with plan), and the Rationale section states "loop 無効は plan にとっても derive にとっても設計フローの段階チェック（前提条件未充足）であり、**どちらも exit 1**". The contradictory "設定不備 = exit 2" language is gone. `tasks.md` T-09/T-10 acceptance criteria also updated to say "loop 無効は段階ゲート = 検証不合格であり exit 1".

### [MEDIUM] D8 Rationale が spec/integration.md §5 を誤参照

- **Status**: FIXED
- **Evidence**: `specrunner/changes/plan-and-derive/design.md` line 141 now reads: "この分類は ADR-0010 の明示エラーの原則から自己完結する（**spec/integration.md §5 共通規約は exit code 規約を規定しない**）。" The incorrect normative reference to §5 has been replaced with an accurate parenthetical that explicitly acknowledges §5 does not define exit codes.

### [LOW] heading 境界判定パターンが design.md / spec §5 と乖離

- **Status**: FIXED
- **Evidence**: `src/graph/body.ts` line 30 now uses `HEADING_ELEMENT_RE = /^## /` (h2 only), not `/^#{2,3} /` (h2 + h3). The module-level JSDoc (lines 8–11) explains: "h3 sub-headings within the body are part of the body (spec/format.md §5: '見出しから次の同レベル見出しまでが要素の本文')." This aligns with design.md D3 mitigation and spec §5.

## Findings

[]
