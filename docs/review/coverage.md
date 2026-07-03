# 検証被覆台帳

docs/open-questions.md 論点 8 の戦略 2 の運用実体。**網羅の主張は run 単位ではなく本台帳の状態で行う**——フロンティア（要再検証 + 未走査）が空であることが「網羅」の定義である。

運用規約:

- **母集団**: 下表のシャード（記録の正本文書）。文書の追加・削除は本表の更新で追従する
- **セル**: 最終検証ラウンドと、検証時点の blob（`git hash-object`、先頭 12 桁）
- **フロンティア判定**: シャードの現 blob が記録と異なれば「要再検証」、記録が無ければ「未走査」。findings ゼロと未走査を区別する
- **レンズ**: 現行のレビュー定型（docs/review/adversarial-consistency.md）は観点 1〜5 を一括適用するため、セルはラウンド単位で持つ。レンズ別の被覆が必要になったら列を分ける
- **規則への卒業**: 決定的検証（check の C 規則・architecture test・conformance テスト）に卒業した観点のシャードは本台帳から消す（窓なしの恒常検証になるため）。design/ が台帳に無いのはこの理由（check が全量恒常検証している。ただし check が見るのは閉包であり意味論の整合ではない——意味論レンズが必要になったら再掲する）

## 台帳

| シャード | 最終検証 | 検証時 blob | 状態 |
|---|---|---|---|
| README.md | takt 2026-07-02 | c698fa24d657 | 要再検証（分流修正で変更） |
| adr/0001-tool-positioning.md | takt 2026-07-02 | 20b0f63f585b | 検証済 |
| adr/0002-artifact-model.md | takt 2026-07-02 | 30411f193017 | 検証済 |
| adr/0003-id-reference-grammar.md | takt 2026-07-02 | 258dde38d754 | 要再検証（分流修正で変更） |
| adr/0004-living-docs-computed-delta.md | takt 2026-07-02 | 9081a0496987 | 検証済 |
| adr/0005-element-state-machine.md | takt 2026-07-02 | 063137b39247 | 要再検証（ADR-0018 反映で変更） |
| adr/0006-input-ladder.md | takt 2026-07-02 | 76404e10b84d | 要再検証（分流修正で変更） |
| adr/0007-gates.md | takt 2026-07-02 | eb6b046ae939 | 要再検証（分流修正で変更） |
| adr/0008-verb-cli.md | takt 2026-07-02 | e87411173d19 | 検証済 |
| adr/0009-tech-stack.md | takt 2026-07-02 | a0adba47dc5b | 検証済 |
| adr/0010-adoption-gradient.md | takt 2026-07-02 | 0e1a528de21d | 要再検証（分流修正で変更） |
| adr/0012-consumer-agnostic-derive.md | takt 2026-07-02 | 435e12844b2a | 検証済 |
| adr/0013-escalation-triage.md | takt 2026-07-02 | 967ee64b5c8e | 検証済 |
| adr/0014-directory-ownership.md | takt 2026-07-02 | d6acb36648b1 | 検証済 |
| adr/0015-actor-as-core-type.md | takt 2026-07-02 | c361f432ba06 | 検証済 |
| adr/0016-versioning-and-release.md | — | — | 未走査（分流で新設） |
| adr/0017-granularity-by-citation-context.md | — | — | 未走査（新設） |
| adr/0018-loop-write-semantics.md | — | — | 未走査（新設） |
| spec/format.md | takt 2026-07-02 | ece0028a83c2 | 要再検証（C3 訂正・分流修正で変更） |
| spec/integration.md | takt 2026-07-02 | 14581b39d1eb | 要再検証（分流修正で変更） |
| docs/open-questions.md | takt 2026-07-02 | 18d1b2c5cf65 | 要再検証（分流修正で変更） |
| docs/adoption.md | — | — | 未走査 |
| docs/boundary.md | — | — | 未走査（新設） |
| docs/dogfooding-runbook.md | — | — | 未走査 |

## ラウンド記録

- **takt 2026-07-02**: 対象 = adr 全件 + spec 全件 + open-questions + README（commit e51f5f5 時点）。findings 20 件 → `findings-takt.md`、分流 → `triage-takt-2026-07-02.md`。分流の修正 13 件が 8 シャードを変更したため、それらは要再検証に戻る
