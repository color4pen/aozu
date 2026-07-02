# ADR-0018: loop の書き込み意味論 — 書き手の最小化と計算される遷移

- Status: accepted（ADR-0006 の plan 永続と topic の status frontmatter を修正する）
- Date: 2026-07-02

## Context

敵対的整合レビュー（docs/review/findings-takt.md #3 / #9 / #15 / #20）が loop まわりの記録に二種の穴を示した:

1. 状態・付随記録の書き込みに所有者が居ない箇所がある（topic の addressed、plan の `request:` 行、designed への戻り）
2. plan を「永続する記録」とする決定が、ADR-0004「過去形の記録は ADR のみが積層する」および C10（derived 済み plan の要素が後の再設計で削除されると恒久 fail し、通すには過去の記録を書き換えるしかない）と両立しない

また mark implemented の並列上書き規則（要素集合の重なる request が異なるタイミングで mark を呼ぶ場合）が未定義だった。

書き手を増やすほど所有者問題と衝突規則が増える。原則（ADR-0004: delta は計算物 / ADR-0007: 判断場面を消す）に従い、書き込み自体を減らす方向で解く。

## Decision

1. **plan は現在形の作業文書**とする。derive を終えた plan は削除してよい（過去の plan は git 履歴が保持する — living docs と同じ規約）。「なぜこの束で切ったか」は request 本文と ADR に残る。C10 は現存する plan にのみ働く。ADR-0006 の「永続する横断アーティファクト」を本 ADR で修正する
2. **plan の `request:` 行を廃止**する。要素 ↔ request の対応は state.json に一本化し、state の書き手は coverage（→ requested）と mark implemented（→ implemented）に限る
3. **topic の addressed は計算で導く**。frontmatter の `status` を廃し、「ADR から `topics:` で引用された top は addressed」とみなす。C9 が固定する意味論を明示する: **ADR の top 引用はその topic への決定の宣言**であり、決定しない topic を文脈として引用するのは誤用である。won't-fix も決定であり ADR に値する
4. **要素は同時に 1 request にのみ属する**。coverage は既に requested の要素を含む plan グループを不合格とする。これにより mark implemented の並列上書き規則そのものが不要になる（slug 一致のみを遷移させ、重なりは発生しない）。同一要素へ並行して触りたい要求は plan の編集で人が裁く（同一要素の並行変更は設計上の真の衝突 — spec §9 と同じ哲学）
5. **designed への戻りも計算優先の方向**とするが、機構（実装時の要素本文ハッシュと現物の乖離検出。整形だけの変更でも戻る = fail-closed 側に倒れるがノイズになる）は loop 動詞の実装設計で確定する（docs/open-questions.md 論点 12）

## Consequences

- 状態の書き手が coverage / mark implemented の 2 動詞に閉じ、上書き規則・所有者問題の設計が消える
- status の open topic フロンティアは「ADR から引用されていない top」の計算になる。実装（status のフロンティア計算・scaffold の topic テンプレート）の追随は loop 動詞の request に含める
- 処理済み topic によるフロンティアの可視化汚染（findings #15 の反例）が構造的に解消する
- plan の削除は強制しない。残す場合も C10 の対象であり続けるため、要素を削除する再設計時には plan も直すか消す
