---
id: seq-closure-check
---
# 閉包検証の流れ

## 登場要素
- [[mod-cli]]
- [[mod-parse]]
- [[mod-graph]]
- [[mod-check]]

## 流れ
1. [[mod-cli]] が design/ 配下の文書を列挙し、[[mod-parse]] に渡す
2. [[mod-parse]] が要素宣言・参照・構造化リストを抽出する
3. [[mod-graph]] が要素表と参照辺を構築する
4. [[mod-check]] が manifest の有効集合に対して規則を評価する
5. [[mod-cli]] が診断を整形し、exit code で合否を返す
