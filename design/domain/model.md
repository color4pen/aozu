# ドメインモデル

## 要素 {#ent-element}
設計の最小単位。ID（不変）・型・表示名・本文を持つ。[[ent-artifact]] に宣言され、[[ent-reference]] の端点になる。状態は [[ent-state-entry]] が無ければ designed とみなす。

## 参照 {#ent-reference}
要素の本文から他要素 ID への辺。[[ent-element]] 間の関係の唯一の表現。

## アーティファクト {#ent-artifact}
要素を宣言する文書ファイル。型を持ち、型がリンク義務と宣言構文を定める。

## マニフェスト {#ent-manifest}
有効な型の集合の宣言。[[term-closure]] の評価範囲を決める。

## 状態エントリ {#ent-state-entry}
要素 ID ごとの実装状態の記録。designed → requested → implemented と遷移し、再設計で designed に戻る。
