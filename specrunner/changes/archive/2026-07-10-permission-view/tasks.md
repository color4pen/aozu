# Tasks: permission-view

## T-01: LAYER_PREREQUISITES の permission を domain に修正する

- [x] `src/check/manifest.ts` の `LAYER_PREREQUISITES` で `permission: ["static"]` を `permission: ["domain"]` に変更する（:101）
- [x] コメント `// View type prerequisites (from spec §4 type table)` はそのまま維持

**Acceptance Criteria**:
- `LAYER_PREREQUISITES["permission"]` が `["domain"]` を返す
- `checkC7({ formatVersion: "0", enabled: ["static", "permission"] })` が C7 error（"permission" requires "domain"）を返す
- `checkC7({ formatVersion: "0", enabled: ["static", "domain", "permission"] })` が空配列を返す
- 既存テスト `src/check/rules/c07-manifest-prerequisites.test.ts` が変更なしで green
- `tsc --noEmit` が成功する

## T-02: SUPPORTED_VIEW_TYPES 定数を manifest.ts に追加する

- [x] `src/check/manifest.ts` の型表群セクション（`VIEW_TYPE_NAMES` 定義の近傍）に `SUPPORTED_VIEW_TYPES: Set<string>` を追加する。初期値は `new Set(["permission"])`
- [x] JSDoc コメントを記載: サポート済みビュー型の集合。C6 がサポート/未サポートを判別するために使用する。将来のビュー型はここに追加する
- [x] export する

**Acceptance Criteria**:
- `SUPPORTED_VIEW_TYPES.has("permission")` が `true`
- `SUPPORTED_VIEW_TYPES.has("screen")` が `false`
- `tsc --noEmit` が成功する

## T-03: getEnabledPrefixes をサポート済みビュー型に対応させる

- [x] `src/check/manifest.ts` の `getEnabledPrefixes` を修正: manifest.enabled に含まれるビュー型名のうち、`SUPPORTED_VIEW_TYPES` に属するものの prefix を enabledPrefixes に追加する。`VIEW_ENABLED_NAME_TO_PREFIX` で名前 -> prefix を変換する
- [x] 関数の JSDoc コメントを更新: 「View type prefixes are NOT included」の記述を「Supported view type prefixes are included when enabled」に変更する

**Acceptance Criteria**:
- `getEnabledPrefixes({ formatVersion: "0", enabled: ["static", "domain", "permission"] })` の結果に `"perm"` が含まれる
- `getEnabledPrefixes({ formatVersion: "0", enabled: ["static", "domain"] })` の結果に `"perm"` が含まれない
- `getEnabledPrefixes({ formatVersion: "0", enabled: ["static", "screen"] })` の結果に `"scr"` が含まれない（未サポート型）
- 既存テスト `src/check/manifest.test.ts` が変更なしで green
- `tsc --noEmit` が成功する

## T-04: perm の構造行パースを structured-lines.ts に追加する

- [x] `src/parse/types.ts` に型定義を追加:
  - `PermOperation`: `{ operation: string; actorIds: string[]; file: string; line: number }`
  - `PermTarget`: `{ targetId: string; file: string; line: number }`
- [x] `ParseResult` に `permOperations: PermOperation[]` と `permTargets: PermTarget[]` を追加する
- [x] `src/parse/structured-lines.ts` に以下を追加:
  - 操作行の正規表現: `- <operation>: [[act-id]](, [[act-id]])*` を認識する。operation は `[^\s:]+` トークン。`[[id]]` をカンマ区切りで複数認識する
  - 対象: 行の正規表現: `^対象: \[\[([a-z0-9-]+)\]\]$` を認識する
  - `StructuredLineResult` に `permOperations` と `permTargets` を追加する
- [x] `src/parse/structured-lines.ts` のファイル冒頭コメントの認識リストに操作行・対象: 行を追加する
- [x] `src/parse/parser.ts` の `parseFiles` で、structured の `permOperations` と `permTargets` を result に集約する

**Acceptance Criteria**:
- `extractStructuredLines("- create: [[act-admin]], [[act-manager]]", "test.md")` が operation "create"、actorIds ["act-admin", "act-manager"] のエントリを返す
- `extractStructuredLines("対象: [[ent-deal]]", "test.md")` が targetId "ent-deal" のエントリを返す
- コードフェンス内の操作行・対象: 行は認識しない
- 操作行の operation に空白や `:` を含むパターンはマッチしない
- `tsc --noEmit` が成功する

## T-05: Graph 型に perm データフィールドを追加する

- [x] `src/graph/types.ts` の `Graph` インターフェースに以下を追加:
  - `permOperations: ParseResult["permOperations"]`
  - `permTargets: ParseResult["permTargets"]`
- [x] `src/graph/builder.ts` の `buildGraph` で、parsed.permOperations と parsed.permTargets を graph に含める
- [x] `src/graph/index.ts` で必要なら追加の re-export を行う

**Acceptance Criteria**:
- `buildGraph(parsed)` の結果に `permOperations` と `permTargets` が含まれる
- 既存テスト `src/graph/builder.test.ts` が変更なしで green（既存テストの ParseResult に permOperations / permTargets の空配列を追加する必要がある場合は修正する）
- `tsc --noEmit` が成功する

## T-06: C6 を二相化する

- [x] `src/check/rules/c06-view-links.ts` を改修:
  - import に `SUPPORTED_VIEW_TYPES`、`VIEW_ENABLED_NAME_TO_PREFIX` を追加
  - import に Graph 型を追加（perm 検証に必要）
  - `checkC6` のシグネチャを拡張: `checkC6(manifest: Manifest, graph: Graph): CheckDiagnostic[]`
  - enabled のビュー型名を走査し、`SUPPORTED_VIEW_TYPES` に属するものはスキーマ検証へ、属さないものは従来どおり error
  - permission の検証ロジック（後続 T-07 で実装）を呼び出すディスパッチ構造を用意する
- [x] `src/check/checker.ts` の `checkC6` 呼び出しを更新: `checkC6(manifest)` -> `checkC6(manifest, graph)`
- [x] ファイル冒頭の JSDoc コメントを更新: 二相構造の説明を追加

**Acceptance Criteria**:
- 未サポートビュー型（screen 等）が enabled の場合、従来どおり C6 error
- permission が enabled の場合、「unsupported view type」エラーが出ない
- 既存テスト `src/check/rules/c06-view-links.test.ts` のうち、permission 以外のビュー型のテストが変更なしで green。permission のテストケース（`all supported view types trigger C6`）は、permission を除外するように更新する
- `tsc --noEmit` が成功する

## T-07: C6 の perm 検証ロジックを実装する

- [x] `src/check/rules/c06-view-links.ts` に perm 検証関数を追加（C6 内のプライベート関数またはディスパッチ先）:
  - graph.rawElements から prefix が "perm" の要素を収集する
  - 各 perm 要素について、graph.permOperations をファイルと行ベースの帰属（findOwningElement と同じロジック: 同じファイル内で宣言行 <= 操作行 < 次の perm 宣言行）で突合する
  - **(a) 非空義務**: 帰属する操作行が 0 本なら C6 error
  - **(b) operation 一意**: 同一 perm 内で同じ operation が複数あれば C6 error
  - **(c) 参照 prefix 適格性**: 操作行内の各 actorId の prefix が "act" でなければ C6 error
  - 解決検証（actorId が実在するか）は行わない（C3 の責務）
- [x] findOwningElement を import する（graph/attribution.ts から）

**Acceptance Criteria**:
- 有効な perm（操作行あり・一意・act prefix）が C6 pass
- 操作行ゼロの perm が C6 error
- 同一 perm 内の operation 重複が C6 error
- 操作行の参照が act 以外の prefix（ent, mod 等）の場合に C6 error
- act-nonexistent への参照は C6 では報告されない
- 1 ファイルに複数の perm 要素がある場合、各要素が独立に検証される
- `tsc --noEmit` が成功する

## T-08: C11 に views 層の参照方向制限を追加する

- [x] `src/check/rules/c11-layer-direction.ts` の `LAYER_ALLOWED_TARGET_PREFIXES` に `views` エントリを追加する。許可 prefix は全ビュー prefix + static/domain/dynamic の全 prefix:
  ```
  views: new Set(["uc", "scr", "api", "dat", "flow", "evt", "ext", "perm", "dpl", "mod", "term", "ent", "inv", "act", "seq"])
  ```
- [x] ファイル冒頭 JSDoc コメントを更新: views の参照方向（下位層 + 自層のみ）を追記する。「Unlisted layers (loop, adr, views) have no restriction」のコメント (:19) から views を削除する

**Acceptance Criteria**:
- perm 要素から act / ent / mod / seq への参照が C11 pass
- perm 要素から他の views 要素（uc 等）への参照が C11 pass
- domain 要素（ent）から perm への参照が C11 error
- static 要素（mod）から perm への参照が C11 error
- dynamic 要素（seq）から perm への参照が C11 error
- loop / adr からの参照は引き続き無制限
- 既存テスト `src/check/rules/c11-layer-direction.test.ts` が変更なしで green
- `tsc --noEmit` が成功する

## T-09: export permissions サブコマンドを実装する

- [x] `src/export/permissions.ts` を新規作成。以下の関数を実装:
  - `generatePermissions(graph: Graph): { json: string }` — spec §11 の JSON を生成する
  - graph.rawElements から prefix "perm" の要素を収集し、id 昇順にソートする
  - 各 perm 要素に帰属する permOperations を収集し、operations オブジェクトを構築する（キー = operation 名を辞書順、値 = actorIds を ID 昇順）
  - 各 perm 要素に帰属する permTargets から target を取得する（あれば "target" フィールドを含める、なければ省略）
  - format-version は 0 とする
- [x] `src/export/` の index.ts に必要なら re-export を追加する
- [x] `src/cli/commands/export.ts` を修正:
  - permissions サブコマンドを追加する
  - USAGE テキストに permissions サブコマンドの説明を追加する
  - manifest.enabled に "permission" が含まれなければ exit 1（stderr にメッセージ）
  - design/ 不在なら exit 2
  - `--dir` と `--out` オプションを rules と同様に処理する
  - format-version 検証（C12）を rules と同様に適用する
  - check は実行しない（export は check と独立。check エラーがあっても JSON は排出する）

**Acceptance Criteria**:
- `handleExport(["permissions", "--dir", validPermDesignDir])` が exit 0 で、stdout に spec §11 準拠の JSON を出力する
- JSON の permissions 配列が id 昇順
- JSON の operations キーが辞書順
- JSON の act 配列が ID 昇順
- `対象:` 行がない perm の JSON に target フィールドが含まれない
- `対象:` 行がある perm の JSON に target フィールドが含まれる
- permission 未 enabled の design に対して exit 1
- design/ 不在で exit 2
- `--out <path>` で JSON がファイルに書き出される
- `tsc --noEmit` が成功する

## T-10: 構造行パースのユニットテストを追加する

- [x] `src/parse/structured-lines.test.ts` に以下のテストケースを追加:
  - 操作行 `- create: [[act-admin]], [[act-manager]]` が正しくパースされる（operation, actorIds）
  - 操作行 `- list: [[act-admin]]` が単一 actorId でパースされる
  - 対象: 行 `対象: [[ent-deal]]` が正しくパースされる
  - コードフェンス内の操作行・対象: 行が無視される
  - 通常の箇条書き `- some text` が操作行として誤認されない
  - 既存の構造行（責務:, 実装:, 依存辺, 登場要素）が引き続き正しく認識される

**Acceptance Criteria**:
- 新規テストケースが全て green
- 既存テストケースが変更なしで green
- `bun test src/parse/structured-lines.test.ts` が green

## T-11: C6 のユニットテストを追加する

- [x] `src/check/rules/c06-view-links.test.ts` を更新:
  - 既存テスト `all supported view types trigger C6` を修正: permission を除外（permission はサポート済みのため C6 error にならない）
  - 新規テスト: permission enabled + 有効な perm 要素（操作行あり・act prefix）-> C6 pass
  - 新規テスト: permission enabled + 操作行ゼロの perm -> C6 error
  - 新規テスト: permission enabled + operation 重複 -> C6 error
  - 新規テスト: permission enabled + 非 act prefix の参照 -> C6 error
  - 新規テスト: permission enabled + perm 要素なし -> C6 pass（perm 要素の宣言がなくてもエラーにしない。空の view は合法）
  - 新規テスト: permission + screen の両方 enabled -> permission は perm 検証、screen は unsupported error

**Acceptance Criteria**:
- 全テストケースが green
- `bun test src/check/rules/c06-view-links.test.ts` が green

## T-12: C7 / C11 / C3 の perm 関連テストを追加する

- [x] `src/check/rules/c07-manifest-prerequisites.test.ts` に追加:
  - permission enabled + domain あり -> C7 pass
  - permission enabled + domain なし（static のみ）-> C7 error
- [x] `src/check/rules/c11-layer-direction.test.ts` に追加:
  - perm -> act 参照 -> C11 pass
  - perm -> ent 参照 -> C11 pass
  - ent -> perm 参照 -> C11 error
  - mod -> perm 参照 -> C11 error
  - seq -> perm 参照 -> C11 error
- [x] `src/check/rules/c03-ref-resolved.test.ts` に追加:
  - permission enabled で実在する act への参照 -> C3 pass
  - permission enabled で実在しない act への参照 -> C3 error
- [x] `src/check/degradation.test.ts` に追加:
  - permission 未 enabled の design に perm 宣言があっても診断が出ない（縮退テスト）

**Acceptance Criteria**:
- 全新規テストケースが green
- 既存テストケースが変更なしで green

## T-13: export permissions のテストを追加する

- [x] `src/cli/commands/export.test.ts` に以下のテストケースを追加:
  - permission + domain enabled の fixture で `export permissions` が exit 0 + 正しい JSON
  - `対象:` 行あり/なしの両方の perm で JSON の target フィールドの有無を検証
  - permission 未 enabled で exit 1
  - design/ 不在で exit 2
  - `--out <path>` でファイル出力
  - 出力順の決定性: id 昇順・operation 辞書順・act ID 昇順
- [x] `src/export/permissions.ts` のユニットテスト（`src/export/permissions.test.ts` を新規作成）:
  - perm 要素・操作行・対象行を含む graph から正しい JSON を生成
  - 複数 perm 要素の id 昇順ソート
  - operations キーの辞書順ソート
  - act 配列の ID 昇順ソート
  - target 省略の検証

**Acceptance Criteria**:
- 全テストケースが green
- `bun test src/cli/commands/export.test.ts` が green
- `bun test src/export/permissions.test.ts` が green

## T-14: conformance fixture の統合テストを追加する

- [x] `src/check/integration.test.ts` または新規テストファイルに以下のテストケースを追加:
  - spec §8 の例と同形の fixture を構築する:
    - manifest: `enabled: static, domain, permission`
    - mod 要素、act 要素（act-admin, act-manager, act-member, act-finance）
    - perm 要素（perm-deal）に操作行（list, create）と対象: 行（ent-deal）
    - ent 要素（ent-deal）
    - dependencies.md は空（または最小構成）
  - `runCheck(graph, manifest, [])` が 0 件の診断を返す
- [x] `src/check/integration.test.ts` の既存テスト「design/ has zero check diagnostics」が引き続き green であることを確認

**Acceptance Criteria**:
- conformance fixture で `runCheck` が 0 件の診断を返す
- aozu 自身の design/ の self-check が引き続き green
- `bun test src/check/integration.test.ts` が green

## T-15: 最終検証

- [x] `tsc --noEmit` が成功する
- [x] `bun test` が全テスト green
- [x] `package.json` の `dependencies` が `{}` のまま
- [x] design/ に対する self-check（`src/check/integration.test.ts`）が引き続き green
- [x] `design/rules.json` に対する `export rules --verify` が exit 0
- [x] 未サポートのビュー型（screen 等）の既存テストが変更なし（または最小限の修正）で green

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- `dependencies` が空
- `export rules --verify` が exit 0
