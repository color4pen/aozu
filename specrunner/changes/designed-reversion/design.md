# Design: designed への戻りの実装

## Context

要素状態機械（designed → requested → implemented、ADR-0005）において、implemented 要素の設計本文が変更されたことを検出する機構が存在しない。ADR-0018 補記で仕様が確定し、spec/format.md §9 の `hash` フィールドと縮退規則は merge 済み。本変更はこの確定仕様を src/ に実装する。

現状コードの関連点:

- `StateEntry` は `{state, request?, pr?}` — hash フィールドが未実装
- `mark implemented`（src/cli/commands/mark.ts）は `readMarkdownFiles` + `parseFiles` を呼ぶが `buildGraph` は呼ばない。遷移時に要素本文へのアクセスは行わない
- `extractElementBody`（src/graph/body.ts）は見出しレベル境界で要素の body テキストを切り出す。宣言行（`## Name {#id}`）自体は含まない。文書要素は frontmatter 以降を返す。本変更のハッシュ範囲はこれと異なる
- `findOwningElement`（src/graph/attribution.ts）は要素宣言行の位置で帰属を判定する。ハッシュ範囲はこの帰属規則に従う
- `check` の exit 判定は `diagnostics.length === 0 ? 0 : 1` — warning/error の区別がなく、warning を追加すると exit 1 になってしまう
- `check --request` の R2 判定（src/cli/commands/check.ts:152-164）は raw state を直読みする
- `computeFrontier`（src/plan/frontier.ts）と `verifyCoverage`（src/plan/coverage.ts）も raw stateMap を受け取る
- `writeDesignState`（src/state/writer.ts）は `JSON.stringify(value)` でエントリを直列化しており、フィールド順はオブジェクトの挿入順に依存する
- 許可依存（design/static/dependencies.md）において、mod-state から mod-parse / mod-graph への辺は無い

## Goals / Non-Goals

**Goals**:

- mark implemented 時に要素本文の SHA-256 ハッシュを state.json の `hash` フィールドに記録する
- check / status / coverage / check --request で本文乖離を検出し、当該要素を designed 扱いに縮退する（計算のみ、state.json は書き換えない）
- S1 warning 診断で乖離を可視化する（exit code には影響しない）
- 許可依存を変更しない。ハッシュ・縮退の計算結果はパラメータで渡す

**Non-Goals**:

- ハッシュの正規化（空白・整形の緩和）
- 既存 implemented エントリへの hash バックフィル
- state.json スキーマのそれ以外の変更・format-version 増分
- diff / trace 動詞
- spec-runner 側の受け口変更

## Decisions

### D1: 要素範囲関数 `extractElementRange` を src/graph/body.ts に新設

findOwningElement の帰属規則と同一の範囲定義を使う:

- **見出し要素** (mod / term / ent / inv / act / grp): 宣言行（`## Name {#id}`）から、同一ファイル内で自分より後に出現する最初の要素宣言行の直前まで。最後の要素ならファイル末尾まで。次の要素の探索には `graph.elements` の同一ファイル内エントリを行番号でソートして使う
- **文書要素** (seq / top / plan / adr): ファイル全体（`fileInput.content`）。frontmatter を含む

既存の `extractElementBody` との差異:
- extractElementBody は宣言行を含まず（`headingIdx + 1` 始点）、見出しレベル境界で切る。文書要素は frontmatter 以降
- extractElementRange は宣言行を含み（`headingIdx` 始点）、要素宣言行境界で切る。文書要素はファイル全体

2 関数は異なる用途を持つ（body = prompt 組み立て・表示、range = ハッシュ計算）。ハッシュの等値性に関わるのは extractElementRange のみ。

Rationale: 「範囲導出は findOwningElement の帰属規則と同一」（architect 判断）。帰属の導出が二箇所に割れると将来の要素種追加時に不一致が入る。

Alternatives considered: extractElementBody を拡張してパラメータで切り替える → 既存テスト・消費者への影響が大きく、2 つの用途を 1 関数に混ぜると責務が不明確になるため却下。

### D2: ハッシュ計算ヘルパを src/graph/body.ts に配置

- `computeElementHash(elementId, graph, files): string | null` — extractElementRange + SHA-256 hex
- `computeAllHashes(ids, graph, files): Map<string, string>` — bulk 版

SHA-256 は Bun 組み込みの `Bun.CryptoHasher` を使用。

配置理由: body.ts はすでに要素範囲の抽出を担っており、ハッシュ計算はその延長。mod-cli から mod-graph への依存は許可済み。`src/graph/index.ts` からエクスポートする。

### D3: 有効状態の純関数を src/state/effective.ts に新設

- `getEffectiveState(entry: StateEntry, currentHash: string | undefined): "designed" | "requested" | "implemented"` — 判定: implemented かつ hash あり かつ currentHash あり かつ不一致 → "designed"、それ以外は entry.state
- `computeEffectiveStates(stateMap: StateMap, currentHashes: Map<string, string>): { effectiveMap: StateMap; driftedIds: Set<string> }` — bulk 版

mod-state 内部の型のみを使い、新たな依存を追加しない。effectiveMap は読み取り専用の計算結果であり、ディスクに書き出してはならない（state.json は書き換えない）。

CLI 層のオーケストレーション: files → graph → `computeAllHashes` → `computeEffectiveStates` → 消費関数にパラメータとして渡す。

### D4: writer のフィールド順保証 — serializeEntry ヘルパを writer.ts に追加

`JSON.stringify(value)` のキー順はオブジェクトの挿入順に依存するため、reader 経由で読み込んだ既存エントリのフィールド順がスキーマと異なる可能性がある。明示的に `state → request → pr → hash` の順で新規オブジェクトを構築してから JSON.stringify する `serializeEntry` ヘルパを追加し、writer のエントリ直列化をこれに差し替える。

### D5: S1 診断は CLI 層（handleCheck）で追加、runCheck は不変

S1 は閉包規則ではなく状態乖離の warning。`runCheck`（src/check/checker.ts）の入力は `graph + manifest + stateKeys` で変更しない。`handleCheck`（src/cli/commands/check.ts）が `runCheck` の結果に S1 を追記する。

Rationale: S1 は要素本文のハッシュ計算を要するため graph + files が必要。runCheck は純関数として graph + manifest + stateKeys を受ける設計であり、files を渡す変更は runCheck の責務拡張になる。S1 を runCheck の外で追加することで、runCheck のインタフェースを不変に保つ。

### D6: check の exit 判定を error 限定に精密化

`diagnostics.length === 0 ? 0 : 1` を `diagnostics.some(d => d.level === "error") ? 1 : 0` に変更。S1 (warning) のみなら exit 0。既存の closure rule 診断はすべて level "error" なので、この変更で既存動作は不変。

### D7: フロンティアの乖離注記 — formatFrontier に driftedIds パラメータを追加

`Frontier` 型は変更しない（`designed` は `string[]` のまま）。`computeFrontier` に effectiveStateMap を渡すことで、乖離要素が designed リストに自然に現れる。`formatFrontier` の第 2 引数に `driftedIds?: Set<string>` を追加し、該当 ID に注記を付ける（例: `ent-order (drift: 実装時記録から本文が乖離)`）。

Alternatives considered: `Frontier.designed` を `Array<{ id: string; drift?: true }>` に変更 → Frontier 型の変更は computeFrontier（src/plan/frontier.ts）と既存テストに波及するため、影響範囲が大きい。formatFrontier の引数追加のほうが局所的。

### D8: coverage — effectiveStateMap で検証、raw stateMap で書き込み

`verifyCoverage` に渡す stateMap を effectiveStateMap に差し替え、WRONG_STATE の判定を縮退後の状態で行う。遷移の書き込み（`newStateMap[id] = { state: "requested", request: requestSlug }`）は raw stateMap ベースのまま。この代入がエントリ全体を上書きするため、古い hash は自然に脱落する。

raw stateMap を書き込みに使う理由: effectiveMap の drifted エントリは `state: "designed"` に変更されている。これをディスクに書き出すと state.json が書き換わり、「縮退は計算のみ・state.json は書き換えない」の規約に違反する。

## Risks / Trade-offs

[Risk] extractElementRange と extractElementBody で要素境界の定義が異なり、将来の変更で混乱する → Mitigation: 2 関数の責務の違い（表示 vs ハッシュ）と範囲の差異を JSDoc に明記する。ハッシュの整合性にかかわるのは extractElementRange のみ。

[Risk] 正規化なしのハッシュは整形だけの変更でも乖離を起こし、ノイジーになる可能性がある → Mitigation: ADR-0018 補記 4 で正規化は別決定として先送り済み。初期値は fail-closed（乖離の見落としより誤検出を許容する）。

[Risk] check の exit 判定変更で、将来 warning を出す closure rule が exit 0 になる → Mitigation: 現状の closure rule はすべて error。新たに warning を出す rule を追加する際は exit 判定を意識的に見直す。

## Open Questions

（なし — 設計判断は ADR-0018 補記で決定済み。Frontier の型変更方針は D7 で確定）
