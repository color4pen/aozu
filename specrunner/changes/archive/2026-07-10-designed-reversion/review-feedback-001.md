# Code Review Feedback — iteration 001

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
- iteration line format (exact): `- **iteration**: NNN` (3-digit zero-padded integer)
- Findings table MUST have exactly 7 columns in this order:
  # | Severity | Category | File | Description | How to Fix | Fix
  - Fix column: yes = fixer should address this finding; no = skip (pre-existing / out-of-scope)
- Scores table columns: Category | Score | Weight
  - Valid Category values: correctness | security | architecture | performance | maintainability | testing
  - Score: integer 1-10
  - Weight: decimal as defined below
- total line format (exact): `- **total**: <decimal>`
- Default weights: correctness=0.30, security=0.25, architecture=0.15, performance=0.10, maintainability=0.10, testing=0.10
- Scores table is optional but recommended.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | low | testing | src/cli/commands/check.test.ts | TC-009（S1 warning と error 診断が同時存在する場合 exit 1）の明示的なアサーションがない。TC-013 の fixture では mod-alpha に S1・ent-ghost に C8 error が共存するが、exit code の断言が含まれていない。"should" 優先度であり実装ロジック自体は正しい。 | TC-013 に `expect(exitCode).toBe(1)` の断言を追加するか、S1+error 共存シナリオの独立テストを追加する。 | no |
| 2 | low | maintainability | specrunner/changes/designed-reversion/spec.md | spec.md のシナリオが「WARN S1」と記載しているが実装・テストは「WARNING S1」（`d.level.toUpperCase()` = `"WARNING"`）を使用している。コードバグではなく spec ドキュメントの略称と実出力の乖離。 | spec.md のシナリオを `WARNING S1` に揃えるか、注記を添える。スコープ外（spec.md はこの change の成果物だが直接の動作保証には影響しない）。 | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 9 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 8 | 0.10 |

- **total**: 8.9

## Summary

### 品質ゲート

| ゲート | 結果 |
|--------|------|
| `bunx tsc --noEmit` | clean（出力なし） |
| `bun test` | 913 pass / 0 fail |
| aozu 自身の design/ check | exit 0（既存テストで通過） |
| must TC 17 件 | 全件カバー |

### 実装評価

**T-01（StateEntry + serializeEntry）**: `serializeEntry` が `{ state, request?, pr?, hash? }` の順でオブジェクトを再構築して `JSON.stringify` しており、フィールド順が明示的に保証される。undefined フィールドは省略。spec §9 と一致。

**T-02（extractElementRange / computeElementHash）**: 見出し要素は宣言行（`el.line - 1`）から次要素宣言行 -1 まで、文書要素は `fileInput.content` 全体を返す。`findOwningElement` と同一帰属規則。`DOCUMENT_PREFIXES.has(other.prefix) → continue` で文書要素が見出し要素の範囲計算に混入しない処置が適切。`extractElementBody` との差異を JSDoc に明記。

**T-03（getEffectiveState / computeEffectiveStates）**: 縮退判定の 5 ブランチ（!implemented / hash 無し / currentHash undefined / 一致 / 不一致）を全実装・テスト済み。元 stateMap を変更せずコピーを作成。`effectiveMap` を `Readonly<StateMap>` で返すことで書き戻し誤用を型レベルで抑制（design.md D3 の JSDoc 要求に相当する保護が型で実現されている）。

**T-04（mark のハッシュ記録）**: `computeAllHashes(requestedIds, graph, files)` → hash Map → エントリ構築時 `...(hash !== undefined ? { hash } : {})` で省略可能。no-op パスは変更なし。原子性・冪等性は既存の全量書き替えで継続保証。

**T-05（S1 診断 + exit 判定）**: `runCheck` 外（handleCheck 内）で S1 を追加しており、`runCheck` インタフェース不変（D5 準拠）。`isLayerEnabled("loop", manifest)` ガード付き。グラフ不在エントリは `currentHash === undefined` で `continue`（クラッシュなし）。exit 判定 `diagnostics.some(d => d.level === "error") ? 1 : 0`（D6 通り）。

**T-06（check --request の R2 有効状態適用）**: `entry.state === "implemented" && entry.hash !== undefined` の場合のみ `computeElementHash` を呼ぶ分岐が明確。過去互換維持。

**T-07（status の乖離注記）**: `formatFrontier(frontier, driftedIds?)` の第 2 引数は省略可能なため既存呼び出しに影響なし。`Frontier` 型変更なし（D7 準拠）。

**T-08（coverage の有効状態適用）**: `verifyCoverage` に `effectiveMap` を渡す（乖離要素 → effective state = "designed" → WRONG_STATE 通過）。書き込みは raw stateMap ベースで `{ state: "requested", request: requestSlug }` 代入がエントリ全体を上書き → hash 自然脱落（D8 準拠）。

**許可依存**: mod-state → mod-parse / mod-graph への辺は追加なし。ハッシュ計算結果は `Map<string, string>` としてパラメータ渡し。`runCheck` のインタフェース不変。設計（design/static/dependencies.md）との乖離なし。
