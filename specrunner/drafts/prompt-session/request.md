# prompt session を実装し、topic から設計セッションへの経路を立てる

## Meta

- **type**: new-feature
- **slug**: prompt-session
- **base-branch**: main
- **adr**: true

<!-- adr 判断基準: 新しい port/adapter 追加、既存パターンと異なる設計選択、振る舞い/契約を変える修正、構造的リファクタリング → true。いずれにも該当しない → false -->
<!-- 論点 8 の注入スコープ規則案を決定として確定する（hop 数・全量枠・縮約形）ため true -->

## 背景

ADR-0008 の動詞表にある `prompt session --topic <id>`（topic + 関連文書 + 形式規則を注入した設計セッション開始プロンプト）が未実装で、topic を起票した後の設計セッションの開始が人手の文脈集めに依存している。設計者（人 + agent セッション）が topic を渡すだけで、判断に必要な文脈が注入されたセッションを開始できる経路を立てる。

注入スコープの規則案は docs/open-questions.md 論点 8 に起草済み: 対象要素 + 参照の in/out 2 hop 近傍を本文ごと注入、不変条件と用語集は常に全量（小さく、常に判断 material になる）、manifest と形式規則の要約は常に注入、static のモジュール一覧は見出し + 責務行のみの縮約形。本 request はこの規則案を初版実装に昇格させる。

## 現状コードの前提

<!-- 書く直前に grep で再検証する。 -->

- src/cli/commands/prompt.ts — `handlePrompt` が sub-command dispatch（現在 `derive` のみ）。exit code 契約は 0 = 指示を stdout / 1 = loop 無効（stage gate、`isLayerEnabled`）/ 2 = 入力・設定不正。**computeNeighborhood と extractAllBodies を既に import して derive の文脈組み立てに使っている**
- src/graph/neighborhood.ts:24 — `computeNeighborhood(seedIds, graph, maxHops)`。参照グラフを in/out 両方向に maxHops まで走査し、seed 自身を除く到達要素 ID 集合を返す
- src/graph/body.ts:48 — `extractElementBody`、:105 — `extractAllBodies`（要素 ID → 本文抽出）
- src/prompt/derive.ts:59 — `buildDeriveInstruction(input)`。純関数で指示テキストを組み立てる既存パターン（I/O なし・テスト容易）
- spec/format.md §2 — `topics/<slug>.md` が top 要素。§8 — topic スキーマ（frontmatter: `id` / 任意の `source`、本文 = 症状・動機）。addressed は frontmatter に持たず ADR の `topics:` 引用から計算する（ADR-0018）
- spec/format.md §5〜§7 — 宣言構文（`{#id}`）・参照構文（`[[id]]`）・frontmatter 規約。セッション内で agent が要素を書き起こすために要約が注入される対象
- aozu 自身の design/ は loop 無効（`enabled: static, domain, dynamic`）のため、テストは合成 fixture で行う（coverage / mark の既存テストと同じ形）

## 要件

<!-- 実装の最重量部を名指しする。 -->

1. **`prompt session --topic <top-id> [--dir <path>]`** を追加する。指示テキストを stdout に出力し、ファイルには何も書かない（ADR-0008 の prompt 動詞意味論）。exit code は derive と同型: 0 = 成功 / 1 = loop 無効 / 2 = 入力不正（design 不在・topic 不存在）
2. **注入スコープ（最重量部）**: seed = topic 本文中の `[[id]]` 引用。プロンプトに含めるのは (a) topic 本文（id・source 込み）、(b) seed 要素と in/out 2 hop 近傍の本文全量、(c) inv / term の全量（近傍に関係なく常に）、(d) static モジュール一覧の縮約形（見出し + 責務行のみ）、(e) manifest の enabled 一覧、(f) 形式規則の要約（宣言・参照・型スキーマの要点。セッション内で agent が要素を書ける分量）。近傍に含まれない domain / dynamic 要素の本文は注入しない
3. **引用 0 件の topic は正常系**: seed が空なら近傍も空で、(a) + (c)〜(f) のみのプロンプトを出力する（topic は緩い入力であり引用義務はない — ADR-0006）
4. **セッションへの作法指示**をプロンプト末尾に含める: scaffold で新要素を作る・check を回しながら編集する・判断は ADR に記録する・topic は ADR の `topics:` 引用で addressed になる（ADR-0018）
5. 組み立ては derive と同じ分離にする: 純関数 `buildSessionInstruction(input)`（src/prompt/ 配下）+ CLI ハンドラの I/O 層。hop 数などの規則値は定数として一箇所に置く
6. 出力は決定的とする: 同一の design/ と topic に対してバイト同一の stdout（要素の列挙順は ID 辞書順等の決定的順序）

## スコープ外

- `prompt propagate` / `prompt review`（別動詞。別 request）
- one-shot runner（プロンプトを agent に直接投げる実行殻 — 論点 9-a、需要待ち）
- スコーピング規則の高度化（主張索引・グラフ近傍シャーディング — 論点 8 の戦略 3。設計が窓に収まらなくなった時点の課題）
- セッションプロンプトのテンプレート外部注入（設計判断参照）
- status / check の変更

## 受け入れ基準

<!-- 機械検証できる文にする。 -->

- [ ] 引用ありの topic で、topic 本文・seed 本文・2 hop 近傍本文・inv / term 全量・static 縮約・形式規則要約・作法指示が stdout に含まれることを合成 fixture テストで固定する
- [ ] 2 hop 近傍の**外**の要素本文が stdout に含まれないことをテストで固定する（スコープの上限）
- [ ] 引用 0 件の topic で exit 0、全量枠のみのプロンプトが出ることをテストで固定する
- [ ] loop 無効の design で exit 1、topic 不存在・design 不在で exit 2 をテストで固定する（derive と同型）
- [ ] 同一入力で stdout がバイト同一であることをテストで固定する
- [ ] stdout に診断が混ざらないこと（診断は stderr のみ — integration.md §5 の共通規約）
- [ ] 既存テスト無変更で green / `tsc --noEmit && bun test` green / dependencies 空

## architect 評価済みの設計判断

- **セッションプロンプトのテンプレートは aozu 所有（コード内）とし、manifest 注入にしない**。却下した代替: request テンプレートと同じ frontmatter 注入（ADR-0012）— request テンプレは消費者（実装パイプライン）の所有物だから注入するのであって、設計セッションは aozu 自身の工程であり消費者非依存にする理由がない。注入点は需要が出たら加算的に足せる
- **注入スコープは論点 8 の規則案をそのまま初版とする**（2 hop・inv / term 全量・static 縮約）。却下した代替: 実装時の独自調整 — 規則の調整は運用の証拠（文脈があふれる / 足りない実例）を待つ。規則値は定数一箇所に置き、調整を単一修正点にする
- **seed は topic 本文の `[[id]]` 引用とし、引用 0 件を正常とする**。却下した代替: 引用必須 — topic は成果物の階段の最上流で、下流に人がいるため曖昧でよい（ADR-0006）。greenfield の topic は引用先がまだ存在しない
- **exit code / stage gate は derive と同型**。prompt 動詞群の契約一貫性を保ち、呼び出し側（人・スクリプト）が動詞ごとの差異を覚えなくてよいようにする
