# Design: export operations

## Context

`export operations` は ADR-0025 D3 で決定した操作境界の中立形式排出コマンドである。spec/format.md §11 に出力スキーマが定義済み。

既存の `export permissions` が確立した定型がある:

- 生成ロジックを `src/export/permissions.ts` の純関数 `generatePermissions(graph): { json }` に分離
- CLI 層（`src/cli/commands/export.ts`）は入出力・exit code のみ担当
- `graph.targetLines` を `findOwningElement` で帰属判定し、owner prefix でフィルタ
- `graph.implementations` も同じ帰属判定パターンで利用可能

op 要素は domain 層の型（`LAYER_MAP` で `op: "domain"`）。`対象:` 行は `TargetLine`（`targetIds: string[]`）として graph に載っており、`実装:` 行は `ImplementationEntry`（`paths: string[]`）として `graph.implementations` に載っている。いずれも `findOwningElement` で所属 op 要素を特定できる。

## Goals / Non-Goals

**Goals**:

- `export operations` サブコマンドを追加し、spec §11 の operations JSON を排出する
- 既存 `export rules` / `export permissions` の挙動を一切変更しない
- 出力の決定性を保証する（id 昇順、target/implementation は宣言順）

**Non-Goals**:

- `--verify` の実装（ADR-0025 D3 で不採用）
- seq 等の相互作用情報の包含
- ent / inv 等他の per-type export
- op スキーマの拡張

## Decisions

### D1: generateOperations を src/export/operations.ts の純関数として分離

generatePermissions と同じ構造: `generateOperations(graph: Graph): { json: string }` を純関数として `src/export/operations.ts` に配置する。CLI 層は入出力と exit code のみを担う。

**Rationale**: 既存の permissions が確立した分離定型に従う。CLI 内での直接生成は既存パターンとの一貫性を損なう。

**Alternatives considered**: CLI 内で直接 JSON 構築 → 却下。permissions との一貫性を損なう。テストで CLI 全体を起動する必要が生じる。

### D2: domain 未有効は manifest.enabled.includes("domain") で判定し exit 1

op は domain 層の型（`LAYER_MAP` で `op: "domain"`）。domain が enabled でない design では操作が管理下にないことを示すために exit 1 を返す。これは permissions export の `enabled.includes("permission")` → exit 1 と同じ意味論。

domain 有効で op 0 件の場合は `"operations": []` を exit 0 で排出する（管理下にあるが操作が未定義、と区別）。

**Rationale**: 空リスト排出との区別。permissions export の「ビュー未有効 = exit 1」と同じ判断。

**Alternatives considered**: domain 未有効でも空リスト排出 → 却下。「管理下にない」と「管理下だが 0 件」の区別が消える。

### D3: target は ID 配列として排出

`対象:` 行は複数参照可（`TargetLine.targetIds: string[]`）。1 件でも配列で排出し、消費者のパースを単型に保つ。該当行が無ければキーごと省略。

**Rationale**: 単一文字列だと消費者が件数で分岐する必要がある。spec §11 も配列を規定。

**Alternatives considered**: 単一文字列 → 却下。`対象:` が複数参照可なので配列が自然。

### D4: implementation は paths を宣言順にフラット排出

`ImplementationEntry.paths[]` は 1 行の `実装:` 行から得られるカンマ分割パス配列。1 つの op に複数の `実装:` 行がある場合はファイル内の出現順（line 昇順）で結合し、各行内のパス順は宣言順を保持する。該当行が無ければキーごと省略。

**Rationale**: spec §11 が宣言順を規定。

**Alternatives considered**: パス昇順ソート → 却下。spec が宣言順を規定しているため。

### D5: domain 有効チェックは CLI 層で行い、generateOperations は Graph のみ受け取る

generatePermissions が Graph のみ受け取る純関数であるのと同様、domain 有効チェックは CLI 層（export.ts）で行う。generateOperations は常に operations 配列を生成して返す。

**Rationale**: 生成関数を manifest に依存させない。テストで manifest 構築が不要になる。

**Alternatives considered**: generateOperations に manifest を渡して内部で判定 → 却下。permissions と同じ分離を崩す理由がない。

## Risks / Trade-offs

[Risk] `findOwningElement` の O(n) 走査が op・target・implementation の増加で遅くなる → permissions でも同じ走査を行っており、実用上の設計文書サイズでは問題にならない。ボトルネックが計測された場合にインデックス化を検討する

[Risk] CLI の subcommand 分岐が 3 つに増えることで export.ts が肥大化する → 各 subcommand の定型は 20 行程度で、現状の可読性で十分。4 つ目以降が追加される時点でディスパッチテーブル化を検討する

## Open Questions

なし。設計判断は ADR-0025 で確定済み、実装パターンは既存 permissions export が確立済み。
