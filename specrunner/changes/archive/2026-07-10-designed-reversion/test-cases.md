# Test Cases: designed への戻りの実装

## Summary

- **Total**: 35 cases
- **Automated** (unit/integration): 35
- **Manual**: 0
- **Priority**: must: 17, should: 13, could: 5

---

### TC-001: mark implemented 後の state.json にハッシュが記録される

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark implemented はハッシュを記録する > Scenario: Hash is recorded on transition

---

### TC-002: 見出し要素のハッシュ範囲が宣言行を含み次の要素宣言行を含まない

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: mark implemented はハッシュを記録する > Scenario: Hash matches heading element body range (includes declaration line)

---

### TC-003: ファイル末尾要素の範囲がファイル末尾まで含む

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: mark implemented はハッシュを記録する > Scenario: End-of-file element range extends to EOF

---

### TC-004: 文書要素のハッシュがファイル全体（frontmatter 含む）をカバーする

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: mark implemented はハッシュを記録する > Scenario: Document element hashes entire file

---

### TC-005: 要素が design ファイルに存在しない場合 hash を省略して遷移が続行する

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: mark implemented はハッシュを記録する > Scenario: Unresolvable element omits hash

---

### TC-006: mark 冪等 no-op（全件 implemented 済み）で state.json が byte-identical

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: mark の冪等 no-op は state.json を変更しない > Scenario: No-op does not change state.json

---

### TC-007: 本文 1 文字変更で WARN S1 が stderr に出力され exit 0

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: check は乖離要素に S1 warning を出す > Scenario: Body change triggers S1 warning with exit 0

---

### TC-008: 空白のみの変更（正規化なし完全一致）でも S1 が発生する

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: check は乖離要素に S1 warning を出す > Scenario: Whitespace-only change triggers S1

---

### TC-009: S1 warning と error 診断が同時存在する場合 exit 1

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: check は乖離要素に S1 warning を出す > Scenario: S1 warning does not override error exit code

---

### TC-010: hash 無し implemented エントリは S1 の対象にならない（過去互換）

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: check は乖離要素に S1 warning を出す > Scenario: Hash-less implemented entry produces no S1

---

### TC-011: 記録 hash と現物 hash が一致する場合 S1 が発生しない

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: check は乖離要素に S1 warning を出す > Scenario: Matching hash produces no S1

---

### TC-012: loop 無効時は S1 が発生しない

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: check は乖離要素に S1 warning を出す > Scenario: Loop disabled suppresses S1

---

### TC-013: グラフに存在しない implemented+hash エントリは S1 をスキップしクラッシュしない

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: check は乖離要素に S1 warning を出す > Scenario: Graph-unresolvable entry is skipped by S1

---

### TC-014: 乖離した implemented 要素を被覆引用する request が check --request で exit 0

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: check --request は有効状態で R2 を判定する > Scenario: Drifted element passes R2

---

### TC-015: hash 無し implemented 要素の被覆引用は check --request で exit 1（R2 不合格）

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: check --request は有効状態で R2 を判定する > Scenario: Hash-less implemented element blocks R2

---

### TC-016: 乖離なし implemented 要素の被覆引用は check --request で exit 1（R2 不合格）

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: check --request は有効状態で R2 を判定する > Scenario: Non-drifted implemented element blocks R2

---

### TC-017: 乖離要素が status の Designed フロンティアに drift 注記つきで表示される

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: status は乖離要素を Designed フロンティアに注記つきで表示する > Scenario: Drifted element appears in Designed frontier with annotation

---

### TC-018: 非乖離の designed 要素に drift 注記が付かない

**Category**: integration
**Priority**: should
**Source**: spec.md > Requirement: status は乖離要素を Designed フロンティアに注記つきで表示する > Scenario: Non-drifted designed element has no annotation

---

### TC-019: 乖離要素が coverage を通過して requested に遷移し新エントリに hash が残らない

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage は有効状態で WRONG_STATE を判定する > Scenario: Drifted element passes coverage and transitions to requested

---

### TC-020: hash 無し implemented 要素が coverage で WRONG_STATE 不合格になる（過去互換）

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: coverage は有効状態で WRONG_STATE を判定する > Scenario: Hash-less implemented element blocks coverage

---

### TC-021: mark と check が見出し要素（複数要素ファイル）で同一ハッシュを返す

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: mark と check のハッシュは共有ヘルパで一致する > Scenario: Hash equality for heading element in multi-element file

---

### TC-022: mark と check がファイル末尾要素で同一ハッシュを返す

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: mark と check のハッシュは共有ヘルパで一致する > Scenario: Hash equality for end-of-file element

---

### TC-023: mark と check が文書要素で同一ハッシュを返す

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: mark と check のハッシュは共有ヘルパで一致する > Scenario: Hash equality for document element

---

### TC-024: writer が hash フィールドを pr の後に出力する

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: writer のフィールド順は state, request, pr, hash > Scenario: Hash field appears after pr

---

### TC-025: hash 無しエントリの出力に hash キーが含まれない

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: writer のフィールド順は state, request, pr, hash > Scenario: Entry without hash omits the field

---

### TC-026: extractElementRange と extractElementBody の範囲が異なる（宣言行含む / 含まない）

**Category**: unit
**Priority**: could
**Source**: design.md > D1: 要素範囲関数 `extractElementRange` を src/graph/body.ts に新設

**GIVEN** a heading element `ent-order` declared at line 5 of `domain/model.md` with the body starting at line 6
**WHEN** `extractElementRange` and `extractElementBody` are called for `ent-order` on the same graph and file
**THEN** `extractElementRange` result includes line 5 (the declaration line `## Name {#ent-order}`) and `extractElementBody` result does not include line 5

---

### TC-027: implemented + hash あり + currentHash undefined の場合 getEffectiveState は "implemented" を返す

**Category**: unit
**Priority**: should
**Source**: design.md > D3: 有効状態の純関数を src/state/effective.ts に新設

**GIVEN** a `StateEntry` with `{ state: "implemented", hash: "abc...64hex" }` and `currentHash` is `undefined` (element unresolvable from graph)
**WHEN** `getEffectiveState(entry, undefined)` is called
**THEN** the return value is `"implemented"` (no degradation when current body cannot be resolved)

---

### TC-028: designed / requested エントリは hash の有無に関わらず元の状態を返す

**Category**: unit
**Priority**: should
**Source**: design.md > D3: 有効状態の純関数を src/state/effective.ts に新設

**GIVEN** a `StateEntry` with `{ state: "requested", request: "slug" }` and any `currentHash` value
**WHEN** `getEffectiveState(entry, currentHash)` is called
**THEN** the return value is `"requested"` (non-implemented entries are not subject to degradation)

---

### TC-029: computeEffectiveStates が元の stateMap を変更しない

**Category**: unit
**Priority**: should
**Source**: design.md > D3: 有効状態の純関数を src/state/effective.ts に新設

**GIVEN** a stateMap containing an implemented entry with a drifted hash and `currentHashes` showing mismatch
**WHEN** `computeEffectiveStates(stateMap, currentHashes)` is called
**THEN** the original `stateMap` is not mutated (the entry's `state` field remains `"implemented"` in the original); only `effectiveMap` has `state: "designed"` for the drifted entry

---

### TC-030: effectiveMap の乖離エントリが state: "designed" になりつつ他フィールドを保持する

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03: 有効状態の純関数 > Acceptance Criteria

**GIVEN** a stateMap entry `{ state: "implemented", request: "slug", pr: 42, hash: "old...hex" }` with a current hash mismatch
**WHEN** `computeEffectiveStates(stateMap, currentHashes)` is called
**THEN** the corresponding entry in `effectiveMap` has `state: "designed"` and retains `request: "slug"`, `pr: 42`, and `hash: "old...hex"`; and the entry's id appears in `driftedIds`

---

### TC-031: formatFrontier に driftedIds を渡さない場合（後方互換）は注記なしで出力される

**Category**: unit
**Priority**: could
**Source**: design.md > D7: フロンティアの乖離注記 — formatFrontier に driftedIds パラメータを追加

**GIVEN** a `Frontier` with `designed: ["ent-order", "ent-billing"]` and `driftedIds` is omitted (undefined)
**WHEN** `formatFrontier(frontier)` is called (without second argument)
**THEN** the output lists `ent-order` and `ent-billing` without any `(drift: ...)` annotation

---

### TC-032: computeAllHashes が null 解決（要素不在）のエントリを Map に含めない

**Category**: unit
**Priority**: could
**Source**: design.md > D2: ハッシュ計算ヘルパを src/graph/body.ts に配置

**GIVEN** a list of ids `["ent-order", "ent-ghost"]` where `ent-ghost` does not exist in the graph
**WHEN** `computeAllHashes(["ent-order", "ent-ghost"], graph, files)` is called
**THEN** the returned Map contains an entry for `"ent-order"` (64-char hex) and does not contain an entry for `"ent-ghost"`

---

### TC-033: hash 付きエントリの write → read ラウンドトリップで値が一致する

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-01: StateEntry 型拡張と writer のフィールド順保証 > Acceptance Criteria

**GIVEN** a stateMap containing `{ state: "implemented", request: "slug", pr: 10, hash: "a1b2...64hex" }` for id `"ent-order"`
**WHEN** `writeDesignState(path, stateMap)` writes to a file and `readDesignState(path)` reads it back
**THEN** the read-back entry for `"ent-order"` has all four fields with values identical to the original, and the raw JSON string for that entry matches the pattern `{"state":"implemented","request":"slug","pr":10,"hash":"a1b2...64hex"}`

---

### TC-034: computeElementHash が要素不在の場合 null を返す

**Category**: unit
**Priority**: could
**Source**: tasks.md > T-02: 要素範囲抽出とハッシュ計算ヘルパ > Acceptance Criteria

**GIVEN** a graph that does not contain element id `"ent-ghost"`
**WHEN** `computeElementHash("ent-ghost", graph, files)` is called
**THEN** the return value is `null`

---

### TC-035: coverage の遷移書き込みが effectiveMap でなく raw stateMap をベースとし乖離エントリを上書きする

**Category**: integration
**Priority**: could
**Source**: design.md > D8: coverage — effectiveStateMap で検証、raw stateMap で書き込み

**GIVEN** element `ent-order` has state entry `{ state: "implemented", request: "old-slug", hash: "old...hex" }` with a drifted hash, and it belongs to plan group `grp-rework`
**WHEN** coverage passes and writes the transition for `ent-order`
**THEN** the written entry is `{ state: "requested", request: "new-slug" }` with no `hash` or `pr` key, and state.json does not contain any entry with `state: "designed"` (the effectiveMap `state: "designed"` was never persisted)

---

## Result

```yaml
result: completed
total: 35
automated: 35
manual: 0
must: 17
should: 13
could: 5
blocked_reasons: []
```
