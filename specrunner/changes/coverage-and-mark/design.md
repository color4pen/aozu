# Design: coverage / mark implemented

## Context

aozu の状態機械 designed -> requested -> implemented（ADR-0005）に書き込み経路を立てる。

現状、state.json の reader は src/state/reader.ts に実装済みだが writer は存在しない。tests/invariants.test.ts T-03 がファイル書き込み API と `state.json` 文字列の共起を src/state/ 以外で禁じており、writer は必ず src/state/ に配置する必要がある。

`coverage` は plan グループの全要素が request 草稿に引用されていることを検証し、合格時に designed -> requested へ遷移する。`mark implemented` は取り込み完了 hook から呼ばれ、requested -> implemented へ遷移する。これらが結線されると状態機械が一周する。

加えて、src/plan/frontier.ts:63-77 の openTopics 計算が frontmatter `status === "open"` に依存する暫定実装（NOTE コメントで明示済み）を、ADR-0018-3 の計算導出（「ADR の `topics:` frontmatter から引用された top は addressed」）に置換する。scaffold の topic テンプレートから `status: open` 行を除去する追随もここで行う。

関連する既存コードの制約:

- `readDesignState(designDir)` が state.json のファイル名知識をカプセル化するパターンを確立済み。writer も `writeDesignState(designDir, stateMap)` で同じ形にする
- draft からの `[[id]]` 抽出は check --request が spec §6 のコード除外規則（extractReferences）で実装済み。coverage は同じ関数を使う
- plan のグループ要素は graph.elementItems に file/line 付きで格納されており、グループの特定には同一ファイル内で直前の grp 要素を探す手法が prompt.ts で確立済み
- 2 語コマンド `mark implemented` は `prompt derive` と同じサブコマンド分岐パターンで処理できる
- adr frontmatter の `topics:` 行の `[[top-*]]` は extractReferences が拾い graph.references.bySource に載る。ただし本文中の文脈引用も含まれるため、openTopics の計算導出では frontmatter の生値（parsed.frontmatters）から厳密抽出する必要がある

## Goals / Non-Goals

**Goals**:

- G1: mod-state に writeDesignState を新設し、spec/format.md §9 の書式（辞書順ソート・1 要素 1 行）に厳密適合する writer を提供する
- G2: `aozu coverage --group <grp-id> --draft <path> --request <slug>` で被覆検証 + designed -> requested 遷移を実装する
- G3: `aozu mark implemented --request <slug> [--pr <番号>]` で requested -> implemented 遷移を実装する（spec/integration.md §2 の契約に厳密適合）
- G4: openTopics の計算を frontmatter `status` 依存から ADR frontmatter `topics:` 厳密抽出による計算導出に置換する（ADR-0018-3）
- G5: scaffold の topic テンプレートから `status: open` 行を除去する（spec §8 追随）
- G6: 状態遷移コマンドの段階ゲート（loop 無効時は exit 1）を実装する

**Non-Goals**:

- designed への戻り遷移の機構（docs/open-questions.md 論点 12）
- plan の `status: derived` の書き込み・計算
- coverage による draft 側の「グループ外引用」の検証
- C9 の判定を bySource 近似から frontmatter 厳密抽出に揃えること
- `diff` / `trace` / `prompt session` / `prompt propagate` / `prompt review`

## Decisions

### D1: writer の配置と書式 — mod-state に writeDesignState を新設

src/state/writer.ts に `writeDesignState(designDir: string, stateMap: StateMap): Promise<void>` を新設する。

出力書式:
- JSON オブジェクトのキーを辞書順（`Object.keys(stateMap).sort()`）にソートする
- 1 要素 1 行で書き出す（`JSON.stringify` の replacer + space によるフォーマットではなく、手組みで行レイアウトを制御する。`JSON.stringify` の space=2 は値オブジェクト内で改行するため 1 要素 1 行にならない）
- ファイルパスは `${designDir}/state.json` とし、ファイル名の知識は writer 内に閉じる
- 空の stateMap（`{}`）はファイルを書かない（全 designed のデフォルトに一致させ不要ファイルを生まない）。ただし既存ファイルがある場合は `{}` で上書きする（全 implemented 後の designed への巻き戻し等で stateMap が空になるケースに備える。ただし本 request では巻き戻しはスコープ外なので、この分岐に入ることはない。将来安全性のため定義しておく）

readDesignState との round-trip をテストで固定する。

state/index.ts に writeDesignState の re-export を追加する。

**Rationale**: state.json のファイル名・書式の知識を mod-state に閉じ、T-03 invariant に適合する。`readDesignState` と対称な API にすることでカプセル化の一貫性を保つ。

**Alternatives considered**: handler から直接 Bun.write → T-03 violation。JSON.stringify(stateMap, null, 2) → 値オブジェクト内で改行し 1 要素 1 行にならない（spec §9 違反）。

### D2: writeDesignState の書式 — 手組み JSON

spec/format.md §9 の「1 要素 1 行」要件を厳密に満たすため、JSON.stringify のインデント機能を使わず手組みで行レイアウトを制御する。

具体的な出力形式:
```json
{
  "ent-order": { "state": "requested", "request": "order-model-rework" },
  "mod-cli": { "state": "implemented", "request": "cli-split", "pr": 123 }
}
```

各エントリは `  "${key}": ${JSON.stringify(value)}` の 1 行にする。キーは辞書順にソートし、末尾カンマ（trailing comma）は付けない（標準 JSON）。最終行の閉じ `}` は改行して独立行にする。

**Rationale**: spec §9 が「1 要素 1 行」を規定。並列作業時の merge 衝突を「同一要素を触った場合のみ」に局所化する設計意図を実装で保証する。

### D3: coverage コマンドの配置 — mod-cli の handler + mod-plan の検証ロジック

coverage コマンドは2つの責務を持つ: (a) 被覆検証・状態検査・依存辺診断、(b) 状態遷移の書き込み。

(a) の検証ロジックは src/plan/coverage.ts に純粋関数として配置する。mod-plan -> mod-graph と mod-plan -> mod-state は許可済み。(b) の書き込みは src/cli/commands/coverage.ts の handler が writeDesignState を呼ぶ。

coverage の検証関数シグネチャ:
```typescript
interface CoverageResult {
  pass: boolean;
  errors: CoverageDiagnostic[];
  warnings: CoverageDiagnostic[];
}

function verifyCoverage(
  groupElementIds: string[],
  draftRefs: Set<string>,
  graph: Graph,
  stateMap: StateMap,
  groupGraph: GroupGraph  // クロスグループ参照辺診断用
): CoverageResult;
```

handler は verifyCoverage の result.pass が true の場合のみ、グループ要素を requested に遷移して writeDesignState を呼ぶ。全遷移 or 全不変を保証する（result.pass が false なら state.json に触れない）。

**Rationale**: 検証ロジックを純関数に閉じることでテスト容易性を確保し、IO（ファイル読み書き）は composition root（mod-cli）に集約する。mod-plan の責務（coverage 検証）に自然に収まる。

**Alternatives considered**: mod-state に検証ロジックを配置 → mod-state -> mod-graph の依存が不許可。handler に全ロジック → テスト困難・責務肥大。

### D4: coverage の被覆検証 — extractReferences の再利用

draft ファイルからの `[[id]]` 抽出には既存の `extractReferences(content, filePath)` をそのまま使う。この関数は spec §6 のコード除外規則（コードフェンス・インラインコードを除外）を実装済みであり、check --request と同じ抽出ロジックを共有する。

handler（mod-cli）が draft ファイルを読み extractReferences を呼び、結果の targetId の Set を verifyCoverage に渡す。mod-cli -> mod-parse は許可済み。

**Rationale**: 同一の抽出規則の二重実装を避ける。check --request で確立済みの spec §6 適合ロジックを再利用する。

### D5: coverage の状態検査 — fail-closed

グループ elements の全要素に対し:
- graph に存在しない要素 → error（実在検証失敗。ただし C10 で通常は先に捕捉される）
- stateMap[id]?.state === "requested" → error（adr/0018-4: 要素は同時に 1 request にのみ属する）
- stateMap[id]?.state === "implemented" → error（同上。再実装は designed への戻りが前提であり、スコープ外）
- stateMap[id]?.state === "designed" または stateMap にエントリなし → ok

1 つでも error があれば result.pass = false（全不変）。

**Rationale**: adr/0018-4 の「要素は同時に 1 request にのみ属する」をツールが強制する。fail-closed にすることで、mark の上書き規則が不要になる（request.md architect 評価済み）。

### D6: coverage のクロスグループ参照辺診断 — 警告のみ

グループ要素が別グループの要素を参照している辺が存在し、かつその 2 グループ間に `after:` 順序制約がない場合、warning として診断する。不合格にはしない。

この診断にはグループ構造の解析が必要。handler 内でグラフからグループ→要素のマッピングを構築し、verifyCoverage に渡す。

情報構造:
```typescript
interface GroupGraph {
  /** 各グループの要素 ID 集合 */
  groupElements: Map<string, Set<string>>;
  /** after: で結ばれたグループ対 (from -> to の Set) */
  afterEdges: Set<string>; // "grp-a->grp-b" の形式
}
```

after: 行はパース結果の graph.references から取得する。plan ファイル内の grp 要素から grp-* への参照が after: 辺に相当する。

**Rationale**: 読み取り専用の参照など正当な並列分割でも辺は残り得るため、不合格にすると偽陽性が多い。順序判断は人の領分（request.md architect 評価済み）。

### D7: mark implemented の配置と契約 — spec/integration.md §2 厳密適合

src/cli/commands/mark.ts に `handleMark(args: string[]): Promise<number>` を実装する。サブコマンド `implemented` のみを受け付ける。

処理フロー:
1. `--request <slug>` を取得
2. readDesignState で state.json を読む
3. stateMap 中で `request === slug` の全エントリを収集（状態を問わない）
4. 一致 0 件 → exit 1（未知の slug）
5. loop 無効 → exit 1
6. 全件 implemented 済み → no-op で exit 0（冪等）
7. requested のエントリを全て implemented に遷移。`--pr` があれば pr フィールドを記録
8. writeDesignState で書き込み
9. 遷移件数を stderr に出力

部分適用状態を作らない: step 7 は stateMap のコピーを変更し、完成後に一括書き込みする。

**Rationale**: spec/integration.md §2 が「slug 一致（状態不問）で判定」「requested のみ遷移」「全件 implemented 済みは no-op exit 0」「一致 0 件は exit 1」「部分適用状態を作らない」を明示的に規定しており、これに厳密適合する。

### D8: openTopics の計算導出 — ADR frontmatter topics: の厳密抽出

src/plan/frontier.ts の openTopics 計算を以下に置換する:

1. 全 adr 要素のファイルの frontmatter から `topics:` の値を取得する（parsed.frontmatters）
2. `topics:` の値（文字列またはカンマ区切り配列）から `[[top-*]]` パターンの ID を厳密抽出する（正規表現で `\[\[top-[a-z0-9-]+\]\]` を抽出）
3. 抽出された top-* ID の集合を "addressed" とする
4. graph.elements 中の全 top 要素のうち、addressed 集合に含まれないものを openTopics とする

この実装は `topics:` frontmatter の値のみを見る。ADR 本文中の `[[top-*]]` は addressed の根拠にしない。

frontmatter パース結果の型は `ParseResult["frontmatters"]` で、graph/index.ts 経由の re-export から取得する（mod-plan -> mod-graph は許可済み）。frontmatter の生値から `[[top-*]]` を抽出する正規表現は、参照文法の解釈ではなく frontmatter 値のパターンマッチであるため、src/parse/references.ts の extractReferences とは別の責務。ただし inv-single-reference-grammar（T-04）が `\\[\\[` パターンを src/parse/ 外で禁止しているため、抽出ロジックは以下のいずれかで対応する:

- 選択肢A: extractReferences を frontmatter 値に対して呼ぶ。extractReferences は行指向で `[[id]]` を抽出する汎用関数であり、frontmatter の値文字列を「1 行の content」として渡せば正しく動作する。mod-plan -> mod-parse は不許可だが、caller（mod-cli の handler）が extractReferences を呼んで結果を frontier 計算関数に渡す設計にすれば依存は発生しない
- 選択肢B: frontmatter 値をそのまま文字列として受け取り、正規表現なしで `[[` / `]]` のインデックス探索でパースする

**選択A を採用する**。computeFrontier のシグネチャに `addressedTopics: Set<string>` を追加し、caller（mod-cli の status handler / coverage handler）が frontmatter から抽出して渡す。computeFrontier 内部では `addressedTopics` を受け取るだけであり、参照文法の解釈を行わない。

これにより:
- mod-plan は参照文法の正規表現を持たない（T-04 の歯に適合）
- mod-cli（composition root）が extractReferences を使って frontmatter 値から top-* ID を抽出する
- computeFrontier は純粋関数のまま保たれる

**Rationale**: ADR-0018-3 の字義「topics: frontmatter から引用された top は addressed」を厳密に実装する。本文中の `[[top-*]]` を含めると偽陽性が発生する（C9 と同じ bySource 近似の問題）。

**Alternatives considered**: C9 と同じ bySource 近似 → ADR 本文中の `[[top-*]]` 文脈引用が addressed と誤判定される。

### D9: computeFrontier のシグネチャ変更

現在のシグネチャ:
```typescript
function computeFrontier(
  graph: Graph,
  stateMap: StateMap,
  enabledPrefixes: Set<string>,
  frontmatters: ParseResult["frontmatters"]
): Frontier;
```

変更後のシグネチャ:
```typescript
function computeFrontier(
  graph: Graph,
  stateMap: StateMap,
  enabledPrefixes: Set<string>,
  addressedTopics: Set<string>
): Frontier;
```

`frontmatters` パラメータを `addressedTopics: Set<string>` に置換する。openTopics の計算に frontmatter を直接読む必要がなくなるため、依存を削減する。

caller 側の変更:
- status.ts の `computeFrontier` wrapper: `frontmatters` の代わりに `addressedTopics` を計算して渡す
- status.ts の wrapper の型シグネチャも追随する（`frontmatters` → `addressedTopics` に変更するか、wrapper 内で frontmatters -> addressedTopics の変換を行う）

後方互換: status.ts の公開 wrapper `computeFrontier(graph, stateMap, manifest, frontmatters)` は caller に対して安定 API を維持する必要がある。wrapper 内で frontmatters から addressedTopics を計算し、内部の computeFrontierImpl に渡す形にする。

**Rationale**: computeFrontier の関心を「addressed の判定方法」から切り離し、caller が判定ロジックを注入する設計。frontmatter パース結果への依存を除去してテスト容易性を高める。

### D10: addressed topics の抽出ヘルパー — mod-cli に配置

frontmatter から addressed topics を抽出するヘルパー関数を用意する:

```typescript
function extractAddressedTopics(
  frontmatters: Map<string, Record<string, string | string[]>>,
  graph: Graph
): Set<string>;
```

処理:
1. graph.rawElements から prefix === "adr" の要素のファイルパスを収集
2. 各 adr ファイルの frontmatter から `topics:` の値を取得
3. 値が文字列ならその文字列から、配列なら各要素から `[[top-*]]` パターンを抽出
4. 抽出した top-* ID の Set を返す

配置場所: src/cli/commands/status.ts（status と coverage の両方が使う。coverage handler からは import する）。あるいは共通ユーティリティとして独立ファイルに切り出す。

`[[top-*]]` の抽出には extractReferences は使わない。frontmatter の値は単純な文字列であり、`/\[\[(top-[a-z0-9-]+)\]\]/g` で直接抽出できる。ただし T-04 の歯が `\\[\\[` パターンを src/parse/ 外で禁止しているため、この正規表現を src/cli/ に書くと歯テストに引っかかる可能性がある。

対策: `extractReferences(topicsValue, "<synthetic>")` を呼んで結果を `top-` prefix でフィルタする。extractReferences は src/parse/references.ts にあり、mod-cli -> mod-parse は許可済み。この方法なら src/cli/ に `\\[\\[` パターンの正規表現を書く必要がない。

**Rationale**: 参照文法の解釈を mod-parse に委ね、T-04 の歯に適合する。

### D11: coverage / mark のコマンド登録パターン

- `coverage` は 1 語コマンドとして registry に直接登録する
- `mark` は 1 語コマンドとして registry に登録し、handler 内で第 1 引数 `implemented` をサブコマンドとして dispatch する（`prompt derive` と同じパターン）

main.ts への追加:
```typescript
register(registry, "coverage", handleCoverage, "verify draft coverage and transition to requested");
register(registry, "mark", handleMark, "transition element states");
```

**Rationale**: registry の既存パターンに従う。mark は将来サブコマンドが追加される可能性があり、`mark implemented` のサブコマンド形式はその拡張点を提供する。

### D12: scaffold topic テンプレートの修正

src/cli/commands/scaffold.ts の `topicTemplate` 関数から `status: open` 行を除去する。

変更前:
```
---
id: ${id}
status: open
---
```

変更後:
```
---
id: ${id}
---
```

spec/format.md §8 の topic スキーマが既に `status` を持たない（計算導出）ことへの追随。

**Rationale**: spec §8 の topic スキーマに `status` フィールドが存在しないことに合わせる。既存 topic ファイルの `status: open` 残存は openTopics の計算導出（D8）により無視される。

### D13: exit code の体系

| コマンド | exit 0 | exit 1 | exit 2 |
|---|---|---|---|
| coverage | 合格（遷移済み） | 不合格 or loop 無効 | 入力不正（draft/group/dir 不在、slug 文法違反） |
| mark implemented | 遷移完了（no-op 含む） | 未知 slug or loop 無効 | 入力不正（slug/dir 不在） |

loop 無効は exit 1（ADR-0010 の段階ゲート = 検証不合格。plan / prompt derive と同クラス）。

**Rationale**: plan / prompt derive で確立済みの exit code 体系に揃える。

### D14: 診断出力の形式

coverage / mark の診断は stderr に 1 行 1 診断で出力する（spec/integration.md §5）。

coverage の診断形式:
- error: `COVERAGE ERROR <code> <element-id> <message>`
- warning: `COVERAGE WARN <code> <element-id> <message>`

mark の診断形式:
- error: `MARK ERROR <message>`

遷移結果の要約（何件遷移したか）は stderr に出す。stdout には何も書かない（成果物ではないため）。

## Risks / Trade-offs

- [Risk] writer の手組み JSON が JSON 仕様に厳密適合しないケース（特殊文字のエスケープ等） → Mitigation: 値オブジェクトは `JSON.stringify(entry)` で生成するため、値のシリアライズは標準 JSON に委ねる。手組みはキーの並べ替えとインデント（1 要素 1 行）のみ。readDesignState との round-trip テストで固定する
- [Risk] 既存テストの openTopics 系テストが意味論変更で壊れる → Mitigation: openTopics の計算基盤を変更するため、関連テストの fixture を ADR frontmatter topics: ベースに更新する。変更箇所は frontier.ts / status.ts / status.test.ts / frontier テスト（存在すれば）に限定される
- [Risk] coverage と check --request の `[[id]]` 抽出が異なる動作をするリスク → Mitigation: 同一の extractReferences 関数を使うことで動作を統一する
- [Risk] 並列 request で同一要素を coverage しようとした場合の競合 → Mitigation: adr/0018-4 の状態検査（D5）が requested/implemented 要素を拒否するため、2 番目の coverage は必ず exit 1 になる。git の衝突も安全弁として機能する

## Open Questions

- なし（設計判断は request の architect 評価で解決済み）
