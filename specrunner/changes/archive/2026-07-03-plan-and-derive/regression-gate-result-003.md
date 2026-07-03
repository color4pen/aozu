# Regression Gate Result — iteration 003

- **verdict**: approved

## Ledger Verification

### [✅ FIXED] TC-017 — derive rejects when group elements do not resolve

`createUnresolvedElementFixture` helper (prompt.test.ts:167–225) creates a plan file
`plans/test-plan.md` with `grp-test` whose `elements:` line references `[[ent-nonexistent]]`,
an ID absent from the graph. The subprocess test at prompt.test.ts:580–594 asserts
`exitCode === 2` and `stderr` contains `"ent-nonexistent"`.
Production code at prompt.ts:236–243 filters unresolved IDs via `graph.elements.has(id)` and
returns 2 with a stderr diagnostic. **Still fixed.**

---

### [✅ FIXED] TC-044 — template command non-zero exit → exit 2 (first entry)

Test at prompt.test.ts:419–448 (`"request-template command exits non-zero → exit 2 + stderr
diagnostic (TC-044)"`) sets `request-template: exit 1` (a shell command that always exits
non-zero, with no file at that path), runs `prompt derive`, and asserts `exitCode === 2` and
`stderr` contains `"request-template"`.
Production code at prompt.ts:305–322 (`resolveTemplate`) executes the command via
`Bun.spawn(["sh", "-c", value])`, checks the exit code, and writes a stderr diagnostic before
returning `null` (→ exit 2). **Still fixed.**

---

### [✅ FIXED] TC-044 carryover — same finding (iteration-001 carry)

Covered by the same test added for TC-044 (prompt.test.ts:419–448). **Still fixed.**

---

### [✅ FIXED] openTopics 計算が ADR-0018-3 と矛盾

`src/plan/frontier.ts:63–71` には NOTE コメントが追記されており、ADR-0018-3 準拠への移行が
coverage/mark request のスコープであること、plan/derive が `frontier.designed` のみを
消費するため動作影響がないことを明示している。
`design.md D1`（line 56）もこの経緯を正式に記録している（「openTopics の frontmatter
`status` 依存は本変更では移設のまま保持する」「frontier.ts の該当箇所にこの経緯を NOTE
コメントとして残し、暗黙の定着を防ぐ」）。**Still fixed (documented deferral).**

---

### [✅ FIXED] D8 Decision 文と Rationale 文が derive loop 無効時の exit code で矛盾する

`design.md:137` の Decision 文は derive の loop 無効を exit 1 と定め（「plan と同じ段階ゲート
= exit 1」）、`design.md:141` の Rationale も「**どちらも exit 1**」と一貫している。
実装（prompt.ts:169 `return 1`）とテスト（prompt.test.ts:465 `expect(exitCode).toBe(1)`）も
exit 1 で一致している。三すくみは解消された。**Still fixed.**

---

### [✅ FIXED] D8 Rationale が存在しない spec/integration.md §5 の exit code 規約を参照している

`design.md:141` の Rationale は「この分類は ADR-0010 の明示エラーの原則から自己完結する
（spec/integration.md §5 共通規約は exit code 規約を規定しない）」と明示しており、
存在しない §5 への誤参照が除去されている。ADR-0010 に根拠が集約された。**Still fixed.**

---

### [✅ FIXED] heading 境界判定パターンが design.md Risks 記述および spec §5 と乖離している

`src/graph/body.ts:30` は `const HEADING_ELEMENT_RE = /^## /;`（h2 のみ）になっており、
前回 iteration-002 が指摘した `^#{2,3} ` パターンが修正されている。
`design.md` Risks 節（line 218）は「次の同レベル以上見出し（`## ` で始まる行）まで」と
h2 境界のみを明示しており、`body.ts` と一致している。
`tasks.md T-03`（line 43）も「`^## ` で始まる行」に更新済みであり、三者が揃った。
`body.ts` のファイルレベルコメント（lines 7–12）も「next same-level `##` heading」と
一貫した記述になっている。**Fixed (regression from iteration-002 resolved).**

---

## Test Run

全テスト green 確認済み: `422 pass, 0 fail` (bun test, 43 files).
