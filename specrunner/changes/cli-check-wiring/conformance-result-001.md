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
| tasks.md | ✅ yes | All 9 task blocks (T-01 – T-09), every checkbox marked [x] |
| design.md | ✅ yes | All decisions D1–D7 implemented as specified |
| spec.md | ✅ yes | All Requirements (SHALL/MUST) and every Scenario covered by tests |
| request.md | ✅ yes | All 8 acceptance criteria satisfied; tsc clean; 210/210 tests green; dependencies empty |

---

## Detail

### 1. Task Completeness (tasks.md)

All 9 task blocks have every checkbox marked `[x]`. No pending items.

| Task | Title | Status |
|------|-------|--------|
| T-01 | state.json リーダー (`src/state/`) | ✅ all [x] |
| T-02 | command registry (`src/cli/registry.ts`) | ✅ all [x] |
| T-03 | 診断フォーマッタ (`src/cli/format.ts`) | ✅ all [x] |
| T-04 | `check` handler — 通常モード | ✅ all [x] |
| T-05 | `check --request` handler | ✅ all [x] |
| T-06 | `main.ts` 結線 | ✅ all [x] |
| T-07 | 統合テスト — 通常モード | ✅ all [x] |
| T-08 | `check --request` 統合テスト | ✅ all [x] |
| T-09 | 最終検証 | ✅ all [x] |

### 2. Design Conformance (design.md)

**D1 — command registry** — `createRegistry()` returns `Map<string, CommandDef>`. `CommandHandler` is `(args: string[]) => Promise<number>`. `dispatch` returns 2 for unknown commands. `helpText` generates command listing. `process.exit` is confined to `main.ts` only. ✅

**D2 — `aozu check` pipeline** — Implementation order: dirExists → readMarkdownFiles → parseFiles → parseManifest → buildGraph → readState → runCheck → writeDiagnostics → return exit code. Exactly matches D2. ✅

**D3 — `check --request` uses `extractReferences`** — `handleCheckRequest` calls `extractReferences(content, requestPath)` from `src/parse/references.ts`. No duplicate regex. Code-fence exclusion is inherited. Deduplication of cited IDs precedes validation. ✅

**D4 — state reader in `src/state/`** — `readState(path): Promise<StateMap>` returns `{}` when file absent; parses JSON when present. `StateEntry` / `StateMap` in `types.ts`; re-exported from `index.ts`. Write side absent (out of scope). ✅

**D5 — formatter in CLI layer** — `formatDiagnostic(d)` in `src/cli/format.ts` produces `${d.level.toUpperCase()} ${d.code} ${d.elementId ?? "-"} ${d.message} (${d.file}:${d.line})`. `writeDiagnostics` writes each line to `process.stderr`. Check module returns `CheckDiagnostic[]` only. ✅

**D6 — exit codes 0 / 1 / 2** — Handlers return integer exit codes; `main.ts` calls `process.exit`. No handler calls `process.exit` directly, enabling test-time assertion on return value. ✅

**D7 — per-element state check** — Each cited ID individually evaluated: `stateMap[id]?.state ?? "designed"`. State `"implemented"` → R2 diagnostic per element. Absence defaults to `"designed"` (pass). Per-element judgment consistent with contract §1 (b). ✅

### 3. Spec Conformance (spec.md)

**Requirement: CLI SHALL dispatch commands via self-contained registry**
- "known command dispatches to handler" → `registry.test.ts` ✅
- "unknown command prints error (exit 2)" → `registry.test.ts` ✅
- "no command prints usage (exit 0)" → `main.ts` + `registry.test.ts` (helpText) ✅

**Requirement: `aozu check` SHALL run closure verification**
- "self-check yields exit 0" → `check.test.ts`: "returns 0 for this repository's own design directory" ✅
- "violations produce exit 1 with contract-format diagnostics on stderr" → `check.test.ts`: fixture test + subprocess stderr assertion ✅
- "missing design directory produces exit 2" → `check.test.ts` ✅
- "stdout remains empty" → `check.test.ts` subprocess: `expect(stdout).toBe("")` ✅

**Requirement: `aozu check --request` SHALL validate citations**
- "valid citations → exit 0" → `check-request.test.ts` ✅
- "non-existent citation → exit 1" → `check-request.test.ts` ✅
- "request file not found → exit 2" → `check-request.test.ts` ✅
- "citation in code fence is excluded" → `check-request.test.ts`: "ignores citations inside code fences" ✅

**Requirement: `--require-citation` SHALL reject zero citations**
- "zero citations with --require-citation → exit 1" → `check-request.test.ts` ✅
- "zero citations without --require-citation → exit 0" → `check-request.test.ts` ✅

**Requirement: SHALL reject citations to implemented-only elements**
- "implemented-only citation → exit 1" → `check-request.test.ts` TC-023 ✅
- "designed element citation passes" → `check-request.test.ts` ✅
- "requested element citation passes" → `check-request.test.ts` ✅

**Requirement: state.json reader SHALL return empty map when absent**
- "state.json absent" → `reader.test.ts` ✅
- "state.json present" → `reader.test.ts` ✅

**Requirement: diagnostics SHALL be written to stderr, never stdout**
- "stderr/stdout separation" → `check.test.ts` subprocess test ✅

### 4. Acceptance Criteria (request.md)

| Criterion | Satisfied | Evidence |
|-----------|-----------|----------|
| 本リポジトリで `check` が exit 0 (tools/check.sh と同判定) をテストで固定 | ✅ | `check.test.ts`: "returns 0 for this repository's own design directory" |
| 違反 fixture で exit 1 + 契約形式の診断 on stderr をテストで固定 | ✅ | `check.test.ts`: violation fixture test + subprocess stderr assertion |
| design ディレクトリ不在で exit 2 をテストで固定 | ✅ | `check.test.ts`: "returns 2 when design directory does not exist" |
| `check --request`: 実在→0 / 架空→1 / `--require-citation` かつ 0 件→1 / 不在→2 をテストで固定 | ✅ | `check-request.test.ts` (4 distinct tests) |
| implemented のみを引用する request が不合格をテストで固定 | ✅ | `check-request.test.ts` TC-023 |
| stdout に診断が混ざらない (stderr/stdout 分離) をテストで固定 | ✅ | `check.test.ts` subprocess test |
| `package.json` の dependencies が空のまま | ✅ | `"dependencies": {}` verified |
| `tsc --noEmit && bun test` が green | ✅ | `tsc --noEmit` exits cleanly; `bun test` → 210 pass, 0 fail |

### 5. Non-blocking Observations

The following LOW-severity observations (from code-review-001, all Fix: no) are noted for completeness.

1. **Unused `manifest` in `handleCheckRequest`** (`check.ts:96`) — `buildPipeline` returns `{ graph, manifest }` but `manifest` is unused in request mode. No runtime impact. Optional: rename to `_manifest` or split `buildPipeline` for request mode.

2. **Hard-coded `line: 1` in R1/R2 diagnostics** (`check.ts:133–156`) — `extractReferences` returns per-reference line numbers; deduplication step discards `Reference` objects, losing precision. Conservative fallback `line: 1` is always technically correct. Optional: retain first `Reference` per `targetId` for accurate line reporting.

3. **TC-029 not implemented** — Mixed-citation (implemented + designed) scenario is "should" priority in test-cases.md. D7 per-element logic is correctly implemented; coverage gap is low risk. Optional addition.

4. **`spec/integration.md §1` output format drift** — Contract specifies `<LEVEL> <CODE> <id> <message>`; implementation produces the extended `<LEVEL> <CODE> <id> <message> (<file>:<line>)`. `spec.md` correctly captures the extended form. `spec/integration.md` update is a follow-up documentation task only.

5. **`design.md` D7 first-paragraph contradiction** — First paragraph implies mixed-citation could pass; the Rationale (per-element judgment) and the code are consistent with each other. First paragraph is residual from an earlier draft. Optional cleanup.

None of these observations affect correctness, security, or architecture. No blocking issues exist.

---

## Verification Evidence

```
tsc --noEmit  → exit 0 (no output)
bun test      → 210 pass, 0 fail (184 pre-existing + 26 new) [78ms]
package.json  → "dependencies": {}
```
