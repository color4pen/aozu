---
id: seq-rules-export
---
# ruleset 出力の流れ

## 登場要素
- [[mod-cli]]
- [[mod-parse]]
- [[mod-graph]]
- [[mod-export]]

## 流れ
1. [[mod-cli]] が static 層の文書を [[mod-parse]] 経由で読み込む
2. [[mod-graph]] がモジュール表と許可依存の辺を構築する
3. [[mod-export]] が中立 ruleset（JSON）を生成する。verify 指定時はコミット済み出力と比較し、乖離を診断として返す
