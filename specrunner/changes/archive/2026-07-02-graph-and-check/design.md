# Design: graph-and-check

## Context

R1（skeleton-and-parser）で strict プロファイルパーサが確立した。`src/parse/` は要素宣言・参照・依存辺・構造化行・構文診断を `ParseResult` として返す純関数であり、`design/` の 25 要素・15 参照種がテストで回帰固定されている。

本変更は aozu の中核機能である参照グラフ構築（`mod-graph`）と閉包検証（`mod-check`）を実装する。`spec/format.md` §10 の C1〜C11 規則を純関数として評価し、位置つき診断の配列を返すまでがスコープ。CLI コマンド結線（check コマンド / exit code / stdout 整形）は次 request で行う。

現状の制約:

- `ParseResult` はすでに `elements`, `references`, `dependencyEdges`, `diagnostics`, `frontmatters` を持つ。`frontmatters` は `Map<string, Record<string, string | string[]>>` で、manifest の `enabled` リストはすでに `string[]` としてパース済み
- `src/parse/structured-lines.ts` が `actorIds`（登場要素）、`elementItems`（plan の elements 行）を抽出するが、これらは `ParseResult` に含まれていない。graph / check が必要とする場合は `ParseResult` を拡張するか、`extractStructuredLines` を直接呼ぶ必要がある
- `tools/check.sh` が C1〜C5, C11（domain のみ）の暫定実装として存在する。本実装の結果は同等以上でなければならない
- 実行時依存ゼロ方針: `dependencies` は空を維持
- `design/manifest.md` の現在値は `enabled: static, domain, dynamic`。loop / ビュー型は無効

## Goals / Non-Goals

**Goals**:

- `src/graph/` に参照グラフを実装する: `ParseResult` から要素表（ID → Element）と参照辺を構築し、ID 解決 API を提供する
- `src/check/` に閉包検証を実装する: C1〜C11 を段階縮退つきで評価し、位置つき診断の配列を返す
- manifest の `enabled` リストを解釈し、型の前提関係をコード内宣言テーブルで定義する
- `ParseResult` を拡張して `actorIds`（seq の登場要素）と `elementItems`（plan の elements）を含める
- C6 のビュー型 fail-closed: ビュー型が `enabled` に含まれていれば「unsupported view type」診断を出す
- `design/` に対する評価が違反ゼロであることをテストで固定する
- C1〜C11 の各規則について違反 fixture で陽性テストを固定する
- 段階縮退のテスト: `enabled: static` のみの fixture でスキップを確認する

**Non-Goals**:

- CLI コマンド結線（check / check --request / exit code / stdout 整形）
- rules export / diff / state.json / prompt / plan
- ビュー型スキーマの定義
- `tools/check.sh` の削除・置換（共存のまま）

## Decisions

### D1: ParseResult を拡張して actorIds / elementItems を含める

`ParseResult` に `actorIds` と `elementItems` フィールドを追加する。`parser.ts` の `parseFiles` 内で `extractStructuredLines` の結果からこれらを集約する。

**Rationale**: graph / check が `ParseResult` のみを入力とする純関数であるために、必要な構造化データがすべて `ParseResult` に含まれている必要がある。`extractStructuredLines` を graph/check が直接呼ぶのは `mod-graph -> mod-parse` の依存方向（`design/static/dependencies.md` で許可済み）に合致するが、パース結果の分散を避けるために統合する。

**代替**: graph が `extractStructuredLines` を直接呼ぶ — パース結果が `ParseResult` と個別呼び出しに分散し、呼び出し側のコードが複雑化する。

### D2: graph モジュールの設計 — ElementTable + ReferenceIndex

`src/graph/` のコア型:

```
ElementTable: Map<string, Element>     // ID → Element の索引
ReferenceIndex: {
  bySource: Map<string, Reference[]>   // ファイルパス → そのファイルからの参照
  byTarget: Map<string, Reference[]>   // ターゲット ID → その ID への参照
  all: Reference[]                      // 全参照のフラット配列
}
```

`buildGraph(parsed: ParseResult): Graph` が公開 API。`Graph` は `ElementTable` + `rawElements: Element[]`（宣言順の生配列。Map 構築時に重複 ID が上書き消失するため、C2 の重複検出はこちらを走査する）+ `ReferenceIndex` + `DependencyEdge[]` + `actorIds` + `elementItems` + `manifestPath: string | null` を束ねる構造。解析済み `Manifest` オブジェクトは含まない — `parseManifest()` で別途生成し `runCheck` に渡す。

また `src/graph/index.ts` は `validateId` / `KNOWN_PREFIXES` を `src/parse/` から re-export する。check の C1 はこの re-export を経由して参照し、`src/check/` から `src/parse/` への直接 import を作らない（許可依存は `mod-check → mod-graph → mod-parse` の経路のみ）。

**Rationale**: check の各規則が「ID で要素を引く」「特定 ID への参照を列挙する」「全参照を走査する」の 3 パターンでアクセスする。索引を事前構築することで規則評価が O(1) / O(n) になる。

**代替**: ParseResult をそのまま渡して check 側で毎回 find する — O(n²) で規則数 × 要素数の積が効く。

### D3: manifest 解釈と型テーブルの設計

manifest の `enabled` リストは `ParseResult.frontmatters` から `design/manifest.md` のレコードを取得し、`enabled` キーの値（`string[]`）を読む。

型テーブルはコード内の宣言的定数として定義する:

```
LAYER_MAP: prefix → layer
  mod → static, term/ent/inv → domain, seq → dynamic
  top/plan/grp → loop, adr → always
  uc/scr/api/dat/flow/evt/ext/perm/dpl → views

LAYER_PREREQUISITES: layer → 前提 layer[]
  domain → [static], dynamic → [static], loop → [static]
  各ビュー型 → ビュー型固有の前提（uc は dynamic が前提、等）

LAYER_ALLOWED_REFS: layer → 参照可能な prefix[]
  domain → [term, ent, inv]
  static → [mod, term, ent, inv]
  dynamic → [seq, mod, term, ent, inv]
  loop, adr → 制限なし（全 prefix）

VIEW_ENABLED_NAME_TO_PREFIX: enabled に現れるビュー型名 → prefix
  use-case → uc, screen → scr, api → api, data → dat, dataflow → flow,
  event → evt, external → ext, permission → perm, deployment → dpl
```

ビュー型は本 request 時点で未対応（C6 が fail-closed 診断を出す）ため、`getEnabledPrefixes` はビュー型の prefix を **enabledPrefixes に含めない**。ビュー要素の参照解決を無言で許すと C6 の診断と矛盾するためである。

**Rationale**: ADR-0002「型はツールの知識であり、設定可能にすると閉包の意味が揺れる」に従い、宣言的テーブルをソースに埋め込む。テーブルの変更は仕様変更であり、コード変更として追跡される。

**代替**: manifest でユーザー定義可能にする — 却下済み（architect 評価）。

### D4: check モジュールの設計 — 規則ごとの関数 + 集約

`src/check/` の構成:

```
src/check/
  types.ts          # CheckDiagnostic 型、CheckResult 型
  manifest.ts       # manifest 解釈（enabled 解析、前提関係検証）
  rules/
    c01-id-grammar.ts
    c02-id-unique.ts
    c03-ref-resolved.ts
    c04-dep-endpoints.ts
    c05-seq-actors.ts
    c06-view-links.ts
    c07-manifest-prerequisites.ts
    c08-state-keys.ts
    c09-adr-topics.ts
    c10-plan-elements.ts
    c11-layer-direction.ts
  checker.ts        # 集約: 有効規則のみ評価して診断配列を返す
  index.ts          # re-export
```

各規則関数は**必要な入力のみを取り、共通シグネチャを強制しない**（C2 は `graph` のみで `graph.rawElements` を走査、C3・C11 は `enabledPrefixes: Set<string>` を追加で取る、C6・C7 は `manifest` のみ、C8 は `stateKeys: string[]` を取る、等。正確なシグネチャは tasks.md の各タスク定義に従う）。

`checker.ts` の `runCheck(graph, manifest, stateKeys?)` が段階縮退を適用し、有効な規則のみを規則ごとの必要引数で呼び出して全診断を集約する。

**Rationale**: 規則ごとにファイルを分離することで、テストが規則単位で書ける。集約関数が段階縮退を制御するため、各規則は「自分が呼ばれたなら評価する」だけでよい。

**代替**: 全規則を 1 ファイルに書く — 規則数が 11 あり、1 ファイルが肥大化する。テストの粒度も粗くなる。

### D5: CheckDiagnostic の設計

```
CheckDiagnostic {
  level: "error" | "warning"    // 診断レベル
  code: string                  // "C1" 〜 "C11"
  elementId: string | null      // 関連要素の ID（参照不在の場合など null）
  message: string               // 人向けメッセージ
  file: string                  // 発生箇所のファイル
  line: number                  // 発生箇所の行番号
}
```

`spec/integration.md` §1 の出力形式（`<LEVEL> <CODE> <id> <message>`）への整形は CLI 層の責務（次 request）。check モジュールは構造体を返すのみ。

**Rationale**: 出力整形を check から分離することで、check は純関数の性質を保つ。CLI 層が用途に応じて整形を選択できる（stderr 向け、JSON 向け等）。

**代替**: check が整形済み文字列を返す — CLI 側の柔軟性が失われる。

### D6: 段階縮退の実装方針

`checker.ts` が manifest の `enabled` から有効な層（layer）を算出し、規則ごとに「この規則を評価するか」を判定する:

| 規則 | 評価条件 |
|------|---------|
| C1, C2 | 常時 |
| C3 | 常時。ただし**参照元・参照先のどちらか**の prefix が無効な型に属する参照は診断しない |
| C4 | static 有効時 |
| C5 | dynamic 有効時 |
| C6 | ビュー型が enabled に含まれる場合（現在は fail-closed） |
| C7 | 常時（enabled の組み合わせ自体を検証） |
| C8, C9, C10 | loop 有効時 |
| C11 | 有効な層に属する要素のみ対象 |

**Rationale**: 「無効な型の義務は評価しない」という段階縮退の原則に基づく。C3 については、参照先が無効な型に属する場合（その型自体が評価対象外）に加え、**参照元の要素が無効な型に属する場合**も診断しない — 無効層の文書が持つ義務を評価しないという原則の一貫した適用である。

### D7: C11 層間参照方向の詳細ルール

`spec/format.md` §10 の C11:

| 参照元の層 | 参照可能な prefix |
|-----------|-----------------|
| domain (term/ent/inv) | term, ent, inv のみ |
| static (mod) | mod, term, ent, inv |
| dynamic (seq) | seq, mod, term, ent, inv |
| loop (top/plan/grp) | 制限なし |
| adr | 制限なし |

`tools/check.sh` は domain → domain のみを検証しているが、本実装では全有効層の方向を検証する。

**Rationale**: 仕様に忠実な実装。check.sh は暫定であり、domain のみの検証は最低限の実装だった。

### D8: state.json は check モジュールが直接読まない

C8（state.json のキーが実在要素に解決される）の評価には state.json の内容が必要だが、state.json の読み込みは `mod-state` の責務。本 request では state.json の内容を `Graph` に含めるのではなく、check 関数が state.json の内容をオプショナルな引数として受け取る設計とする。

`runCheck(graph: Graph, manifest: Manifest, stateKeys?: string[]): CheckDiagnostic[]`

state.json のパースは `check` モジュールの外で行い、キーの配列として渡す。本 request では state.json パーサは最小実装（JSON.parse のラッパー）とする。

**Rationale**: `mod-check -> mod-state` の依存は `design/static/dependencies.md` に存在しない。check が state を import すると設計の依存方向に違反する。キーの配列として受け取ればこの問題を回避できる。

**代替**: `mod-check -> mod-state` の依存を設計に追加する — 設計変更が必要になるため本 request のスコープを超える。

## Risks / Trade-offs

- **[Risk] ParseResult 拡張による既存テスト影響** → 新フィールド追加は後方互換（既存コードは新フィールドを無視する）。既存テストの assert 対象フィールドには影響しない。
- **[Risk] C3 の有効型判定と参照解決の整合** → 参照先 ID の prefix から型を判定し、その型が有効かを確認する。未知の prefix を持つ参照は常にエラーとする（C1 で検出済みのため二重報告を避ける設計にする）。
- **[Risk] state.json が存在しない場合の C8** → state.json は loop 有効時のみ評価。state.json が無ければ stateKeys を空配列として渡し、C8 は自明に成立（キーが 0 件なので残骸なし）。
- **[Trade-off] 規則ごとのファイル分割によるファイル数増加** → 11 ファイルが増えるが、各ファイルは単一関数で小さい。テスト粒度とのトレードオフとして許容する。

## Open Questions

（なし — architect 評価済みの設計判断により主要な技術選択は確定済み）
