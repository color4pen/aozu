# Tasks: designed への戻りの実装

## T-01: StateEntry 型拡張と writer のフィールド順保証

- [x] `src/state/types.ts`: `StateEntry` に `hash?: string` を追加する
- [x] `src/state/writer.ts`: `serializeEntry(entry: StateEntry): string` 内部ヘルパを追加する。`{ state, request?, pr?, hash? }` の順でオブジェクトを再構築し `JSON.stringify` する。undefined のフィールドは省略する
- [x] `src/state/writer.ts`: `writeDesignState` のエントリ直列化 `JSON.stringify(value)` を `serializeEntry(value as StateEntry)` に差し替える
- [x] 既存 writer テスト (`src/state/writer.test.ts`) が green であることを確認する
- [x] テスト追加: hash 付きエントリの round-trip（write → read → 一致）
- [x] テスト追加: フィールド順が `state, request, pr, hash` であることの検証（JSON 文字列パターンマッチ）
- [x] テスト追加: hash 無しエントリの出力に `hash` キーが含まれないことの検証

**Acceptance Criteria**:
- `StateEntry` に `hash?: string` が存在する
- `writeDesignState` の出力で hash フィールドが pr の後に出力される
- hash 無しエントリの出力に `hash` キーが含まれない
- 既存 writer テストが green

## T-02: 要素範囲抽出とハッシュ計算ヘルパ

- [x] `src/graph/body.ts`: `extractElementRange(elementId: string, graph: Graph, files: FileInput[]): string | null` を追加する
  - 見出し要素: `graph.elements` から同一ファイル内の全要素を取得し行番号ソート。当該要素の宣言行（`el.line - 1` 0-based）から次の要素の宣言行の直前まで（次の要素がなければファイル末尾まで）を `lines.slice(startIdx, endIdx).join("\n")` で返す
  - 文書要素: `fileInput.content` 全体を返す（frontmatter 含む）
  - 要素が見つからない / ファイルが見つからない場合は `null`
  - JSDoc に extractElementBody との範囲の違い（宣言行含む/含まない、帰属規則境界 vs 見出しレベル境界）を明記する
- [x] `src/graph/body.ts`: `computeElementHash(elementId: string, graph: Graph, files: FileInput[]): string | null` を追加する。`extractElementRange` の結果に `new Bun.CryptoHasher("sha256")` で SHA-256 hex を計算して返す。range が null なら null を返す
- [x] `src/graph/body.ts`: `computeAllHashes(ids: string[], graph: Graph, files: FileInput[]): Map<string, string>` を追加する。各 id に `computeElementHash` を呼び、null でないものを Map に収める
- [x] `src/graph/index.ts`: `extractElementRange`, `computeElementHash`, `computeAllHashes` をエクスポートする
- [x] テスト追加（`src/graph/body.test.ts` に追記）:
  - 見出し要素の範囲が宣言行を含み、次の要素宣言行を含まないこと
  - ファイル末尾要素の範囲がファイル末尾まで含むこと
  - 文書要素の範囲がファイル全体（frontmatter 含む）であることを確認
  - `computeElementHash` が 64 文字の hex を返すこと
  - 同一内容で同一ハッシュ、1 バイト違いで異なるハッシュが出ること
  - 要素不在時に null を返すこと

**Acceptance Criteria**:
- `extractElementRange` が findOwningElement と同一の帰属規則（要素宣言行境界）で範囲を返す
- `computeElementHash` が SHA-256 hex（64 文字小文字）を返す
- 見出し要素・ファイル末尾要素・文書要素の 3 形でテスト green

## T-03: 有効状態の純関数

- [x] `src/state/effective.ts` を新規作成する
- [x] `getEffectiveState(entry: StateEntry, currentHash: string | undefined): "designed" | "requested" | "implemented"` を実装する。判定ロジック:
  - `entry.state !== "implemented"` → `entry.state` をそのまま返す
  - `entry.hash === undefined` → `"implemented"`（hash 無し → 過去互換）
  - `currentHash === undefined` → `"implemented"`（要素が解決できない → 縮退しない）
  - `entry.hash === currentHash` → `"implemented"`（一致 → 縮退しない）
  - `entry.hash !== currentHash` → `"designed"`（乖離 → 縮退）
- [x] `computeEffectiveStates(stateMap: StateMap, currentHashes: Map<string, string>): { effectiveMap: StateMap; driftedIds: Set<string> }` を実装する。stateMap の各エントリに getEffectiveState を適用し、state が変わったエントリは effectiveMap にコピーを作成（元の stateMap は変更しない）。state が変わったエントリの id を driftedIds に収める
- [x] `src/state/index.ts` から `getEffectiveState`, `computeEffectiveStates` をエクスポートする
- [x] テスト追加（`src/state/effective.test.ts` を新規作成）:
  - implemented + hash + 一致 → `"implemented"`
  - implemented + hash + 不一致 → `"designed"`
  - implemented + hash 無し → `"implemented"`（過去互換）
  - implemented + hash + currentHash undefined → `"implemented"`
  - requested → `"requested"`（hash の有無に依存しない）
  - designed → `"designed"`
  - `computeEffectiveStates` が effectiveMap と driftedIds を正しく返すこと
  - effectiveMap の drifted エントリが `state: "designed"` で元のエントリの他フィールド（request, pr, hash）を保持すること

**Acceptance Criteria**:
- `getEffectiveState` が仕様どおりの縮退判定を返す
- `computeEffectiveStates` が effectiveMap と driftedIds を正しく返す
- hash 無し implemented が従来どおり `"implemented"` のまま

## T-04: mark implemented のハッシュ記録

- [x] `src/cli/commands/mark.ts`: `buildGraph` のインポートを `../../graph/builder.ts` から追加する
- [x] `src/cli/commands/mark.ts`: `computeAllHashes` のインポートを `../../graph/body.ts` から追加する
- [x] `handleMarkImplemented` 内で、parsed の後に `const graph = buildGraph(parsed, manifestPath)` で graph を構築する
- [x] 遷移パス（requestedIds が非空の場合）で `computeAllHashes(requestedIds, graph, files)` を呼ぶ。`files` は `readMarkdownFiles` の戻り値（既にスコープ内にある）
- [x] 遷移エントリの構築を以下に変更する:
  ```
  const hash = hashes.get(id);
  newStateMap[id] = {
    state: "implemented",
    request: entry.request ?? slug,
    ...(prNumber !== undefined ? { pr: prNumber } : {}),
    ...(hash !== undefined ? { hash } : {}),
  };
  ```
- [x] no-op パス（requestedIds.length === 0）は変更しない（冪等）
- [x] テスト追加（`src/cli/commands/mark.test.ts` に追記）:
  - mark 後の state.json にハッシュ（64 桁 hex）が記録されること
  - フィールド順が `state, request, pr, hash` であること（JSON 文字列で検証）
  - 要素が design ファイルに存在しない場合（graph に無い id）に hash が省略され遷移が続行すること
  - 冪等 no-op（全件 implemented 済み）で state.json が byte-identical であること

**Acceptance Criteria**:
- requested → implemented の遷移時に hash が記録される
- hash が 64 桁の小文字 hex 文字列である
- 冪等 no-op で state.json は変化しない
- 要素未解決時に hash なしで遷移が成功する

## T-05: check の S1 診断と exit 判定の精密化

- [x] `src/cli/commands/check.ts`: `computeAllHashes` のインポートを追加する
- [x] `src/cli/commands/check.ts`: `isLayerEnabled` のインポートを追加する（manifest 利用のため。既にインポート済みか確認）
- [x] `handleCheck` で runCheck の後、loop が有効な場合に S1 診断を追加するロジックを実装する:
  1. stateMap から `state === "implemented" && hash !== undefined` のエントリを抽出する
  2. 抽出した id リストに対して `computeAllHashes(ids, graph, files)` で現物ハッシュを計算する
  3. `hashes.get(id)` が undefined（要素がグラフに存在しない — 削除要素の残骸等）の場合は S1 をスキップし、`graph.elements.get(id)` の参照も行わない（`if (!currentHash) continue;`。残骸の検出は C8 の責務。`getEffectiveState` の「currentHash undefined → 縮退しない」と同じ fail-safe）
  4. 記録 hash と現物 hash が不一致のエントリに `CheckDiagnostic` を追加する: `{ level: "warning", code: "S1", elementId: id, message: "element body has drifted from implementation-time record", file: el.file, line: el.line }`
- [x] exit 判定を `diagnostics.length === 0 ? 0 : 1` から `diagnostics.some(d => d.level === "error") ? 1 : 0` に変更する
- [x] graph を構築するため、`handleCheck` の inline pipeline で `buildGraph` を呼ぶ（既に呼んでいるか確認）
- [x] テスト追加（`src/cli/commands/check.test.ts` に追記）:
  - 本文 1 文字変更 → `WARN S1 <id>` が stderr に出力され exit 0
  - 空白追加 → `WARN S1` が出力される（正規化なし完全一致の確認）
  - S1 + C3 error → exit 1
  - hash 無し implemented → S1 対象外
  - 乖離なし（hash 一致）→ S1 なし + exit 0
  - loop 無効時は S1 が発生しないこと
  - グラフに存在しない要素の implemented+hash エントリ（削除要素の残骸）→ S1 スキップ・クラッシュなし（C8 が別途 error を報告）

**Acceptance Criteria**:
- 乖離要素で `WARN S1` が出力される
- S1 のみなら exit 0、error ありなら exit 1
- hash 無し implemented は S1 の対象外
- 空白変更でも乖離が検出される

## T-06: check --request の R2 判定に有効状態を適用

- [x] `src/cli/commands/check.ts`: `computeAllHashes` と `getEffectiveState` のインポートを追加する（T-05 で追加済みの場合はスキップ）
- [x] `buildPipeline` の戻り値に `files: FileInput[]` を追加する（`readMarkdownFiles` の結果を返す）
- [x] `handleCheckRequest` で pipeline から `files` を受け取る
- [x] R2 判定ループで、各 cited id の状態判定を以下に変更する:
  1. `const entry = stateMap[id]` で raw エントリを取得
  2. `entry` が undefined なら `state = "designed"`
  3. `entry` が implemented で hash ありなら `computeElementHash(id, graph, files)` で現物ハッシュを取得し `getEffectiveState(entry, currentHash)` で有効状態を得る
  4. 有効状態が `"implemented"` なら R2 error
- [x] handleCheckRequest の exit 判定も `diagnostics.some(d => d.level === "error") ? 1 : 0` に変更する（check --request には元々 warning がないため動作は不変だが、一貫性のため）
- [x] テスト追加（`src/cli/commands/check-request.test.ts` に追記）:
  - 乖離した implemented 要素の被覆引用 → exit 0（R2 再開通）
  - hash 無し implemented の被覆引用 → exit 1（従来どおり R2 不合格）
  - 乖離なし implemented の被覆引用 → exit 1

**Acceptance Criteria**:
- 乖離した implemented 要素を引用する request が check --request で合格する
- hash 無し implemented は従来どおり R2 で弾かれる
- 乖離なし implemented も従来どおり R2 で弾かれる

## T-07: status のフロンティア乖離注記

- [x] `src/cli/commands/status.ts`: `computeAllHashes` のインポートを `../../graph/body.ts` から追加する
- [x] `src/cli/commands/status.ts`: `computeEffectiveStates` のインポートを `../../state/effective.ts` から追加する
- [x] `handleStatus` の loop 有効パスで:
  1. stateMap を読み込んだ後、全 implemented+hash エントリの id を収集する
  2. `computeAllHashes(ids, graph, files)` で現物ハッシュを計算する（`files` は `readMarkdownFiles` の戻り値。handleStatus のスコープ内で保持する）
  3. `computeEffectiveStates(stateMap, currentHashes)` で `effectiveMap` と `driftedIds` を得る
  4. `computeFrontier` に `effectiveMap` を渡す（raw stateMap の代わり）
  5. `formatFrontier(frontier, driftedIds)` を呼ぶ
- [x] `formatFrontier` のシグネチャに `driftedIds?: Set<string>` を追加する（省略可能、デフォルト undefined）
- [x] `formatFrontier` の designed 出力ループで、id が `driftedIds` に含まれる場合に注記を付ける: `${id} (drift: 実装時記録から本文が乖離)`
- [x] テスト追加（`src/cli/commands/status.test.ts` に追記）:
  - 乖離要素が Designed フロンティアに注記つきで現れること
  - 非乖離 designed 要素に注記が付かないこと
  - loop 無効時は summary 表示（乖離計算なし）であることの確認

**Acceptance Criteria**:
- 乖離要素が status の Designed フロンティアに `(drift: 実装時記録から本文が乖離)` 注記つきで表示される
- 非乖離の designed 要素には注記が付かない
- loop 無効時の動作は不変

## T-08: coverage の有効状態適用

- [x] `src/cli/commands/coverage.ts`: `computeAllHashes` のインポートを `../../graph/body.ts` から追加する
- [x] `src/cli/commands/coverage.ts`: `computeEffectiveStates` のインポートを `../../state/effective.ts` から追加する
- [x] `handleCoverage` で stateMap を読み込んだ後:
  1. 全 implemented+hash エントリの id を収集する
  2. `computeAllHashes(ids, graph, files)` で現物ハッシュを計算する
  3. `computeEffectiveStates(stateMap, currentHashes)` で `effectiveMap` を得る
  4. `verifyCoverage` に渡す stateMap を `effectiveMap` に差し替える
- [x] 遷移の書き込みは raw stateMap ベースのまま: `const newStateMap: StateMap = { ...stateMap }` の `stateMap` は原本の raw stateMap。coverage の遷移 `{ state: "requested", request: requestSlug }` がエントリ全体を上書きするため、古い hash は自然に脱落する
- [x] テスト追加（`src/cli/commands/coverage.test.ts` に追記）:
  - 乖離要素を含む plan グループが coverage を通過し requested に遷移すること
  - 遷移後のエントリに古い hash が含まれないこと
  - hash 無し implemented 要素が WRONG_STATE で弾かれること（過去互換）

**Acceptance Criteria**:
- 乖離した implemented 要素が coverage を通過し requested に遷移できる
- 遷移後のエントリに hash が含まれない（`{ state: "requested", request: "<slug>" }`）
- hash 無し implemented は WRONG_STATE で弾かれる（従来動作の保持）
