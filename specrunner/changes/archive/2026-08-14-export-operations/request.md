# export operations の実装 — 操作境界の実行時交換面（ADR-0025）

## Meta

- **type**: new-feature
- **slug**: export-operations
- **base-branch**: main
- **adr**: false

<!-- 設計判断は ADR-0025（adr/0025-operation-element.md、merge 済み）で決定済み。本 request は確定仕様の実装であり新規 ADR は不要 -->

## 背景

ADR-0025 D3 は操作境界の中立形式を排出する `export operations` を決定し、spec/format.md §11 operations export は merge 済み。消費者は操作境界から実装骨格（interface・認可結線・テストハーネス等）を静的生成する後段ツールであり、export を実行時に直接呼ぶ（コミット済み成果物と `--verify` を持たない — ADR-0023 D4 と同じ判断）。本 request は op 型の実装（request: op-element）の上にこの export を実装する。

依存: [[mod-export]], [[mod-cli]], [[mod-graph]], [[mod-parse]]

## 現状コードの前提

- 本 request の base は request: op-element の merge 後の main（cb56a92 以降）。op 要素（ID・表示名・`対象:` 複数参照・`実装:` 行）はパース済みで graph に乗っている
- `対象:` 行は統合認識（src/parse/types.ts の `TargetLine`（:77）— `targetIds: string[]` + file/line）。所属要素は `findOwningElement` で判定する。op 要素の `対象:` 行は複数参照可（perm の単一制約は C6 (g) が別途検査済み）。消費例は src/export/permissions.ts:69（`graph.targetLines` を owner prefix === "perm" でフィルタ）— **operations 生成は同じ定型で owner prefix === "op" でフィルタする**
- `実装:` 行は `ImplementationEntry`（paths[] / file / line）として graph.implementations に載っており、同じく所属要素で帰属判定する
- export のサブコマンド分岐と usage は src/cli/commands/export.ts（rules / permissions の 2 subcommand）。permissions の生成は src/export/permissions.ts の `generatePermissions` に分離されており、CLI 層は入出力と exit code のみを担う定型がある
- permissions export の exit code 規約: 0 = success / 1 = ビュー未有効 / 2 = input error。出力は stdout 既定・`--out` でファイル
- 出力の決定性の既存規約: permissions は id 昇順・キー辞書順・act 配列 ID 昇順（spec §11）

## 要件

1. **`export operations` subcommand の追加**(mod-cli / mod-export): 生成は `src/export/operations.ts` の純関数に分離し、CLI 層は既存 permissions と同じ定型（stdout 既定・`--out`・usage 追記）とする
2. **出力形式**（spec §11 operations export）:
   - `format-version` と `operations` 配列。各要素は `id` / `name`（表示名 = 見出し）/ `target`（`対象:` 行の参照 ID 配列）/ `implementation`（`実装:` 行のパス配列）
   - `target` / `implementation` は該当行が無ければ**キーごと省略**
   - 決定的順序: `operations` は id 昇順、`target` / `implementation` は宣言順
3. **exit code**: domain が enabled でない design に対しては exit 1（op は domain 層の型 — この design は操作を aozu の管理下に置いていない、の宣言）。domain 有効で op が 0 件なら `operations: []` を exit 0 で排出する。input error は exit 2
4. **含めないもの**: `--verify` は実装しない（ADR-0025 D3）。seq 等の相互作用情報・perm の権限情報は含めない（権限は export permissions の領分）
5. **既存挙動の後方互換**: export rules / permissions の挙動・診断・exit code は不変。既存テスト無変更で green

## スコープ外

- `--verify` およびコミット済み operations.json の規約（ADR-0025 D3 で不採用）
- ent / inv 等の per-type export の追補（ADR-0025 Consequences — 消費者が要求した型から需要駆動で追補。本 request は operations のみ）
- 消費者（骨格生成器）側の実装
- op スキーマの拡張

## 受け入れ基準

- [ ] `対象:`・`実装:` つき op 要素を持つ design で `export operations` が spec §11 の形の JSON を stdout に排出する（テスト）
- [ ] `対象:` / `実装:` の無い op で該当キーが省略される（テスト）
- [ ] 複数 op が id 昇順で並ぶ（テスト）
- [ ] 同一入力で出力がバイト単位に一致する（決定性。テスト）
- [ ] domain 未有効の design で exit 1（テスト）
- [ ] domain 有効・op 0 件で `"operations": []` / exit 0（テスト）
- [ ] `--out` でファイルへ書ける（テスト）
- [ ] export rules / permissions の既存テストが無変更で green
- [ ] `bunx tsc --noEmit` && `bun test` が green

## architect 評価済みの設計判断

- **採用: 生成を src/export/operations.ts の純関数に分離** / 却下: CLI 内での直接生成 — rules / permissions の既存分離定型に従う
- **採用: domain 未有効は exit 1** / 却下: 空リスト排出 — permissions export の「ビュー未有効 = exit 1」と同じ意味論（管理下に無いことを空と区別する）。op 0 件の空リストとは区別する
- **採用: target は ID 配列** / 却下: 単一文字列 — `対象:` は複数参照可（spec §8）。1 件でも配列で排出し、消費者のパースを単型に保つ
