# 交換面契約 v0（draft)

- Status: draft
- 対象: 実装パイプライン・CI・workflow ツールが aozu を呼ぶ際の CLI 契約

aozu と他ツールの結合はリポジトリ内ファイルと本契約のみ（ADR-0001）。呼び出し側は aozu の内部を知らず、aozu は呼び出し側を知らない。

## 1. `check --request <path>` — 入口ゲート

request 文書中の設計要素引用を検証する。

- **抽出**: 文書中のすべての `[[id]]`（形式仕様 §6 のコード除外規則を適用）
- **依存行**: 行頭 `依存: [[id]](, [[id]])*` の行上の引用は**依存引用**——「この request が変更しない依存要素」の宣言である（ADR-0024）。依存行は 1 文書に複数書いてよく、位置を問わない。依存引用は実在解決のみを検証し、要素の状態を問わない（implemented 要素の依存引用は正当）。被覆にも数えない（coverage も同じ規則で除外する）
- **検証**: (a) すべての引用（依存引用を含む）が実在要素に解決される、(b) **被覆引用**（依存行の外の引用）の状態が designed または requested である。implemented 要素の被覆引用は**要素単位で不合格**とする（設計 delta を経ずに実装済み要素へ触る疑い）。request の被覆引用は被覆の宣言であり（coverage と同一意味論、ADR-0012）、変更しない要素の参照は依存行で宣言する。状態の判定は state.json と縮退規則（形式仕様 §9 — 本文乖離した implemented 要素は designed 扱い）に従う。**(b) は loop 有効時のみ検出力を持つ**——state.json が無いプロファイルでは全要素が designed とみなされ常に通過する（段階縮退の帰結として仕様どおり）
- `--require-citation`: **被覆引用**が 0 件なら不合格にする（依存引用は数えない）。構造変更を含む request 型にこのフラグを付けるかは**呼び出し側の判断**（aozu は request の型体系を知らない）
- **出力**: 1 行 1 診断のテキスト。`<LEVEL> <CODE> <id> <message>`
- **exit code**: 0 = 合格 / 1 = 不合格 / 2 = 入力不正（ファイル不存在・design/ 不在）

## 2. `mark implemented --request <slug>` — 出口の状態遷移

取り込み完了 hook から呼ばれ、要素状態を implemented へ遷移する。

- state.json 中で `request` が `<slug>` に一致する要素のうち requested のものをすべて implemented に遷移し、`--pr <番号>` があれば記録する
- **冪等**: 既に implemented の要素は no-op。再実行しても結果が変わらない
- 「該当 0 件」の判定は **`request` の slug 一致で行い、要素の状態を問わない**: slug 一致が 1 件も無ければ未知の slug として exit 1、一致があり全件 implemented 済みなら no-op で exit 0（冪等の帰結）。部分適用状態を作らない（全遷移 or 全不変）
- **loop 層が無効な design でも exit 1**（状態機械が立っておらず遷移対象が存在しない）。呼び出し側は未知の slug と同様に「この request は aozu の状態管理下にない」として扱えばよい
- **exit code**: 0 = 遷移完了（no-op 含む）/ 1 = 未知の slug または loop 層無効 / 2 = 入力不正

## 3. `export rules [--verify]` — 出口ゲートの供給

- 形式仕様 §11 の ruleset JSON を stdout（または `--out <path>`）に出力する
- すべての mod に `実装:` 行があることを要求する（欠落は exit 1）
- `--verify`: コミット済み ruleset と設計文書から再生成した ruleset を比較し、一致で 0、乖離で 1。CI がこれを回すことで「設計文書だけ直して ruleset を置き忘れる」を封じる
- ruleset の消費側（architecture test）の実装は本契約の範囲外。契約は JSON スキーマのみ
- ruleset の「依存」は静的 import 関係のすべてを指し、**型のみの import も含む**（型結合も設計上の知識依存であるため）。消費側はこの意味論で検査することを推奨する。またどのモジュールの `実装:` パスにも属さない実装ファイルは違反として扱う（fail-closed）

## 4. derive の消費者前提

request テンプレートと草稿出力先は設定で注入され、aozu は消費者（実装パイプライン）を知らない（ADR-0012）。注入点は **manifest frontmatter の `request-template` と `request-output-dir`** であり、`prompt derive` 実行時にこれらの値を参照する（形式仕様 §3 参照）。消費者側の唯一の前提は、**request 文書が本文中の `[[id]]` 引用を受け入れること**。この前提が成り立たない消費者では coverage と §1 の入口ゲートが機能しない。依存を宣言する場合の前提も同様に最小である: request 文書が行頭 `依存:` の行を受け入れること（ADR-0024。行は位置不問で、テンプレート構造への要求は無い。依存行を使わない request は従来どおりすべて有効）。

## 5. 共通規約

- 診断はすべて stderr、成果物（ruleset 等）は stdout
- 破壊的変更は `format-version` の増分と同時にのみ行う
- 呼び出し側の推奨結線（非規範）: request 検証 step で §1、取り込み完了 hook で §2、CI で `check` + §3 `--verify`、設計に返る finding の排出は §6

## 6. topic 排出 — パイプライン起点の設計入力

実装工程で出た設計レベルの摩擦（レビューの構造指摘・スコープ外 finding 等）を、パイプラインが topic として設計正本に機械排出する（ADR-0006 の「パイプライン起点」系統・ADR-0013 の正本テストの機械化）。

- **対象**: 解決が change folder の外——設計正本（design/）——への変更を要する finding（ADR-0013 の正本テスト）。判定は呼び出し側の責務であり、機械分類でも escalation 時の人の裁定でもよい。**過剰排出は許容される**: topic の下流は attended であり、不要な topic は人が閉じられる（ADR-0006）。逆の取りこぼしは設計債務を不可視にするため、迷ったら排出に倒す。パイプラインツール自身の改善 finding は対象外（当該ツールのバックログへ）
- **書式**: 形式仕様 §8 の top スキーマに準拠する。`design/topics/<slug>.md`、frontmatter は `id: top-<slug>` と `source:`（job・step・PR 等への逆リンク）。本文は症状・動機で、finding の内容と暫定裁定を書いてよい——ただし**提案であって決定ではない**（決定の正本は ADR。topic は ADR の `topics:` 引用によって addressed になる）
- **冪等**: slug は finding の同一性（job・step・finding 識別子）から決定的に導出し、既存ファイルは上書きしない。ID の一意性は次回 check の C1 が fail-closed で検証する
- **タイミング**: 遅くとも取り込み（archive / merge）まで。正本の更新自体が併走で着地した場合（ADR-0013 の暫定裁定 + 正本更新の併走）もトレースのため排出してよい
- **縮退**: designLayer 無効または `design/` 不在の環境では排出しない（no-op）。`design/topics/` が無ければ作成してよい（git は空ディレクトリを追跡しないため、topics/ の不在は設計層の不在を意味しない）
- **aozu の関与**: なし。本節はファイル契約のみで、aozu CLI の呼び出しを要さない（ADR-0001 — 結合はリポジトリ内ファイルと本契約のみ）

## 7. `export permissions [--out <path>]` — 権限突合の供給

- 形式仕様 §11 の permissions JSON を stdout（または `--out <path>`）に出力する
- 消費者は権限突合テスト: 設計の操作 × アクター表とコード側の権限定義（マトリクス・可否判定）の等値を CI で検査する。表面別の消費（UI ガード・API ハンドラ・MCP ツールのロールゲート）も同一 JSON に対して突合する
- 出力順は決定的（id 昇順・operation 辞書順・act ID 昇順）であり、消費側は順序に依存してよい
- コミット済み成果物と `--verify` は持たない（ADR-0023 D4 — 比較対象はコードの権限定義そのもの）
- **exit code**: 0 = 出力成功 / 1 = permission ビューが enabled でない（この design は権限を aozu の管理下に置いていない）/ 2 = 入力不正（design/ 不在等）
