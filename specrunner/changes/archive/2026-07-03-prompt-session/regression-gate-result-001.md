# Regression Gate Result — prompt-session — Iteration 1

- **verdict**: needs-fix
- **iteration**: 001

## Verification Summary

All 605 tests pass (`bun test` green). `tsc --noEmit` not run here (package.json has no typecheck script); review-feedback-001 confirms it was green at code-fixer commit.

Pipeline commit order verified:
1. `b212de6` implementer
2. `7bcf230` code-review (4 findings: #1 Fix=yes, #2 Fix=yes, #3 Fix=yes, #4 Fix=**no**)
3. `f75616b` code-fixer (addressed only Finding #1 — added `stdout === ""` assertions)
4. `0662275` adversarial-consistency (3 findings logged; verdict filed as "approved" despite them)

---

## Finding-by-Finding Verdict

### [FIXED] Finding 1 — TC-011: エラー系で stdout が空
- **File**: src/cli/commands/prompt.test.ts
- **Status**: FIXED ✓

`code-fixer` added `expect(stdout).toBe("")` to all four stage-gate tests (loop 無効 / topic 不存在 / design 不在 / 引数不足). Verified in current HEAD.

---

### [NOT FIXED] Finding 2 — static モジュール縮約の上限（実装: 行が stdout に含まれないこと）
- **File**: src/cli/commands/prompt.test.ts
- **Status**: NOT FIXED ✗

`createSessionFixture` contains `実装: src/core/` and `実装: src/cli/` lines in `static/modules.md`. No assertion of the form `expect(stdout).not.toContain("実装: src/core/")` or similar exists anywhere in the test file. Only one `.not.toContain()` assertion exists in the entire file (for `UNIQUE_SCOPE_BOUNDARY_MARKER`, covering the 3-hop boundary). The code-fixer only addressed Finding #1.

---

### [NOT FIXED] Finding 3 — --topic に top 以外の prefix を持つ有効 ID を渡した場合の exit 2
- **File**: src/cli/commands/prompt.test.ts
- **Status**: NOT FIXED ✗

No test passes a non-"top" prefix ID (e.g., `ent-order`) to `--topic`. The three existing `exit 2` stage-gate tests cover: topic-nonexistent (prefix is "top" but element absent), design-dir-not-found, and missing-`--topic`. The implementation at `prompt.ts` correctly checks `topicEl.prefix !== "top"`, but this code path is untested. The code-fixer did not add this test.

---

### [INTENTIONALLY SKIPPED] Finding 4 — design.md D5「見出しのみを出力する」とプレースホルダ出力の微差
- **File**: src/cli/commands/prompt.ts:450
- **Status**: SKIPPED (per review Fix=no)

`review-feedback-001.md` explicitly set Fix=**no** for this finding. The implementation still outputs `(no 責務: line found)` at line 450 while `design.md D5` says "見出しのみを出力する". Ledger claim that this was "fixed" is inaccurate; however, the code-reviewer's explicit skip is authoritative. Not reported as a regression.

---

### [NOT FIXED] Finding 5 — FORMAT_RULES_SUMMARY のビュー型欠落
- **File**: src/prompt/session.ts
- **Status**: NOT FIXED ✗

`FORMAT_RULES_SUMMARY` contains a type prefix table with 10 entries (mod / term / ent / inv / act / seq / top / plan / grp / adr) but omits all 9 view-type prefixes defined in `spec/format.md §4`: `uc / scr / api / dat / flow / evt / ext / perm / dpl`. No fixer step ran after `adversarial-consistency`. The adversarial commit (`0662275`) added only the result file; it made no code changes.

---

### [NOT FIXED] Finding 6 — FORMAT_RULES_SUMMARY にバージョン注記が未反映
- **File**: src/prompt/session.ts
- **Status**: NOT FIXED ✗

`design.md` Risks/Trade-offs states: "要約に spec/format.md のバージョン注記を含めることで、手動更新のトリガを可視化する". The `FORMAT_RULES_SUMMARY` constant contains no `format-version: 0` reference or any link to `spec/format.md`. No fixer ran to address this.

---

### [NOT FIXED] Finding 7 — open-questions.md §8「manifest の要約は常に注入」と「Enabled Layers のみ」の解釈乖離
- **File**: docs/open-questions.md
- **Status**: NOT FIXED ✗

The implementer added "初版実装済み" note to `docs/open-questions.md §8` (commit `b212de6`). The note records which constants implement the rules but does not address the interpretation discrepancy: `§8` states "manifest と形式規則の要約は常に注入", yet `SessionInput §6` injects only the `enabled` list and omits `request-template`, `request-output-dir`, etc. The adversarial reviewer (`0662275`) confirmed the gap remains unrecorded after reviewing the note. The rationale (`D8: session は消費者設定に依存しない`) exists in `design.md` but is not cross-referenced to `§8`'s "manifest の要約" phrase.

---

## Findings Requiring Fix

| # | Severity | File | Title |
|---|----------|------|-------|
| F2 | low | src/cli/commands/prompt.test.ts | 縮約上限テスト: `実装:` 行が stdout に含まれないことを assert する |
| F3 | low | src/cli/commands/prompt.test.ts | non-top prefix テスト: `ent-order` 等を --topic に渡して exit 2 を確認する |
| F5 | medium | src/prompt/session.ts | FORMAT_RULES_SUMMARY にビュー型 prefix (uc/scr/api/dat/flow/evt/ext/perm/dpl) を追加する |
| F6 | low | src/prompt/session.ts | FORMAT_RULES_SUMMARY に `spec/format.md` のバージョン注記を追加する |
| F7 | low | docs/open-questions.md | §8「manifest の要約」= enabled 一覧という解釈の根拠を明記する |
