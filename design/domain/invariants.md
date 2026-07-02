# 不変条件

## 合否は決定的検証のみが出す {#inv-deterministic-verdict}
agent の出力テキストを解釈して合否を導出しない。合否は [[ent-element]] と [[ent-reference]] に対する規則評価のみが出す。

## ID は不変 {#inv-immutable-id}
改名は表示名の変更である。ID の変更は削除 + 新規と同義であり、差分・トレースはこの前提に立つ。

## 状態はツールのみが書く {#inv-tool-writes-state}
[[ent-state-entry]] を人が編集しない。遷移は coverage / mark / 設計 delta の merge 経由でのみ起きる。

## 許可依存は fail-closed {#inv-fail-closed-deps}
列挙されない依存はすべて禁止。検出できない依存を許可と解釈しない。

## 参照は一文法 {#inv-single-reference-grammar}
要素間関係の表現は `[[id]]` のみ。第二の参照構文を導入しない。
