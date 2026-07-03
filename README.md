# aozu

**aozu（青図 = blueprint）** — 設計レイヤ CLI。プロダクトリポジトリ内の設計文書を正本として管理し、閉包検証・差分計算・request 導出支援を行う**決定的ツール**。agent 実行を内蔵せず、文脈注入済みの指示（instruction）を出力するまでを担う。消費するのはセッション側の agent。

## 位置づけ

実装パイプライン（request → merged PR を無人完走するツール。例: spec-runner）の上流に、構造レベルの設計工程を形式として与える。設計判断には機械的な合否が存在しないため、実装と同じ完走型パイプラインにはせず、人の判断を決定的処理（検証・差分・導出）で挟む動詞型 CLI とする。境界の詳細（解く問題と解かない問題・保証の範囲・細部の置き場）は [docs/boundary.md](docs/boundary.md)。

## 原理

決定の正本は adr/ にあるが、貫く原理は少ない:

1. **LLM セッションに状態を持たせない**。状態はすべてリポジトリのファイルに落ち、セッションは使い捨てられる。現在地は `status` と `check` の診断から復元する
2. **読む機械のない文書は腐る**（ADR-0004）。形式化・書き起こし・ビュー追加は、それを読む機械（または強制力）を名指しできるときにのみ行う。正本は現在形の living docs とし、過去形の記録は ADR のみが積層する
3. **機械強制できるのは順序ではなく整合**（ADR-0007）。強制する不変条件は design-not-later-than-merge であり、入口ゲート（request の引用検証）と出口ゲート（rules export → architecture test）で挟む
4. **fail-closed**。列挙されない依存は禁止、未知の prefix は違反、マップされないソースは違反。縮退（段階導入）が免除するのは「既知だが無効な型」に限る
5. **判断場面を消す**（ADR-0007）。規律を文化・習慣で守らせない。人の判断は topic / plan / ADR という置き場に集約し、それ以外は決定的処理にする
6. **粒度は型ごとに、その型の主たる引用文脈で決める**（ADR-0017。基底ヒューリスティックは「引用される最小単位」）

## 成果物の階段

```
topic     … 設計の入力。緩い（症状・動機）      ← 下流に人がいるので曖昧でよい
design    … 設計本体。構造的（ID・参照・閉包）
plan      … request の計画。表（束ね方の判断）
request   … 実装の依頼。精密（下流が無人だから）
```

下流ほど無人区間に近づくため形式が硬くなる。

## 一周の流れ

```
topic 起票
  → 設計セッション（attended。check を回しながら編集、判断は ADR に記録）
  → 設計 delta の PR（CI: check + rules 同期検証。merge = 設計承認）
  → plan（人が request への束ね方を決める）
  → prompt derive（request 草稿生成）→ coverage（草稿の被覆を機械検証、合格要素は requested へ）
  → 実装パイプラインへ
  → 取り込み完了 hook（mark implemented）で要素が implemented に遷移
  → status のフロンティアが空なら一周閉じる
```

## 導入

**bun ランタイムが必要です**（Node.js では動作しません）。[bun のインストール](https://bun.sh)を先に行ってください。

```sh
# インストール不要で実行（npx 相当）
bunx aozu --help

# グローバルインストール
bun add -g aozu
```

## 使い方

- **動詞体系**: ADR-0008。実装状況は下記ステータス参照
- **ツールの境界**: [docs/boundary.md](docs/boundary.md) — 解く問題と解かない問題・保証の対応表・細部の置き場の三段選択
- **既存プロジェクトへの導入**: [docs/adoption.md](docs/adoption.md) — 三原則（消費者と同時にしか書き起こさない・一括書き起こしは static のみ・正本は型ごとに移る）と Step 0〜4 の手順
- **実装パイプラインとの結線**: [spec/integration.md](spec/integration.md) — `check --request` / `mark implemented` / `export rules` の CLI 契約
- **仕様の破綻を探すドッグフーディング**: [docs/dogfooding-runbook.md](docs/dogfooding-runbook.md)（導入とは目的が異なり、一括転写が正当な唯一の場面）
- **設計記録の敵対的整合レビュー**: [docs/review/adversarial-consistency.md](docs/review/adversarial-consistency.md)（定型プロンプト）。被覆は [docs/review/coverage.md](docs/review/coverage.md) の台帳で管理する

## 決定記録

リポジトリ直下の `adr/` は**本ツール開発の**決定記録である。形式仕様が定める `design/adr/`（対象プロジェクトの設計決定、loop 有効時に C9 の検証対象）とは別物。

| ADR | 決定 |
|---|---|
| [0001](adr/0001-tool-positioning.md) | 位置づけと責務境界 — 設計の正本を守る決定的 CLI。agent 実行を持たない |
| [0002](adr/0002-artifact-model.md) | 成果物モデル — コア 3 層固定 + ビュー可変 |
| [0003](adr/0003-id-reference-grammar.md) | ID・参照文法と strict Markdown プロファイル |
| [0004](adr/0004-living-docs-computed-delta.md) | living docs 正本・delta は計算物 |
| [0005](adr/0005-element-state-machine.md) | 要素状態機械 designed → requested → implemented |
| [0006](adr/0006-input-ladder.md) | 入力の階段 topic → design → plan → request |
| [0007](adr/0007-gates.md) | ゲート — design-not-later-than-merge の機械強制 |
| [0008](adr/0008-verb-cli.md) | CLI 動詞体系 — 完走 run を持たない |
| [0009](adr/0009-tech-stack.md) | 技術選定 — TypeScript + Bun、依存ゼロ |
| [0010](adr/0010-adoption-gradient.md) | 導入の段階性 — 最小プロファイルは静的構造のみ（0002 を修正） |
| [0012](adr/0012-consumer-agnostic-derive.md) | 導出の消費者非依存 — request テンプレートは設定で注入 |
| [0013](adr/0013-escalation-triage.md) | escalation の分流 — 正本テスト（外に触るなら設計に返る） |
| [0014](adr/0014-directory-ownership.md) | ディレクトリの所有権 — 正本にツール名を冠しない |
| [0015](adr/0015-actor-as-core-type.md) | アクターの一級化 — act 型をコアの domain 層に追加（C5 改訂） |
| [0016](adr/0016-versioning-and-release.md) | バージョニング — ツール semver と format-version の二軸分離 |
| [0017](adr/0017-granularity-by-citation-context.md) | 要素の粒度 — 型ごとの主たる引用文脈で決める |
| [0018](adr/0018-loop-write-semantics.md) | loop の書き込み意味論 — 書き手の最小化と計算される遷移（0006 を修正） |

未確定の論点は [docs/open-questions.md](docs/open-questions.md)。

## 仕様

- [形式仕様 v0](spec/format.md) — ID 文法・宣言/参照構文・型スキーマ・閉包規則 C1〜C11・state.json・rules export
- [交換面契約 v0](spec/integration.md) — `check --request` / `mark implemented` / `export rules` の CLI 契約
- [design/](design/) — aozu 自身の設計（本形式による自己記述）

## ステータス

実装中。動詞の実装状況:

- **実装済み**: `init` / `scaffold` / `check`（`--request` 含む）/ `status` / `export rules`（`--verify` 含む）
- **未実装**: `diff` / `trace` / prompt 4 種 / `plan` / `coverage` / `mark implemented`（loop 動詞。フルループ一周の検証はこれ待ち）

検証状況: 自己記述ドッグフード（design/ 26 要素）と業務 SaaS の書き起こし（74 要素）で check exit 0。既知の実装穴（未知 prefix の fail-open・C11 誤帰属）は修正済み（PR #7）。
