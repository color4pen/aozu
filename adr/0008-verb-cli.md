# ADR-0008: CLI 動詞体系 — 完走 run を持たない

- Status: accepted
- Date: 2026-07-02

## Context

実装パイプラインの「完走型 run」が成立するのは、各ステップの入力がファイルで完結し、出力に機械的合否があり、無人リトライできるからである。設計判断は合否 = 人であり、この条件を満たさない（ADR-0001）。

## Decision

人の判断 1 回ごとに発火する**動詞型 CLI** とし、完走型の `run` を持たない。

| 群 | 動詞 | 内容 |
|---|---|---|
| 基盤 | `init` | 規約・manifest・テンプレート・CI スニペット生成 |
| | `scaffold <type> <id>` | 型テンプレートから新規アーティファクト生成 |
| 検証・観測 | `check` | 参照グラフ構築と閉包検証（ID 一意性・参照解決・リンク義務・manifest 整合） |
| | `status` | open topic / designed 要素 / requested 要素のフロンティア表示 |
| | `diff <ref>..<ref>` | 要素単位の差分（追加・削除・改名・参照替え）を層別表示 |
| | `trace <id>` | 要素 ↔ topic / ADR / request / PR の対応表示 |
| プロンプト | `prompt session --topic <id>` | topic + 関連文書 + 形式規則を注入した設計セッション開始プロンプト |
| | `prompt propagate --adr <id>` | 決定の全層整合反映プロンプト（適用後は check が合否） |
| | `prompt review` | 矛盾の findings 列挙プロンプト（verdict は人） |
| | `prompt derive --group <id>` | plan のグループ単位の request 草稿生成プロンプト |
| 導出 | `plan` | designed 要素を plan 表に出力（依存辺・接地・重複を注釈） |
| | `coverage` | plan の被覆・実在・矛盾の機械検証。合格要素を requested へ |
| 交換面 | `check --request <path>` | request の設計要素引用の検証（実装パイプラインが呼ぶ入口ゲート） |
| | `export rules` | 許可依存の中立 ruleset 出力（`--verify` で同期検証） |
| | `mark implemented --request <slug>` | 取り込み完了 hook。対象要素を implemented へ |

プロンプト動詞は文脈注入済みテキストを stdout に出すまでを責務とし、実行しない（実行様式は ADR-0001）。

## Consequences

- attended / semi-attended / 無人ドラフトのどの実行様式でも同じ動詞が土台になる
- 小さい変更は check を回しながらの編集数分で一周し、大きい変更は plan で複数 request に割れる。粒度が変わっても動詞の並びは同じ
