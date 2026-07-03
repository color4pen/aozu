# Regression Gate Result — prompt-session — Iteration 4

- **verdict**: needs-fix
- **iteration**: 004

## Verification Summary

Commit history inspected (HEAD `f271592` back to main):

| Commit | Role |
|--------|------|
| `f271592` | code-fixer iter 4 — changed only `events.jsonl`, `state.json`, `usage.json` (NO source code changes) |
| `eb068b8` | regression-gate iter 3 — wrote result file, verdict: needs-fix |
| `cabe81d` | code-fixer iter 3 — changed only `events.jsonl`, `state.json`, `usage.json` (NO source code changes) |
| `25fba67` | regression-gate iter 2 — wrote result file, verdict: needs-fix |
| `0dfe059` | code-fixer iter 2 — added 9 view-type rows to FORMAT_RULES_SUMMARY in `src/prompt/session.ts` |
| `4a4140a` | regression-gate iter 1 — wrote result file, verdict: needs-fix |
| `f75616b` | code-fixer iter 1 — added `stdout === ""` assertions to error-case tests |
| `b212de6` | implementer — initial implementation |

The iter 4 code-fixer commit (`f271592`) contains **no source code changes** — only specrunner artifact files were touched. Consequently, none of the open findings from iteration 3 (F2, F3, F6, F7) were addressed. No new regressions were introduced in previously-fixed items (F1, F5). The source tree is byte-identical to iteration 3 HEAD (`cabe81d`).

---

## Finding-by-Finding Verdict

### [FIXED] Finding 1 — TC-011: エラー系で stdout が空
- **File**: src/cli/commands/prompt.test.ts
- **Status**: FIXED ✓ (no regression)

All four stage-gate tests (loop 無効 / topic 不存在 / design 不在 / 引数不足) include `expect(stdout).toBe("")`. Fixed in iter 1 (`f75616b`); still present in current HEAD. No regression.

---

### [NOT FIXED] Finding 2 — static モジュール縮約の上限（実装: 行が stdout に含まれないこと）
- **File**: src/cli/commands/prompt.test.ts
- **Status**: NOT FIXED ✗
- **Severity**: low / resolution: fixable

`createSessionFixture` generates `static/modules.md` containing `実装: src/core/` and `実装: src/cli/`. No assertion of the form `expect(stdout).not.toContain("実装:")` exists anywhere in the test file. The only `.not.toContain()` assertion in the session tests is `expect(stdout).not.toContain("UNIQUE_SCOPE_BOUNDARY_MARKER")` (3-hop boundary). The iter 4 code-fixer made no code changes. Finding carried over from iters 2 and 3 unchanged.

---

### [NOT FIXED] Finding 3 — --topic に top 以外の prefix を持つ有効 ID を渡した場合の exit 2
- **File**: src/cli/commands/prompt.test.ts
- **Status**: NOT FIXED ✗
- **Severity**: low / resolution: fixable

No test passes a non-"top" prefix ID (e.g., `ent-order`) to `--topic session`. The implementation check at `prompt.ts:389` (`topicEl.prefix !== "top"`) is correct but untested. The four existing stage-gate tests use `top-my-topic` (valid), `top-nonexistent` (absent — hits the `!topicEl` branch, not the prefix branch), missing `--dir`, or missing `--topic`. The iter 4 code-fixer made no code changes. Finding carried over from iters 2 and 3 unchanged.

---

### [INTENTIONALLY SKIPPED] Finding 4 — design.md D5「見出しのみを出力する」とプレースホルダ出力の微差
- **File**: src/cli/commands/prompt.ts:450
- **Status**: SKIPPED (review-feedback-001 Fix=no)

`prompt.ts:450` still outputs `(no 責務: line found)` while design.md D5 says "見出しのみを出力する". `review-feedback-001` explicitly set Fix=**no** ("設計判断が必要なため fixer でスキップしても可"). Consistent with iter 1, 2, and 3 gate decisions. Not treated as a regression.

---

### [FIXED] Finding 5 — FORMAT_RULES_SUMMARY のビュー型欠落
- **File**: src/prompt/session.ts
- **Status**: FIXED ✓ (no regression)

All 9 view-type prefixes (`uc / scr / api / dat / flow / evt / ext / perm / dpl`) are present in the type prefix table in `FORMAT_RULES_SUMMARY` (added in iter 2 commit `0dfe059`). Still present in current HEAD. No regression.

---

### [NOT FIXED] Finding 6 — FORMAT_RULES_SUMMARY にバージョン注記が未反映
- **File**: src/prompt/session.ts
- **Status**: NOT FIXED ✗
- **Severity**: low / resolution: fixable

design.md Risks/Trade-offs states "要約に spec/format.md のバージョン注記を含めることで、手動更新のトリガを可視化する". The `FORMAT_RULES_SUMMARY` constant in `session.ts` (lines 36–87) contains no `format-version: 0` reference or link to `spec/format.md`. The iter 4 code-fixer made no code changes. Finding carried over from iters 2 and 3 unchanged.

---

### [NOT FIXED] Finding 7 — 論点 8「manifest の要約は常に注入」と「Enabled Layers のみ」の解釈乖離が記録されていない
- **File**: docs/open-questions.md
- **Status**: NOT FIXED ✗
- **Severity**: low / resolution: fixable

`docs/open-questions.md §8` says "manifest と形式規則の要約は常に注入" but `SessionInput §6` injects only the `enabled` list (omitting `request-template`, `request-output-dir`, etc.). The rationale for this narrowing interpretation ("D8: session は消費者設定に依存しない") exists in design.md but is not cross-referenced in §8. The "初版実装済み" note records hop-rule constants but does not address this gap. The iter 4 code-fixer made no code changes to `docs/open-questions.md`. Finding carried over from iters 2 and 3 unchanged.

---

## Findings Requiring Fix

| # | Severity | File | Title |
|---|----------|------|-------|
| F2 | low | src/cli/commands/prompt.test.ts | 縮約上限テスト: `実装: src/core/` が stdout に含まれないことを assert する |
| F3 | low | src/cli/commands/prompt.test.ts | non-top prefix テスト: `--topic ent-order` で exit 2 + stderr 診断を assert する |
| F6 | low | src/prompt/session.ts | FORMAT_RULES_SUMMARY に `spec/format.md` のバージョン注記（例: `format-version: 0`）を追加する |
| F7 | low | docs/open-questions.md | §8「manifest の要約 = enabled 一覧」という縮小解釈の根拠を D8 への参照とともに明記する |
