# Design: prompt propagate / prompt review

## Context

ADR-0008 の動詞表に定義された prompt 群のうち `prompt propagate --adr <id>` と `prompt review` が未実装で残っている。derive（PR #9）と session（PR #11）で「純関数 build*Instruction + CLI ハンドラの I/O 層」という分離パターンと、ADR-0019 の注入スコープ規則（2 hop・inv/term 全量・static 縮約）が確立済みである。

本変更はこのパターンを再利用し prompt 動詞群を完成させる。設計上の新規判断は 3 点: (1) propagate の注入スコープを ADR-0019 規則の ADR 起点適用として定義する、(2) review の初版を全量注入とする、(3) 両動詞に loop gate を課さない。

現状の `handleSession` には term/inv 収集・static mod 縮約・enabled layers 取得の組み立てがインラインで実装されている。propagate でも同じ組み立てが必要になるため、共有ヘルパーへの抽出が前提作業になる。

## Goals / Non-Goals

**Goals**:

- `prompt propagate --adr <adr-id> [--dir <path>]` を実装し、ADR の決定を全層に反映するためのプロンプトを stdout に出力する
- `prompt review [--dir <path>]` を実装し、コーパス全体の矛盾を人が findings として列挙するためのプロンプトを stdout に出力する
- session/derive と共通する文脈組み立て処理を共有ヘルパーに抽出し、三重実装を回避する
- session/derive の既存テストが無変更で green であることを保証する

**Non-Goals**:

- one-shot runner（論点 9-a）
- review のスコープ規則高度化（ペア照合・シャーディング — 論点 8 戦略 3）
- `diff` / `trace` 動詞の実装
- ADR scaffold テンプレート変更・C9 挙動変更
- session/derive の既存出力バイト列の変更

## Decisions

### D1: 共有ヘルパーの抽出先は `src/prompt/shared.ts`

`handleSession` にインラインで実装されている以下の組み立て処理を `src/prompt/shared.ts` に純関数として抽出する:

1. `collectTermsAndInvariants(graph, files)` → `string` — term/inv 要素の ID 辞書順全量を `### id\nbody` 形式で連結
2. `collectStaticModulesSummary(graph, files)` → `string` — mod 要素の ID 辞書順で `### id\n責務: ...` 形式を連結（縮約形）

session の `handleSession` はこれらを呼び出すように書き換える。書き換え後の stdout 出力はバイト同一であること。

**Rationale**: mod-prompt の責務（指示の組み立て）に属する関数なので `src/prompt/` 配下に置く。CLI ハンドラ（mod-cli）からの依存方向は `mod-cli → mod-prompt` で許可済み。`mod-prompt → mod-graph` の依存は `extractAllBodies` / `extractElementBody` の既存利用で確立済み。

**Alternatives considered**: (a) prompt.ts 内に private helper として置く — mod-prompt のテスト単位に入らず、共有の意図が見えにくい。(b) graph モジュールに置く — 文脈の「組み立て」は graph の責務（構造とルックアップ）を超える。

### D2: propagate の注入スコープは ADR-0019 規則の ADR 起点適用

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

hop 数は `SESSION_MAX_HOPS` 定数を共有する（`src/prompt/session.ts` から export 済み）。定数名を `SCOPE_MAX_HOPS` にリネームし `src/prompt/shared.ts` に移動することで、session 固有ではないことを明示する。

引用 0 件の ADR は正常系（exit 0）で、seed / 近傍セクションが空プレースホルダになるだけでプロンプトを出力する。

**Rationale**: 論点 8 規則案「対象要素（topic / ADR が引用する要素）」の ADR 起点版。hop 数を session と共有することで調整が単一修正点に閉じる。

**Alternatives considered**: propagate 専用の別スコープ定数 — 規則が二系統になり調整の証拠も分散する。却下。

### D3: review の初版は全量注入

review の注入内容:

| 種別 | 対象 | 注入量 |
|---|---|---|
| 全要素本文 | graph.elements の全要素 | 本文全量（ID 辞書順） |
| 形式規則要約 | FORMAT_RULES_SUMMARY | コード内定数 |
| findings 書式指示 | REVIEW_GUIDANCE | コード内定数 |

review は seed や近傍を持たない。対象は設計コーパス全体であり、全要素の本文を ID 辞書順に注入する。term/inv や mod を別枠で縮約する必要はない（全量注入なので分ける意味がない）。

REVIEW_GUIDANCE には以下を含む:
- 1 行 1 finding 形式: `<関与する要素 ID> — <矛盾の説明>`
- verdict（採否）は人の領分であると明記
- check が検出する構造違反（参照切れ・ID 重複・リンク義務欠落 = C1〜C11）はレビュー対象外であると明記

**Rationale**: 正本を小さく保つ原理（ADR-0004）が窓を守る前提で、初版は最も単純な全量注入を選ぶ。高度化は「窓に収まらない実例」の証拠待ち。

**Alternatives considered**: 初版からシャーディング — 複雑さに対して証拠がない。却下。

### D4: propagate / review に loop gate を課さない

session と derive は loop gate（`isLayerEnabled("loop", manifest)` で exit 1）を持つ。これは対象が loop 層の型（top / grp）だからである。propagate の対象 adr は常時層（LAYER_MAP で `"always"`）、review は対象を持たない。

段階導入プロファイル（static + domain のみ等）でも ADR は存在しうる（C11「loop と adr は制限なし」）。loop gate を課すと採用勾配（ADR-0010）を狭める。

exit code 体系:

| 条件 | exit code |
|---|---|
| 成功 | 0 |
| 入力不正（design 不在・ADR 不存在・adr 以外の prefix・引数欠落） | 2 |

exit 1（loop disabled）は propagate / review では発生しない。

**Rationale**: gate の根拠は対象の型体系であり、動詞の一律適用ではない。

**Alternatives considered**: prompt 動詞一律で loop gate — 一貫性はあるが根拠が型体系と合わない。却下。

### D5: check の領分を review 指示から明示的に除外する

REVIEW_GUIDANCE に「check が検出する構造違反はレビュー対象外」と明記する。具体的には参照切れ・ID 重複・リンク義務欠落・prefix 不一致など C1〜C11 が全量恒常で検出するクラスを除外する。

**Rationale**: 決定的検証と非決定的レビューの領分を分離する。LLM レビューに重複させると findings の S/N 比が下がり、「規則への卒業 = 台帳の縮小」（論点 8 戦略 4）に逆行する。

**Alternatives considered**: 網羅性のため全部見せる — findings の S/N 比を下げ、決定的合否と非決定的指摘の境界を曖昧にする。却下。

### D6: SCOPE_MAX_HOPS 定数の移動

`SESSION_MAX_HOPS` を `src/prompt/shared.ts` に `SCOPE_MAX_HOPS` として移動する。`src/prompt/session.ts` からは re-export（`export { SCOPE_MAX_HOPS as SESSION_MAX_HOPS } from "./shared.ts"`）して後方互換を維持する。

session.test.ts の既存テスト（`SESSION_MAX_HOPS` の import と assert）が無変更で green になること。

**Rationale**: 定数が session 専用でないことを名前で明示しつつ、既存の import パスを壊さない。

**Alternatives considered**: (a) 名前を変えず session.ts に残す — propagate が session.ts の内部定数に依存する不自然な構造になる。(b) 既存の export を削除して一括リネーム — 既存テストの変更が必要になりスコープ外。

### D7: 純関数の入力型定義

`buildPropagateInstruction` の入力型 `PropagateInput`:

```
adrId: string
adrBody: string
seedBodies: Map<string, string>
neighborBodies: Map<string, string>
termsAndInvariants: string
staticModulesSummary: string
enabledLayers: string[]
formatRulesSummary: string
propagateGuidance: string
```

`buildReviewInstruction` の入力型 `ReviewInput`:

```
allBodies: Map<string, string>
formatRulesSummary: string
reviewGuidance: string
```

session / derive の型定義パターンを踏襲する。Map のイテレーション順序はソート済み入力を前提とし、純関数内でのソートは行わない（呼び出し側で ID 辞書順を保証する — session と同じ契約）。

### D8: ファイル構成

| ファイル | 内容 |
|---|---|
| `src/prompt/shared.ts` | 共有定数（SCOPE_MAX_HOPS）、共有ヘルパー（collectTermsAndInvariants, collectStaticModulesSummary） |
| `src/prompt/propagate.ts` | PropagateInput 型、PROPAGATE_GUIDANCE 定数、buildPropagateInstruction 純関数 |
| `src/prompt/review.ts` | ReviewInput 型、REVIEW_GUIDANCE 定数、buildReviewInstruction 純関数 |
| `src/prompt/session.ts` | 既存。SESSION_MAX_HOPS を re-export に変更。FORMAT_RULES_SUMMARY / SESSION_GUIDANCE は移動しない（session 固有） |
| `src/cli/commands/prompt.ts` | handlePropagate / handleReview ハンドラ追加、handlePrompt dispatch 拡張 |

テストファイル:

| ファイル | 内容 |
|---|---|
| `src/prompt/shared.test.ts` | collectTermsAndInvariants / collectStaticModulesSummary の単体テスト |
| `src/prompt/propagate.test.ts` | buildPropagateInstruction の単体テスト |
| `src/prompt/review.test.ts` | buildReviewInstruction の単体テスト |
| `src/cli/commands/prompt.test.ts` | 既存テスト + handlePropagate / handleReview の fixture テスト追加 |

## Risks / Trade-offs

- **[Risk] 共有ヘルパー抽出で session の出力が変わる** → Mitigation: 抽出後に session の既存テスト（バイト同一の決定性テスト含む）が無変更で green であることを確認する。session/derive のテストを 1 件も変更しないことをタスクの受け入れ基準に含める
- **[Risk] review の全量注入がコンテキスト窓を超える** → Mitigation: 初版は ADR-0004 の「正本を小さく保つ」原理を前提とする。窓を超える実例が出たら論点 8 戦略 3（シャーディング）を検討する。本変更のスコープ外
- **[Risk] SCOPE_MAX_HOPS リネームが既存 import を壊す** → Mitigation: session.ts からの re-export で後方互換を維持する。既存テストが無変更で通ることを確認する
- **[Trade-off] FORMAT_RULES_SUMMARY を shared.ts に移動しない** → propagate と review で FORMAT_RULES_SUMMARY を使うが、session.ts からの import を維持する。移動すると session.ts からの re-export が増え、変更量が利益に見合わない

## Open Questions

なし。全設計判断が request の architect 評価で確定済み。
