# findings-takt 分流記録（2026-07-02）

`docs/review/findings-takt.md`（20 件、レビュー時点 = commit e51f5f5）の裁定。ADR-0013 の正本テストに従い、解決はすべて正本（adr / spec / docs）への変更または未決の明示として処理した。verdict の主体は人側の裁定であり、レビュー定型（verdict を書かない）とは別の成果物である。

| # | 深刻度 | 裁定 | 反映先 |
|---|---|---|---|
| 1 | high | 修正 — coverage の母集合は plan の全要素（ADR-0005 のフロンティア「起票待ち」の常在が母集合の意図を証明する） | adr/0006 |
| 2 | medium | 修正 — 一周の流れを plan → derive（草稿）→ coverage の順に訂正 | README |
| 3 | medium | 未決化 — designed への戻り遷移の所有者 | open-questions 論点 12-1 |
| 4 | medium | 修正 — C5 の縮退意味論を明文化（非空義務・prefix 適格性は常時評価、解決は C3 の縮退に従う）。実装の現挙動と一致し、ADR-0015 の「無害」も成立する | spec/format.md C5 |
| 5 | medium | 修正 — 型の前提関係の全列挙を仕様化（実装 `LAYER_PREREQUISITES` の転記。ビュー行は暫定とし §12 の追補時に確定） | spec/format.md §3 |
| 6 | medium | 解決済み — C3 の未知 prefix fail-closed は仕様・実装（PR #7）とも修正済み | — |
| 7 | medium | 修正 — 出口ゲートの検出範囲を依存構造に限定して主張を訂正。ゲート自体は変更しない | adr/0007 |
| 8 | medium | 修正 — 縮退時 status の表示内容を定義（算出可能なフロンティアのみ） | adr/0010 |
| 9 | medium | 未決化 — plan の寿命（A: 現在形の作業文書 / B: 永続 + C10 限定） | open-questions 論点 13 |
| 10 | medium | 修正 — ステータス節を実態（実装済み動詞・検証状況）に更新 | README |
| 11 | medium | 修正 — (b) は要素単位で不合格と定義（実装の現挙動と一致）。「引用 = 被覆宣言」の意味論を明記し、文脈引用の用途を排除 | spec/integration.md §1 |
| 12 | medium | 修正 — 「該当 0 件」= slug 一致（状態不問）で判定と定義。冪等条項と両立 | spec/integration.md §2 |
| 13 | medium | 修正 — ビュー追補をツール能力としても需要駆動に統一。9 種列挙は名前空間の予約 | open-questions 論点 2 |
| 14 | medium | 追跡 — パイプライン起点 topic の排出契約を受け口一覧に追加 | open-questions 論点 5 |
| 15 | low | 未決化 — topic の open → addressed の所有者 | open-questions 論点 12-2 |
| 16 | low | 修正 — バージョニング二軸分離を ADR 化 | adr/0016（新規） |
| 17 | low | 修正 — 削除要素のトレースは git 履歴が保持と明記（state.json は現在形のみ） | spec/format.md §9 |
| 18 | low | 修正 — 「人は編集しない」の唯一の例外 = 衝突裁定を明記 | spec/format.md §9 |
| 19 | low | 修正 — 「一文法に還元」の主張を文書間参照に限定。要素 ↔ request / PR は state.json の領分 | adr/0003 |
| 20 | low | 未決化 — plan の `request:` 行の記録主体 | open-questions 論点 12-3 |

集計: 修正 13 / 解決済み 1 / 追跡 1 / 未決化 5（論点 12 に 3 件、論点 13 に 1 件、いずれも loop 動詞の実装設計で確定する）。
