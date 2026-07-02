# findings-b — 敵対的整合レビュー 2026-07-02

---

## F-B-01: spec/format.md §12 の未決とADR-0015の決定が同一問題の二重記述になっている

**主張**: spec/format.md §12（本仕様内の未決）が「seq の登場要素にアクター・外部システムを含める扱い」を未決として残しているが、ADR-0015 はその問題を「解決済み」として決定を記録しており、§12 はその後に更新されていない。

**根拠引用**:
- `spec/format.md` §12: 「**seq の登場要素にアクター・外部システムを含める扱い**。CLI ツールの設計では mod だけで足りるが、業務システムではアクター（人・ロール）と外部系が必ず登場する。act 型の新設か、ext / perm ビューの有効化を前提にするか。業務系ドッグフーディングで決める」

**矛盾引用**:
- `adr/0015-actor-as-core-type.md`: 「**C5 を改訂**: seq の登場要素は「mod または act」に解決される」「Status: accepted」
- `spec/format.md` §10 閉包規則 C5: 「seq の登場要素リストが空でなく、すべて mod または act に解決される」— C5 の本文は既に ADR-0015 の決定を取り込んでいる

§12 の未決記述と C5・ADR-0015 の決定記述が同一ファイル内で矛盾した状態で共存している。

**深刻度**: medium

---

## F-B-02: ADR-0002 の status 注記の要約と ADR-0010 の段階体系が整合しない

**主張**: ADR-0002 の status 注記が「ドメイン・動的構造は推奨コアとして段階有効化」と要約しているが、ADR-0010 の段階体系では dynamic は段階②であり loop（topic/plan/state）は段階③として明確に分離されており、注記の要約は両者を「推奨コア」として並列に扱うことで段階体系を曖昧化する。

**根拠引用**:
- `adr/0002-artifact-model.md` status 欄: 「最小プロファイルは静的構造のみ、ドメイン・動的構造は**推奨コアとして段階有効化**」

**矛盾引用または反例**:
- `adr/0010-adoption-gradient.md` Decision: 有効化の段階の目安 — 「1. 静的構造 + 許可依存 / 2. + ドメイン・動的構造 / 3. + topic / plan / 要素状態機械 / 4. + ビュー」

反例: ADR-0002 の注記を読んで「ドメイン・動的構造は推奨コア（一段階）」と解釈したプロジェクトが、loop を有効化せずに状態機械を使おうとすると、ADR-0010 の段階③（loop = topic/plan/state を有効化する段階）を経ていないという矛盾が生じる。

**深刻度**: medium

---

## F-B-03: C3 の段階縮退スキップと C4 の辺評価の優先関係が未定義

**主張**: 閉包規則 C3 は無効な型を含む参照をスキップするが、C4 は dependencies の辺の両端が mod に解決されることを要件とする。段階①で domain が無効な場合、dependencies.md に domain 要素への辺が書かれたとき、C3 がスキップするか C4 が fail するかが仕様から決定できない。

**根拠引用**:
- `spec/format.md` §10 C3: 「すべての `[[id]]` が有効な型の実在要素に解決される。ただし**参照元・参照先のどちらか**の型が無効な参照は評価しない」
- `spec/format.md` §10 C4: 「dependencies の辺の両端が mod 要素に解決される」

**反例**: 段階①（`enabled: static`）で `dependencies.md` に `- [[mod-core]] -> [[ent-order]]` を書いた場合——C3 の「ent が無効な型だからスキップ」を先行させると C4 は発火せず不正な辺が通過する。C4 を C3 より優先させると段階縮退（有効な型のみ評価）の原則と矛盾する。どちらの解釈も仕様からは確定しない。

**深刻度**: high

---

## F-B-04: `--require-citation` のオプション化が ADR-0007「入口ゲートの機械強制」と矛盾する

**主張**: ADR-0007 は「構造変更を含む request は設計要素 ID の引用を必須とする」を機械強制の不変条件として決定しているが、spec/integration.md §1 はその強制の実体である `--require-citation` を呼び出し側の任意フラグとして定義しており、呼び出し側が省略すれば入口ゲートは機能しない。

**根拠引用**:
- `adr/0007-gates.md` Decision: 「**入口ゲート**: 構造変更を含む request（spec-change / new-feature 型）は設計要素 ID の引用を**必須**とする。実装パイプラインの request 検証が `check --request <path>` を呼び、引用 ID の実在と状態を検証する」

**矛盾引用**:
- `spec/integration.md` §1: 「`--require-citation`: 引用が 0 件なら不合格にする。構造変更を含む request 型にこのフラグを付けるかは**呼び出し側の判断**（aozu は request の型体系を知らない）」

呼び出し側が `--require-citation` を省略した場合、引用ゼロの request が入口ゲートを通過する。ADR-0007 が「機械強制」と命名した不変条件が、呼び出し側の設定次第で無効化できる構造になっている。

**深刻度**: high

---

## F-B-05: spec/format.md §2 の adr ディレクトリ規約と実際のリポジトリ配置が異なる

**主張**: spec/format.md §2 のディレクトリ規約は ADR を `design/adr/` 配下に置くと定めているが、実際のリポジトリでは ADR は `adr/`（リポジトリルート直下）に置かれており、自己記述として閉包規則 C9 が検証できない。

**根拠引用**:
- `spec/format.md` §2: ディレクトリ規約 `design/adr/NNNN-<slug>.md   # adr 要素`

**矛盾引用**:
- 実際のファイルパス: `adr/0001-tool-positioning.md`、`adr/0015-actor-as-core-type.md` 等（`design/adr/` ではなく `adr/` 直下）
- `spec/format.md` §10 C9: 「adr が top を引用している（loop 有効時）」— この規則を check が評価するには adr がツールの管理対象（design/ 配下）に存在する必要がある
- `adr/0006-input-ladder.md`: 「設計 delta の ADR は **topic の引用を必須**とする（閉包規則）」

aozu の自己記述（design/ 配下の設計文書）は loop が無効のため現状 C9 は評価されないが、仕様上の配置規約と実態が異なることで、loop を有効化した際にどのパスの ADR を読むべきかが不明になる。

**深刻度**: medium

---

## F-B-06: ADR-0005 の「並列衝突は open-questions 参照」が open-questions.md に存在しない

**主張**: ADR-0005 は「並列 request 実行時の状態マップの merge 衝突の扱いは形式仕様側で詰める（open-questions 参照）」と留保しているが、docs/open-questions.md は当該論点を掲載していない。

**根拠引用**:
- `adr/0005-element-state-machine.md` Consequences: 「並列 request 実行時の状態マップの merge 衝突の扱いは形式仕様側で詰める（open-questions 参照）」

**矛盾引用**:
- `docs/open-questions.md` 全文: §2〜§10 を通じて「並列 request 時の状態マップ衝突」の論点は存在しない

spec/format.md §9 が「同一要素への並行更新は git の衝突として表面化させ、人が裁く」と一部を埋めているが、`mark implemented` を並列 request が同一要素に対して異なるタイミングで呼ぶシナリオ（integration.md §2 の「全遷移 or 全不変」制約との組み合わせ）における上書き可否の定義が空白のまま、かつ参照先として指定された open-questions.md にも記載がない。

**深刻度**: medium
