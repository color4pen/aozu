# 敵対的整合レビュー — Iteration 2

- **verdict**: needs-fix

---

## Iteration 1 所見の対応確認

- **Finding 1（`act` が IMPLEMENTATION_PREFIXES に欠落 — high）**: 対応済み。`src/plan/frontier.ts:43` の `IMPLEMENTATION_PREFIXES` に `"act"` が追加され、ADR-0005・ADR-0015 の整合が回復した。
- **Finding 2（`openTopics` が ADR-0018-3 に違反 — medium）**: 対処済み。`src/plan/frontier.ts:63-71` に `NOTE` コメントが追記され、`design.md D1`（移設時の整合裁定 2）が ADR-0018-3 準拠への移行を coverage/mark request のスコープとして明示的に記録した。plan/derive が `frontier.designed` のみを消費するため動作影響がないことも文書化された。

---

## 1. design.md D8 の Decision 文と Rationale 文が derive loop 無効時の exit code で矛盾する

**主張**: `design.md` D8 の決定文は derive の loop 無効を exit 1 と定め、実装（`prompt.ts:169`）および回帰テスト（`prompt.test.ts:465`）もこれに従うが、同じ D8 の Rationale 文は「derive の loop 無効は実行の前提設定不備（exit 2）と位置づける」と述べ、exit 2 が正しいと正反対の分類を行っている。さらに `tasks.md` T-09・T-10 も exit 2 の仕様を記録したままであり、設計記録内で決定の根拠が確定していない。

**根拠引用（決定文）**:

- `specrunner/changes/plan-and-derive/design.md` D8: 「**derive コマンド**: handler 冒頭で `isLayerEnabled("loop", manifest)` を検査し、false なら stderr に案内メッセージを出力して **exit 1** を返す（... 段階ゲート（ADR-0010 の明示エラー）は設定欠落とはクラスが異なり、plan と同じ検証不合格 = exit 1 に揃える）。」

**矛盾引用（Rationale 文・tasks）**:

- `specrunner/changes/plan-and-derive/design.md` D8 Rationale: 「plan の loop 無効は設計フローの段階チェック（exit 1）、**derive の loop 無効は実行の前提設定不備（exit 2）と位置づける**。」
- `specrunner/changes/plan-and-derive/tasks.md` T-09: 「`isLayerEnabled("loop", manifest)` → false なら stderr に案内出力して **return 2**（derive にとって loop 無効は設定不備 = 入力不正であり exit 2）」
- `specrunner/changes/plan-and-derive/tasks.md` T-10 Acceptance Criteria: 「loop 無効 → **exit 2**（derive では loop 無効は設定不備 = exit 2）」

**深刻度**: medium — D8 という単一の決定文書内で Decision と Rationale が相反しており、「なぜこの exit code を選んだか」の根拠記録が壊れている。実装・テストは exit 1 で一貫しているため機能的問題はないが、後続の coverage/mark 実装が同一ゲートパターンを引き継ぐ際に混乱の種となる。tasks.md T-09・T-10 の受け入れ基準が exit 2 のままであることも同様。

---

## 2. design.md D8 Rationale が exit code 根拠として参照する spec/integration.md §5 に exit code 規約が存在しない

**主張**: `design.md` D8 Rationale は「exit code は spec/integration.md §5 の規約に従い、入力不正は exit 2、検証不合格は exit 1」と述べ、plan/derive の exit code が §5 に定められた共通規約に従うと主張する。しかし `spec/integration.md §5`（共通規約）は exit code についていかなる規定も持たない。plan/derive の exit code が「検証不合格 = 1、入力不正 = 2」とする根拠規定は現行 spec に存在せず、§1・§2・§3 の個別コマンドに暗黙のパターンがあるに過ぎない。

**根拠引用**:

- `specrunner/changes/plan-and-derive/design.md` D8 Rationale: 「exit code は **spec/integration.md §5 の規約**に従い、入力不正は exit 2、検証不合格は exit 1。」

**矛盾引用**:

- `spec/integration.md §5`（共通規約）全文: 「診断はすべて stderr、成果物（ruleset 等）は stdout / 破壊的変更は `format-version` の増分と同時にのみ行う / 呼び出し側の推奨結線（非規範）: request 検証 step で §1、取り込み完了 hook で §2、CI で `check` + §3 `--verify`」— exit code についての記述なし。

**矛盾引用（exit code が定められている箇所）**:

- `spec/integration.md §1`: 「**exit code**: 0 = 合格 / 1 = 不合格 / 2 = 入力不正（ファイル不存在・design/ 不在）」（`check --request` のみに適用）
- `spec/integration.md §2`: 「**exit code**: 0 = 遷移完了（no-op 含む）/ 1 = 未知の slug / 2 = 入力不正」（`mark implemented` のみに適用）

§5 は汎用的な exit code 規約を定めていない。plan/derive コマンドの exit code セマンティクスは integration.md のどの節にも記載されておらず、D8 の参照先は誤っている。

**深刻度**: medium — plan/derive の exit code 契約に spec の正当性根拠が無い状態となっており、将来の呼び出し側（CI スクリプト等）が D8 記述と spec を突き合わせたとき矛盾を発見する。ADR-0012 が「連携はファイルと CLI 契約のみ」と定めるなか、CLI 契約の exit code が spec/integration.md に明示されていないことは観点 2（消費者不在の形式化）にも該当する。

---

## 3. design.md Risks の本文境界記述と body.ts の実装が矛盾する

**主張**: `design.md` の Risks 節（D3 の mitigation）は見出し要素の本文境界を「`## ` で始まる行」（h2 のみ）と明示するが、`src/graph/body.ts` は `^#{2,3} ` パターン（h2 AND h3）で境界を判定する。h2 で宣言された要素（例: `## Module A {#mod-a}`）のボディ内に非要素 h3 見出し（例: `### Implementation Notes`）がある場合、body.ts は h2 要素ボディを h3 で途切れさせ、設計文書の実態よりも短い本文を返す。`spec/format.md §5` も「見出しから次の同レベル見出しまでが要素の本文」と述べており（h2 要素は次の h2 まで）、`^#{2,3}` によって h3 で終端するのは spec とも乖離する。

**根拠引用**:

- `specrunner/changes/plan-and-derive/design.md` Risks 節 D3 mitigation: 「見出し要素は次の同レベル以上見出し（**`## ` で始まる行**）まで、文書要素は EOF までという単純な規則で始め、テストで固定する」
- `spec/format.md §5`: 「パターン: `^#{2,3} (.+) \{#(<id>)\}$`。**見出しから次の同レベル見出しまでが要素の本文**」（h2 要素であれば次の h2 まで）

**矛盾引用**:

- `src/graph/body.ts:28`: `const HEADING_ELEMENT_RE = /^#{2,3} /;`
- `specrunner/changes/plan-and-derive/tasks.md` T-03: 「宣言行の次の行から、同じファイル内の次の同レベル以上の見出し（**`^#{2,3} ` で始まる行**）の直前まで」

**反例**: `design/static/modules.md` の `## CLI {#mod-cli}` が将来 `### セクション` 等の h3 下位節を持つように拡張された場合、`extractElementBody("mod-cli", ...)` は h3 行で切断し、以降の本文を `prompt derive` の対象要素ボディから欠落させる。derive が提供する context が不完全になることで、生成される request 草稿に引用漏れが発生し、coverage 検証で不合格となる可能性がある。

**深刻度**: low — 現行の `design/` ファイルはすべての heading 要素が h2 単一レベルであり、h3 非要素見出しは存在しないため直接的な動作影響はない。ただし design.md Risks と T-03 の記述が異なる規則を述べており、実装の意図の根拠が設計記録内で分裂している。

---

## 反証を試みて不能だった観点

- **観点 1（Iteration 1 finding 1 の残存リスク）**: `IMPLEMENTATION_PREFIXES` への `"act"` 追加は frontier.ts のコメント・テスト追記を含め ADR-0005・ADR-0015 と整合している。反証不能。
- **観点 1（Iteration 1 finding 2 の残存リスク）**: design.md D1 が openTopics 計算の deferral を明示的に記録し、frontier.ts に NOTE コメントが付与された。plan/derive の動作への影響がないことも確認できる。反証不能。
- **観点 2（消費者不在の形式化 — spec/format.md §3 追補）**: `request-template` / `request-output-dir` の消費者は `prompt derive` として spec/integration.md §4 に明記された。spec/format.md §3 の記述と整合。反証不能。
- **観点 3（テンプレートのデュアルモード — ファイル実在性でモード切替）**: D7 の設計は意図的な選択として記録されており、具体的な反例（コマンドと同名ファイルが存在するケースも含め）は ADR-0012 の記述と矛盾しない。反証不能。
- **観点 4（段階縮退の穴 — manifest enabled 組合せ）**: plan/derive いずれも loop 無効の場合に明示的なエラーを返し、縮退して動くふりをしない（ADR-0010 準拠）。loop 有効かつ他設定欠落の場合の挙動も exit 2 で明確に定義されている。反証不能。
- **観点 5（ADR-0018-2 との整合 — `request:` 行の廃止）**: `generatePlan` は `request:` 行を一切出力しない。design/static/modules.md の mod-plan 責務行から「グループへの request 記録」が除去された。ADR-0018-2 との矛盾なし。
