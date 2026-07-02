# aozu

**aozu（青図 = blueprint）** — 設計レイヤ CLI。プロダクトリポジトリ内の設計文書を正本として管理し、閉包検証・差分計算・request 導出支援を行う**決定的ツール**。agent 実行を内蔵せず、文脈注入済みの指示（instruction）を出力するまでを担う。消費するのはセッション側の agent。

## 位置づけ

実装パイプライン（request → merged PR を無人完走するツール。例: spec-runner）の上流に、構造レベルの設計工程を形式として与える。設計判断には機械的な合否が存在しないため、実装と同じ完走型パイプラインにはせず、人の判断を決定的処理（検証・差分・導出）で挟む動詞型 CLI とする。

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
  → plan（人が request への束ね方を決める）→ coverage（機械検証）
  → request 生成 → 実装パイプラインへ
  → 取り込み完了 hook で要素が implemented に遷移
  → status のフロンティアが空なら一周閉じる
```

## 決定記録

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

未確定の論点は [docs/open-questions.md](docs/open-questions.md)。

## 仕様

- [形式仕様 v0](spec/format.md) — ID 文法・宣言/参照構文・型スキーマ・閉包規則 C1〜C11・state.json・rules export
- [交換面契約 v0](spec/integration.md) — `check --request` / `mark implemented` / `export rules` の CLI 契約
- [design/](design/) — aozu 自身の設計（本形式による自己記述）

## ステータス

設計段階。コードはまだない。形式仕様 v0 は自己記述ドッグフードで検証済み。次は業務システムでの粒度検証と、実装着手の判断。
