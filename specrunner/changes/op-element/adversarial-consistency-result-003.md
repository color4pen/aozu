# 敵対的整合レビュー — op-element

Reviewer: adversarial-consistency
Iteration: 3

---

## 前周 findings の再確認

### F-01（前周 medium）: spec.md および design.md の ADR-0023 D2 誤引用 → **解消済み**

現在の spec.md L51 は以下のように記述されている:

> The system SHALL enforce perm `対象:` lines to contain exactly one reference (perm schema in spec/format.md §8, made explicit by this change; ADR-0023 does not constrain the reference count of `対象:` lines).

現在の design.md Goals L25 は以下のように記述されている:

> 4. perm の `対象:` 行の複数参照を C6 error にする（perm の対象は単一参照 — spec/format.md §8 の perm スキーマとして本変更で明文化。ADR-0023 は `対象:` 行の参照数を定めていない）

いずれも前周指摘の誤引用（"ADR-0023 D2"）が除去され、正しい根拠（spec/format.md §8 の perm スキーマとして本変更で明文化、ADR-0023 は`対象:` 行参照数を制約しない旨）に改められている。解消済みと判定する。

---

## 今周の反証試行

### 観点 1: op が domain 層機構に正しく載っているか

以下の宣言的定数を確認した:

- `KNOWN_PREFIXES`（src/parse/id.ts）: `"op"` が含まれる
- `LAYER_MAP`（src/check/manifest.ts L68）: `op: "domain"` が設定されている
- `LAYER_TO_PREFIXES.domain`（同 L152）: `["term", "ent", "inv", "act", "op"]` — `op` が含まれる
- `LAYER_ALLOWED_TARGET_PREFIXES`（src/check/rules/c11-layer-direction.ts L22–28）: domain / static / dynamic / views の全集合に `op` が追加されている
- `IMPLEMENTATION_PREFIXES`（src/plan/frontier.ts L43）: `"op"` が含まれる

ADR-0025 Decision 1（"op 型の追加（domain 層・見出し要素）"）と矛盾しない。反証を構成できなかった。

### 観点 2: perm `対象:` 行の単一参照制約と ADR-0023 D3 の整合

ADR-0023 D3 は "`対象:` 行（任意）は任意の実在要素を指せる（解決検証は C3 の一般規則）" と述べるのみで参照数の制約を置いていない。単一参照制約は旧実装の正規表現 `PERM_TARGET_LINE_RE = /^対象: \[\[([a-z0-9-]+)\]\]$/` によって実行時に強制されていたが、ADR の決定記録ではなかった。

本変更は C6 の義務として明示化し（spec/format.md §8 / §10 C6 に転記）、spec.md および design.md の根拠記述は "ADR-0023 D2" から "spec/format.md §8 の perm スキーマとして本変更で明文化" に修正されている。ADR-0023 D3 に対する矛盾を構成できなかった。

### 観点 3: spec/format.md §10 C11 の domain 列挙

現行 spec/format.md L292:
> domain の要素は domain（term / ent / inv / act / op）のみを参照できる

`LAYER_ALLOWED_TARGET_PREFIXES.domain = new Set(["term", "ent", "inv", "act", "op"])` と一致する。ADR-0025 Decision 1 との矛盾を構成できなかった。

### 観点 4: spec/format.md §11 permissions export の操作キー

現行 spec/format.md §11（L318–319）:
```json
"op-create-deal": ["act-admin", "act-manager"],
"op-list-deals": ["act-admin", "act-finance", "act-manager", "act-member"]
```

ADR-0025 Decision 2（"自由トークンを廃止する"）と整合する。permissions.ts の実装も PermOperation.operation フィールド（op ID）をそのまま操作キーに使用しており、矛盾を構成できなかった。

### 観点 5: malformed 操作行の二段検出と ADR-0024 要件 2 との対称性

structured-lines は malformed 操作行を分類のみ行い（`malformedPermOperations`）、診断は C6 が発行する。これは extractRequestCitations が malformedLines を返して check --request が R3 を発行する「分類は抽出時・診断は消費側」の定型と同型である。ADR-0024 要件 2 との矛盾を構成できなかった。

### 観点 6: malformed のみの perm が 2 errors を発行するか

c06-view-links.ts の実装（L103–128）:
1. malformed ループ（(a)）で各 malformed 行に error を発行
2. valid ops リスト（malformed を含まない）が空 → 非空義務 error (b) + continue

malformed のみの perm は malformed error(s) と非空義務 error の両方を発行し、規則間の抑制関係は生じない。request.md 要件 5「2 errors」と矛盾しない。

### 観点 7: op targetLines の消費者不在の検査

op 帰属の targetLines（複数参照を含む）は `export operations`（ADR-0025 Decision 3 / spec/format.md §11）が消費する予定の named consumer であり、スコープ外として本 request では実装されていない。消費者が名指しされているため "消費者不在の形式化" の指摘を構成できなかった。

### 観点 8: format 0 内改訂と format-version 増分不要の根拠

spec/format.md Status: "draft — ドッグフーディングでの修正を前提とする" および ADR-0025 Decision 4: "旧文法の有効な corpus / consumer が存在しない" が根拠。format-version を増分しない判断に矛盾を構成できなかった。

### 観点 9: 段階・縮退の穴

permission は domain を前提とする（spec/format.md §3 前提表）。domain が無効かつ permission が有効の組み合わせは C7 が検出する。op を domain 層に置くことで前提表の変更は不要であり、ADR-0023 D7（縮退と fail-closed は既存規則の一貫適用）と整合する。反証を構成できなかった。

### 観点 10: uc / scr の去就・C5 への op 追加のスコープ外判断

open-questions 論点 17 に未確定として明示されており、ADR-0025 Alternatives（"uc / scr の同時削除"「trace の実装判断まで C5 には触れない」）と整合する。本 request のスコープ外判断に矛盾を構成できなかった。

---

## 反証を試みて不能だった観点（総括）

- op が domain 層機構（KNOWN_PREFIXES / LAYER_MAP / LAYER_TO_PREFIXES / LAYER_ALLOWED_TARGET_PREFIXES / IMPLEMENTATION_PREFIXES）に正しく載っているか → 矛盾なし
- perm `対象:` 単一参照制約の根拠記述（spec.md / design.md / spec/format.md）が ADR-0023 を正しく扱っているか → 前周指摘は解消済み、現在の記述に矛盾なし
- spec/format.md §10 C11 の domain 列挙に op が含まれているか → 含まれており矛盾なし
- spec/format.md §11 permissions export 例のキー → op ID キーに更新済みで ADR-0025 D2 と整合
- malformed 操作行の二段検出が ADR-0024 要件 2 の定型に従っているか → 従っており矛盾なし
- malformed のみの perm が 2 errors → 正しく実装されており矛盾なし
- op targetLines の消費者 → export operations として名指しされており消費者不在ではない
- format 0 内改訂の根拠 → draft 明示・corpus 不在で矛盾なし
- 段階・縮退の穴 → C7 が domain/permission 組み合わせ不正を検出し矛盾なし
- uc / scr の去就・C5 への op 追加のスコープ外 → open-questions 論点 17 に委ね ADR-0025 と整合
