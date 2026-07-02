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

- **verdict**: approved

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | LOW | Clarity | tasks.md T-01 | import path の記述が二段構えで冗長。「`import type { Element } from "../parse/types.ts";` を使用する（…`../graph/index.ts`）」という書き方は、最終的に使うパスが `../graph/index.ts` であることは明確だが、前半の `../parse/types.ts` が混乱源になりうる。 | 文をひとつにまとめ「`import type { Element } from "../graph/index.ts";` を使用する（mod-check → mod-graph の許可依存に従い graph 経由）」と書き直す。実装への支障はないため対応は任意。 |
| 2 | LOW | Precision | design.md Risks | 境界条件リスクの説明「現在の C3・C11 の実装は undefined の場合を『スキップしない（評価する）』として扱っており、共有関数に切り替えた場合も同じ動作を維持する」は、「ファイル内に要素がない場合」に限った説明になっている。「ファイル内に要素は存在するが全て参照行より後の行にある」場合、旧 `find` は先頭要素を返すが `findOwningElement` は `undefined` を返す（C11 は continue、C3 は評価継続）。旧動作との差異が明示されていない。 | Risks に「ファイル内要素が全て参照行より後の行にある場合、旧 `find` と挙動が変わる（`undefined` を返す）。C11 はスキップ、C3 は評価継続となり、より正確な帰属判定になる」と一文補足する。実害はなく動作は仕様的に正しいため対応は任意。 |

## 検証メモ

### バグ確認（コード実測）

**バグ 1（fail-open）**: `src/check/rules/c03-ref-resolved.ts` の縮退スキップ（行 25–27）:

```typescript
if (!enabledPrefixes.has(targetPrefix)) {
  continue;
}
```

`getEnabledPrefixes()` が返す集合は manifest の `enabled` 層由来の prefix のみ（例: `enabled: static` → `{mod, adr}`）。`zzz` は `KNOWN_PREFIXES`（`src/parse/id.ts`）に存在しないため、全層有効時（`{mod,term,ent,inv,act,seq,top,plan,grp,adr}`）でも `zzz` は含まれない。`[[zzz-typo]]` は常に skip → fail-open を実測で確認。

**バグ 2（誤帰属）**: `c11-layer-direction.ts` 行 39 および `c03-ref-resolved.ts` 行 34 の共通パターン:

```typescript
const sourceElement = graph.rawElements.find((el) => el.file === ref.file);
```

`Array.find` はファイル内宣言順の先頭要素を返す。複数要素ファイルでは後方要素セクション内の参照も先頭要素に帰属する誤動作を確認。

### 設計判断の妥当性検証

**D1（二段判定）**: 実装イメージ:

```typescript
if (KNOWN_PREFIXES.has(targetPrefix) && !enabledPrefixes.has(targetPrefix)) {
  continue; // 既知だが無効な型 → 縮退スキップ
}
// 未知 prefix（zzz 等）→ fall through → 評価
```

既存テスト「reference to disabled-type element」（`seq-foo` + `STATIC_ONLY`）への影響を確認:
- `targetPrefix = "seq"`, `KNOWN_PREFIXES.has("seq") = true`, `enabledPrefixes.has("seq") = false` → skip 継続 ✓
- 既存テストは無変更で green を維持する。

**D2（`findOwningElement` 共有化）**: `Element` 型は `line: number` フィールドを持つ（`src/parse/types.ts` 実測確認）。アルゴリズム「`el.file === file && el.line <= line` を満たす要素の中で最大 `el.line`」は型制約内で実装可能。

**D3（診断メッセージ区別）**: spec.md Scenario「未知 prefix 参照の fail-closed」は `code: "C3"`, `level: "error"` の診断存在のみを要件とし、メッセージ文言は規定しない。tasks.md T-03 が `"zzz-typo"` と `"zzz"` のアサーションを追加する。spec と tasks の詳細度に乖離があるが矛盾はなく、テストが精度を担保する。

### 依存方向の適合確認

`design/static/dependencies.md` より `mod-check → mod-graph` が許可依存として明記されている。`src/graph/index.ts` は `KNOWN_PREFIXES`・`Element` を re-export 済み。`src/check/attribution.ts` が `../graph/index.ts` から import することで `mod-check → mod-parse` 直接依存を生じさせない。設計の依存方向制約を満たす。

### C1 既存挙動確認

`src/check/rules/c01-id-grammar.ts` は `validateId()` を呼び出し、`KNOWN_PREFIXES` に存在しない prefix の宣言を C1 エラーとして検出する。`{#zzz-foo}` は既に fail-closed。本変更対象外で変更不要（要件 3 を満たす）。

### セキュリティ評価

本変更は純粋な内部ロジック（集合演算・行番号比較）のみ。I/O 追加なし・外部入力バリデーション変更なし・認証/認可に関わる変更なし。OWASP Top 10 の懸念対象外。

### 受け入れ基準の実装可能性

全 5 項目が既存インフラ（`KNOWN_PREFIXES`・`rawElements`・`line` フィールド）で実装可能。既存 326 テストはすべて単一要素ファイルを前提としており、`findOwningElement` 切り替え後も結果は同一（後退なし）。
