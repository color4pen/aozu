# Regression Gate Result — prompt-session — Iteration 2

- **verdict**: needs-fix
- **iteration**: 002

## Verification Summary

Commit history inspected (HEAD `0dfe059` back to main):

| Commit | Role |
|--------|------|
| `0dfe059` | code-fixer iter 2 — changed only `src/prompt/session.ts` (added 9 view-type rows to FORMAT_RULES_SUMMARY) |
| `4a4140a` | regression-gate iter 1 — wrote result file, verdict: needs-fix |
| `0662275` | adversarial-consistency — result file only, no code changes |
| `f75616b` | code-fixer iter 1 — added `stdout === ""` assertions (F1 only) |
| `7bcf230` | code-review — 4 findings: #1 Fix=yes, #2 Fix=yes, #3 Fix=yes, #4 Fix=no |
| `b212de6` | implementer — initial implementation |

`bun test` green per review-feedback-001 (605 pass / 0 fail). No additional code changes exist beyond the two fixer commits.

---

## Finding-by-Finding Verdict

### [FIXED] Finding 1 — TC-011: エラー系で stdout が空
- **File**: src/cli/commands/prompt.test.ts
- **Status**: FIXED ✓

All four stage-gate tests (loop 無効 / topic 不存在 / design 不在 / 引数不足) include `expect(stdout).toBe("")`. Fixed in iter 1 (`f75616b`); still present in current HEAD.

---

### [NOT FIXED] Finding 2 — static モジュール縮約の上限（実装: 行が stdout に含まれないこと）
- **File**: src/cli/commands/prompt.test.ts
- **Status**: NOT FIXED ✗

`createSessionFixture` generates `static/modules.md` containing `実装: src/core/` and `実装: src/cli/`. The code fixer for iter 2 touched only `src/prompt/session.ts`; no `.not.toContain("実装:")` assertion was added to `prompt.test.ts`. The sole `.not.toContain()` in the session test section remains `expect(stdout).not.toContain("UNIQUE_SCOPE_BOUNDARY_MARKER")` (3-hop boundary). This finding is not fixed.

---

### [NOT FIXED] Finding 3 — --topic に top 以外の prefix を持つ有効 ID を渡した場合の exit 2
- **File**: src/cli/commands/prompt.test.ts
- **Status**: NOT FIXED ✗

No test passes a non-"top" prefix ID (e.g., `ent-order`) to `--topic session`. All stage-gate tests use either `top-my-topic` (valid topic) or `top-nonexistent` (non-existent but correct prefix). The implementation check at `prompt.ts` (`topicEl.prefix !== "top"`) is correct but untested. The iter 2 fixer did not add this case.

---

### [INTENTIONALLY SKIPPED] Finding 4 — design.md D5「見出しのみを出力する」とプレースホルダ出力の微差
- **File**: src/cli/commands/prompt.ts
- **Status**: SKIPPED (review-feedback-001 Fix=no)

`prompt.ts:450` still outputs `(no 責務: line found)` while design.md D5 says "見出しのみを出力する". `review-feedback-001` explicitly set Fix=**no** for this finding ("設計判断が必要なため fixer でスキップしても可"). This is a documented intentional skip, not a regression. Not reported as a blocking finding.

---

### [FIXED] Finding 5 — FORMAT_RULES_SUMMARY のビュー型欠落
- **File**: src/prompt/session.ts
- **Status**: FIXED ✓

Commit `0dfe059` (iter 2 code-fixer) added all 9 view-type prefixes (`uc / scr / api / dat / flow / evt / ext / perm / dpl`) to the type prefix table in `FORMAT_RULES_SUMMARY`. Verified present in current HEAD.

---

### [NOT FIXED] Finding 6 — FORMAT_RULES_SUMMARY にバージョン注記が未反映
- **File**: src/prompt/session.ts
- **Status**: NOT FIXED ✗

design.md Risks/Trade-offs states "要約に spec/format.md のバージョン注記を含めることで、手動更新のトリガを可視化する". The `FORMAT_RULES_SUMMARY` constant in `session.ts` contains no `format-version: 0` reference or link to `spec/format.md`. The iter 2 fixer added only the view-type rows; no version note was added.

---

### [NOT FIXED] Finding 7 — 論点 8「manifest の要約は常に注入」と「Enabled Layers のみ」の解釈乖離が記録されていない
- **File**: docs/open-questions.md
- **Status**: NOT FIXED ✗

The "初版実装済み" note added in commit `b212de6` is still the only addition to open-questions.md §8. It records that `SESSION_MAX_HOPS` implements the hop rule but does not address the interpretation gap: §8 says "manifest と形式規則の要約は常に注入" while `SessionInput §6` injects only the `enabled` list (omitting `request-template`, `request-output-dir`, etc.). The rationale ("D8: session は消費者設定に依存しない") exists in design.md but is not cross-referenced to §8's "manifest の要約" phrase. The iter 2 fixer made no changes to `docs/open-questions.md`.

---

## Findings Requiring Fix

| # | Severity | File | Title |
|---|----------|------|-------|
| F2 | low | src/cli/commands/prompt.test.ts | 縮約上限テスト: `実装: src/core/` が stdout に含まれないことを assert する |
| F3 | low | src/cli/commands/prompt.test.ts | non-top prefix テスト: `--topic ent-order` で exit 2 + stderr 診断を assert する |
| F6 | low | src/prompt/session.ts | FORMAT_RULES_SUMMARY に `spec/format.md` のバージョン注記（例: `format-version: 0`）を追加する |
| F7 | low | docs/open-questions.md | §8「manifest の要約 = enabled 一覧」という縮小解釈の根拠を D8 への参照とともに明記する |
