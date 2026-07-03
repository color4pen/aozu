# Regression Gate Result — iteration 001

- **verdict**: needs-fix

## Ledger Verification

### [✅ FIXED] TC-017 — derive rejects when group elements do not resolve

`createUnresolvedElementFixture` helper (prompt.test.ts:167–225) creates a plan referencing
`[[ent-nonexistent]]` which has no matching heading. The subprocess test at
prompt.test.ts:580–594 asserts `exitCode === 2` and `stderr` contains `"ent-nonexistent"`.
Production code at prompt.ts:236–243 is confirmed correct. **Still fixed.**

### [✅ FIXED] TC-044 — template command non-zero exit → exit 2

Test at prompt.test.ts:419–448 (`"request-template command exits non-zero → exit 2 + stderr diagnostic (TC-044)"`)
sets `request-template: exit 1`, runs derive, and asserts `exitCode === 2` and
`stderr` contains `"request-template"`. Production code at prompt.ts:305–322 handles
this correctly. **Still fixed.**

### [✅ FIXED] TC-044 carryover — same as above (iteration-002 carry)

Covered by the same test added for TC-044 above. **Still fixed.**

### [✅ FIXED] openTopics 計算が ADR-0018-3 と矛盾したまま正規モジュールに転記された

`src/plan/frontier.ts:63–71` に NOTE コメントが追記されており、ADR-0018-3 準拠への移行が
coverage/mark request のスコープであること、plan/derive が `frontier.designed` のみを
消費するため動作影響がないことを明示している。`design.md D1` の「移設時の整合裁定 2」も
この経緯を正式に記録している。**Still fixed (documented deferral).**

---

### [❌ REGRESSION] D8 Decision 文と Rationale 文が derive loop 無効時の exit code で矛盾する

- **File**: specrunner/changes/plan-and-derive/design.md:141
- **Severity**: medium
- **Resolution**: fixable

**現状**: `design.md:137` の Decision 文は「derive は loop 無効時に exit 1 を返す」と定め、
実装（`prompt.ts:168`）およびテスト（`prompt.test.ts:465 expect(exitCode).toBe(1)`）も
exit 1 で一貫している。しかし同 D8 の Rationale（line 141）は
「derive の loop 無効は実行の前提設定不備（exit 2）と位置づける」と述べ、正反対の分類を行っている。
さらに `tasks.md T-09`（line 216）と T-10（line 264–275）は `return 2`・`exit 2` を
acceptance criteria として記録したままである。

設計記録内に Decision（exit 1）/ Rationale（exit 2）/ tasks.md（exit 2）の三すくみが残存し、
「なぜこの exit code か」の根拠が確定していない。後続の coverage/mark 実装が同一ゲートパターンを
引き継ぐ際に混乱の種となる。**NOT FIXED.**

**Fix required**: D8 Rationale の末尾一文（「derive の loop 無効は実行の前提設定不備（exit 2）と位置づける」）
を「derive の loop 無効も plan と同様に検証不合格（exit 1）として扱う」に書き換え、
tasks.md T-09（line 216）および T-10（line 264）の `return 2`/`exit 2` を `return 1`/`exit 1` に修正する。

---

### [❌ REGRESSION] D8 Rationale が存在しない spec/integration.md §5 の exit code 規約を根拠として参照している

- **File**: specrunner/changes/plan-and-derive/design.md:141
- **Severity**: medium
- **Resolution**: fixable

**現状**: D8 Rationale は「exit code は spec/integration.md §5 の規約に従い、入力不正は exit 2、
検証不合格は exit 1」と主張する。しかし `spec/integration.md §5`（共通規約）の内容は
「診断はすべて stderr / format-version 増分条件 / 推奨結線（非規範）」の 3 点のみであり、
exit code についての記述を一切持たない。§1 と §2 は個別コマンド（check / mark）の
exit code を定めるが、plan/derive の exit code はいずれの節にも記載されていない。

§5 を正当性根拠として参照する文書記録は誤りであり、将来の呼び出し側（CI スクリプト等）が
D8 記述と spec/integration.md を突き合わせたとき矛盾を発見する。**NOT FIXED.**

**Fix required**: D8 Rationale の「exit code は spec/integration.md §5 の規約に従い…」の参照を除去し、
plan/derive の exit code 規約が spec/integration.md に明文化されていない現状を認め、
D8 の Decision（ADR-0010 ゲートパターン）の文言に自己完結する形で根拠を書き直す。
必要であれば spec/integration.md §5 に plan/derive の exit code 規約を追補し、
そこへ参照を向ける。

---

### [❌ REGRESSION] heading 境界判定パターンが design.md Risks 記述および spec §5 と乖離している

- **File**: src/graph/body.ts:28
- **Severity**: low
- **Resolution**: fixable

**現状**: `body.ts:28` は `const HEADING_ELEMENT_RE = /^#{2,3} /;` を使用し、
h2 AND h3 どちらの見出し行でも要素本文を終端する。`design.md` Risks 節の D3 mitigation は
「見出し要素は次の同レベル以上見出し（`## ` で始まる行）まで」と h2 境界のみを明示し、
`spec/format.md §5` も「見出しから次の同レベル見出しまでが要素の本文」と定める（h2 要素は次の h2 まで）。
`tasks.md T-03` が `^#{2,3}` と記述していることで設計記録内の記述が割れており、
実装の意図根拠が定まっていない。現行 design/ には h3 非要素見出しが存在しないため
直接的な動作影響はないが、将来の設計文書拡張時に derive の context 欠落リスクとなる。**NOT FIXED.**

**Fix required**: 次のいずれかの対応を選択する。
(a) `body.ts:28` を `const HEADING_ELEMENT_RE = /^## /;` に変更し、h2 のみで境界を取り、
    `design.md` Risks・spec §5 と一致させる。`tasks.md T-03` も `^## ` に更新。
(b) spec §5 の「同レベル見出し」解釈を `^#{2,3}` とする根拠を design.md に明示し、
    `body.ts` のコメントと `tasks.md T-03` を統一する（spec §5 の改訂も要検討）。
