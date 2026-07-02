# 交換面契約 v0（draft)

- Status: draft
- 対象: 実装パイプライン・CI・workflow ツールが sd を呼ぶ際の CLI 契約

sd と他ツールの結合はリポジトリ内ファイルと本契約のみ（ADR-0001）。呼び出し側は sd の内部を知らず、sd は呼び出し側を知らない。

## 1. `check --request <path>` — 入口ゲート

request 文書中の設計要素引用を検証する。

- **抽出**: 文書中のすべての `[[id]]`（形式仕様 §6 のコード除外規則を適用）
- **検証**: (a) すべての引用が実在要素に解決される、(b) 引用要素の状態が designed または requested である（implemented のみを引用する request は設計 delta を経ていない疑い）
- `--require-citation`: 引用が 0 件なら不合格にする。構造変更を含む request 型にこのフラグを付けるかは**呼び出し側の判断**（sd は request の型体系を知らない）
- **出力**: 1 行 1 診断のテキスト。`<LEVEL> <CODE> <id> <message>`
- **exit code**: 0 = 合格 / 1 = 不合格 / 2 = 入力不正（ファイル不存在・design/ 不在）

## 2. `mark implemented --request <slug>` — 出口の状態遷移

取り込み完了 hook から呼ばれ、要素状態を implemented へ遷移する。

- state.json 中で `request` が `<slug>` に一致する requested 要素をすべて implemented に遷移し、`--pr <番号>` があれば記録する
- **冪等**: 既に implemented の要素は no-op。再実行しても結果が変わらない
- 該当要素が 0 件（未知の slug）は exit 1 と診断。部分適用状態を作らない（全遷移 or 全不変）
- **exit code**: 0 = 遷移完了（no-op 含む）/ 1 = 未知の slug / 2 = 入力不正

## 3. `export rules [--verify]` — 出口ゲートの供給

- 形式仕様 §11 の ruleset JSON を stdout（または `--out <path>`）に出力する
- すべての mod に `実装:` 行があることを要求する（欠落は exit 1）
- `--verify`: コミット済み ruleset と設計文書から再生成した ruleset を比較し、一致で 0、乖離で 1。CI がこれを回すことで「設計文書だけ直して ruleset を置き忘れる」を封じる
- ruleset の消費側（architecture test）の実装は本契約の範囲外。契約は JSON スキーマのみ

## 4. 共通規約

- 診断はすべて stderr、成果物（ruleset 等）は stdout
- 破壊的変更は `format-version` の増分と同時にのみ行う
- 呼び出し側の推奨結線（非規範）: request 検証 step で §1、取り込み完了 hook で §2、CI で `check` + §3 `--verify`
