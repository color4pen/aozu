# Request Review Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- The verdict line MUST appear before the Findings table.
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approve | needs-discussion | reject
  - approve:          No blocking findings (no HIGH, no decision-needed). Request is ready for pipeline execution.
  - needs-discussion: One or more blocking findings (HIGH or decision-needed) resolvable through discussion.
  - reject:           Multiple blocking findings AND requirement contradictions or structural breakdown.
- Findings table MUST have exactly 6 columns in this order:
  # | Severity | Category | Location | Description | Recommendation
- Valid Severity values (uppercase): HIGH | MEDIUM | LOW
  - HIGH:   Request-level defect — goal unclear, acceptance criteria absent/untestable, or critical external constraint unspecified
  - MEDIUM: Scope ambiguity, recommended additions
  - LOW:    Clarity improvements, expression refinements
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approve

## Findings

| # | Severity | Category | Location | Description | Recommendation |
|---|----------|----------|----------|-------------|----------------|
| 1 | LOW | Clarity | 要件 2 / `src/check/rules/c03-ref-resolved.ts` | C3 の `rawElements.find()` はソース層判定（skip ロジック）にも使われており、診断帰属ではなく「skip 判断の誤帰属」という点では C11 と同じ欠陥を持つ。要件本文では "C11 に限らず" と言及されているが、C3 のどの挙動を修正対象とするかが明示されていない（診断帰属 vs skip ロジック）。 | 実装 step への note として、C3 の修正対象は「skip ロジックで使う source element の特定」であることを design.md または tasks.md に明記しておくと混乱を防げる。 |
| 2 | LOW | Clarity | 要件 2 / 帰属導出実装方針 | `Element` 型は開始行（`line`）のみを持ち、セクション終端行を持たない。要件は "行範囲から導出できる" とするが、"終端行はファイル内で次の要素の開始行 - 1" という導出手順は暗黙。 | tasks.md で実装方針を「同一ファイルの rawElements を line 昇順ソートし、`el.line <= ref.line` を満たす最後の要素を選ぶ」と一文補足すると実装者が迷わない。 |

## 検証メモ

### Bug 1（fail-open）確認

`src/check/rules/c03-ref-resolved.ts` の当該コード（行 24–26）:

```typescript
const targetPrefix = extractPrefix(ref.targetId);
if (!enabledPrefixes.has(targetPrefix)) {
  continue;  // ← zzz-typo もここで素通り
}
```

`enabledPrefixes`（`getEnabledPrefixes()` が返す集合）は有効な層のプレフィクスのみを含む。`zzz` は `KNOWN_PREFIXES`（`src/parse/id.ts`）に存在しないため、`static` 限定の場合（`{mod, adr}`）はもちろん全層有効時（`{mod,term,ent,inv,act,seq,top,plan,grp,adr}`）でも `zzz` は含まれず、`[[zzz-typo]]` は常に skip される。バグ確定。

`spec/format.md` §10 C3 の現行テキストは既にこの動作を違反として規定済み: "縮退による評価除外は既知だが無効な型に限る——未知の prefix を持つ参照は縮退の対象外で、常に違反として診断する"。仕様が先行しており、修正の根拠が明確。

### Bug 2（誤帰属）確認

`src/check/rules/c11-layer-direction.ts` の当該コード（行 39）:

```typescript
const sourceElement = graph.rawElements.find((el) => el.file === ref.file);
```

`Array.find()` はファイル内の最初の要素を返す。複数要素ファイルでは、後方要素セクション内の参照がファイル先頭要素に帰属するため誤診断を生む。`c03-ref-resolved.ts`（行 34）も同パターンで同一の構造的欠陥を持つ。`rawElements.find()` はコードベース全体でもこの 2 箇所のみ（Grep 確認済み）。

### 要件 3（C1 整合）確認

`src/check/rules/c01-id-grammar.ts` は `validateId()` を呼び出し、`KNOWN_PREFIXES` に存在しない prefix を持つ宣言 ID を C1 エラーとして報告する。`{#zzz-foo}` は既に fail-closed。追加修正不要であり、受け入れ基準の「確認し、fail-open があれば塞ぐ」に合致。

### 受け入れ基準の実装可能性

全 5 項目が既存インフラ（`KNOWN_PREFIXES`・`rawElements` の line ソート）で実装可能。既存 C3/C11 テストは単一要素ファイルを使用しており、fix 後も結果は同一（後退なし）。
