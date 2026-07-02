# ADR-0005: 要素状態機械 designed → requested → implemented

- Status: accepted
- Date: 2026-07-02

## Context

設計と実装の対応が記録されないと、「設計したが未起票」「起票したが未実装」「実装済みだが再設計中」の判別が人の記憶に依存し、設計の継続運用が成立しない。「次にやること」が git ref の暗算からしか出ない状態は避けたい。

## Decision

全設計要素は 3 状態を持ち、実装状態マップ（横断アーティファクト）に記録する:

```
designed（設計済・未起票） → requested（request 起票済） → implemented（実装済）
        ↑______________________________________________|
         実装済み要素を再設計すると designed に戻る
```

状態遷移は**自動**とし、人の規律に依存させない:

- 設計 delta の merge → 対象要素が `designed` に（新規または戻り）
- `coverage` 合格（plan の全要素が request 草稿に被覆） → `requested`（request slug を記録）
- 実装パイプラインの取り込み完了 hook（`mark implemented --request <slug>`） → `implemented`（PR を記録）

`status` コマンドは 3 つのフロンティアを機械的に提示する:

1. open な topic（設計待ち）
2. designed のままの要素（起票待ち = 設計負債）
3. requested のままの要素（実装待ち）

## Consequences

- 「設計レイヤの次にやること」が 1 コマンドで出る。これが設計を継続する運用の実体になる
- 実装パイプライン側に hook 1 本の受け口が必要（取り込み完了時に `mark implemented` を呼ぶ）
- 並列 request の重なりは「要素は同時に 1 request にのみ属する」（coverage が既 requested 要素を拒否 — ADR-0018）で封じ、同一要素への並行編集は git 衝突として人が裁く（spec §9）
