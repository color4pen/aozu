# 形式仕様 v0（draft）

- Status: draft — ドッグフーディングでの修正を前提とする
- format-version: 0

本仕様は設計文書の**strict プロファイル**を定義する。目標は「行指向の貧弱なパーサで読める」こと（ADR-0003）。本仕様に含まれない Markdown 記法は自由（ツールは無視する）。

## 1. 用語

- **要素（element）**: ID を持つ設計の最小単位。参照・引用・トレースの対象
- **アーティファクト**: 要素を含む文書ファイル
- **ビュー**: manifest で有効化される optional なアーティファクト型（ADR-0002）
- **閉包**: 有効な型のリンク義務がすべて解決している状態

## 2. ディレクトリ規約

```
design/
  manifest.md          # 有効化宣言（必須）
  static/
    modules.md         # mod 要素
    dependencies.md    # 許可依存（辺。要素ではない）
  domain/
    glossary.md        # term 要素
    model.md           # ent 要素
    invariants.md      # inv 要素
    actors.md          # act 要素（任意）
  dynamic/
    <slug>.md          # 1 ファイル 1 seq 要素
  topics/<slug>.md     # top 要素
  plans/<slug>.md      # plan 要素
  adr/NNNN-<slug>.md   # adr 要素
  state.json           # 要素状態マップ（ツールのみが書く）
  rules.json           # コミット済み ruleset（export rules --out の既定出力先。--verify の比較対象）
  views/<type>/...     # 有効化されたビュー
```

最小プロファイル（ADR-0010 段階①）は `manifest.md` + `static/` のみ。

## 3. manifest

`design/manifest.md`。frontmatter のみを読む:

```markdown
---
format-version: 0
enabled: static, domain, dynamic, loop, use-case
---
```

- `enabled` は単一のリスト。層（static / domain / dynamic）、ループ（loop = topic・plan・state）、ビュー型を並べる
- 任意キー（loop 有効時の導出設定）:
  - `request-template`: 値がファイルパス（design dir からの相対）なら内容を、存在しなければシェルコマンドとして実行し stdout をテンプレートとして使用する
  - `request-output-dir`: `prompt derive` が指示に含める草稿の出力先パス
- 型の前提関係は次表を正とし、check（C7）が組み合わせの不正を検出する:

| 型 | 前提 |
|---|---|
| static | なし（最小プロファイル） |
| domain / dynamic / loop | static |
| use-case | dynamic |
| screen | use-case |
| api / external / deployment | static |
| permission | domain |
| data | domain |
| dataflow / event | dynamic |

ビュー型の行は各ビューのスキーマ追補（§12）時に確定する。**permission は確定済み**（操作行が act を参照するため domain を前提とする — ADR-0023）。他は暫定。

## 4. ID 文法

```
id      = prefix "-" slug
slug    = [a-z0-9]+ ("-" [a-z0-9]+)*
```

- **一意性はリポジトリ全体**で 1 名前空間（参照解決を単純にするため）
- **ID は不変**。改名は表示名の変更であり、ID を変えることは要素の削除 + 新規作成を意味する
- 型プレフィクス:

| prefix | 型 | 属する層 |
|---|---|---|
| `mod` | モジュール | static |
| `term` | 用語 | domain |
| `ent` | エンティティ | domain |
| `inv` | 不変条件 | domain |
| `act` | アクター（ロール・主体） | domain |
| `seq` | シーケンス | dynamic |
| `top` | topic | loop |
| `plan` | plan | loop |
| `grp` | plan 内グループ | loop |
| `adr` | 決定記録 | 常時 |
| `uc` / `scr` / `api` / `dat` / `flow` / `evt` / `ext` / `perm` / `dpl` | 各ビュー | views |

ビュー型が manifest の `enabled` に現れるときの正準名と prefix の対応:

| enabled 名 | prefix |
|---|---|
| `use-case` | `uc` |
| `screen` | `scr` |
| `api` | `api` |
| `data` | `dat` |
| `dataflow` | `flow` |
| `event` | `evt` |
| `external` | `ext` |
| `permission` | `perm` |
| `deployment` | `dpl` |

## 5. 宣言構文

**見出し要素**（1 ファイルに複数置ける型: term / ent / inv / mod / uc 等）:

```markdown
## 受注 {#ent-order}
```

- パターン: `^#{2,3} (.+) \{#(<id>)\}$`。見出しから次の同レベル見出しまでが要素の本文

**文書要素**（1 ファイル 1 要素の型: seq / top / plan / adr）: frontmatter で宣言:

```markdown
---
id: seq-order-intake
---
```

文書要素の表示名は、ファイル先頭の `# 見出し` とする。

## 6. 参照構文

本文中の `[[id]]` がすべて。リンク義務の充足・トレース・引用はこの一文法に還元される。

**コードフェンス（``` で囲まれた範囲）およびインラインコード（バッククォート内）の `[[id]]` は参照ではない**。文法自体への言及を可能にするための除外であり、行指向処理（フェンスのトグル + インラインコードの除去）で判定できる。

## 7. frontmatter 規約

- flat な `key: value` のみ（ネスト・複数行値なし）。値は文字列またはカンマ区切りリスト
- これを超える構造が必要になったら形式の設計を疑う

## 8. アーティファクト型スキーマ

### static/modules.md — mod

```markdown
## CLI 層 {#mod-cli}
責務: コマンド解釈と入出力。ドメイン判断を持たない。
実装: src/cli/
```

- 責務 1 行を必須とする（`責務:` で始まる行）
- 粒度は seam（レイヤ / ディレクトリ境界）とする。個別関数を mod にしない — 細粒度の言及は seq の流れの散文に書く（ADR-0017）
- `実装:` 行（実装ディレクトリのカンマ区切り）は任意。ただし rules export はすべての mod に `実装:` を要求する（欠けていれば export 不合格）。設計と実装の接地は設計情報であり、外部の設定ファイルに出さない

### static/dependencies.md — 許可依存

```markdown
- [[mod-cli]] -> [[mod-core]]
```

- パターン: `^- \[\[<id>\]\] -> \[\[<id>\]\]$`。「左は右に依存してよい」
- 列挙されない依存はすべて禁止（fail-closed）。辺は要素ではなく ID を持たない

### domain/glossary.md — term / model.md — ent / invariants.md — inv

- term: 見出し + 定義本文。**ent / act の見出しは用語定義を兼ねる**ため、glossary には構造を持たない語彙のみを置く（同じ概念を複数の型に書かない）
- ent: 見出し + 本文（属性の箇条書き、関係は `[[ent-*]]` 参照で表す）
- inv: **1 見出し 1 本**。個別引用される粒度（ADR-0017 — inv の主たる引用文脈は個別引用）
- act: 見出し + 本文（誰であるか・何に責任を持つかの散文）。シナリオ（seq）の主語として登場要素から参照される。**操作権限の詳細（act × 操作のマトリクス）は permission ビューの領分**であり、act はその土台となる宣言のみ

### dynamic/<slug>.md — seq

```markdown
---
id: seq-order-intake
---
# 引合の受付

## 登場要素
- [[mod-cli]]
- [[mod-core]]

## 流れ
（自由記述。Mermaid は挿絵であり検証対象外）
```

`## 登場要素` 配下の `- [[id]]` リストが機械の読む正本。

### topics/<slug>.md — top

```markdown
---
id: top-duplicate-slug
source: gh#708
---
（症状・動機。意図を書いてよいが提案であって決定ではない）
```

`source` は任意。addressed の状態は frontmatter に持たず、**計算で導く**: ADR から `topics:` で引用された top は addressed とみなす（ADR-0018。ADR の top 引用はその topic への決定の宣言であり、決定しない topic の文脈引用は誤用）。open topic のフロンティアは status コマンドが計算表示する。

### plans/<slug>.md — plan

```markdown
---
id: plan-checkout-rework
status: open
---
## 受注モデル刷新 {#grp-order-model}
- elements: [[ent-order]], [[inv-3]]
- after: （順序制約。grp 参照、任意）
- parallel: no
```

`status: open | derived`。グループは見出し要素、`elements:` 行が被覆の正本。plan は**現在形の作業文書**であり、derive を終えたら削除してよい（過去の plan は git 履歴が保持する。ADR-0018）。要素 ↔ request の対応は state.json が正本であり、plan には記録しない。

### adr/NNNN-<slug>.md — adr

```markdown
---
id: adr-0001-order-status-model
topics: [[top-duplicate-slug]]
---
```

`loop` 有効時、`topics:` に最低 1 つの top 引用を必須とする（ADR-0006）。

### views/permission/<file>.md — perm

```markdown
## 案件の権限 {#perm-deal}
対象: [[ent-deal]]

- list: [[act-admin]], [[act-manager]], [[act-member]], [[act-finance]]
- create: [[act-admin]], [[act-manager]]
```

- 1 見出し 1 perm 要素 = 1 つの保護対象の操作 × アクター表（粒度は ADR-0017 / ADR-0023 D1）
- **機械の読む正本は操作行**: `- <operation>: [[act-id]](, [[act-id]])*`。operation は空白と `:` を含まない自由トークンで、同一 perm 内で一意。操作行が 1 本も無い perm は違反（非空義務、C6）
- 操作行の参照はすべて **act 要素**に解決されること（C6。C5 の主語義務と同型）
- `対象:` 行は任意。書く場合は実在要素への参照（解決は C3 の一般規則）
- 操作は**表面非依存**の動詞（画面・API・MCP ツールのどれから呼ばれるかを perm は知らない — ADR-0023 D2）。表面 → 操作の対応はコード側の関心事
- ファイル配置は `views/permission/` 配下の任意の `.md`

## 9. 状態マップ — state.json

```json
{
  "ent-order": { "state": "requested", "request": "order-model-rework" },
  "mod-cli":   { "state": "implemented", "request": "cli-split", "pr": 123 }
}
```

- キーは要素 ID、**辞書順ソート・1 要素 1 行**で書く（並列作業時の merge 衝突を「同一要素を触った場合」だけに局所化する）
- `state: designed | requested | implemented`（ADR-0005）。エントリが無い要素は designed とみなす
- **人は編集しない**。coverage / mark / 設計 delta の merge がツール経由で書く。唯一の例外は次項の衝突裁定で、conflict marker の解消は人が直接行う
- 同一要素への並行更新は git の衝突として表面化させ、機械的な後勝ち解決を行わない（同一要素の並行変更は設計上の真の衝突であり、人が裁く）
- 削除された要素はエントリごと削除する（C8）。削除要素のトレース（request / PR 対応）は git 履歴が保持する — state.json が持つのは現在形のみ（ADR-0004 と同型の規約）

## 10. 閉包検証規則（check）

有効な型のみ評価する（段階縮退、ADR-0010）:

| # | 規則 |
|---|---|
| C1 | すべての ID が文法に適合する |
| C2 | ID がリポジトリ全体で一意 |
| C3 | すべての `[[id]]` が有効な型の実在要素に解決される。ただし**参照元・参照先のどちらか**の型が無効な参照は評価しない（無効な型の義務は評価しない、の一貫適用）。縮退による評価除外は**既知だが無効な型**に限る——**未知の prefix**（§4 に無い型）を持つ参照は縮退の対象外で、常に違反として診断する（typo の fail-open を許さない） |
| C4 | dependencies の辺の両端が mod 要素に解決される。この規則は static アーティファクトの構造義務であり **C3 の縮退スキップの対象外**（端点が mod 以外なら、その型の有効・無効によらず常に違反） |
| C5 | seq の登場要素リストが空でなく（**非空義務は縮退に依らず常に評価する**）、すべてのエントリの prefix が mod または act である（prefix 適格性も常時評価）。エントリの**解決**は C3 に従う — domain 無効時の act 参照は既知だが無効な型として解決検証のみ縮退スキップされる。act のみの登場要素リストも非空義務を満たす |
| C6 | ビューのリンク義務が充足される。サポート済みの型はスキーマのリンク義務を検証する（perm → act・操作行の非空と一意）。**未サポートのビュー型が enabled に現れたら常に違反**（fail-closed。サポート済みは現在 permission のみ） |
| C7 | manifest の enabled 組み合わせが型の前提関係を満たす |
| C8 | state.json の全キーが実在要素（削除要素の残骸検出） |
| C9 | adr が top を引用している（loop 有効時） |
| C10 | plan の elements がすべて実在し、after の grp が実在する |
| C11 | 層間参照方向: domain の要素は domain（term / ent / inv / act）のみを参照できる。static は static と domain、dynamic は dynamic・static・domain を参照できる。views は views・static・domain・dynamic を参照できる（コア層 → views の参照は禁止 — ADR-0023 D6）。loop と adr は制限なし |
| C12 | manifest の `format-version` が対応集合に属する（現在 `{"0"}`）。欠落も違反 |

## 11. rules export

```json
{
  "format-version": 0,
  "modules": ["mod-cli", "mod-core"],
  "paths": { "mod-cli": ["src/cli/"], "mod-core": ["src/core/"] },
  "allowed": [["mod-cli", "mod-core"]]
}
```

実装リポジトリの architecture test が消費する中立形式。`--verify` はコミット済み出力と設計文書の一致を検査する。

### permissions export（permission ビュー有効時）

```json
{
  "format-version": 0,
  "permissions": [
    {
      "id": "perm-deal",
      "target": "ent-deal",
      "operations": {
        "create": ["act-admin", "act-manager"],
        "list": ["act-admin", "act-finance", "act-manager", "act-member"]
      }
    }
  ]
}
```

`export permissions` が排出する。権限突合テスト（設計の表 vs コードの権限定義の等値検査）が消費する中立形式。

- `target` は `対象:` 行が無ければ省略
- 出力順は決定的: `permissions` は id 昇順、`operations` のキーは辞書順、act 配列は ID 昇順（diff の安定性）
- コミット済み成果物と `--verify` は持たない。突合の比較対象はコード側の権限定義そのものであり、中間成果物を挟まない（ADR-0023 D4）
- permission ビューが enabled でない design に対しては exit 1（この design は権限を aozu の管理下に置いていない、の宣言）

## 12. 本仕様内の未決

- **seq の登場要素に外部システムを含める扱い**（アクターは ADR-0015 で act 型として決着済み。外部系は ext ビューの追補時に扱う）
- ビュー型それぞれのスキーマ詳細（named consumer を名指しできる実プロジェクトが現れた時点で個別に追補 — ADR-0022。**permission は ADR-0023 で追補済み**、§8）
- `format-version` の互換性ポリシー（v1 で確定）
