# Regression Gate Result — prompt-session — Iteration 5

- **verdict**: approved
- **iteration**: 005

## Verification Summary

Commit history inspected (HEAD `6b961dd` back to main):

| Commit | Role |
|--------|------|
| `6b961dd` | code-fixer iter 5 — changed only `events.jsonl`, `state.json`, `usage.json` (NO source code changes) |
| `d59cb23` | fix: regression-gate 残 findings を解消する — source code changes (F2, F3, F6, F7) |
| `ed5b224` | regression-gate iter 4 — wrote result-004.md, verdict: needs-fix |
| `f271592` | code-fixer iter 4 — NO source code changes |
| `0dfe059` | code-fixer iter 2 — added 9 view-type rows to FORMAT_RULES_SUMMARY (F5) |
| `f75616b` | code-fixer iter 1 — added `stdout === ""` assertions to error-case tests (F1) |
| `b212de6` | implementer — initial implementation |

The iter 5 code-fixer commit (`6b961dd`) contains **no source code changes**. All source-level fixes were introduced by commit `d59cb23`, which is included in the current HEAD. No new regressions were introduced.

---

## Finding-by-Finding Verdict

### [FIXED] Finding 1 — TC-011: エラー系で stdout が空
- **File**: src/cli/commands/prompt.test.ts
- **Status**: FIXED ✓ (no regression)
- **Evidence**: All five stage-gate tests in the `handleSession — stage gates` describe block include `expect(stdout).toBe("")`:
  - "loop disabled → exit 1" (line ~1280)
  - "topic not found → exit 2" (line ~1298)
  - "non-top prefix ID → exit 2" (line ~1316)
  - "design directory not found → exit 2" (line ~1330)
  - "missing --topic argument → exit 2" (line ~1344)
- Fixed in iter 1 (`f75616b`); still present in current HEAD. No regression.

---

### [FIXED] Finding 2 — static モジュール縮約の上限（実装: 行が stdout に含まれないこと）
- **File**: src/cli/commands/prompt.test.ts
- **Status**: FIXED ✓
- **Evidence**: Test "static mod condensed excludes 実装: lines" (added in `d59cb23`) asserts `expect(stdout).not.toContain("実装:")`. The `createSessionFixture()` helper generates `static/modules.md` containing `実装: src/core/` and `実装: src/cli/` lines, making the test a meaningful upper-bound gate. The assertion is present and correct in the current HEAD.

---

### [FIXED] Finding 3 — --topic に top 以外の prefix を持つ有効 ID を渡した場合の exit 2
- **File**: src/cli/commands/prompt.test.ts
- **Status**: FIXED ✓
- **Evidence**: Test "non-top prefix ID → exit 2 + stderr diagnostic" (added in `d59cb23`) passes `--topic ent-order` (a valid, existing, non-"top" prefix ID) and asserts:
  - `expect(exitCode).toBe(2)`
  - `expect(stderr).toContain("ent-order")`
  - `expect(stdout).toBe("")`
- This directly exercises the `topicEl.prefix !== "top"` branch in `prompt.ts:389`. Present in current HEAD.

---

### [INTENTIONALLY SKIPPED] Finding 4 — design.md D5「見出しのみを出力する」とプレースホルダ出力の微差
- **File**: src/cli/commands/prompt.ts:450
- **Status**: SKIPPED (review-feedback-001 Fix=no, unchanged from iter 4)
- **Evidence**: `prompt.ts:450` still outputs `(no 責務: line found)` when no `責務:` line is found in a `mod` element body. `design.md` D5 says "見出しのみを出力する" — the wording mismatch persists. This was explicitly classified Fix=no ("設計判断が必要なため fixer でスキップしても可") in `review-feedback-001`. No changes to `prompt.ts` or `design.md` D5 were made in `d59cb23`. Classification consistent across all iterations. **Not treated as a regression.**

---

### [FIXED] Finding 5 — FORMAT_RULES_SUMMARY のビュー型欠落
- **File**: src/prompt/session.ts
- **Status**: FIXED ✓ (no regression)
- **Evidence**: All 9 view-type prefixes (`uc / scr / api / dat / flow / evt / ext / perm / dpl`) are present in the Type prefix table within `FORMAT_RULES_SUMMARY` (lines 75–83 of `session.ts`). Fixed in iter 2 (`0dfe059`); still present in current HEAD. No regression.

---

### [FIXED] Finding 6 — FORMAT_RULES_SUMMARY にバージョン注記が未反映
- **File**: src/prompt/session.ts
- **Status**: FIXED ✓
- **Evidence**: `session.ts` line 37 now reads:
  ```
  Summary of spec/format.md (format-version: 0). When the spec changes, update this summary to match.
  ```
  This line (added in `d59cb23`) provides the version reference and a manual-update trigger, matching the Mitigation described in `design.md` Risks/Trade-offs. Present in current HEAD.

---

### [FIXED] Finding 7 — 論点 8「manifest の要約は常に注入」と「Enabled Layers のみ」の解釈乖離が記録されていない
- **File**: docs/open-questions.md
- **Status**: FIXED ✓
- **Evidence**: `docs/open-questions.md §8` now contains (added in `d59cb23`):
  > 「manifest の要約」は enabled 一覧のみの注入という縮小解釈で実装している（session は request-template 等の消費者設定に依存しない — prompt-session change の設計判断 D8）
  
  This explicitly records the narrowing interpretation ("manifest summary = enabled list only") with the design rationale cross-referenced to D8. Present in current HEAD.

---

## Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | MEDIUM | TC-011 エラー系 stdout 空アサーション | FIXED ✓ |
| 2 | LOW | static 縮約上限テスト（実装: 行非含有） | FIXED ✓ |
| 3 | LOW | non-top prefix → exit 2 テスト | FIXED ✓ |
| 4 | LOW | design.md D5 / プレースホルダ文言乖離 | SKIPPED (Fix=no per review-feedback-001) |
| 5 | MEDIUM | FORMAT_RULES_SUMMARY ビュー型欠落 | FIXED ✓ |
| 6 | LOW | FORMAT_RULES_SUMMARY バージョン注記欠落 | FIXED ✓ |
| 7 | LOW | 論点 8 縮小解釈の設計記録欠落 | FIXED ✓ |

**Regressions**: None  
**Contradictions**: None  
**Verdict**: approved — all addressable findings are fixed; F4 remains intentionally skipped per prior review decision, consistent with iters 1–4.
