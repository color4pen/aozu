# 敵対的整合レビュー — op-element

Reviewer: adversarial-consistency
Iteration: 1

---

## F-01: spec/format.md §11 permissions export 例が ADR-0025 D2 と矛盾する

**主張**: spec/format.md §11 の permissions export JSON 例は operations のキーに自由トークン（`"create"`、`"list"`）を用いており、ADR-0025 D2 が明記する「自由トークンの廃止」と矛盾している。実装（permissions.ts）は op ID キーを正しく使っており、spec 文書と実装が整合していない。

**根拠引用** (spec/format.md §11、L318–319):
```json
"operations": {
  "create": ["act-admin", "act-manager"],
  "list": ["act-admin", "act-finance", "act-manager", "act-member"]
}
```

**矛盾引用** (adr/0025-operation-element.md D2):
> **perm 操作行の op 参照化**: 操作行を `- [[op-id]]: [[act-id]](, [[act-id]])*` に改め、**自由トークンを廃止する**。

同 Consequences:
> perm 操作行の旧文法（自由トークン）は不合法になる。

また design.md D6 は「§11 permissions export の例キー・§8 perm 操作行文法・§8 op スキーマは ADR-0025 merge 済み」と主張するが、git diff（spec/format.md 変更行 6 行）に §11 の改修は含まれておらず、現行 spec/format.md §11 は自由トークンのままである。ADR-0025 の Consequences にも「§11 operations export」の記載はあるが「§11 permissions export の例キー更新」は記載がない。design.md の主張は ADR-0025 の実際の内容と一致しない。

さらに request.md 要件 6 は「§11 permissions export の例のキーを op ID へ」を明示的に 転記漏れ修正として列挙しているが、tasks.md T-08 にこの修正項目は存在しない。

**深刻度**: high — spec/format.md は正典であり、ADR-0025 の決定（自由トークン廃止）と直接矛盾する記述が残る。

---

## F-02: spec/format.md §8 perm が ADR-0023 D2 に存在しない制約を引用する

**主張**: spec/format.md §8 perm の `対象:` 行更新箇所は「複数参照は C6 違反（ADR-0023 D2）」と記しているが、ADR-0023 D2 は `対象:` 行の参照数制約を決定した節ではない。

**根拠引用** (spec/format.md §8 perm、変更後行):
> `対象:` 行は任意。書く場合は単一参照。複数参照は C6 違反（ADR-0023 D2）。参照は C3 の一般規則で解決される

**矛盾引用**（引用先の ADR-0023 D2 本文）:
> 機械の読む正本は操作行 `- <operation>: [[act-id]](, [[act-id]])*`。operation はプロジェクトの語彙（自由トークン）であり、**その操作が画面・API・MCP ツールのどの表面から呼ばれるかを perm は知らない**。表面 → 操作の対応はコード側の関心事で……

ADR-0023 D2 は操作行の文法（自由トークン・表面非依存）を定めた節であり、`対象:` 行の参照数については何も述べていない。

`対象:` 行を扱うのは ADR-0023 D3:
> `対象:` 行（任意）は任意の実在要素を指せる（解決検証は C3 の一般規則）

D3 も単一参照制約を明記していない。単一参照は旧実装の正規表現 `PERM_TARGET_LINE_RE = /^対象: \[\[([a-z0-9-]+)\]\]$/` によって実行時に強制されていたが、ADR によって決定記録された制約ではなかった。

本 PR でこの制約を C6 に明示化すること自体は request の要件に従っており問題ではないが、引用先として ADR-0023 D2 を指定することは誤った引用である。D2 が述べる原則（自由トークン・表面非依存）とは無関係の制約を同節に帰属させると、将来の読者が ADR-0023 D2 を参照しても制約の根拠を見つけられない。

**深刻度**: medium — 記述の修正が必要。引用先を正しい節（例:「旧実装の正規表現パターンが単一参照を前提として設計されていたことの明示化であり、新規 ADR 決定ではない」等の記述）に改めることで一貫性を回復できる。

---

## 反証を試みて不能だった観点

- **op が domain 層機構に正しく載っているか**: KNOWN_PREFIXES・LAYER_MAP・LAYER_TO_PREFIXES.domain・LAYER_ALLOWED_TARGET_PREFIXES の各集合への op 追加は一貫しており、C1〜C3・C11 の縮退・層方向チェックの一貫適用という現行設計（D1）と矛盾しない
- **malformed 操作行の二段検出（form-matching → op 参照検証）と extractRequestCitations の定型との整合**: 「分類は抽出時・診断は消費側」の定型に従っており、ADR-0024 要件 2 との対称性に反証を構成できなかった
- **段階・縮退の穴**: permission は domain を前提とし（§3 前提表）C7 が不正な組み合わせを検出する。domain が無効な状態で op 参照が来ると C3 縮退スキップが適用される。これらは既存設計と矛盾しない
- **uc / scr の去就・C5 への op 追加のスコープ外判断**: open-questions 論点 17 に委ね trace の実装判断まで触れないとする本 PR の方針は ADR-0025 の「却下: uc / scr の同時削除」および「open-questions 論点 17」と整合する
- **export operations の消費者不在**: `targetLines` の op 帰属データは C3 が参照解決を検証し、`export operations`（spec §11 に文書化）が named consumer として存在する。消費者は名指しされており不在ではない
