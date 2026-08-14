# 敵対的整合レビュー — op-element

Reviewer: adversarial-consistency
Iteration: 2

---

## 前周 findings の再確認

### F-01（前周 high）: spec/format.md §11 permissions export 例と ADR-0025 D2 の矛盾 → **解消済み**

現在の spec/format.md §11（L318–319）は `"op-create-deal"` / `"op-list-deals"` を operations キーとして使用しており、ADR-0025 D2「自由トークン廃止」と整合する。code-fixer による修正を確認。

### F-02（前週 medium）: spec/format.md §8 perm の ADR-0023 D2 誤引用 → **spec/format.md は解消済みだが、spec.md / design.md に同一誤引用が残存**

spec/format.md §8（L255）から "(ADR-0023 D2)" の引用は除去された。しかし同じ誤引用が spec.md と design.md に残っており、以下の F-01 として再指摘する。

---

## F-01: spec.md および design.md が perm `対象:` 単一参照制約の根拠として ADR-0023 D2 を誤引用している

**主張**: spec.md の Requirement 「perm target line SHALL reject multiple references as C6 error」と design.md の Goals 項目 4 は、perm `対象:` 行の単一参照制約の根拠として ADR-0023 D2 を引用しているが、ADR-0023 D2 はこの制約を述べた節ではない。

**根拠引用** (spec.md L51):
> The system SHALL enforce perm `対象:` lines to contain exactly one reference (ADR-0023 D2).

**根拠引用** (design.md Goals L25):
> 4. perm の `対象:` 行の複数参照を C6 error にする（perm は単一参照のみ — ADR-0023 D2）

**矛盾引用** (adr/0023-permission-view.md D2 全文):
> ### D2: 操作行の文法は表面非依存とする
>
> 機械の読む正本は操作行 `- <operation>: [[act-id]](, [[act-id]])*`。operation はプロジェクトの語彙（自由トークン）であり、その操作が画面・API・MCP ツールのどの表面から呼ばれるかを perm は知らない。表面 → 操作の対応はコード側の関心事で……

ADR-0023 D2 は操作行の文法（自由トークン・表面非依存）を定めた節であり、`対象:` 行の参照数に関する記述は一切含まない。`対象:` 行を扱うのは ADR-0023 D3 だが、D3 も「任意の実在要素を指せる」と述べるのみで単一参照制約は明記していない。

perm `対象:` 行を単一参照に実行時制限していたのは旧実装の正規表現 `PERM_TARGET_LINE_RE = /^対象: \[\[([a-z0-9-]+)\]\]$/`（実装上の事実）であり、ADR によって決定記録された制約ではなかった。前周の F-02 で指摘した誤引用が spec/format.md では除去されたが、spec.md と design.md では残っている。

**深刻度**: medium — spec.md は形式仕様的位置づけの要求文書であり、ADR-0023 D2 を根拠に挙げても将来の読者は同節に該当記述を見つけられない。記述の修正が必要。

---

## 反証を試みて不能だった観点

- **op が domain 層機構に正しく載っているか**: KNOWN_PREFIXES・LAYER_MAP・LAYER_TO_PREFIXES.domain・LAYER_ALLOWED_TARGET_PREFIXES（domain / static / dynamic / views の各集合）への `op` 追加は一貫しており、ADR-0025 Decision 1（domain 層・見出し要素）と矛盾しない

- **spec/format.md §10 C11 の domain 列挙**: 現行 L292 は「domain（term / ent / inv / act / op）」と記述しており、LAYER_ALLOWED_TARGET_PREFIXES の domain 集合 `["term", "ent", "inv", "act", "op"]` および ADR-0025 Decision 1 と整合する

- **spec/format.md §11 permissions export 例**: L318–319 で `"op-create-deal"` / `"op-list-deals"` を操作キーとして示しており、ADR-0025 D2「自由トークン廃止」と整合する（前周 F-01 解消確認）

- **malformed 操作行の二段検出と ADR-0024 要件 2 との対称性**: `structured-lines` は分類のみ行い診断は C6 が発行する設計は、extractRequestCitations が malformedLines を返して check --request が R3 を発行する定型と同型であり、矛盾を構成できなかった

- **`targetLines` の op 帰属データに消費者がいないか**: `export operations`（ADR-0025 Decision 3 / spec/format.md §11）が named consumer として存在する。消費者は名指しされており不在ではない

- **malformed のみの perm が malformed error + 非空義務 error の 2 errors を発行するか**: c06-view-links.ts の実装は (a) malformed ループ → (b) ops.length === 0 で非空 error + continue の順序により、malformed error 先行・非空義務 error 後続の 2 errors を正しく発行する。規則間抑制は生じない

- **`format 0` 内改訂の根拠**: spec/format.md Status「draft — ドッグフーディングでの修正を前提とする」と ADR-0025 D4「旧文法の有効な corpus / consumer が存在しない」は整合する。format-version を増分しない判断に矛盾は構成できなかった

- **段階・縮退の穴**: permission は domain を前提とする（spec/format.md §3 前提表）。domain 無効かつ permission 有効の組み合わせは C7 が検出する。op を domain に置くことで前提表に変更不要である点は ADR-0025 Decision 1 と ADR-0023 D3・D7 の既存設計と整合する

- **uc / scr の去就・C5 への op 追加のスコープ外**: open-questions.md §17 に未確定として明示されており、ADR-0025 の「却下: uc / scr の同時削除」・「trace の実装判断まで C5 には触れない」と整合する
