# モジュール構成

## CLI {#mod-cli}
責務: コマンド解釈・引数検証・診断の出力整形。検証・導出のロジックを持たない composition root。

## パーサ {#mod-parse}
責務: strict プロファイルの行指向パース。文書から要素宣言・参照・構造化リストを抽出する。

## 参照グラフ {#mod-graph}
責務: 抽出結果から要素表と参照辺を構築し、ID 解決を提供する。

## 閉包検証 {#mod-check}
責務: 閉包規則を参照グラフと manifest に対して評価し、診断を返す。

## 差分 {#mod-diff}
責務: git ref 間の要素差分（追加・削除・改名・参照替え）の算出。

## 状態 {#mod-state}
責務: state.json の読み書きと状態遷移（designed / requested / implemented）の適用。

## 導出 {#mod-plan}
責務: plan の生成・coverage 検証・グループへの request 記録。

## 指示 {#mod-prompt}
責務: 参照グラフ近傍のスコープ選択と、テンプレートへの文脈注入による指示の組み立て。

## エクスポート {#mod-export}
責務: 許可依存の中立 ruleset 出力と同期検証。

## git 読み取り {#mod-gitread}
責務: git の読み取り呼び出し（show / rev-parse）の唯一の seam。書き込みを持たない。
