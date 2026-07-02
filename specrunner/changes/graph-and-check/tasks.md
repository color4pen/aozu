# Tasks: graph-and-check

## T-01: ParseResult の拡張（actorIds / elementItems の追加）

- [ ] `src/parse/types.ts` に `actorIds` と `elementItems` フィールドを追加:
  - `actorIds: { id: string; file: string; line: number }[]` — seq の `## 登場要素` 配下の `- [[id]]` エントリ
  - `elementItems: { id: string; file: string; line: number }[]` — plan の `elements:` 行の `[[id]]` エントリ
- [ ] `src/parse/parser.ts` の `parseFiles` 関数を更新: `extractStructuredLines` の結果から `actorIds` と `elementItems` を `ParseResult` に集約する
- [ ] `src/parse/index.ts` の re-export を確認（型の追加分が export されること）
- [ ] 既存テストが green のまま通ることを確認（`bun test src/parse/`）

**Acceptance Criteria**:
- `ParseResult` に `actorIds` と `elementItems` が含まれる
- `design/` のパースで `actorIds` に seq 文書の登場要素が含まれる
- 既存テスト（TC-001, TC-004, TC-005, TC-007, TC-033, TC-034, TC-035）が変更なしで green
- `tsc --noEmit` が成功する

## T-02: graph モジュールの型定義

- [ ] `src/graph/types.ts` を作成し、以下の型を定義:
  - `ElementTable`: `Map<string, Element>` の型エイリアス（ID → Element）
  - `ReferenceIndex`: `{ bySource: Map<string, Reference[]>; byTarget: Map<string, Reference[]>; all: Reference[] }`
  - `Manifest`: `{ formatVersion: string; enabled: string[] }`
  - `Graph`: `{ elements: ElementTable; rawElements: Element[]; references: ReferenceIndex; dependencyEdges: DependencyEdge[]; actorIds: ParseResult["actorIds"]; elementItems: ParseResult["elementItems"]; manifestPath: string | null }`（`rawElements` は宣言順の生配列。Map 構築で重複 ID が消失するため C2 の走査対象）
- [ ] `src/graph/index.ts` を作成し re-export。あわせて `validateId` / `KNOWN_PREFIXES` を `src/parse/` から re-export する（check は parse を直接 import せず、この経由で参照する）

**Acceptance Criteria**:
- 全型が `src/graph/index.ts` から import 可能
- `tsc --noEmit` が成功する

## T-03: graph 構築関数の実装

- [ ] `src/graph/builder.ts` を作成
- [ ] `buildGraph(parsed: ParseResult, manifestPath: string): Graph` を実装:
  - `parsed.elements` から `ElementTable`（Map<string, Element>）を構築
  - `parsed.elements` をそのまま `rawElements` として格納（順序・重複を保存）
  - `parsed.references` から `ReferenceIndex` を構築（bySource / byTarget の索引）
  - `parsed.dependencyEdges`, `parsed.actorIds`, `parsed.elementItems` をそのまま格納
  - `manifestPath` を格納（manifest ファイルの特定に使用）
- [ ] `resolveId(graph: Graph, id: string): Element | undefined` ヘルパーを実装（`graph.elements.get(id)`）
- [ ] `src/graph/index.ts` に re-export を追加
- [ ] `src/graph/builder.test.ts` を作成:
  - 単純な ParseResult から Graph が構築される
  - `resolveId` で既知 ID が Element を返す
  - `resolveId` で未知 ID が undefined を返す
  - `byTarget` で特定 ID への参照リストが取得できる
  - 空の ParseResult で空の Graph が返る

**Acceptance Criteria**:
- `buildGraph` が ParseResult から Graph を構築できる
- `resolveId` が正しく動作する
- `bun test src/graph/builder.test.ts` が green
- `tsc --noEmit` が成功する

## T-04: graph 統合テスト（design/ 対象）

- [ ] `src/graph/integration.test.ts` を作成
- [ ] `design/` の全文書をパースして `buildGraph` に渡す
- [ ] ElementTable に 25 エントリがあることを assert
- [ ] `resolveId(graph, "mod-parse")` が Element を返すことを assert
- [ ] `resolveId(graph, "nonexistent")` が undefined を返すことを assert
- [ ] `byTarget` で `mod-cli` への参照が存在することを assert（design/ 内で mod-cli は複数箇所から参照されている）

**Acceptance Criteria**:
- `design/` の parse 結果から Graph が正しく構築される
- 要素表に 25 エントリ、参照索引が正しく構築される
- `bun test src/graph/integration.test.ts` が green

## T-05: check モジュールの型定義と manifest 解釈

- [ ] `src/check/types.ts` を作成:
  - `CheckDiagnostic`: `{ level: "error" | "warning"; code: string; elementId: string | null; message: string; file: string; line: number }`
- [ ] `src/check/manifest.ts` を作成:
  - `LAYER_MAP`: prefix → layer のマッピング定数（`mod→static`, `term/ent/inv→domain`, `seq→dynamic`, `top/plan/grp→loop`, `adr→always`, ビュー prefix → `views`）
  - `LAYER_PREREQUISITES`: layer → 前提 layer[] のマッピング定数
  - `VIEW_ENABLED_NAME_TO_PREFIX`: `Record<string, string>` — `enabled` に現れるビュー型名 → prefix の全列挙（`use-case→uc`, `screen→scr`, `api→api`, `data→dat`, `dataflow→flow`, `event→evt`, `external→ext`, `permission→perm`, `deployment→dpl`）。`VIEW_TYPE_NAMES` はこの Record のキー集合として導出する
  - `LAYER_ENABLED_NAMES`: 層名の Set（`static`, `domain`, `dynamic`, `loop`）
  - `parseManifest(frontmatters: ParseResult["frontmatters"], manifestPath: string): Manifest` — frontmatter から `enabled` リストを抽出
  - `getEnabledLayers(manifest: Manifest): Set<string>` — 有効な層を返す
  - `getEnabledPrefixes(manifest: Manifest): Set<string>` — 有効な層に属する prefix の集合を返す。**ビュー型の prefix は含めない**（ビュー型は未対応で C6 が fail-closed 診断を出すため、参照解決を無言で許さない）。`adr` prefix は常時含める
  - `isLayerEnabled(layer: string, manifest: Manifest): boolean`
- [ ] `src/check/manifest.test.ts` を作成:
  - `enabled: static, domain, dynamic` → layers `{static, domain, dynamic}` が有効
  - `enabled: static` → static のみ有効、domain/dynamic/loop は無効
  - `enabled` にビュー型名が含まれる場合の認識
  - `getEnabledPrefixes` で static → `{mod}`, domain → `{term, ent, inv}` 等
- [ ] `src/check/index.ts` を作成し re-export

**Acceptance Criteria**:
- manifest の `enabled` リストが正しくパースされる
- 層→prefix の変換が正しい
- `bun test src/check/manifest.test.ts` が green
- `tsc --noEmit` が成功する

## T-06: C1（ID 文法）の実装

- [ ] `src/check/rules/c01-id-grammar.ts` を作成
- [ ] `checkC1(graph: Graph): CheckDiagnostic[]` を実装: 全要素の ID を `validateId` で検証し、不合格なら `code: "C1"` の診断を返す。`validateId` / `KNOWN_PREFIXES` は `src/graph/` の re-export 経由で import する（`src/check/` から `src/parse/` を直接 import しない — 許可依存 `mod-check → mod-graph → mod-parse` に従う）
- [ ] `src/check/rules/c01-id-grammar.test.ts` を作成:
  - 正常 ID のみの Graph → 診断 0 件
  - 大文字 ID を含む Graph → C1 診断が返る
  - 未知 prefix の ID → C1 診断が返る

**Acceptance Criteria**:
- 不正な ID が C1 として検出される
- 正常な ID では診断が出ない
- `bun test src/check/rules/c01-id-grammar.test.ts` が green

## T-07: C2（ID 一意性）の実装

- [ ] `src/check/rules/c02-id-unique.ts` を作成
- [ ] `checkC2(graph: Graph): CheckDiagnostic[]` を実装: `graph.rawElements`（宣言順の生配列）を走査し、同一 ID が複数回宣言されていれば `code: "C2"` の診断を返す（2 番目以降の宣言に対して診断）
- [ ] `src/check/rules/c02-id-unique.test.ts` を作成:
  - 一意な ID のみ → 診断 0 件
  - 重複 ID あり → C2 診断が返る（2 番目の宣言の位置情報つき）

**Acceptance Criteria**:
- 重複 ID が C2 として検出される
- 一意な ID では診断が出ない
- `bun test src/check/rules/c02-id-unique.test.ts` が green

## T-08: C3（参照解決）の実装

- [ ] `src/check/rules/c03-ref-resolved.ts` を作成
- [ ] `checkC3(graph: Graph, enabledPrefixes: Set<string>): CheckDiagnostic[]` を実装:
  - 全参照を走査し、参照先が ElementTable に存在しない場合は `code: "C3"` の診断
  - ただし、参照先 ID の prefix が有効な prefix に含まれない場合（disabled type への参照）はスキップ
  - **参照元の要素の prefix が無効な層に属する場合もスキップ**（無効層の文書の義務は評価しない、の一貫適用。例: `enabled: static` のとき seq 文書内の未解決 mod 参照は診断しない）
- [ ] `src/check/rules/c03-ref-resolved.test.ts` を作成:
  - 全参照が解決 → 診断 0 件
  - 未解決参照あり → C3 診断が返る
  - disabled type への参照 → C3 診断が出ない
  - disabled 層の要素**から**の未解決参照 → C3 診断が出ない

**Acceptance Criteria**:
- 未解決参照が C3 として検出される
- disabled type への参照はスキップされる
- `bun test src/check/rules/c03-ref-resolved.test.ts` が green

## T-09: C4（依存辺端点）の実装

- [ ] `src/check/rules/c04-dep-endpoints.ts` を作成
- [ ] `checkC4(graph: Graph): CheckDiagnostic[]` を実装:
  - 全 `dependencyEdges` を走査し、from/to の prefix が `mod` でなければ `code: "C4"` の診断
  - from/to が ElementTable に存在しなければ同じく C4 の診断
- [ ] `src/check/rules/c04-dep-endpoints.test.ts` を作成:
  - 両端が mod → 診断 0 件
  - 片端が ent → C4 診断が返る
  - 端点が未解決 → C4 診断が返る

**Acceptance Criteria**:
- 非 mod 端点が C4 として検出される
- 未解決端点が C4 として検出される
- `bun test src/check/rules/c04-dep-endpoints.test.ts` が green

## T-10: C5（seq 登場要素）の実装

- [ ] `src/check/rules/c05-seq-actors.ts` を作成
- [ ] `checkC5(graph: Graph): CheckDiagnostic[]` を実装:
  - seq 要素ごとに、その seq ファイルに紐づく actorIds を収集
  - actorIds が 0 件なら `code: "C5"` の診断（空リスト）
  - actorIds の各 ID の prefix が `mod` でなければ `code: "C5"` の診断
- [ ] `src/check/rules/c05-seq-actors.test.ts` を作成:
  - 正常な seq（mod のみの登場要素）→ 診断 0 件
  - 空の登場要素 → C5 診断が返る
  - 非 mod の登場要素 → C5 診断が返る

**Acceptance Criteria**:
- 空の登場要素リストが C5 として検出される
- 非 mod 登場要素が C5 として検出される
- `bun test src/check/rules/c05-seq-actors.test.ts` が green

## T-11: C6（ビューリンク義務 — fail-closed）の実装

- [ ] `src/check/rules/c06-view-links.ts` を作成
- [ ] `checkC6(manifest: Manifest): CheckDiagnostic[]` を実装:
  - `manifest.enabled` に VIEW_TYPE_NAMES に該当する値があれば `code: "C6"` の診断（"unsupported view type: <name>"）
  - ビュー型がなければ空配列
- [ ] `src/check/rules/c06-view-links.test.ts` を作成:
  - ビュー型なし → 診断 0 件
  - `use-case` を含む → C6 診断が返る（"unsupported view type"）
  - 複数のビュー型 → 各ビュー型ごとに C6 診断が返る

**Acceptance Criteria**:
- ビュー型が enabled に含まれると C6 として検出される
- ビュー型がなければ診断が出ない
- `bun test src/check/rules/c06-view-links.test.ts` が green

## T-12: C7（manifest 前提関係）の実装

- [ ] `src/check/rules/c07-manifest-prerequisites.ts` を作成
- [ ] `checkC7(manifest: Manifest): CheckDiagnostic[]` を実装:
  - `LAYER_PREREQUISITES` を参照し、`enabled` に含まれる層の前提が満たされていなければ `code: "C7"` の診断
  - 例: `loop` が enabled で `static` が未 enabled → C7
- [ ] `src/check/rules/c07-manifest-prerequisites.test.ts` を作成:
  - 前提が満たされている → 診断 0 件
  - loop without static → C7 診断
  - dynamic without static → C7 診断
  - domain without static → C7 診断（domain は static が前提）

**Acceptance Criteria**:
- 前提関係の不足が C7 として検出される
- 正しい組み合わせでは診断が出ない
- `bun test src/check/rules/c07-manifest-prerequisites.test.ts` が green

## T-13: C8（state.json キー検証）の実装

- [ ] `src/check/rules/c08-state-keys.ts` を作成
- [ ] `checkC8(graph: Graph, stateKeys: string[]): CheckDiagnostic[]` を実装:
  - `stateKeys` の各キーが ElementTable に存在しなければ `code: "C8"` の診断
- [ ] `src/check/rules/c08-state-keys.test.ts` を作成:
  - 全キーが実在 → 診断 0 件
  - 存在しないキー → C8 診断が返る
  - stateKeys が空 → 診断 0 件

**Acceptance Criteria**:
- 実在しないキーが C8 として検出される
- `bun test src/check/rules/c08-state-keys.test.ts` が green

## T-14: C9（ADR の topic 引用）の実装

- [ ] `src/check/rules/c09-adr-topics.ts` を作成
- [ ] `checkC9(graph: Graph): CheckDiagnostic[]` を実装:
  - `adr` prefix を持つ全要素について、その要素のファイル内の参照に `top-*` が 1 つ以上あるかを検証
  - frontmatter の `topics:` 行に `[[top-*]]` があればそれも考慮（references に含まれているため自然に拾える）
  - `top` 参照がなければ `code: "C9"` の診断
- [ ] `src/check/rules/c09-adr-topics.test.ts` を作成:
  - adr が top を参照 → 診断 0 件
  - adr が top を参照していない → C9 診断が返る

**Acceptance Criteria**:
- topic 引用のない adr が C9 として検出される
- `bun test src/check/rules/c09-adr-topics.test.ts` が green

## T-15: C10（plan の elements / after 検証）の実装

- [ ] `src/check/rules/c10-plan-elements.ts` を作成
- [ ] `checkC10(graph: Graph): CheckDiagnostic[]` を実装:
  - plan ファイル内の `elementItems` の各 ID が ElementTable に存在するか検証
  - plan ファイル内の参照のうち `grp-*` prefix を持つもの（after の grp 参照）が ElementTable に存在するか検証
  - 未解決なら `code: "C10"` の診断
- [ ] `src/check/rules/c10-plan-elements.test.ts` を作成:
  - 全 elements/after が解決 → 診断 0 件
  - elements に未解決 ID → C10 診断が返る

**Acceptance Criteria**:
- plan の未解決要素が C10 として検出される
- `bun test src/check/rules/c10-plan-elements.test.ts` が green

## T-16: C11（層間参照方向）の実装

- [ ] `src/check/rules/c11-layer-direction.ts` を作成
- [ ] `checkC11(graph: Graph, enabledPrefixes: Set<string>): CheckDiagnostic[]` を実装:
  - 有効な層に属する要素の参照について、参照先の prefix が許可リストに含まれるかを検証
  - 許可リスト: domain → `{term, ent, inv}`, static → `{mod, term, ent, inv}`, dynamic → `{seq, mod, term, ent, inv}`, loop/adr → 全 prefix
  - 違反なら `code: "C11"` の診断
- [ ] `src/check/rules/c11-layer-direction.test.ts` を作成:
  - domain → domain 参照 → 診断 0 件
  - domain → mod 参照 → C11 診断が返る
  - static → domain 参照 → 診断 0 件
  - static → seq 参照 → C11 診断が返る
  - dynamic → static/domain 参照 → 診断 0 件
  - adr → any → 診断 0 件

**Acceptance Criteria**:
- 層間方向違反が C11 として検出される
- 許可された方向では診断が出ない
- `bun test src/check/rules/c11-layer-direction.test.ts` が green

## T-17: checker 集約関数の実装

- [ ] `src/check/checker.ts` を作成
- [ ] `runCheck(graph: Graph, manifest: Manifest, stateKeys?: string[]): CheckDiagnostic[]` を実装:
  - manifest から有効層・有効 prefix を算出
  - C1, C2, C7 は常時評価
  - C3 は常時評価（enabledPrefixes を渡す）
  - C4 は static 有効時のみ
  - C5 は dynamic 有効時のみ
  - C6 は常時評価（ビュー型チェック）
  - C8, C9, C10 は loop 有効時のみ
  - C11 は有効層に属する要素のみ対象
  - 全規則の診断を集約して返す（fail-fast しない）
- [ ] `src/check/index.ts` に `runCheck` を re-export
- [ ] `src/check/checker.test.ts` を作成:
  - 正常な Graph + manifest → 診断 0 件
  - 複数の規則違反を含む Graph → 全違反が報告される（fail-fast しない）
  - `enabled: static` のみ → C5, C8, C9, C10 がスキップされる

**Acceptance Criteria**:
- `runCheck` が全規則を集約して評価する
- 段階縮退が正しく動作する
- `bun test src/check/checker.test.ts` が green

## T-18: design/ に対する統合テスト（違反ゼロ）

- [ ] `src/check/integration.test.ts` を作成
- [ ] `design/` の全文書をパース → `buildGraph` → `runCheck` を実行
- [ ] `manifest.md` のパスを特定し、manifest を解析
- [ ] 診断が 0 件であることを assert
- [ ] テスト名に `tools/check.sh` との同等性を明記

**Acceptance Criteria**:
- `design/` に対する check が違反ゼロを返す
- `tools/check.sh` の OK 判定と同等であることがテスト名に明記されている
- `bun test src/check/integration.test.ts` が green

## T-19: 段階縮退の統合テスト

- [ ] `src/check/degradation.test.ts` を作成
- [ ] `enabled: static` のみの fixture（manifest + modules.md + dependencies.md のみ）を用意
- [ ] この fixture に対して `runCheck` を実行し、domain / dynamic / loop 固有の規則が評価されないことを assert:
  - C5（seq 登場要素）の診断が出ないこと
  - C8, C9, C10（loop）の診断が出ないこと
  - C4（static 依存辺）は評価されること
- [ ] `enabled: static` の fixture に domain の参照を含めても C3 / C11 で domain 側のエラーが出ないことを確認
- [ ] 無効層の要素（例: seq）からの未解決参照が C3 診断を出さないケースの fixture とアサーションを追加

**Acceptance Criteria**:
- `enabled: static` で domain/dynamic/loop の規則がスキップされる
- static の規則は正常に評価される
- `bun test src/check/degradation.test.ts` が green

## T-20: ビュー型 fail-closed の統合テスト

- [ ] T-19 のテストファイルまたは別ファイルに追加
- [ ] `enabled: static, domain, use-case` の fixture を用意
- [ ] `runCheck` で C6 の「unsupported view type」診断が出ることを assert

**Acceptance Criteria**:
- ビュー型が enabled に含まれると C6 診断が出る
- `bun test` で該当テストが green

## T-21: 最終検証

- [ ] `tsc --noEmit` が成功する
- [ ] `bun test` が全テスト green（既存テスト含む）
- [ ] `bash tools/check.sh design` が引き続き `OK: 宣言 25 要素 / 参照 15 種` を返す
- [ ] `package.json` の `dependencies` が `{}` のまま

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- 既存テスト（TC-001, TC-004, TC-005, TC-007, TC-013, TC-014, TC-033, TC-034, TC-035）が変更なしで green
- `tools/check.sh` の出力が変わらない
- `dependencies` が空
