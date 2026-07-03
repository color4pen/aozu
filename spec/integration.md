# 交換面契約 v0（draft)

- Status: draft
- 対象: 実装パイプライン・CI・workflow ツールが aozu を呼ぶ際の CLI 契約

aozu と他ツールの結合はリポジトリ内ファイルと本契約のみ（ADR-0001）。呼び出し側は aozu の内部を知らず、aozu は呼び出し側を知らない。

## 1. `check --request <path>` — 入口ゲート

request 文書中の設計要素引用を検証する。

- **抽出**: 文書中のすべての `[[id]]`（形式仕様 §6 のコード除外規則を適用）
- **検証**: (a) すべての引用が実在要素に解決される、(b) 引用要素の状態が designed または requested である。implemented 要素の引用は**要素単位で不合格**とする（設計 delta を経ずに実装済み要素へ触る疑い）。request の引用は被覆の宣言であり（coverage と同一意味論、ADR-0012）、変更しない要素を文脈として引用する用途には使わない。**(b) は loop 有効時のみ検出力を持つ**——state.json が無いプロファイルでは全要素が designed とみなされ常に通過する（段階縮退の帰結として仕様どおり）
- `--require-citation`: 引用が 0 件なら不合格にする。構造変更を含む request 型にこのフラグを付けるかは**呼び出し側の判断**（aozu は request の型体系を知らない）
- **出力**: 1 行 1 診断のテキスト。`<LEVEL> <CODE> <id> <message>`
- **exit code**: 0 = 合格 / 1 = 不合格 / 2 = 入力不正（ファイル不存在・design/ 不在）

## 2. `mark implemented --request <slug>` — 出口の状態遷移

取り込み完了 hook から呼ばれ、要素状態を implemented へ遷移する。

- state.json 中で `request` が `<slug>` に一致する要素のうち requested のものをすべて implemented に遷移し、`--pr <番号>` があれば記録する
- **冪等**: 既に implemented の要素は no-op。再実行しても結果が変わらない
- 「該当 0 件」の判定は **`request` の slug 一致で行い、要素の状態を問わない**: slug 一致が 1 件も無ければ未知の slug として exit 1、一致があり全件 implemented 済みなら no-op で exit 0（冪等の帰結）。部分適用状態を作らない（全遷移 or 全不変）
- **exit code**: 0 = 遷移完了（no-op 含む）/ 1 = 未知の slug / 2 = 入力不正

## 3. `export rules [--verify]` — 出口ゲートの供給

- 形式仕様 §11 の ruleset JSON を stdout（または `--out <path>`）に出力する
- すべての mod に `実装:` 行があることを要求する（欠落は exit 1）
- `--verify`: コミット済み ruleset と設計文書から再生成した ruleset を比較し、一致で 0、乖離で 1。CI がこれを回すことで「設計文書だけ直して ruleset を置き忘れる」を封じる
- ruleset の消費側（architecture test）の実装は本契約の範囲外。契約は JSON スキーマのみ
- ruleset の「依存」は静的 import 関係のすべてを指し、**型のみの import も含む**（型結合も設計上の知識依存であるため）。消費側はこの意味論で検査することを推奨する。またどのモジュールの `実装:` パスにも属さない実装ファイルは違反として扱う（fail-closed）

## 4. derive の消費者前提

request テンプレートと草稿出力先は設定で注入され、aozu は消費者（実装パイプライン）を知らない（ADR-0012）。注入点は **manifest frontmatter の `request-template` と `request-output-dir`** であり、`prompt derive` 実行時にこれらの値を参照する（形式仕様 §3 参照）。消費者側の唯一の前提は、**request 文書が本文中の `[[id]]` 引用を受け入れること**。この前提が成り立たない消費者では coverage と §1 の入口ゲートが機能しない。

## 5. 共通規約

- 診断はすべて stderr、成果物（ruleset 等）は stdout
- 破壊的変更は `format-version` の増分と同時にのみ行う
- 呼び出し側の推奨結線（非規範）: request 検証 step で §1、取り込み完了 hook で §2、CI で `check` + §3 `--verify`
