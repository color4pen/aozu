# ADR-0019: prompt session の実装と注入スコープ規則

- Status: accepted
- Date: 2026-07-03

## Context

ADR-0008 の動詞表に `prompt session --topic <id>` が定義されていたが未実装だった。topic を起票した後の設計セッション開始が人手の文脈集めに依存しており、設計者が topic を渡すだけで必要な文脈が注入されたセッションを開始できる経路が存在しなかった。

実装にあたって三つの設計選択が必要になった:

1. **注入スコープの規則** — どの要素をどこまで注入するか。`docs/open-questions.md` 論点 8 に規則案が起草済みだったが、「運用の証拠を待って調整する」という留保があり決定として確定していなかった
2. **セッションプロンプトのテンプレート所有権** — `prompt derive` は実装パイプライン（消費者）のテンプレートを manifest で注入する（ADR-0012）。`prompt session` でも同じ方式を採るか、aozu 所有のコード内定数にするか
3. **seed の抽出規則** — topic の引用対象を seed とする方式と、topic frontmatter に明示列挙する方式の選択

## Decision

### 1. 注入スコープ規則（論点 8 の初版実装として確定）

注入する内容と範囲を以下の 6 種に固定する:

| 種別 | 対象 | 注入量 |
|---|---|---|
| topic | 指定された top 要素 | 本文全量（id・source 込み） |
| seed 要素 | topic 本文中の `[[id]]` 引用 | 本文全量 |
| 近傍要素 | seed の in/out **2 hop** 近傍 | 本文全量 |
| term / inv | 全量（近傍に関係なく常に） | 本文全量 |
| static mod | 全量 | **縮約形**（見出し + `責務:` 行のみ） |
| 形式規則要約 | 宣言・参照・型スキーマの要点 | コード内定数 |

hop 数は定数 `SESSION_MAX_HOPS = 2` として `src/prompt/session.ts` に一箇所化し、調整を単一修正点にする。規則の調整は運用の証拠（文脈があふれる / 足りない実例）が揃ってから行う。

### 2. セッションプロンプトテンプレートは aozu 所有（コード内定数）

`FORMAT_RULES_SUMMARY`（形式規則要約）と `SESSION_GUIDANCE`（セッション作法指示）を `src/prompt/session.ts` のコード内定数として持つ。manifest への注入は行わない。

セッション作法指示の内容: scaffold で新要素を作る・check を回しながら編集する・判断は ADR に記録する・topic は ADR の `topics:` 引用で addressed になる（ADR-0018）。

### 3. seed は topic 本文の `[[id]]` 引用、0 件は正常系

`extractReferences(topicBody, topicFile)` で topic 本文中の `[[id]]` 引用を抽出し seed とする。引用 0 件の topic は正常終了し、seed セクションと近傍セクションが空プレースホルダになるだけでプロンプトを出力する。

### 4. exit code は derive と同型

| 条件 | exit code |
|---|---|
| 成功 | 0 |
| loop 無効（stage gate） | 1 |
| 入力不正（design 不在・topic 不存在・引数欠落） | 2 |

## Alternatives Considered

### Alternative 1: テンプレートを manifest 注入にする（ADR-0012 方式）

- **Pros**: derive との一貫性。注入点を外から差し替えられる
- **Cons**: 設計セッションは aozu 自身の工程であり、外部消費者に依存する理由がない。テンプレートの差し替え需要が現時点で存在しない
- **Why not**: request テンプレートは実装パイプライン（消費者）が所有するものであり manifest 注入する意義がある。セッションプロンプトは aozu の工程知識であり消費者非依存にする理由がない。注入点は需要が出たら加算的に足せる

### Alternative 2: topic frontmatter に seed を明示列挙する

- **Pros**: 明示的で解釈の余地がない
- **Cons**: topic の軽量さ（数行の症状記述）を損なう。ADR-0006「緩い入力」原則に反する。greenfield の topic は引用先がまだ存在しない
- **Why not**: topic は成果物の最上流で、下流に人がいるため曖昧でよい（ADR-0006）

### Alternative 3: 注入スコープを実装時に独自調整する（論点 8 の規則案を使わない）

- **Pros**: 実装の裁量で最適化できる
- **Cons**: 規則のばらつきが生じ、hop 数などの変更が散在する。運用前に「最適」を判断する証拠がない
- **Why not**: 規則の調整は運用の証拠を待つ。定数一箇所化で調整コストを下げる方が設計として正しい

### Alternative 4: static mod を全文注入する

- **Pros**: 実装が単純（`extractAllBodies` をそのまま使える）
- **Cons**: 大きな codebase では static 全文が窓を圧迫する。設計セッションに `実装:` 行やサブ見出しは不要
- **Why not**: 論点 8 の規則案「static は縮約形」がウィンドウコストへの合理的な対処。全文は必要になれば check / status で確認できる

### Alternative 5: spec/format.md をランタイムに読み込んで全文注入する

- **Pros**: 要約の手動更新が不要になり、常に最新の仕様を反映できる
- **Cons**: 閉包規則（C1〜C11）や state.json の詳細など設計セッションに不要な情報も含まれる。`mod-prompt` から `mod-fsread` への依存が生じ、純関数 `buildSessionInstruction` に I/O が混入する
- **Why not**: ランタイムのファイル読み込みは handler（mod-cli）の責務であり純関数には持ち込まない。要約は宣言・参照・ID 文法の最小限に限定しており変更頻度は低い。乖離は check 実行（書き起こした要素が不合格になる）で間接検出される

## Consequences

### Positive

- topic を渡すだけで判断に必要な文脈が注入されたセッションを開始できる経路が確立する
- 注入スコープ規則が定数として一箇所に閉じ、hop 数の変更が単一修正点になる
- derive と同型の exit code / stage gate により、呼び出し側（人・スクリプト）が動詞ごとの差異を覚えなくてよい
- `buildSessionInstruction` 純関数の分離（derive と同パターン）によりテストが I/O なしで記述できる

### Negative

- `FORMAT_RULES_SUMMARY` は `spec/format.md` が更新されると手動更新が必要になる。乖離は check 実行（書き起こした要素が不合格になる）で検出可能だが、自動追従はしない
- 2 hop 近傍に大量の要素が含まれる場合、窓が圧迫される。初版では全量注入とし、証拠が出てからスコーピング規則の高度化を検討する（論点 8 戦略 3 — スコープ外）

### Risks

- **形式規則要約の乖離** → Mitigation: 要約は宣言・参照・ID 文法の最小限に限定しており変更頻度は低い。乖離は check で間接検出される
- **近傍爆発** → Mitigation: 初版では許容し、実例が出た時点で論点 8 戦略 3（グラフ近傍シャーディング）を検討する

### Known Design Debt

- static mod 縮約ロジック（`責務:` 行が存在しない場合のフォールバック: 現実装はプレースホルダ文字列を出力、design.md D5 は「見出しのみ」と規定）に仕様と実装の文言上の乖離がある（review-feedback-001 finding #4）。次の変更で設計判断を確定しコードかコメントを揃える
