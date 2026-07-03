# ADR-0020: prompt propagate / prompt review の注入スコープとループゲート方針

- Status: accepted
- Date: 2026-07-03

## Context

ADR-0008 の動詞表に定義された `prompt propagate --adr <id>` と `prompt review` が未実装だった。`prompt session`（ADR-0019）と `prompt derive`（ADR-0012）で「純関数 build*Instruction + CLI ハンドラの I/O 層」という分離パターンと、注入スコープ規則（ADR-0019: 2 hop・inv/term 全量・static 縮約）が確立済みである。

実装にあたって四つの設計選択が必要になった:

1. **propagate の注入スコープ** — ADR-0019 の規則を ADR 起点に適用するか、propagate 専用の別スコープを定義するか
2. **review の注入方針** — 全量注入で始めるか、初版からスコープ規則（ペア照合・シャーディング）を設けるか
3. **ループゲートの適用基準** — propagate / review に session / derive と同様の loop gate（`isLayerEnabled("loop")`）を課すか
4. **check の領分と review の領分の境界** — 構造違反（C1〜C11）を review の findings 対象に含めるか

## Decision

### 1. propagate の注入スコープは ADR-0019 規則の ADR 起点適用

ADR-0019 の注入スコープ規則（`docs/open-questions.md` 論点 8 の初版実装）は「対象要素（topic / ADR が引用する要素）」と定義している。topic 起点は ADR-0019 で確定済みであり、本 ADR はその ADR 起点への適用を決定として確定する。

propagate の注入内容:

| 種別 | 対象 | 注入量 |
|---|---|---|
| ADR 本文 | 指定された adr 要素 | 本文全量（id・topics 込み） |
| seed 要素 | ADR 本文中の `[[id]]` 引用 | 本文全量 |
| 近傍要素 | seed の in/out 2 hop 近傍 | 本文全量 |
| term / inv | 全量（近傍に関係なく常に） | 本文全量 |
| static mod | 全量 | 縮約形（見出し + `責務:` 行のみ） |
| enabled 一覧 | manifest の enabled list | そのまま |
| 形式規則要約 | FORMAT_RULES_SUMMARY | コード内定数 |
| 反映作法指示 | PROPAGATE_GUIDANCE | コード内定数 |

hop 数は `SCOPE_MAX_HOPS` 定数（旧: `SESSION_MAX_HOPS`、`src/prompt/shared.ts` に移動）を共有し、調整を単一修正点に保つ。`session.ts` からは `SESSION_MAX_HOPS` として re-export し後方互換を維持する。

引用 0 件の ADR は正常系（exit 0）で、seed / 近傍セクションが空プレースホルダになるだけでプロンプトを出力する。

### 2. review の初版は全量注入

review は seed や近傍という概念を持たない。対象は設計コーパス全体であり、全要素の本文を ID 辞書順に注入する。

| 種別 | 対象 | 注入量 |
|---|---|---|
| 全要素本文 | graph.elements の全要素 | 本文全量（ID 辞書順） |
| 形式規則要約 | FORMAT_RULES_SUMMARY | コード内定数 |
| findings 書式指示 | REVIEW_GUIDANCE | コード内定数 |

term/inv や mod を別枠で縮約する必要はない（全量注入なので分ける意味がない）。高度化（ペア照合・シャーディング）は「窓に収まらない実例」の証拠が出てから検討する（`docs/open-questions.md` 論点 8 戦略 3 — スコープ外）。

### 3. propagate / review にループゲートを課さない

session と derive は `isLayerEnabled("loop", manifest)` で exit 1 を返す loop gate を持つ。これは対象要素（top / grp）が loop 層の型だからである。

propagate の対象 `adr` は常時層（LAYER_MAP で `"always"`）、review は対象を持たない。spec/format.md C11 で「loop と adr は制限なし」と定義されており、ADR は loop 無効のプロファイルでも存在しうる（C9 のみ loop 条件）。loop gate を課すと段階導入プロファイル（static + domain のみ等）での使用を妨げ、採用勾配（ADR-0010）を狭める。

exit code 体系:

| 条件 | exit code |
|---|---|
| 成功 | 0 |
| 入力不正（design 不在・ADR 不存在・adr 以外の prefix・引数欠落） | 2 |

exit 1（loop disabled）は propagate / review では発生しない。

### 4. check の領分を review 指示から明示除外する

REVIEW_GUIDANCE に「check が検出する構造違反（参照切れ・ID 重複・リンク義務欠落・prefix 不一致 — C1〜C11）はレビュー対象外」と明記する。verdict（採否）は人の領分であることも明記する。

決定的検証（check）と非決定的レビュー（LLM review）の領分を分離する。「規則への卒業 = 台帳の縮小」（`docs/open-questions.md` 論点 8 戦略 4）を実現するためには、決定的検出が担う領域を LLM に重複させない必要がある。

## Alternatives Considered

### Alternative 1: propagate 専用の別スコープ定数を設ける

- **Pros**: propagate に最適化した hop 数・縮約方針を独自に持てる
- **Cons**: 規則が二系統になり、hop 数の調整が分散する。ADR-0019 の「調整を単一修正点に保つ」原則と矛盾する
- **Why not**: 運用証拠のない最適化は複雑さだけを生む。ADR-0019 の規則が ADR 起点でも適合しない証拠が出てから分離する

### Alternative 2: review に初版からスコープ規則（ペア照合）を設ける

- **Pros**: 大規模コーパスへの対応が早期に完成する
- **Cons**: 複雑さに対して窓に収まらない実例の証拠がない。ADR-0004「正本を小さく保つ」原理を前提とした段階設計を採る場合、初版は全量注入が最も単純
- **Why not**: 証拠なしの先行最適化は避ける。論点 8 戦略 3 は「実例の証拠が出てから」としており設計原則として決定済み

### Alternative 3: prompt 動詞一律でループゲートを課す

- **Pros**: 動詞の一貫性があり呼び出し側が覚えやすい
- **Cons**: 根拠が型体系と合わない。adr は常時層であり、C11 の定義に反する
- **Why not**: gate の根拠は対象の型体系であり、動詞の一律適用ではない。一貫性を型体系の正確性より優先する理由がない

### Alternative 4: check 違反を review 指示に含める（網羅性のため）

- **Pros**: LLM が全種の問題を報告でき、見落としが減る
- **Cons**: findings の S/N 比が下がる。決定的合否（check exit code）と非決定的指摘（review findings）の境界が曖昧になる
- **Why not**: 決定的検証で既に全量恒常検出される問題を重複させることで、「合否が機械で出るなら規則に昇格できる」（論点 8 戦略 4）という原則に逆行する

## Consequences

### Positive

- propagate で ADR-0019 注入スコープ規則の ADR 起点版が確定し、`docs/open-questions.md` 論点 8 規則案の両起点（topic / ADR）が実装済みになる
- `SCOPE_MAX_HOPS` 定数の一箇所化により、hop 数の変更が session・propagate 両動詞で単一修正点になる
- loop gate の根拠が型体系で明文化されることで、将来の動詞追加時に判断基準が明確になる
- check と review の領分が明示分離され、findings の S/N 比が維持される

### Negative

- review の全量注入は大規模コーパスでコンテキスト窓を圧迫しうる。ADR-0004「正本を小さく保つ」を前提とするが、初版では窓超過への対処を持たない
- `FORMAT_RULES_SUMMARY` を `src/prompt/shared.ts` に移動したため、`spec/format.md` が更新された際の手動更新箇所が shared.ts に変わる（session.ts からは re-export）

### Risks

- **review 全量注入の窓超過** → Mitigation: 初版は ADR-0004 の「正本を小さく保つ」を前提。窓を超える実例が出た時点で論点 8 戦略 3（シャーディング）を検討する
- **SCOPE_MAX_HOPS リネームによる既存 import の破損** → Mitigation: `session.ts` から `SESSION_MAX_HOPS` として re-export し後方互換を維持。既存テストが無変更で通ることで確認済み

### Known Design Debt

- `handleDerive` は共有ヘルパー（`collectTermsAndInvariants`）を使わず独自インライン実装を維持している（review-feedback-001 finding #3）。derive の将来の PR で共有ヘルパーへの統一を行う
