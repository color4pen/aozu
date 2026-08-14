# Tasks: op 要素の実装 — op 型の追加と perm 操作行の op 参照化

## T-01: op prefix を宣言的定数に追加する

- [ ] `src/parse/id.ts` の `KNOWN_PREFIXES` に `"op"` を追加する
- [ ] `src/check/manifest.ts` の `LAYER_MAP` に `op: "domain"` を追加する
- [ ] `src/check/manifest.ts` の `LAYER_TO_PREFIXES.domain` 配列に `"op"` を追加する
- [ ] `src/check/rules/c11-layer-direction.ts` の `LAYER_ALLOWED_TARGET_PREFIXES` の `domain` 集合に `"op"` を追加する
- [ ] 同ファイルの `static` 集合に `"op"` を追加する
- [ ] 同ファイルの `dynamic` 集合に `"op"` を追加する
- [ ] 同ファイルの `views` 集合に `"op"` を追加する
- [ ] `src/plan/frontier.ts` の `IMPLEMENTATION_PREFIXES` に `"op"` を追加する

**Acceptance Criteria**:
- `## 受注を確定する {#op-confirm-order}` を含む domain 文書が `check` exit 0（C1/C2/C3 の op 認識）
- op から static 要素への参照は C11 違反で exit 1
- op→ent 参照を含む design の check が exit 0 で C11 診断なし
- `実装:` 行つき op 要素が mark implemented / frontier の対象になる
- `bunx tsc --noEmit` が green

## T-02: `対象:` 行の汎用化と TargetLine 型の導入

- [ ] `src/parse/types.ts` に `TargetLine` 型を追加する: `{ targetIds: string[]; file: string; line: number }`
- [ ] `src/parse/types.ts` の `ParseResult` から `permTargets: PermTarget[]` を `targetLines: TargetLine[]` に置換する
- [ ] `PermTarget` 型は削除する（TargetLine に統合）
- [ ] `src/parse/structured-lines.ts` の `PERM_TARGET_LINE_RE` を汎用 RE `/^対象: (.+)$/` に変更し、名前を `TARGET_LINE_RE` に改名する
- [ ] 同ファイルの `StructuredLineResult` から `permTargets` を `targetLines: TargetLine[]` に置換する
- [ ] 同ファイルの対象行認識ロジックを変更: マッチしたら `[[id]]` を全抽出し、`targetIds` 配列として TargetLine に格納する
- [ ] `src/graph/types.ts` の `Graph` インタフェースから `permTargets` を `targetLines` に置換する
- [ ] `src/graph/builder.ts` の buildGraph で `permTargets` を `targetLines` に置換する
- [ ] `src/parse/parser.ts` の parseFiles で `permTargets` の集約を `targetLines` に置換する

**Acceptance Criteria**:
- `対象: [[ent-order]]`（単一参照）が `targetLines` に `targetIds: ["ent-order"]` として格納される
- `対象: [[ent-order]], [[ent-customer]]`（複数参照）が `targetLines` に `targetIds: ["ent-order", "ent-customer"]` として格納される
- `bunx tsc --noEmit` が green（全コンパイルエラー解消）

## T-03: C6 の対象行検証（perm 単一制約 / op 複数許容）

- [ ] `src/check/rules/c06-view-links.ts` の `checkPermission` 関数で、`graph.targetLines` から perm 帰属の対象行を抽出するよう変更する（findOwningElement で判定、prefix === "perm"）
- [ ] perm 帰属の対象行で `targetIds.length > 1` の場合、C6 error 診断を発行する（行番号つき、メッセージは「perm target line must contain exactly one reference」相当）
- [ ] perm 帰属の対象行から `targetIds[0]` を取得し、既存の target 処理（export 向け）に渡す
- [ ] op 帰属の対象行は C6 の検証対象外とする（error を出さない。export operations が将来消費）

**Acceptance Criteria**:
- perm の `対象: [[ent-a]], [[ent-b]]`（複数参照）が C6 error で exit 1
- perm の `対象: [[ent-a]]`（単一参照）は C6 pass
- op の `対象: [[ent-a]], [[ent-b]]`（複数参照）は error なし
- `bunx tsc --noEmit` が green

## T-04: perm 操作行の op 参照化（structured-lines）

- [ ] `src/parse/structured-lines.ts` の `PERM_OPERATION_LINE_RE` を新文法 `/^- \[\[([a-z0-9-]+)\]\]: (\[\[.+)$/` に変更する
- [ ] 旧文法キャッチ用の `PERM_OPERATION_LINE_RE_LEGACY` を追加: `/^- ([^\s:]+): (\[\[.+)$/`（現行 RE と同一パターン）
- [ ] `src/parse/types.ts` に `MalformedPermOperation` 型を追加: `{ file: string; line: number; text: string }`
- [ ] `src/parse/types.ts` の `ParseResult` に `malformedPermOperations: MalformedPermOperation[]` を追加する
- [ ] `src/parse/structured-lines.ts` の `StructuredLineResult` に `malformedPermOperations: MalformedPermOperation[]` を追加する
- [ ] 操作行認識ロジックを変更: まず新 RE でマッチを試行し、マッチすれば permOperations に格納。不一致の場合、旧 RE でマッチを試行し、マッチすれば malformedPermOperations に格納
- [ ] `src/graph/types.ts` の `Graph` に `malformedPermOperations` を追加する
- [ ] `src/graph/builder.ts` の buildGraph で `malformedPermOperations` を伝搬する
- [ ] `src/parse/parser.ts` の parseFiles で `malformedPermOperations` を集約する

**Acceptance Criteria**:
- `- [[op-create-deal]]: [[act-admin]]` が permOperations に `operation: "op-create-deal"` として格納される
- `- create: [[act-admin]]` が malformedPermOperations に格納される（permOperations には入らない）
- `bunx tsc --noEmit` が green

## T-05: C6 の op 参照検証と malformed 診断

- [ ] `src/check/rules/c06-view-links.ts` の `checkPermission` に malformed 操作行の診断を追加: `graph.malformedPermOperations` から perm 帰属のものを抽出し、各行に C6 error 診断を発行する（行番号つき、メッセージは「malformed operation line: expected [[op-id]] reference」相当）
- [ ] 有効操作行の op 参照検証を追加: `op.operation` を `graph.elements` で lookup し、存在しない場合は C6 error（「unresolved op reference」）。存在するが prefix が `op` でない場合も C6 error（「operation reference is not an op element」）
- [ ] 既存の act prefix 検証（prefix !== "act" → error）は維持する
- [ ] 非空義務の判定を変更: 有効操作行（permOperations の perm 帰属のもの）の本数で判定する。malformed は数えない
- [ ] op 参照の perm 内一意の検証: seenOps の検証対象を operation フィールド（= op ID）にする（既存ロジックの延長）
- [ ] malformed のみの perm は malformed error + 非空義務 error の 2 errors を発行する

**Acceptance Criteria**:
- `- [[op-a]]: [[act-x]]` が op / act とも解決すれば C6 合格
- 未定義 op への操作行参照が C6 error で exit 1
- `- [[ent-order]]: [[act-x]]`（実在するが op でない）が C6 error で exit 1
- 同一 perm 内で同じ op を参照する操作行 2 本が C6 error（1 件のみ。prefix 違反エラーなし）
- `- create: [[act-x]]`（自由トークン）が C6 error で exit 1
- malformed のみの perm が malformed error + 非空義務 error の 2 errors
- `bunx tsc --noEmit` が green

## T-06: generatePermissions の対象行取得を targetLines に移行

- [ ] `src/export/permissions.ts` の `generatePermissions` で `graph.permTargets` を `graph.targetLines` に変更し、findOwningElement で perm 帰属のものを抽出して `targetIds[0]` を target として使用する

**Acceptance Criteria**:
- `export permissions` の出力で、perm の `対象:` 行がある場合は target フィールドが出力される（既存挙動維持）
- perm の `対象:` 行がない場合は target フィールドが省略される（既存挙動維持）
- `bunx tsc --noEmit` が green

## T-07: JSDoc・テスト名の更新

- [ ] `src/parse/types.ts` の `PermOperation` インタフェースの JSDoc コメントを `- [[op-id]]: [[act-id]](, [[act-id]])*` に更新する
- [ ] `src/export/permissions.ts` の冒頭 JSDoc の出力例を op ID キーに更新する（`"op-create-deal": [...]` 等）
- [ ] `src/export/permissions.test.ts` のテスト名 `"spec §8 example: perm-deal with list and create"` から spec §8 への言及を外す（例: `"perm-deal with list and create"` に変更）

**Acceptance Criteria**:
- PermOperation の JSDoc が新文法を例示している
- permissions.ts の JSDoc が op ID キーを例示している
- テスト名に "spec §8" が含まれない
- 既存テスト自体は無変更で green（テスト名のみ変更）

## T-08: spec/format.md の転記更新

- [ ] §8 perm セクションの `対象:` 行の説明に「単一参照。複数参照は C6 違反」を追記する
- [ ] §10 C6 の規則説明に「perm 対象行の単一制約」を追記する
- [ ] §10 C11 の規則内 `domain（term / ent / inv / act）` を `domain（term / ent / inv / act / op）` に変更する

**Acceptance Criteria**:
- spec/format.md §8 perm に単一参照制約が記載されている
- spec/format.md §10 C6 に perm 対象行の単一制約が記載されている
- spec/format.md §10 C11 の domain 列挙に op が含まれている

## T-09: 既存テストの新文法への書き換えと回帰テスト

- [ ] `src/check/rules/c06-view-links.test.ts` の perm 操作行テストを新文法（`- [[op-id]]: [[act-id]]`）に書き換える（PermOperation の operation フィールドを op ID に変更する）
- [ ] `src/check/rules/c06-view-links.test.ts` および `src/export/permissions.test.ts` の makeGraph ヘルパーで `permTargets: []` を `targetLines: []` に置換する（T-02 の ParseResult 型変更によるコンパイルエラー解消）
- [ ] `src/export/permissions.test.ts` の変更スコープはテスト名のみ（T-07 委譲）。PermOperation の operation フィールドは自由トークンのまま残す（generatePermissions は文法非依存の純関数であり、直接構築では旧実装と区別できない — design D5）
- [ ] perm 文法テスト以外の既存テストが無変更で green であることを確認する
- [ ] aozu 自身の design/ の `check` 結果が不変であることを確認する（design/ は op / perm を使用していない）
- [ ] `bunx tsc --noEmit` && `bun test` が green であることを確認する

**Acceptance Criteria**:
- 書き換えたテストが新文法で green
- perm 文法テスト以外の既存テストが無変更で green
- aozu 自身の design/ の check 結果が不変
- `bunx tsc --noEmit` && `bun test` が全 green

## T-10: export permissions の op ID キー検証テスト（実パース経由）

- [ ] `src/export/permissions.test.ts` に新テストを追加する: markdown fixture 文字列（op 要素の宣言 + perm 要素の操作行 `- [[op-id]]: [[act-id]]`）を parseFiles → buildGraph → generatePermissions に通し、出力 JSON の operations キーが op ID（例: `"op-create-deal"`）であることを assert する
- [ ] fixture は最小限の markdown: manifest.md（format-version: 0, enabled: [static, domain, permission]）、domain/operations.md（op 宣言）、domain/actors.md（act 宣言）、views/permission/deal.md（perm 宣言 + 操作行）

**Acceptance Criteria**:
- テストが実パース経由で operations キーが op ID であることを検証する
- 旧実装（自由トークン認識）では括弧ごとトークンが取得されるため、このテストは red になる
- `bun test` が green
