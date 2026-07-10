# Conformance Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:   implementation conforms to tasks.md, design.md, spec.md, and request.md
  - needs-fix:  one or more upstream artifacts are not satisfied by the implementation
  - escalation: conformance cannot be determined (missing artifacts, unresolvable ambiguity)
- The Findings table records the per-artifact judgment.
-->

- **verdict**: approved

## Conformance Findings

| Artifact | Conforms | Notes |
|----------|----------|-------|
| tasks.md | ✅ yes | T-01〜T-08 の全チェックボックスが [x] 済み |
| design.md | ✅ yes | D1〜D8 の全設計判断が実装に反映されている（詳細は下記） |
| spec.md | ✅ yes | 全 Requirement (SHALL) とシナリオを実装・テストで充足（軽微な表記差あり、詳細は下記） |
| request.md | ✅ yes | 全受け入れ基準を実装・テストで充足（tsc clean、913 pass / 0 fail） |

---

## Quality Gate

| ゲート | 結果 |
|--------|------|
| `bunx tsc --noEmit` | ✅ clean（出力なし） |
| `bun test` | ✅ 913 pass / 0 fail |
| verification-result.md | passed（must TC 17/17 covered） |
| code-review verdict | approved（total 8.9 / 10） |

---

## Detailed Judgment

### tasks.md — ✅ conforms

T-01 から T-08 の全タスクのチェックボックスが `[x]` で完了済み。

### design.md — ✅ conforms

| 設計判断 | 実装 | 適合 |
|---------|------|------|
| D1: `extractElementRange` を src/graph/body.ts に新設 | `graph.elements` から次要素宣言行を探索（findOwningElement と同一帰属規則）。JSDoc に extractElementBody との差異を明記 | ✅ |
| D2: ハッシュ計算ヘルパを src/graph/body.ts に配置 | `computeElementHash` / `computeAllHashes` を body.ts に実装し `src/graph/index.ts` からエクスポート | ✅ |
| D3: 有効状態の純関数を src/state/effective.ts に新設 | `Readonly<StateMap>` / `ReadonlySet<string>` を返し書き戻し誤用を型レベルで抑制。JSDoc に effectiveMap 書き戻し禁止を明記 | ✅ |
| D4: serializeEntry ヘルパを writer.ts に追加 | `state → request → pr → hash` 順でオブジェクトを明示構築してから JSON.stringify。`writeDesignState` が使用 | ✅ |
| D5: S1 は CLI 層（handleCheck）で追加、runCheck は不変 | `runCheck` シグネチャ変更なし。S1 を `runCheck` の外で追記 | ✅ |
| D6: exit 判定を error 限定に精密化 | `handleCheck` と `handleCheckRequest` の双方で `diagnostics.some(d => d.level === "error") ? 1 : 0` | ✅ |
| D7: formatFrontier に driftedIds パラメータ追加 | `driftedIds?: ReadonlySet<string>`（省略可能）。`Frontier` 型・`computeFrontier` 変更なし | ✅ |
| D8: coverage は effectiveMap で検証、raw stateMap で書き込み | `verifyCoverage` に effectiveMap、書き込みは raw stateMap ベースで全フィールド上書き → hash 自然脱落 | ✅ |

許可依存（`design/static/dependencies.md`）: `mod-state → mod-parse / mod-graph` への辺は追加なし。ハッシュ計算結果は `Map<string, string>` でパラメータ渡し ✅

### spec.md — ✅ conforms

全 Requirement（SHALL 文）と全シナリオをテストで充足。

**軽微な表記差（機能的影響なし）**: spec.md のシナリオ記述が「WARN S1」（略称）であるのに対し、実装の出力形式（`d.level.toUpperCase()`）は「WARNING S1」（既存 diagnostic フォーマット `format.ts` に準拠）。テストは「WARNING S1」で正しく検証しており、実装の不具合ではない。spec.md 記述の軽微な表記差（code-review finding #2、severity: low）。

### request.md — ✅ conforms

全受け入れ基準を充足：

| 受け入れ基準 | 結果 |
|-------------|------|
| mark 後 hash（64 桁 hex）記録・書式保証 | ✅ mark.test.ts で round-trip・フィールド順検証 |
| 1 文字変更で WARNING S1 出力・exit 0 | ✅ check.test.ts で検証 |
| 空白のみ変更でも乖離（正規化なし） | ✅ check.test.ts で検証 |
| 乖離要素が Designed フロンティアに注記つき | ✅ status.test.ts で検証 |
| 乖離要素の被覆引用で check --request exit 0 | ✅ check-request.test.ts で検証 |
| coverage 通過・requested 遷移・古い hash 脱落 | ✅ coverage.test.ts で検証 |
| hash 無し implemented は S1 対象外・R2 で弾かれる | ✅ check.test.ts + check-request.test.ts で検証 |
| mark no-op で state.json 不変 | ✅ mark.test.ts で検証 |
| mark と check のハッシュが同一要素で一致（3 形） | ✅ body.test.ts で hash 等値テスト |
| 既存テスト green（後方互換） | ✅ 913 pass / 0 fail |
| aozu 自身の design/ check 不変 | ✅ loop 無効のため S1 不発生（code-review 確認） |
| `bunx tsc --noEmit` && `bun test` が green | ✅ tsc clean・913 pass |
