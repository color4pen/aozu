# Tasks: check-fail-closed-fixes

## T-01: 帰属導出ヘルパー `findOwningElement` の実装

- [ ] `src/check/attribution.ts` を新規作成する
- [ ] `import type { Element } from "../parse/types.ts";` を使用する（`mod-check → mod-graph → mod-parse` の許可依存に従い、`src/graph/index.ts` 経由の re-export を使う: `import type { Element } from "../graph/index.ts";`）
- [ ] `findOwningElement(elements: Element[], file: string, line: number): Element | undefined` を実装する:
  - `elements` を線形スキャンし、`el.file === file` かつ `el.line <= line` を満たす要素を収集する
  - `el.line` が最大の要素（= 参照行に最も近い直前の宣言）を返す
  - 該当する要素が 1 件もない場合は `undefined` を返す
- [ ] `src/check/attribution.test.ts` を新規作成し、以下のケースを単体テストで固定する:
  - ファイルに要素が 1 件のみ → その要素が返される
  - ファイルに要素が 2 件あり参照が後方要素のセクション内 → 後方要素が返される
  - ファイルに要素が 2 件あり参照が先頭要素のセクション内（後方要素宣言より前） → 先頭要素が返される
  - 参照行がファイル内の最初の要素宣言より前 → `undefined` が返される
  - 参照ファイルが `elements` に存在しない → `undefined` が返される
  - 複数ファイルが混在する `elements` で正しいファイルの要素のみが候補になる

**Acceptance Criteria**:
- `src/check/attribution.ts` が `findOwningElement` を export している
- `bun test src/check/attribution.test.ts` が green
- `tsc --noEmit` が成功する

---

## T-02: C3 の fail-open 修正（未知 prefix 参照を常にエラーとする）

- [ ] `src/check/rules/c03-ref-resolved.ts` を修正する
- [ ] `KNOWN_PREFIXES` を `../../graph/index.ts` から import に追加する（既存の `extractPrefix` import と同じファイル）
- [ ] `findOwningElement` を `../attribution.ts` から import する
- [ ] 参照先の縮退スキップ条件を二段判定に変更する（現在: `!enabledPrefixes.has(targetPrefix)` → 変更後: `KNOWN_PREFIXES.has(targetPrefix) && !enabledPrefixes.has(targetPrefix)`）:
  ```typescript
  // 既知だが無効な型 → 縮退スキップ（従来どおり）
  if (KNOWN_PREFIXES.has(targetPrefix) && !enabledPrefixes.has(targetPrefix)) {
    continue;
  }
  // 未知 prefix → 評価する（fall through）
  ```
- [ ] 参照元の所有要素特定を `findOwningElement` に切り替える:
  - 変更前: `graph.rawElements.find((el) => el.file === ref.file)`
  - 変更後: `findOwningElement(graph.rawElements, ref.file, ref.line)`
- [ ] 参照元の縮退スキップ条件も二段判定に変更する:
  ```typescript
  if (sourceElement) {
    const sourcePrefix = extractPrefix(sourceElement.id);
    if (KNOWN_PREFIXES.has(sourcePrefix) && !enabledPrefixes.has(sourcePrefix)) {
      continue;
    }
  }
  ```
- [ ] 未知 prefix の参照診断メッセージを識別可能にする（既知 prefix の未解決と区別するため）:
  - 未知 prefix の場合: `` `unresolved reference "[[${ref.targetId}]]" (unknown prefix "${targetPrefix}")` ``
  - 既知 prefix・未解決の場合（現行と同じ）: `` `unresolved reference "[[${ref.targetId}]]"` ``

**Acceptance Criteria**:
- `src/check/rules/c03-ref-resolved.test.ts` の既存テストが全て変更なしで green を維持する
- `bun test src/check/rules/c03-ref-resolved.test.ts` が green

---

## T-03: C3 テストへの新規ケース追加（fail-closed と縮退維持の固定）

- [ ] `src/check/rules/c03-ref-resolved.test.ts` に以下のテストケースを追加する:

  **未知 prefix 参照の fail-closed**:
  - `enabled: static`（`enabledPrefixes = {mod, adr}`）の環境で、`mod-intake` 要素が存在するファイル内に `[[zzz-typo]]` 参照がある → `checkC3` が C3 エラー診断を返す
  - 診断の `code` が `"C3"`, `level` が `"error"` であることを assert する
  - 診断のメッセージに `"zzz-typo"` と `"zzz"` が含まれることを assert する

  **縮退の維持（既知 prefix・無効な型はスキップ）**:
  - `enabled: static`（`enabledPrefixes = {mod, adr}`）の環境で、`mod-intake` 要素が存在するファイル内に `[[ent-x]]` 参照がある → `checkC3` が診断を返さない
  - 既存の `it("reference to disabled-type element → no C3 diagnostic")` との重複を避け、新テストは `ent` prefix を使った明示的ケースとする

**Acceptance Criteria**:
- 未知 prefix 参照（`[[zzz-typo]]`）のテストが C3 診断を assert する
- 既知だが無効な型への参照（`[[ent-x]]` with `enabled: static`）のテストが診断ゼロを assert する
- `bun test src/check/rules/c03-ref-resolved.test.ts` が green

---

## T-04: C11 の参照元誤帰属修正

- [ ] `src/check/rules/c11-layer-direction.ts` を修正する
- [ ] `findOwningElement` を `../attribution.ts` から import する
- [ ] 参照元の所有要素特定を `findOwningElement` に切り替える:
  - 変更前: `graph.rawElements.find((el) => el.file === ref.file)`
  - 変更後: `findOwningElement(graph.rawElements, ref.file, ref.line)`
- [ ] 変数名を `sourceElement` のままとし、`undefined` の場合の `continue` ガードは既存の `if (!sourceElement) continue;` をそのまま維持する

**Acceptance Criteria**:
- `src/check/rules/c11-layer-direction.test.ts` の既存テストが全て変更なしで green を維持する
- `bun test src/check/rules/c11-layer-direction.test.ts` が green
- `tsc --noEmit` が成功する

---

## T-05: C11 テストへの新規ケース追加（複数要素ファイルの正帰属固定）

- [ ] `src/check/rules/c11-layer-direction.test.ts` に以下のテストケースを追加する:

  **複数要素ファイルで後方要素のセクション内違反が正しい elementId に帰属する**:
  - `actors.md` に `act-sales`（行 1）と `act-bad`（行 10）を宣言する
  - `actors.md` の行 15 に `[[mod-sales]]` という参照を作成する（domain 要素 `act-bad` が mod-sales を参照 → C11 違反。`act-bad` セクション内）
  - `mod-sales` を `modules.md` に宣言する
  - `checkC11` を `ALL_PREFIXES` で呼ぶ → C11 診断が 1 件返る
  - 診断の `elementId` が `"act-bad"` であることを assert する（`"act-sales"` ではない）
  - 診断のメッセージに `"act-bad"` が含まれることを assert する

  **先頭要素のセクション内違反は先頭要素に帰属する（回帰テスト）**:
  - 既存テスト `domain (act) → mod reference → C11 diagnostic` が既にこのケースを固定しているため、追加不要。ただし既存テストを確認し、ファイルに要素が 1 件しかない（先頭要素 = 唯一要素）ことを確認する

**Acceptance Criteria**:
- 複数要素ファイルのテストが `elementId: "act-bad"` を assert する
- `bun test src/check/rules/c11-layer-direction.test.ts` が green

---

## T-06: 全体検証

- [ ] `tsc --noEmit` が成功する（型エラーゼロ）
- [ ] `bun test` が全テスト green（既存 326 件 + 今回追加分）
- [ ] `design/` に対する統合テスト（`src/check/integration.test.ts`）が引き続き違反ゼロを返す
- [ ] `package.json` の `dependencies` が `{}` のまま（実行時依存ゼロを維持）

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- 既存テスト 326 件が変更なしで green
- 統合テストが `design/` の check で違反ゼロを確認する
- `dependencies` が空
