# Regression Gate Result — op-element / Iteration 1

## Verification Summary

All 4 findings from the review ledger were verified against the current branch code. No regressions detected.

---

## Finding 1 (MEDIUM): T-09 が request.md 要件 7 および design D5 と矛盾

**Status: FIXED**

Current `specrunner/changes/op-element/tasks.md` T-09 has been corrected:
- First bullet now explicitly scopes to `c06-view-links.test.ts` only: `c06-view-links.test.ts の perm 操作行テストを新文法（- [[op-id]]: [[act-id]]）に書き換える（PermOperation の operation フィールドを op ID に変更する）`
- Third bullet explicitly preserves free tokens in permissions.test.ts: `src/export/permissions.test.ts の変更スコープはテスト名のみ（T-07 委譲）。PermOperation の operation フィールドは自由トークンのまま残す（generatePermissions は文法非依存の純関数であり、直接構築では旧実装と区別できない — design D5）`

Implementation confirms alignment: `src/export/permissions.test.ts` line 44 retains `operation: "create"` (free token); `src/check/rules/c06-view-links.test.ts` uses `operation: "op-create-deal"` (op ID). No contradiction with request.md requirement 7 or design D5.

---

## Finding 2 (LOW): T-09 が makeGraph ヘルパーの permTargets → targetLines 移行を記述していない

**Status: FIXED**

Current tasks.md T-09 second bullet now explicitly covers the migration:
> `src/check/rules/c06-view-links.test.ts` および `src/export/permissions.test.ts` の makeGraph ヘルパーで `permTargets: []` を `targetLines: []` に置換する（T-02 の ParseResult 型変更によるコンパイルエラー解消）

Implementation confirms: both `src/export/permissions.test.ts` (line 21) and `src/check/rules/c06-view-links.test.ts` (line 20) use `targetLines: []` in their makeGraph helpers.

---

## Finding 3 (HIGH): §11 permissions export 例が ADR-0025 D2「自由トークン廃止」と矛盾する

**Status: FIXED**

`spec/format.md` lines 318–319 now use op IDs as keys:
```json
"op-create-deal": ["act-admin", "act-manager"],
"op-list-deals": ["act-admin", "act-finance", "act-manager", "act-member"]
```

No free tokens remain in the §11 permissions export example. The example is now consistent with ADR-0025 D2 and the implementation.

---

## Finding 4 (MEDIUM): §8 perm の単一参照制約が ADR-0023 D2 に存在しない根拠を引用する

**Status: FIXED**

`spec/format.md` line 255 now reads:
> `対象:` 行は任意。書く場合は単一参照。複数参照は C6 違反。参照は C3 の一般規則で解決される

The erroneous `（ADR-0023 D2）` citation has been removed. The constraint is stated as a plain fact without attributing it to ADR-0023 D2 (which only addresses surface-independence, not reference-count of `対象:` lines).

The remaining reference to ADR-0023 D2 on line 256 is for a different claim (surface-independence of operations) and is correct.
