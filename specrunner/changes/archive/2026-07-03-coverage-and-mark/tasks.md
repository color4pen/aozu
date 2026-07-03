# Tasks: coverage / mark implemented

## T-01: mod-state に writeDesignState を新設する

src/state/writer.ts に state.json の書き込み関数を実装する。spec/format.md §9 の書式（辞書順ソート・1 要素 1 行）に厳密適合する。

- [x] src/state/writer.ts を新規作成する
- [x] `writeDesignState(designDir: string, stateMap: StateMap): Promise<void>` を実装する:
  - `${designDir}/state.json` にファイル名を閉じる（readDesignState と対称）
  - キーを `Object.keys(stateMap).sort()` で辞書順にソートする
  - 手組み JSON で 1 要素 1 行の書式を出力する。各エントリは `  "${key}": ${JSON.stringify(value)}` の形式
  - 空の stateMap は `{}` 形式（1 行、`{}\n`）で書く。展開形式 `{\n}` は使わない。ただし state.json が存在しなければファイルを作らない（全 designed のデフォルトに一致）
- [x] src/state/index.ts に `writeDesignState` の re-export を追加する
- [x] src/state/writer.test.ts を新規作成し、以下のテストを実装する:
  - round-trip テスト: writeDesignState → readDesignState で元の StateMap と一致する
  - 辞書順ソートテスト: 出力ファイルのキー順が辞書順である
  - 1 要素 1 行テスト: 出力ファイルの行数が `エントリ数 + 2`（開き `{` と閉じ `}`）である
  - pr フィールド付きエントリの round-trip テスト
  - 空の stateMap テスト

**Acceptance Criteria**:
- writeDesignState が src/state/writer.ts に存在し、src/state/index.ts から re-export されている
- round-trip テストが green（readDesignState で書き戻した結果が元と一致）
- 辞書順ソート・1 要素 1 行がテストで固定されている
- T-03 invariant test（src/state/ 以外での state.json 書き込み禁止）に違反しない

## T-02: coverage の検証ロジックを mod-plan に新設する

src/plan/coverage.ts に被覆検証の純粋関数を実装する。

- [x] `CoverageDiagnostic` 型を定義する: `{ level: "error" | "warning"; code: string; elementId: string; message: string }`
- [x] `CoverageResult` 型を定義する: `{ pass: boolean; errors: CoverageDiagnostic[]; warnings: CoverageDiagnostic[] }`
- [x] `GroupGraph` 型を定義する: `{ groupElements: Map<string, Set<string>>; afterEdges: Set<string> }`
- [x] `verifyCoverage(groupElementIds: string[], draftRefs: Set<string>, graph: Graph, stateMap: StateMap, groupGraph: GroupGraph): CoverageResult` を実装する:
  - (a) 被覆検証: groupElementIds の各 ID が draftRefs に含まれるか検査。不在は error
  - (b) 実在検証: groupElementIds の各 ID が graph.elements に存在するか検査。不在は error
  - (c) 状態検証: groupElementIds の各 ID の stateMap エントリが designed（またはエントリなし）か検査。requested/implemented は error（adr/0018-4）
  - (d) クロスグループ参照辺診断: 対象グループの要素が別グループの要素を参照していて after: で結ばれていなければ warning
  - errors が 1 件以上なら pass = false
- [x] src/plan/coverage.test.ts を新規作成し、以下のテストを実装する:
  - 全要素が被覆された場合に pass = true
  - 1 件の引用漏れで pass = false、漏れた ID が errors に含まれる
  - requested 要素を含む場合に pass = false
  - implemented 要素を含む場合に pass = false
  - graph に存在しない要素を含む場合に pass = false
  - クロスグループ参照辺 + after なしで warnings に診断が含まれるが pass = true（被覆が満ちている場合）
  - クロスグループ参照辺 + after ありで warnings が空

**Acceptance Criteria**:
- verifyCoverage が src/plan/coverage.ts に存在する
- 被覆・実在・状態・クロスグループの 4 検証がテストで固定されている
- pass = false 時に errors が具体的な ID を含む
- warnings は pass に影響しない

## T-03: coverage コマンド handler を実装する

src/cli/commands/coverage.ts に coverage コマンドの handler を実装する。

- [x] `handleCoverage(args: string[]): Promise<number>` を実装する:
  - `--help` / `-h` で usage を stderr に出力して return 0
  - `--group <grp-id>` をパース。不足は return 2
  - `--draft <path>` をパース。不足は return 2
  - `--request <slug>` をパース。不足は return 2
  - `--dir <path>` をパース（デフォルト: `./design`）
  - design ディレクトリ存在チェック → 不在は return 2
  - draft ファイル存在チェック → 不在は return 2
  - slug 文法チェック（`[a-z0-9]+(-[a-z0-9]+)*`）→ 不適合は return 2
- [x] パイプラインの実行:
  - `readMarkdownFiles` → `parseFiles` → `buildGraph` → `parseManifest`
  - `isLayerEnabled("loop", manifest)` → false なら stderr に案内出力して return 1
  - グループ要素の収集: graph.elementItems から対象 grp の要素 ID を特定する（prompt.ts と同じパターン: 同一ファイル内で直前の grp 要素を探す）
  - グループ不在 → return 2
  - draft ファイルを読み、`extractReferences(content, draftPath)` で `[[id]]` を抽出し、targetId の Set を構築する
  - `readDesignState` で state.json を読む
  - GroupGraph の構築: 全 plan ファイルからグループ→要素のマッピングと after: 辺を抽出する
  - `verifyCoverage` を呼ぶ
- [x] 結果の処理:
  - result.warnings を stderr に出力する
  - result.pass === false の場合: result.errors を stderr に出力して return 1
  - result.pass === true の場合: グループ要素を requested に遷移し request slug を記録した新しい stateMap を構築して `writeDesignState` で書き込む。遷移件数を stderr に出力して return 0
- [x] stdout には何も書かない

**Acceptance Criteria**:
- handleCoverage が export されている
- 各引数の不在が exit 2 を返す
- loop 無効が exit 1 を返す
- verifyCoverage の結果に基づいて遷移 or 不変が正しく動作する
- 診断が stderr に出力される
- stdout に何も出力しない

## T-04: coverage コマンドの統合テスト

src/cli/commands/coverage.test.ts を新規作成する。fixture は tmpdir に設計ディレクトリを構築する方式。

- [x] fixture ヘルパーの作成: loop 有効の manifest・plan ファイル（1 グループ）・対象要素の設計文書・state.json を生成する関数
- [x] 正常系テスト（被覆完全）:
  - draft が全要素を引用した場合に exit 0
  - state.json でグループ全要素が `{ state: "requested", request: "<slug>" }` になっている
- [x] 引用漏れテスト:
  - draft が 1 件引用漏れの場合に exit 1
  - 漏れた ID が stderr に含まれる
  - state.json が不変
- [x] 状態検査テスト:
  - グループに requested 要素を含む場合に exit 1、state.json 不変
  - グループに implemented 要素を含む場合に exit 1、state.json 不変
- [x] コードフェンステスト:
  - `[[id]]` がコードフェンス内にのみ存在する場合に exit 1（被覆に数えない）
- [x] クロスグループ参照辺テスト:
  - 2 グループ間に参照辺があり after なしの場合、被覆が満ちていれば exit 0 で stderr に警告
- [x] loop 無効テスト:
  - manifest に loop がない場合に exit 1
- [x] 入力不正テスト:
  - draft 不在 → exit 2
  - グループ不在 → exit 2
  - slug 文法違反 → exit 2
  - design ディレクトリ不在 → exit 2

**Acceptance Criteria**:
- 受け入れ基準の coverage 関連項目がすべてテストで固定されている
- 各テストが green

## T-05: mark implemented コマンド handler を実装する

src/cli/commands/mark.ts に mark コマンドの handler を実装する。

- [x] `handleMark(args: string[]): Promise<number>` を実装する:
  - `--help` / `-h` で usage を stderr に出力して return 0
  - `args[0]` をサブコマンドとして取得。`implemented` 以外 / 不足は stderr にエラー出力して return 2
  - `implemented` の場合、`handleMarkImplemented(args.slice(1))` に委譲
- [x] `handleMarkImplemented(args: string[]): Promise<number>` を実装する:
  - `--request <slug>` をパース。不足は return 2
  - `--pr <番号>` をパース（任意。数値変換）
  - `--dir <path>` をパース（デフォルト: `./design`）
  - design ディレクトリ存在チェック → 不在は return 2
- [x] パイプラインの実行:
  - `readMarkdownFiles` → `parseFiles` → `parseManifest`
  - `isLayerEnabled("loop", manifest)` → false なら stderr に案内出力して return 1
  - `readDesignState` で state.json を読む
  - stateMap 中で `entry.request === slug` の全エントリを収集（状態を問わない）
  - 一致 0 件 → stderr に「unknown slug」出力して return 1
  - 全件 `state === "implemented"` → stderr に「all already implemented」出力して return 0（no-op、冪等）
  - requested エントリを全て `{ state: "implemented", request: slug, pr: prNumber }` に更新した新しい stateMap を構築
  - `writeDesignState` で書き込み
  - 遷移件数を stderr に出力して return 0
- [x] 部分適用状態を作らない: stateMap のコピーを変更してから一括書き込みする
- [x] stdout には何も書かない

**Acceptance Criteria**:
- handleMark が export されている
- サブコマンド `implemented` のみ受け付ける
- spec/integration.md §2 の契約に厳密適合する（冪等・slug 一致判定・部分適用禁止）
- 診断が stderr に出力される

## T-06: mark implemented コマンドの統合テスト

src/cli/commands/mark.test.ts を新規作成する。

- [x] fixture ヘルパーの作成: loop 有効の manifest・requested 状態の state.json を生成する関数
- [x] 正常遷移テスト:
  - requested 要素 2 件を mark implemented → exit 0、両方 implemented に遷移
  - `--pr` 付きで pr フィールドが記録される
- [x] 冪等再実行テスト:
  - 全件 implemented 済みの状態で再実行 → exit 0、state.json 不変
- [x] 未知 slug テスト:
  - stateMap に存在しない slug で実行 → exit 1
- [x] 混在テスト:
  - requested と implemented が混在する slug で実行 → exit 0、requested のみ遷移、implemented は不変
- [x] loop 無効テスト:
  - manifest に loop がない場合に exit 1
- [x] 入力不正テスト:
  - slug 引数不足 → exit 2
  - design ディレクトリ不在 → exit 2
  - サブコマンド不正 → exit 2

**Acceptance Criteria**:
- 受け入れ基準の mark 関連項目がすべてテストで固定されている
- 各テストが green

## T-07: openTopics の計算導出に置換する（ADR-0018-3）

src/plan/frontier.ts の openTopics 計算を frontmatter `status` 依存から計算導出に変更する。

- [x] computeFrontier のシグネチャを変更する（design.md D9 と同一の 5 パラメータ）:
  - 旧: `computeFrontier(graph, stateMap, enabledPrefixes, frontmatters)`
  - 新: `computeFrontier(graph, stateMap, enabledPrefixes, addressedTopics: Set<string>, frontmatters)`
- [x] openTopics の計算ロジックを変更する:
  - 旧: frontmatter の `status === "open"` で判定
  - 新: graph.elements 中の全 top 要素のうち、`addressedTopics` に含まれないものを openTopics とする
  - `source` フィールドは top 要素自身の frontmatter から取得する（addressedTopics の計算とは独立）
- [x] NOTE コメント（frontier.ts:63-69）を除去する
- [x] Frontier 型の openTopics の source フィールド取得ロジックを維持する。source は引き続き top 要素ファイルの frontmatter から取得するため、**frontmatters パラメータは残す**（判断済み — design.md D9。除去すると status 出力から出典が無音で消える回帰になる）

  **判断**: source 取得のために frontmatters を残す。ただしパラメータ名は意味を明確にするため、シグネチャを `computeFrontier(graph, stateMap, enabledPrefixes, addressedTopics, frontmatters)` とする（addressedTopics を追加、frontmatters は source 専用に残す）。

- [x] src/cli/commands/status.ts の wrapper `computeFrontier` を更新する:
  - frontmatters から addressed topics を抽出する関数 `extractAddressedTopics` を status.ts 内に実装する
  - wrapper 内で `extractAddressedTopics(frontmatters, graph)` を呼び、結果を `computeFrontierImpl` に渡す
- [x] `extractAddressedTopics` の実装:
  - graph.rawElements から prefix === "adr" の要素のファイルパスを収集
  - 各 adr ファイルの frontmatter `topics:` 値を取得
  - 値が文字列なら `extractReferences(value, "<synthetic>")` を呼び、targetId が `top-` で始まるものを収集
  - 値が配列なら各要素に同様の処理を行う
  - 結果の Set<string> を返す

**Acceptance Criteria**:
- openTopics の計算が ADR frontmatter topics: ベースになっている
- NOTE コメントが除去されている
- frontmatter の `status` フィールドを読まない
- source フィールドは引き続き取得できる

## T-08: openTopics 関連の既存テスト更新

frontier.ts / status.ts のテストを計算導出の新しい意味論に合わせて更新する。

- [x] status.test.ts の openTopics 関連テストを更新する:
  - fixture に ADR ファイルの `topics:` frontmatter を追加する
  - `topics:` で引用された top が openTopics に含まれないことを検証する
  - `topics:` で引用されていない top が（旧 `status: addressed` frontmatter があっても）openTopics に含まれることを検証する
  - `topics:` で引用されていない top が（旧 `status: open` frontmatter がなくても）openTopics に含まれることを検証する
- [x] 新規テストの追加:
  - ADR の topics: に引用された top がフロンティアから消えることを検証する
  - 引用のない top が（旧 status: frontmatter の値に依らず）open と表示されることを検証する

**Acceptance Criteria**:
- openTopics の新しい意味論がテストで固定されている
- 旧 status frontmatter が結果に影響しないことがテストで固定されている

## T-09: scaffold の topic テンプレートから status 行を除去する

src/cli/commands/scaffold.ts の `topicTemplate` 関数を修正する。

- [x] `topicTemplate` 関数から `status: open` 行を除去する:
  - 変更前: `---\nid: ${id}\nstatus: open\n---`
  - 変更後: `---\nid: ${id}\n---`
- [x] scaffold.test.ts の topic テンプレート関連テストを更新する:
  - topic 生成物に `status` 行が無いことを検証するテストを追加（または既存テストを更新）
  - 既存の scaffold 正常系テストが green であることを確認する

**Acceptance Criteria**:
- topicTemplate の出力に `status:` 行が含まれない
- scaffold テストが green

## T-10: main.ts への coverage / mark コマンド登録

src/cli/main.ts に coverage と mark コマンドを登録する。

- [x] `import { handleCoverage } from "./commands/coverage.ts"` を追加
- [x] `import { handleMark } from "./commands/mark.ts"` を追加
- [x] `register(registry, "coverage", handleCoverage, "verify draft coverage and transition to requested")` を追加
- [x] `register(registry, "mark", handleMark, "transition element states")` を追加

**Acceptance Criteria**:
- `aozu --help` の出力に coverage / mark が表示される
- `aozu coverage --help` / `aozu mark --help` がそれぞれ usage を表示する

## T-11: design/rules.json の再 export

design/static/modules.md の mod-state 責務行と dependencies の整合を確認し、rules.json を再 export する。

- [x] design/static/modules.md の mod-state 責務行が「読み書き」を反映しているか確認する（現在の「読み書きと状態遷移」は既に正確。変更不要なら skip）
- [x] `bun src/cli/main.ts export rules --out design/rules.json` を実行して rules.json を更新する
- [x] `bun src/cli/main.ts export rules --verify` が exit 0 であることを確認する

**Acceptance Criteria**:
- `export rules --verify` が exit 0

## T-12: 全体回帰テスト

既存テストと設計整合性の最終確認。

- [x] `tsc --noEmit` が green であることを確認する
- [x] `bun test` が全テスト green であることを確認する
- [x] `bun src/cli/main.ts check` が exit 0 であることを確認する（本リポジトリの design/ に対して）
- [x] `bun src/cli/main.ts export rules --verify` が exit 0 であることを確認する
- [x] `package.json` の `dependencies` が空のままであることを確認する
- [x] 新規ファイルの import が許可依存に違反しないことを確認する:
  - src/state/writer.ts（mod-state）: 外部依存なし（StateMap 型は同モジュール内）
  - src/plan/coverage.ts（mod-plan）: mod-plan -> mod-graph（Graph 型）は許可済み。mod-plan -> mod-state（StateMap 型）は許可済み
  - src/cli/commands/coverage.ts（mod-cli）: mod-cli -> mod-plan / mod-parse / mod-graph / mod-check / mod-state / mod-fsread（全て許可済み）
  - src/cli/commands/mark.ts（mod-cli）: mod-cli -> mod-parse / mod-check / mod-state / mod-fsread（全て許可済み）
- [x] 既存テストは、意味論変更の対象（openTopics 系・scaffold topic 系）の更新を除き無変更で green
- [x] architecture.test.ts が green であることを確認する

**Acceptance Criteria**:
- 既存テスト（openTopics / scaffold 以外）が無変更で green
- 新規テストも green
- `tsc --noEmit` green
- `check` exit 0、`export rules --verify` exit 0
- `dependencies` 空
- architecture test green

## 依存関係

```
T-01 (writer) ─────────────────────────┐
T-02 (coverage 検証ロジック) ──────────┤
                                       ├─ T-03 (coverage handler) ─── T-04 (coverage テスト)
                                       │
                                       ├─ T-05 (mark handler) ─── T-06 (mark テスト)
T-07 (openTopics 計算導出) ────────────┤
                                       ├─ T-08 (openTopics テスト更新)
T-09 (scaffold topic 修正) ────────────┤
                                       │
T-01〜T-09 ────────────────────────────┴─ T-10 (main.ts 登録) ─── T-11 (rules 再export) ─── T-12 (全体回帰)
```

T-01（writer）と T-02（coverage 検証ロジック）は互いに独立で並列実行可能。T-07（openTopics）と T-09（scaffold）も独立。T-03 は T-01 + T-02 に依存（writer と検証ロジックが必要）。T-05 は T-01 に依存（writer が必要）。T-10〜T-12 は全タスク完了後。
