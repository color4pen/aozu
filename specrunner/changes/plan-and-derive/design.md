# Design: plan / prompt derive

## Context

aozu の loop 動詞（plan / coverage / derive / mark）のうち、state.json への書き込みを伴わない読み取り系 2 つ（`plan` と `prompt derive`）を先行実装する。

`plan` は designed フロンティアの要素を集め、spec/format.md §8 に適合する plan 文書を生成する。人が統合・分割・順序・並列可否を編集するための出発点であり、scaffold と同型のファイル生成コマンドである。

`prompt derive` は plan のグループを単位として、request 草稿生成のための指示テキストを stdout に出力するプロンプト動詞である。ファイルにも state にも書かない。テンプレートと出力先は manifest の frontmatter に設定として持ち、消費者非依存を保つ（ADR-0012）。

既存コードの制約:

- `computeFrontier` は src/cli/commands/status.ts にあり、mod-plan から mod-cli への依存は不許可。同一ロジックの再利用には移設が要る
- `findOwningElement`（参照の要素帰属）は src/check/attribution.ts にあり、mod-plan から mod-check への依存は不許可。注釈の mod 接地に帰属計算が要る場合は mod-graph へ移設する
- Element 型は id / prefix / displayName / file / line のみで本文テキストを持たない。derive で要素本文を注入するには、ファイル内容から要素の本文範囲を切り出す新しいロジックが要る
- manifest の frontmatter パースは src/check/manifest.ts にあり、mod-cli -> mod-check が許可済み。plan / derive コマンドの handler（mod-cli）からは直接利用可能
- src/plan/ と src/prompt/ は未作成だが、design/static/modules.md と design/rules.json にモジュール定義とパスが予約済み

## Goals / Non-Goals

**Goals**:

- G1: `aozu plan <slug>` で designed 要素を束ねた plan 文書を生成し、spec §8 に適合させる
- G2: plan 生成物に判断材料の注釈（参照辺・mod 接地・requested 一覧）を含める
- G3: `aozu prompt derive --group <grp-id>` で request 草稿生成の指示テキストを stdout に出力する
- G4: テンプレートと出力先を manifest frontmatter の設定 2 点で注入する（ADR-0012）
- G5: 段階ゲートを全コマンドに適用する（loop 無効時は明示エラー、fail-closed）
- G6: 正本の追随（spec/format.md §3、spec/integration.md §4、design/static/modules.md の mod-plan 責務行）

**Non-Goals**:

- `coverage` / `mark implemented` / state.json への書き込み一切
- designed への戻り遷移の機構
- `prompt session` / `prompt propagate` / `prompt review` / `diff` / `trace`
- プロンプトのスコープ縮約の高度化（static 一覧の縮約形等）
- 設定の CLI フラグによる上書き
- plan の `status: derived` への遷移

## Decisions

### D1: computeFrontier の移設先 — mod-plan

`computeFrontier` は現在 src/cli/commands/status.ts に定義されているが、mod-plan から mod-cli への依存は不許可である。

移設先は mod-plan（src/plan/frontier.ts）とする。`computeFrontier` は Graph 型（mod-graph）と StateMap 型（mod-state）の両方に依存するため、移設先にはこの 2 つへの依存が許可されている必要がある。mod-plan -> mod-graph と mod-plan -> mod-state はいずれも許可済み。mod-cli -> mod-plan も許可済みであり、status.ts からの import に問題はない。

`computeFrontier` とその型 `Frontier`・`IMPLEMENTATION_PREFIXES` 定数を src/plan/frontier.ts に移設する。status.ts は src/plan/frontier.ts から再 import する。

**Rationale**: フロンティア導出は「グラフ + state.json → 計画に供する要素の分類」であり、plan の生成に直接使う情報を産出する。mod-plan の責務「plan の生成」の前段として自然。

**Alternatives considered**: mod-state に移設 → mod-state -> mod-graph の依存が許可されておらず、Graph 型を直接利用できない。引数を全て展開して Graph 依存を避ける手もあるが、シグネチャが肥大する。mod-graph に移設 → mod-graph -> mod-state は不許可であり StateMap を使えない。

### D2: findOwningElement の移設先 — mod-graph

mod 接地の注釈（要件 2b: 各要素が参照する / 各要素を参照する mod の一覧）には、参照の要素帰属が必要になる。`findOwningElement` は現在 src/check/attribution.ts にあるが、mod-plan から mod-check への依存は不許可。

要素帰属は「グラフ上の要素と参照の位置関係から所有者を決定する」純粋関数であり、mod-graph の責務（要素表と参照辺の構築・ID 解決）の延長線上にある。src/graph/attribution.ts に移設し、src/check/attribution.ts は re-export（または直接 import を差し替え）する。mod-check -> mod-graph は許可済みであり check 側の動作に影響しない。mod-plan -> mod-graph も許可済みであり plan がこの経路で利用できる。

**Rationale**: 帰属計算はグラフの位置情報のみに依存する純粋関数であり、check 固有のロジックではない。

**Alternatives considered**: mod-plan 内への複製 → 同じ導出の二重実装は避ける（R7 一元化の逆行）。

### D3: 要素本文の切り出し — mod-graph に extractElementBody を新設

Element 型は本文テキストを保持していない。derive では対象要素と 2 hop 近傍の要素の本文全量が必要となる。

src/graph/body.ts に `extractElementBody(elementId, graph, fileContents)` を新設する。ロジック: 対象要素の file と line から開始位置を特定し、同じファイル内の次の同レベル以上の見出し要素（または文書要素なら EOF）までの範囲を本文として返す。FileInput[] をファイル内容源として受け取る（純粋関数、IO なし）。

**Rationale**: 本文切り出しは要素の宣言位置（Element.file / Element.line）とファイル構造の解釈であり、mod-graph の責務（要素表と ID 解決）の自然な拡張。mod-prompt -> mod-graph は許可済み。

**Alternatives considered**: mod-parse に配置 → 本文切り出しは宣言抽出ではなくグラフ構築済みの要素情報を前提とする処理であり、parse の責務（行指向の抽出）とは異なる。

### D4: 2 hop 近傍の計算 — mod-graph に computeNeighborhood を新設

src/graph/neighborhood.ts に `computeNeighborhood(seedIds, graph, maxHops)` を新設する。参照グラフ上で seedIds から in/out 双方向に maxHops ホップ以内の要素 ID 集合を返す。derive は maxHops=2 で呼ぶ。

**Rationale**: 近傍計算は参照グラフのトラバーサルであり、mod-graph の責務。

### D5: mod-plan のコアロジック — generatePlan (純粋関数)

src/plan/generator.ts に `generatePlan(slug, designed, annotations)` を配置する。入力:

- slug: plan の名前
- designed: designed 要素 ID の配列
- annotations: { referenceEdges, modGrounding, requestedElements }

出力: plan 文書の文字列（spec §8 適合）。全 designed 要素を 1 つのグループ `grp-<slug>` にまとめ、注釈を自由 Markdown 節として付加する。`request:` 行は書かない（ADR-0018-2）。

handler（mod-cli）が graph / state / manifest の読み込みと注釈素材の組み立てを行い、generatePlan に渡す。

**Rationale**: plan 生成ロジックを純粋関数に閉じることで、テストが容易になり、mod-plan は graph / state のみに依存する（IO を持たない）。

### D6: mod-prompt のコアロジック — buildDeriveInstruction (純粋関数)

src/prompt/derive.ts に `buildDeriveInstruction(input)` を配置する。入力:

- groupElements: グループ内の要素 ID 配列
- elementBodies: 対象要素の本文 Map<id, body>
- neighborBodies: 2 hop 近傍要素の本文 Map<id, body>
- terms: term/inv の全文
- templateContent: テンプレートの内容文字列
- outputDir: 出力先パス
- planId: plan の ID

出力: 指示テキスト文字列。テンプレートは `---TEMPLATE BEGIN---` / `---TEMPLATE END---` で明示区切り。引用規約文を含む。

handler（mod-cli）がテンプレート取得（ファイル読み / コマンド実行）、要素本文の切り出し、近傍計算を行い、結果を buildDeriveInstruction に渡す。mod-prompt は入力を受けて文字列を返すだけの純関数に保つ（architect 評価済み）。

**Rationale**: テンプレート取得の IO を composition root（mod-cli）に閉じることで、mod-prompt が IO を持たない（テスト容易性・mod-fsread への依存回避）。

### D7: テンプレート取得のデュアルモード — ファイル or コマンド実行

manifest の `request-template` の値をデュアルモードで解釈する:

1. 値が実在ファイルパスなら、そのファイルの内容をテンプレートとして使う
2. 実在しなければ、値をシェルコマンドとして実行し stdout をテンプレートとして使う

判定ロジックは handler（mod-cli の derive コマンド handler）に置く。ファイル存在確認 → 存在すればファイル読み取り、存在しなければ `Bun.spawn` でコマンド実行。

パスは manifest ファイルからの相対パスで解決する（design ディレクトリ基準）。

**Rationale**: ADR-0012 の設計。ファイルとコマンドの切り替えを明示フラグではなく実在性で判定することで、設定の簡潔さを保つ。

### D8: 段階ゲートの実装パターン

plan / derive コマンドの handler 冒頭で `isLayerEnabled("loop", manifest)` を検査し、false なら stderr に案内メッセージを出力して exit 1 を返す。

plan の追加ゲート: 既存 `plans/<slug>.md` が存在する場合は exit 1、designed 要素が 0 件の場合は exit 1。

derive の追加ゲート: plan ファイル不在・グループ不在・グループの elements に未解決要素がある場合は exit 2。`request-template` / `request-output-dir` が manifest に欠けている場合は exit 2。

**Rationale**: ADR-0010「縮退して動くふりをしない」。exit code は spec/integration.md §5 の規約に従い、入力不正は exit 2、検証不合格は exit 1。derive は入力の設定不備が主因のため exit 2。

### D9: plan の注釈構造

注釈は plan ファイル末尾の自由 Markdown 節として出力する。機械の読む行（frontmatter, `- elements:`, `- after:`, `- parallel:`）とは位置的に分離される。

構造:
```
## 注釈

### 参照辺
（designed 要素間の参照関係を `A -> B` 形式で列挙）

### モジュール接地
（各要素が属する / 参照する mod を列挙）

### 実行中の要素
（state.json で requested 状態の要素一覧）
```

**Rationale**: ADR-0006 の判断材料の注釈。自由 Markdown 節なので check（C10）に影響しない。

### D10: derive の指示テキスト構造

stdout に出力される指示テキストの構造:

```
# Request 草稿生成指示

## テンプレート
---TEMPLATE BEGIN---
（テンプレート内容）
---TEMPLATE END---

## 対象要素
（グループの各要素の本文）

## 近傍要素（参照 in/out 2 hop）
（近傍要素の本文）

## 用語・不変条件
（term / inv の全量）

## 引用規約
変更対象の設計要素を `[[id]]` で本文に引用せよ。引用は被覆の宣言であり coverage が検証する。

## 出力先
（request-output-dir のパス）
```

### D11: plan コマンドの CLI 構文 — `aozu plan <slug>`

`aozu plan <slug> [--dir <path>]` とする。slug は plan の名前であり、ID は `plan-<slug>` として自動構成される。scaffold と同じ構文パターン。

plan は `design/plans/<slug>.md` に生成する。ディレクトリが存在しなければ作成する。

### D12: prompt derive の CLI 構文 — `aozu prompt derive --group <grp-id>`

`aozu prompt derive --group <grp-id> [--dir <path>]` とする。`prompt` は新しいトップレベルコマンドであり、サブコマンド `derive` を持つ。将来 `session` / `propagate` / `review` が追加される拡張点。

registry には `prompt` を登録し、handler 内で第 1 引数をサブコマンドとして dispatch する。

### D13: 正本更新の範囲

実装と同じ PR で以下の正本を更新する:

(a) spec/format.md §3: manifest の任意キーとして `request-template` / `request-output-dir` を追補
(b) spec/integration.md §4: 「設定で注入され」に注入点（manifest frontmatter）を明記
(c) design/static/modules.md: mod-plan の責務行から「グループへの request 記録」を削除し「plan の生成・coverage 検証」に修正
(d) `export rules --verify` 整合のため `aozu export rules --out design/rules.json` を実行

format-version は変更しない（加算的変更、ADR-0016）。

## Risks / Trade-offs

- [Risk] computeFrontier の移設により status.ts の import パスが変わる → Mitigation: status.ts の import を src/plan/frontier.ts に差し替え、既存テストの green を確認する。status.ts から re-export すれば外部 API は不変
- [Risk] findOwningElement の移設により check の import パスが変わる → Mitigation: src/check/attribution.ts は src/graph/attribution.ts からの re-export に差し替え、check のテストが通ることを確認する
- [Risk] 要素本文の切り出しロジックが見出しレベルの判定に依存し、複雑な文書構造で誤切り出しする → Mitigation: 見出し要素は次の同レベル以上見出し（`## ` で始まる行）まで、文書要素は EOF までという単純な規則で始め、テストで固定する
- [Risk] テンプレートをコマンドとして実行するモードでセキュリティ上の懸念がある → Mitigation: manifest は人が管理する設計文書であり、信頼境界内。実行はユーザーの明示的な設定に基づく
- [Risk] `request-template` の値がファイルでもコマンドでもない場合の挙動 → Mitigation: コマンド実行が失敗した場合（非ゼロ exit）は stderr に診断を出して exit 2

## Open Questions

- なし（設計判断は request の architect 評価で解決済み）
