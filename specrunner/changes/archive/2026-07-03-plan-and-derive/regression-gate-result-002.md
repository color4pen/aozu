# Regression Gate Result — iteration 002

- **verdict**: needs-fix

## Ledger Verification

### [✅ FIXED] TC-017 — derive rejects when group elements do not resolve

`createUnresolvedElementFixture` helper (prompt.test.ts:167–225) creates a plan referencing
`[[ent-nonexistent]]` which has no matching heading in the graph. The subprocess test at
prompt.test.ts:580–594 asserts `exitCode === 2` and `stderr` contains `"ent-nonexistent"`.
Production code at prompt.ts:236–243 is confirmed correct. **Still fixed.**

---

### [✅ FIXED] TC-044 — template command non-zero exit → exit 2 (first entry)

Test at prompt.test.ts:419–448 (`"request-template command exits non-zero → exit 2 + stderr
diagnostic (TC-044)"`) sets `request-template: exit 1` (a shell command that always fails with no
file at that path), runs derive, and asserts `exitCode === 2` and `stderr` contains
`"request-template"`. Production code at prompt.ts:305–322 handles this correctly.
**Still fixed.**

---

### [✅ FIXED] TC-044 carryover — same finding (iteration-001 carry)

Covered by the same test added for TC-044 (prompt.test.ts:419–448). **Still fixed.**

---

### [✅ FIXED] openTopics 計算が ADR-0018-3 と矛盾

`src/plan/frontier.ts:63–71` に NOTE コメントが追記されており、ADR-0018-3 準拠への移行が
coverage/mark request のスコープであること、plan/derive が `frontier.designed` のみを
消費するため動作影響がないことを明示している。`design.md D1`（移設時の整合裁定 2）もこの
経緯を正式に記録している。**Still fixed (documented deferral).**

---

### [✅ FIXED] D8 Decision 文と Rationale 文が derive loop 無効時の exit code で矛盾する

`design.md:137` の Decision 文は derive の loop 無効を exit 1 と定め、
`design.md:141` の Rationale も「**どちらも exit 1**」と一貫している。
`tasks.md` T-09（line 216）の acceptance criteria も「return 1（loop 無効は段階ゲート =
検証不合格であり exit 1）」に更新済み。T-10（line 264, 275）も「exit 1」に更新済み。
実装（prompt.ts:169）とテスト（prompt.test.ts:465 `expect(exitCode).toBe(1)`）も exit 1 で一貫。
三すくみが解消された。**Still fixed.**

---

### [✅ FIXED] D8 Rationale が存在しない spec/integration.md §5 の exit code 規約を参照している

`design.md:141` の Rationale が書き換えられており、現在は
「この分類は ADR-0010 の明示エラーの原則から自己完結する
（spec/integration.md §5 共通規約は exit code 規約を規定しない）」
と明示している。誤った §5 参照が除去され、ADR-0010 に根拠が集約された。
**Still fixed.**

---

### [❌ REGRESSION] heading 境界判定パターンが design.md Risks 記述および spec §5 と乖離している

- **File**: src/graph/body.ts:28
- **Severity**: high
- **Resolution**: fixable

**現状**: `body.ts:28` は `const HEADING_ELEMENT_RE = /^#{2,3} /;` のままであり、
h2 AND h3 どちらの見出し行でも要素本文を終端する。
`design.md` Risks 節（line 218）は依然として
「見出し要素は次の同レベル以上見出し（`## ` で始まる行）まで」と h2 境界のみを明示しており、
regression-gate-result-001.md が NOT FIXED と判定した状態から変化がない。
`spec/format.md §5` も「見出しから次の同レベル見出しまでが要素の本文」と定めており
（h2 要素は次の h2 まで）、`#{2,3}` パターンが h3 で h2 要素ボディを途切れさせる問題は未解消。

`body.ts` のファイルレベルコメント（lines 7–9）は
「next `##` or `###` heading」と `#{2,3}` の意図を記述しているが、
`design.md` Risks の `## ` 記述が更新されておらず、設計記録内の不一致が解消されていない。

`tasks.md` T-03（line 43）は `^#{2,3} ` と記述しており body.ts と一致するが、
これも design.md Risks の `## ` 記述との乖離を解消していない。

**Fix required**: regression-gate-result-001.md に示した次のいずれかを実施する。

(a) `body.ts:28` を `const HEADING_ELEMENT_RE = /^## /;` に変更し、h2 のみで境界を取る。
    design.md Risks はすでに `## ` を明示しており変更不要。
    `tasks.md T-03`（line 43）の `^#{2,3}` を `^## ` に更新する。

(b) design.md Risks 節の「`## ` で始まる行」を `^#{2,3}` に更新し、
    h3 見出しも要素宣言になりうる（spec §5 宣言パターン `^#{2,3}`）ため
    境界として扱う根拠を明示する。`body.ts` のファイルレベルコメントと
    tasks.md T-03 はすでに `#{2,3}` 記述なので追加変更不要。
