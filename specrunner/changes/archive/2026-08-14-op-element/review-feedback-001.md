# Code Review Feedback — op-element — iter 1

<!-- EVIDENCE REPORT FORMAT:
     verdict は CLI が typed findings から導出する。この file に verdict 行を書かない。
     findings は report_result（typed）で報告し、この file はその補足の evidence report である。
-->

## 検証した項目

### 読んだファイル

| ファイル | 確認内容 |
|---|---|
| `src/parse/id.ts` | KNOWN_PREFIXES に `op` が追加されていること |
| `src/parse/types.ts` | TargetLine・MalformedPermOperation 型、ParseResult の新フィールド |
| `src/parse/structured-lines.ts` | TARGET_LINE_RE・新 PERM_OPERATION_LINE_RE・LEGACY RE のロジック |
| `src/parse/parser.ts` | parseFiles の新フィールド集約 |
| `src/check/manifest.ts` | LAYER_MAP・LAYER_TO_PREFIXES.domain への op 追加 |
| `src/check/rules/c11-layer-direction.ts` | LAYER_ALLOWED_TARGET_PREFIXES 4 集合への op 追加 |
| `src/check/rules/c06-view-links.ts` | op 参照解決・prefix 検証・一意・malformed・target 単一制約 |
| `src/graph/types.ts` | Graph インタフェースの targetLines / malformedPermOperations |
| `src/graph/builder.ts` | buildGraph の新フィールド伝搬 |
| `src/graph/attribution.ts` | findOwningElement（C6・generatePermissions の共通関数） |
| `src/plan/frontier.ts` | IMPLEMENTATION_PREFIXES に `op` が追加されていること |
| `src/export/permissions.ts` | generatePermissions が targetLines を findOwningElement 経由で使用 |
| `spec/format.md` | §8 単一参照制約・§10 C6・§10 C11 domain 列挙 |
| `src/check/rules/op-element.test.ts` | TC-001〜TC-014 のカバレッジと正確性 |
| `src/parse/op-element.test.ts` | TC-021〜TC-024 |
| `src/plan/op-element.test.ts` | TC-015 |
| `src/export/op-element.test.ts` | TC-016・TC-025〜TC-026 |
| `src/check/op-spec-docs.test.ts` | TC-017〜TC-020 |
| `src/export/permissions.test.ts` | 既存テストの更新（テスト名変更） |
| `src/check/rules/c06-view-links.test.ts` | op prefix 使用への書き換え |
| `src/cli/commands/export.test.ts` | permissions 統合テスト（op ID キー確認） |
| `src/check/integration.test.ts` | design/ 自己チェック・適合性フィクスチャ |

### 実行コマンドと結果

```
bunx tsc --noEmit         → exit 0（出力なし）
bun test (5 op-element ファイル) → 27 pass / 0 fail
bun test (全ファイル)      → 965 pass / 13 fail
  ※ 13 failures = npm pack EPERM（サンドボックス制限、実装とは無関係な既存失敗）
bun run src/cli/main.ts check → exit 0（design/ に変更なし）
```

### TC 対応表

| TC | テストファイル | 結果 |
|---|---|---|
| TC-001〜TC-014 | src/check/rules/op-element.test.ts | ✅ pass |
| TC-015 | src/plan/op-element.test.ts | ✅ pass |
| TC-016 | src/export/op-element.test.ts | ✅ pass |
| TC-017〜TC-020 | src/check/op-spec-docs.test.ts | ✅ pass |
| TC-021〜TC-024 | src/parse/op-element.test.ts | ✅ pass |
| TC-025〜TC-026 | src/export/op-element.test.ts | ✅ pass |
| TC-027 (tsc gate) | bunx tsc --noEmit | ✅ exit 0 |
| TC-028 (bun test gate) | bun test | ✅ 965 pass（npm pack 失敗は既存） |
| TC-029 (design/ check) | bun run src/cli/main.ts check | ✅ exit 0 |

### 重点確認項目

1. **fail-closed の正確性**: PERM_OPERATION_LINE_RE（新）が先にマッチし `continue`、次に PERM_OPERATION_LINE_RE_LEGACY で malformed をキャッチ。`- [[op-id]]: [[...]]` が LEGACY RE でも一致するが、新 RE が先にヒットするため誤分類なし。

2. **malformed + 非空義務の 2 errors**: `checkPermission` は malformed loop を先に回し、有効 ops が 0 の場合のみ非空義務 error を追加して `continue`（per-op チェックをスキップ）。TC-014 の 2 errors が正確に出力される。

3. **perm target 単一制約の検証箇所**: `checkPermission` の (g) ブロックは `permElements` ループとは独立した後続ループ（`for (const tl of graph.targetLines)`）で実行される。`ops.length === 0` での `continue` は perm ループ内の next permEl へのスキップであり、(g) ブロックを skipping しない。動作は正しい。

4. **TC-012 の strict 1 件アサート**: op-create-deal が declared されており C1/C11 は通過。seenOps に 2 本目追加時に duplicate error 1 件のみ発行される。total diags == 1 が成立。

5. **generatePermissions の変更なし（D4）**: permission.ts のロジック本体に変更なし。キー変化は structured-lines の operation フィールドが op ID（括弧なし）になった結果。TC-016 の parseFiles 経路テストが旧実装では `[[op-id]]` が括弧付きで red になることを設計上確認。

## 検証できなかった項目

None。すべての受け入れ基準・must TC・gate が確認済み。

## Findings 詳細

### 低優先度の観察（verdict に影響しない）

**F-001 — permissions.test.ts の自由トークン使用**

`generatePermissions: deterministic ordering` の describe 内のテスト群（`operation: "create"`, `"list"` 等）は、設計判断 D5 の意図通り文法非依存のユニットテストとして残している。テスト名から "spec §8 example" を除去済み（TC-020 ✅）。ただし D5 への参照コメントが describe ブロックにあると将来の読者に親切。style 観察であり defect ではない。

**F-002 — TC-008 アサーションの幅**

```ts
c6Diags.some((d) => d.message.includes("target") || d.message.includes("perm-deal"))
```

`||` の右辺は非空義務 error も満たしうる。ただしフィクスチャに有効な操作行があるため非空義務は発火しない。動作は正確でテストは正しく機能する。maintainability の観察のみ。
