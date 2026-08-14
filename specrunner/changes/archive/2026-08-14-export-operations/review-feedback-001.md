# Code Review Feedback — iteration 1

<!-- EVIDENCE REPORT FORMAT:
     verdict は CLI が typed findings から導出する。この file に verdict 行を書かない。
     findings は report_result（typed）で報告し、この file はその補足の evidence report である。
-->

## 検証した項目

### 読んだファイル

- `src/export/operations.ts` — 純関数実装全体
- `src/cli/commands/export.ts` — operations サブコマンド追加箇所と既存 rules/permissions との干渉確認
- `src/export/index.ts` — re-export 追加
- `src/export/operations.test.ts` — 全 14 テスト
- `src/cli/commands/export.test.ts` — 全 27 テスト（新規 5 + 既存 22）
- `src/export/permissions.ts` — パターン参照・実装との整合確認
- `src/graph/attribution.ts` — `findOwningElement` の動作確認
- `src/graph/types.ts`, `src/parse/types.ts` — Graph / TargetLine / ImplementationEntry 型確認
- `src/graph/builder.ts` — `makeGraph` ヘルパーの `buildGraph` 呼び出し確認
- `spec/format.md §11` — 出力スキーマ・決定性規約の照合

### 実行した検証

- `bunx tsc --noEmit` → エラーなし
- `bun test src/export/operations.test.ts` → 14 pass / 0 fail
- `bun test src/cli/commands/export.test.ts` → 27 pass / 0 fail
- `bun test src/` (全 src/ テスト) → 902 pass / 0 fail

> Note: `bun test` 全体では 13 fail が出るが、これは `tests/packaging.test.ts` の `npm pack` が npm キャッシュ権限問題（EPERM / root-owned files）で失敗するもの。`git show main:tests/packaging.test.ts` で main にも存在することを確認済みの pre-existing 環境問題。本 PR の変更には無関係。

### TC カバレッジ (test-cases.md 対比)

| TC | 優先度 | 対応テスト | 状態 |
|---|---|---|---|
| TC-001 | must | operations.test.ts | ✓ |
| TC-002 | must | operations.test.ts | ✓ |
| TC-003 | must | operations.test.ts | ✓ |
| TC-004 | must | operations.test.ts | ✓ |
| TC-005 | must | operations.test.ts | ✓ |
| TC-006 | must | operations.test.ts | ✓ |
| TC-007 | must | operations.test.ts | ✓ |
| TC-008 | must | operations.test.ts | ✓ |
| TC-009 | must | export.test.ts | ✓ |
| TC-010 | must | export.test.ts | ✓ |
| TC-011 | must | export.test.ts | △ (詳細後述) |
| TC-012 | must | export.test.ts | ✓ |
| TC-013 | must | gate (bun test src/) | ✓ |
| TC-014 | must | gate (bun test src/) | ✓ |
| TC-015 | must | operations.test.ts | ✓ |
| TC-016 | should | operations.test.ts | ✓ |
| TC-017 | should | operations.test.ts | ✓ |
| TC-018 | should | operations.test.ts | ✓ |
| TC-019 | should | export.test.ts | ✓ |
| TC-020 | should | operations.test.ts | ✓ |
| TC-021 | must | gate (tsc --noEmit) | ✓ |
| TC-022 | must | gate (bun test src/) | ✓ |

## 検証できなかった項目

None — 全受け入れ基準を直接確認済み。

## Findings 詳細

### [LOW] TC-011: stdout 非出力の検証が未記述

spec §11 の TC-011 シナリオは「stdout には何も出力されず」を要件として含む。現テスト（`export.test.ts` L447–464）はファイルへの書き出しと exit 0 のみを検証しており、stdout への誤出力は検出できない。

```typescript
// 現在のテスト（stdout チェックなし）
const exitCode = await handleExport(["operations", "--dir", dir, "--out", outPath]);
expect(exitCode).toBe(0);
const content = await readFile(outPath, "utf-8");
expect(output.operations[0].id).toBe("op-confirm-order");
```

実装側は `--out` 指定時に `process.stdout.write` を呼ばない正しい構造になっており、実際のバグは存在しない。テストの網羅性の欠如のみ。なお既存 `export permissions` テストも同様に stdout 非出力をアサートしていないため、プロジェクトの許容水準に合わせて対応可否を判断する。

---

## 正常確認事項（アクション不要）

- **純関数性**: `generateOperations` はファイル I/O なし。`seenIds` / `targetsByOpId` / `implsByOpId` を毎回ローカル生成するため呼び出し間の副作用なし
- **決定性**: `impls.sort()` はローカル Map 上のみの変更。同一 graph への 2 回呼び出しで同一結果（TC-006, TC-015 で検証済み）
- **既存コード無変更**: `git diff main...HEAD` で `src/export/permissions.ts`, `src/export/generator.ts`, `src/export/types.ts`, `src/graph/attribution.ts`, `src/parse/types.ts`, `src/graph/types.ts` はすべて差分なし
- **後方互換**: rules / permissions の既存 22 テストが変更なしで green（TC-013, TC-014）
- **subcommand 分岐**: `permissions` → `operations` → `rules` の順で評価。3 ブランチとも独立しており干渉なし
- **deduplication**: `seenIds` で first-seen。`targetsByOpId` / `implsByOpId` の `seenIds.has(owner.id)` チェックで重複 op 要素に帰属する行が orphan にならない
- **cross-file attribution**: `findOwningElement` は同一ファイル内のみを走査。異なるファイルへの `対象:` / `実装:` は op に帰属しない（既存 permissions と同じ意味論）
- **出力スキーマ**: spec §11 の `format-version: 0` / `operations` 配列 / `id` / `name` 必須・`target` / `implementation` 条件付き省略に完全準拠
