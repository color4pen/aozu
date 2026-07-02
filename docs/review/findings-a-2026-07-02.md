# 敵対的整合レビュー findings（2026-07-02）

## F1. status / derive を段階①で成立させる要請が、spec の層割り当てと両立しない

**主張**: ADR-0010 は段階①（loop 無効）で `status` / `derive` が意味を持つことを設計要請とするが、spec の層定義ではこれらのコマンドの入出力（topic / plan / state）はすべて loop 層に属し、段階①では存在しない。

**根拠引用**: `adr/0010-adoption-gradient.md`「段階①のプロジェクトが実在する前提でコマンド群を設計する（status / derive が縮退集合でも意味を持つこと）」。有効化段階の目安では「1. 静的構造 + 許可依存」に対し「3. + topic / plan / 要素状態機械 — 設計継続ループの全体」と、topic / plan / 状態機械は段階③に置かれる。

**矛盾引用または反例**: `spec/format.md` §3「ループ（loop = topic・plan・state）」。`adr/0008-verb-cli.md` によれば `status` は「open topic / designed 要素 / requested 要素のフロンティア表示」であり、`plan` は「designed 要素を plan 表に出力」、`coverage` は「合格要素を requested へ」。topic は loop 要素、`plan` 型（`grp` 含む）は loop 型（`spec/format.md` §4 prefix 表で `top` / `plan` / `grp` の属する層は `loop`）、requested 状態は state.json（loop）に記録される。反例シナリオ: 段階①（`enabled: static` のみ）のリポジトリで `derive`（= `plan` → `coverage`）を実行しようとすると、plan 型が無効なため plan 表を書く先も coverage が検証する被覆も存在せず、動作が未定義になる。`status` も、topic が存在せず state.json も無いため「全要素 designed」以外を提示できず、フロンティアの 3 分類のうち 2 つ（open topic / requested）が構造的に空になる。ADR-0010 が「意味を持つ」ことを前提にコマンド群を設計せよと命じている一方、spec の層割り当てはその前提を成り立たなくしている。

**深刻度**: high

## F2. 入口ゲートの状態検証 (b) が最小プロファイルで無音化する

**主張**: 交換面契約 §1 の入口ゲートは引用要素の状態が designed / requested であることを検証し「implemented のみを引用する request」を疑うが、状態（state.json）は loop 層の機能であり、価値の出る最小プロファイル（段階①/②）では loop が無効なため、この検証が常に通過して検出力を失う。

**根拠引用**: `spec/integration.md` §1「**検証**: (a) すべての引用が実在要素に解決される、(b) 引用要素の状態が designed または requested である（implemented のみを引用する request は設計 delta を経ていない疑い）」。この検証は段階を問わず呼び出される（`adr/0007-gates.md`「構造変更を含む request … 実装パイプラインの request 検証が `check --request <path>` を呼び」）。

**矛盾引用または反例**: `spec/format.md` §3「ループ（loop = topic・plan・state）」および §9「エントリが無い要素は designed とみなす」。`adr/0010-adoption-gradient.md`「最小プロファイルを『静的構造（モジュール構成 + 許可依存）のみ』とする。これだけで … 単体で価値が出る」。反例シナリオ: 段階①のリポジトリでは state.json が存在せず、全要素が designed とみなされる。実装済みの `mod-x` を引用する spec-change request を検証しても、(b) は「designed」と評価して合格し、「implemented のみを引用する request は設計 delta を経ていない疑い」という検出が働かない。ゲートの検出仕様が、最も推奨される導入形態で沈黙する。

**深刻度**: medium

## F3. `rules.json` が正本の常在ファイルなのか生成物なのかで記述が食い違う

**主張**: ADR-0014 は `rules.json` を `design/` 配下に常在するプロダクト正本として扱うが、spec のディレクトリ規約は `rules.json` を一切列挙せず、rules export は stdout / `--out` への出力として定義されており、正本ファイルか生成物かが確定しない。

**根拠引用**: `adr/0014-directory-ownership.md`「`design/` の中身は**プロダクトの正本**である。設計文書・topic … `rules.json`（歯の供給源）はいずれも、同じ形式を読む別ツールに乗り換えても意味を保つ」。実体としても `design/rules.json` がリポジトリに存在する。

**矛盾引用または反例**: `spec/format.md` §2 のディレクトリ規約は `manifest.md` / `static/` / `domain/` / `dynamic/` / `topics/` / `plans/` / `adr/` / `state.json` / `views/` を列挙するが `rules.json` を含まない。`spec/integration.md` §3「形式仕様 §11 の ruleset JSON を stdout（または `--out <path>`）に出力する」および §5「成果物（ruleset 等）は stdout」。すなわち spec は ruleset を「実行時に生成し標準出力へ流す出力」と定義しており、ADR-0014 の「design/ に常在する正本ファイル」という位置づけと矛盾する。ディレクトリ規約が state.json を明示列挙しながら rules.json を落としている点も、この不整合の徴候である。

**深刻度**: medium

## F4. spec §12 の未決が、ADR-0015 で決着済みのアクター論点を未決のまま残している

**主張**: `spec/format.md` §12 は seq の登場要素にアクターを含める扱いを「業務系ドッグフーディングで決める」未決事項として掲げるが、ADR-0015 が act 型の新設と C5 改訂で既に決着させており、spec 本体（§4・§8・C5・C11）もその決定を反映している。

**根拠引用**: `spec/format.md` §12「**seq の登場要素にアクター・外部システムを含める扱い**。… act 型の新設か、ext / perm ビューの有効化を前提にするか。業務系ドッグフーディングで決める」。

**矛盾引用または反例**: `adr/0015-actor-as-core-type.md`「**act 型（アクター…）をコアの domain 層に追加**する」「**C5 を改訂**: seq の登場要素は『mod または act』に解決される」。同決定は spec 本体に既に反映済み（`spec/format.md` §4 prefix 表に `act`、§8 に act スキーマ、C5「すべて mod または act に解決される」、C11「domain（term / ent / inv / act）」）。`docs/open-questions.md` §10 でも「~~アクターの表現~~ — **解決済み**（ADR-0015 / PR #6）」と取り消し線で決着が明記されている。決定と本体が更新済みなのに §12 の未決記述だけが古いまま残り、同一文書内で「決定済みの意味論」と「未決の宣言」が併存している。

**深刻度**: medium

## F5. 自己記述の要素数が「25」と記載されるが実体は 26

**主張**: README と open-questions は aozu 自身の自己記述を「25 要素」と記すが、`design/` の実要素数は 26 である。

**根拠引用**: `README.md` ステータス直前「形式仕様 v0 は自己記述ドッグフードで検証済み」に対応する `docs/open-questions.md` §9「`design/` に static + domain + dynamic を自己記述（25 要素）」。

**矛盾引用または反例**: `design/` の実際の要素は、mod 11（`design/static/modules.md` の `{#mod-*}` 見出し 11 個）+ ent 5（`design/domain/model.md`）+ inv 5（`design/domain/invariants.md`）+ term 3（`design/domain/glossary.md`）+ seq 2（`design/dynamic/closure-check.md`・`rules-export.md` の frontmatter `id`）= 26。記載値 25 と 1 件食い違う。

**深刻度**: low

## F6. topic ファイル名規約が ADR-0006 と spec で食い違う

**主張**: ADR-0006 は topic ファイルを `design/topics/<id>.md` とするが、spec は `topics/<slug>.md` とし、id（`top-<slug>`）を使うか slug 単体を使うかでファイル名が一致しない。

**根拠引用**: `adr/0006-input-ladder.md`「`design/topics/<id>.md`。frontmatter に `status: open → addressed`」。

**矛盾引用または反例**: `spec/format.md` §2「`topics/<slug>.md`」および §8「### topics/<slug>.md — top」。id は `top-<slug>`（§4 文法・§8 例 `top-duplicate-slug`）であるため、ADR-0006 の `<id>.md` は `top-duplicate-slug.md`、spec の `<slug>.md` は `duplicate-slug.md` となり、同一 topic のファイル名が両記述で一致しない。dynamic（`<slug>.md`）・plan（`<slug>.md`）が slug 基準で統一されている中、ADR-0006 のみ id 基準で書かれている。

**深刻度**: low
