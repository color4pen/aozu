# Spec Review Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- The verdict line MUST appear before the Findings table.
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:    specification is complete, consistent, and ready for implementation
  - needs-fix:   specification has issues that must be resolved before implementation
  - escalation:  unresolvable conflicts, missing context, or requires human judgment
- Findings table MUST have exactly 6 columns in this order:
  # | Severity | Category | File | Description | How to Fix
- Valid Severity values (uppercase): CRITICAL | HIGH | MEDIUM | LOW
  - CRITICAL: production outage, data loss, security breach
  - HIGH:     functional failure, clear bug, no workaround — blocks approval
  - MEDIUM:   quality degradation, maintainability issue, future risk
  - LOW:      informational, style, minor improvement
- If no findings, write a table row with "None" or omit the table body.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: needs-fix

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | HIGH | Task Specification Gap | tasks.md | **T-05: S1 発行時に `graph.elements.get(id)` null ガード未指定 — 実装クラッシュ経路**。step 2 で `computeAllHashes` がグラフ不在要素 (削除された design 要素など) の hash を Map に含めないため、step 3 で「記録 hash と現物 hash が不一致」の比較 (`hashes.get(id) !== entry.hash`) が `undefined !== "abc..."` → true と評価される。その後 `el = graph.elements.get(id)` が undefined を返し `el.file` で TypeError クラッシュが起きる。元実装は C8 (state.json に残った削除要素) を error として報告した上でこの S1 パスに入るため、両者の競合でチェックが完走できない。 | tasks.md T-05 step 2 の後に、以下の明示的な手順を追加する: 「`hashes.get(id)` が undefined (要素がグラフに存在しない) の場合は S1 をスキップし、`el` の取得も行わない (`if (!currentHash) continue;`)」。これにより `getEffectiveState` の `currentHash === undefined → "implemented"（縮退しない）` と同一の fail-safe 動作を T-05 でも保証できる。 |
| 2 | MEDIUM | Spec Coverage | spec.md | **「loop 無効 → S1 を発行しない」シナリオが spec.md に存在しない**。tasks.md T-05 受け入れ基準・request.md 受け入れ基準（"aozu 自身の check 結果が不変"）では「loop 無効時は S1 が発生しない」が必須要件として明記されているが、spec.md の `check の S1 警告` Requirement 配下に対応するシナリオがない。ガード条件 (`isLayerEnabled("loop", manifest)`) の動作がテスト仕様として保証されない。 | spec.md の「Requirement: check は乖離要素に S1 warning を出す」に次のシナリオを追加する: `#### Scenario: Loop disabled suppresses S1` — `Given loop is not enabled in manifest, When aozu check is executed and state.json contains implemented entries with hash fields, Then no S1 diagnostic is emitted and exit code is 0.` |
| 3 | LOW | Type Safety | design.md / tasks.md | **effectiveMap が disk に書き出された場合に `state: "designed"` + `hash: "abc..."` という意味的に矛盾するエントリが永続化されるリスク**。T-03 の仕様（"effectiveMap の drifted エントリが `state: "designed"` で他フィールドを保持する"）では hash を保持したまま state を "designed" に差し替える。型は `StateMap` のままであり型システムで write 禁止を強制できない。今後の機能追加で effectiveMap を誤って `writeDesignState` に渡すと、designed 状態のエントリに hash が付いた不正ファイルが生成される。 | `computeEffectiveStates` の JSDoc に `@remarks The returned effectiveMap MUST NOT be passed to writeDesignState — it is a read-only computed view. Writing it to disk would persist semantically invalid entries (designed state with hash field).` を明記する。さらに戻り値型を `{ effectiveMap: Readonly<StateMap>; driftedIds: Set<string> }` に変更することで誤用を型レベルで検出しやすくする（StateMap 自体の mutability は変わらないが、受け取り側が Readonly を外さない限り readOnly warnings が出る）。 |

---

## 審査メモ

### 全体評価

設計は ADR-0018 補記の仕様確定を忠実に実装しており、モジュール依存（許可依存変更なし）・状態遷移の不変条件（state.json 書き換えなし）・冪等性・後方互換を正しく考慮している。特に以下は高品質：

- **D3 `getEffectiveState` の 4 分岐**（hash なし / currentHash undefined / 一致 / 不一致）が完全で fail-closed 設計になっている
- **D8 の effectiveMap / raw stateMap の使い分け**（検証は effectiveMap、書き込みは rawStateMap）が正確であり、hash の自然消滅も保証されている
- **D6 の exit 判定精密化**（`diagnostics.some(d => d.level === "error") ? 1 : 0`）の既存動作への影響が risk に明記されている

Finding 1 は HIGH（クラッシュ経路あり）のため `needs-fix`。Finding 2・3 は tasks / design の記述補強で対応可能。

### セキュリティ考査

- **SHA-256 使用**: 変更検出（完全性確認）用途として適切。機密性要件なし
- **ファイルパス**: designDir・element.file ともにシステム内パスで、ユーザー制御の外部入力によるパストラバーサルなし
- **state.json パース**: `f.json() as StateMap` で型強制読み込み。hash フィールドが非文字列値の場合 `getEffectiveState` は `entry.hash !== currentHash` を true 評価して縮退（fail-safe）。OWASP Top 10 該当なし（CLI ツール、HTTP なし、認証なし）
- **effectiveMap の書き込みリスク**: Finding 3 記載。SSRF / データ破壊には至らないが設計違反
