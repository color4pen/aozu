# Spec: export operations

## Requirements

### Requirement: export operations SHALL produce spec §11 operations JSON

`export operations` は Graph 内の op 要素を収集し、spec/format.md §11 で定義された operations JSON を排出する。出力は `format-version` (数値 0) と `operations` 配列を含む。各要素は `id`（要素 ID）と `name`（表示名 = 見出し）を必須フィールドとして持つ。

#### Scenario: op with target and implementation

**Given** design に op 要素 `op-confirm-order`（表示名「受注を確定する」）が存在し、`対象: [[ent-order]]` と `実装: src/application/confirm-order.ts` が宣言されている
**When** `export operations` を実行する
**Then** stdout に JSON が排出され、`operations[0].id` が `"op-confirm-order"`、`operations[0].name` が `"受注を確定する"`、`operations[0].target` が `["ent-order"]`、`operations[0].implementation` が `["src/application/confirm-order.ts"]` である

#### Scenario: op without target or implementation

**Given** design に op 要素 `op-placeholder`（表示名「仮操作」）が存在し、`対象:` 行も `実装:` 行も無い
**When** `export operations` を実行する
**Then** 出力の該当要素に `target` キーと `implementation` キーが存在しない（`id` と `name` のみ）

### Requirement: target and implementation keys SHALL be omitted when absent

op 要素に `対象:` 行が無い場合は `target` キーを、`実装:` 行が無い場合は `implementation` キーを、出力から省略しなければならない（null や空配列ではなくキーごと省略）。

#### Scenario: target present but implementation absent

**Given** op 要素に `対象: [[ent-order]]` があるが `実装:` 行が無い
**When** `export operations` を実行する
**Then** 該当要素に `target` はあるが `implementation` キーは存在しない

#### Scenario: implementation present but target absent

**Given** op 要素に `実装: src/app/foo.ts` があるが `対象:` 行が無い
**When** `export operations` を実行する
**Then** 該当要素に `implementation` はあるが `target` キーは存在しない

### Requirement: operations SHALL be sorted by id ascending

出力の `operations` 配列は要素の `id` の昇順（辞書順）で並ばなければならない。同一入力に対してバイト単位で同一の出力を保証する（決定性）。

#### Scenario: multiple ops in non-alphabetical declaration order

**Given** design に `op-zzz`、`op-aaa`、`op-mmm` の 3 つの op 要素が宣言順に存在する
**When** `export operations` を実行する
**Then** `operations` 配列の id 順は `["op-aaa", "op-mmm", "op-zzz"]` である

#### Scenario: deterministic output on repeated runs

**Given** 同一の design 入力
**When** `export operations` を 2 回実行する
**Then** 両方の出力がバイト単位で一致する

### Requirement: target array SHALL preserve declaration order

`対象:` 行の参照 ID 配列（`target`）は宣言順を保持しなければならない。ソートしない。

#### Scenario: multiple targets in declaration order

**Given** op 要素に `対象: [[ent-order]], [[ent-customer]]` が宣言されている
**When** `export operations` を実行する
**Then** `target` は `["ent-order", "ent-customer"]` である（宣言順）

### Requirement: implementation array SHALL preserve declaration order

`実装:` 行のパス配列（`implementation`）は宣言順を保持しなければならない。複数の `実装:` 行がある場合は行の出現順で結合し、各行内のパス順も宣言順を保持する。

#### Scenario: multiple implementation lines

**Given** op 要素に `実装: src/a.ts` (line 5) と `実装: src/b.ts` (line 8) が存在する
**When** `export operations` を実行する
**Then** `implementation` は `["src/a.ts", "src/b.ts"]` である（出現順）

### Requirement: domain not enabled SHALL cause exit 1

manifest で domain レイヤーが有効でない design に対して `export operations` を実行した場合、exit code 1 を返さなければならない。stderr にエラーメッセージを出力する。

#### Scenario: domain not in enabled list

**Given** manifest の enabled リストに "domain" が含まれない
**When** `export operations` を実行する
**Then** exit code は 1 であり、stdout に JSON は排出されない

### Requirement: domain enabled with zero ops SHALL produce empty list with exit 0

manifest で domain が有効だが op 要素が 0 件の場合、`"operations": []` を含む JSON を exit 0 で排出しなければならない。

#### Scenario: domain enabled but no op elements

**Given** manifest の enabled に "domain" が含まれ、design に op 要素が存在しない
**When** `export operations` を実行する
**Then** 出力 JSON の `operations` は空配列 `[]` であり、exit code は 0 である

### Requirement: --out option SHALL write to file

`--out <path>` オプションが指定された場合、stdout ではなく指定ファイルに JSON を書き出さなければならない。exit code は stdout 出力時と同じ規約に従う。

#### Scenario: --out writes to file

**Given** domain が有効な design
**When** `export operations --out /tmp/ops.json` を実行する
**Then** `/tmp/ops.json` に JSON が書き出され、stdout には何も出力されず、exit code は 0 である

#### Scenario: --out without path argument

**Given** 任意の design
**When** `export operations --out` を引数無しで実行する
**Then** exit code は 2 であり、stderr にエラーメッセージが出力される

### Requirement: existing export subcommands SHALL remain unchanged

`export rules` および `export permissions` の挙動・診断・exit code は本変更によって変更されてはならない。

#### Scenario: export rules unchanged

**Given** 本変更適用後のコード
**When** `export rules` の既存テストを実行する
**Then** 全テストが変更なしで green である

#### Scenario: export permissions unchanged

**Given** 本変更適用後のコード
**When** `export permissions` の既存テストを実行する
**Then** 全テストが変更なしで green である
