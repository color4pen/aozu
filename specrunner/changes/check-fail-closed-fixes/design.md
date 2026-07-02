# Design: check-fail-closed-fixes

## Context

`src/check/` の閉包検証実装に、実機確認で確定した 2 件のバグが存在する。

**バグ 1: C3 fail-open（未知 prefix 素通り）**

`src/check/rules/c03-ref-resolved.ts` の縮退スキップ判定が「既知だが無効な型」と「未知 prefix」を区別していない。現在のコード:

```typescript
if (!enabledPrefixes.has(targetPrefix)) {
  continue; // 未知 prefix もここで素通りしてしまう
}
```

`enabledPrefixes` は有効層の prefix 集合（例: `enabled: static` なら `{mod, adr}`）であり、`KNOWN_PREFIXES` に存在しない prefix も「有効でない」として同じ continue パスに入る。結果、`[[zzz-typo]]` のような typo 参照が無診断で exit 0 相当を通過する（fail-open）。

**バグ 2: C11 診断の誤帰属**

`src/check/rules/c11-layer-direction.ts` の参照元要素の特定ロジックが不正確:

```typescript
const sourceElement = graph.rawElements.find((el) => el.file === ref.file);
```

この `find` はファイル内の**先頭要素**を返す。`actors.md` に `act-sales`（行 1）と `act-bad`（行 10）がある場合、`act-bad` のセクション内にある参照（行 15 等）も `act-sales` に帰属すると誤報告される。同じ問題が `c03-ref-resolved.ts` の参照元チェックにも存在するが、C3 は診断の `elementId` を `ref.targetId`（参照先）にしているため診断内容への影響はない。

**C1 の既存挙動**

`{#zzz-foo}` のような未知 prefix の宣言は `validateId` が `{ valid: false }` を返し、C1 が既にエラーとして検出する。変更不要。

現在の状態: 326 テスト全通過、`design/` の check 違反ゼロ。

## Goals / Non-Goals

**Goals**:

- C3 の縮退スキップを「既知だが無効な型」に限定し、未知 prefix 参照を常にエラーとして診断する（fail-closed）
- 参照の帰属要素を「参照行を含む見出しセクションの最直前要素」に修正する
- 帰属導出ロジックを 1 つの共有関数に集約し、C3・C11 の両方から呼ぶ
- 既存の縮退動作（既知だが無効な型への参照はスキップ）を維持する
- 既存 326 テスト無変更で green を維持する

**Non-Goals**:

- C3 以外の縮退意味論の変更
- findings-takt.md の他の指摘事項
- 新規則・新機能の追加

## Decisions

### D1: 未知 prefix の判定に二段判定を使用する

`checkC3` の参照先スキップ条件を以下に変更する:

```typescript
const isKnownPrefix = KNOWN_PREFIXES.has(targetPrefix);
if (isKnownPrefix && !enabledPrefixes.has(targetPrefix)) {
  continue; // 既知だが無効な型 → 縮退スキップ（従来どおり）
}
// 未知 prefix（isKnownPrefix が false）または既知+有効 → 評価する
```

`KNOWN_PREFIXES` は `src/parse/id.ts` で定義されており、`src/graph/index.ts` が re-export している。import パスは `../../graph/index.ts` 経由とし、`mod-check → mod-graph → mod-parse` の許可依存方向に従う（c01-id-grammar.ts 等の既存コードと同じ経路）。

参照元の縮退スキップ（参照元の prefix が無効な層に属する場合にスキップする）にも同じ二段判定を適用する。

**Rationale**: 仕様（spec/format.md §10 C3）が「縮退による評価除外は既知だが無効な型に限る」と明記している。`KNOWN_PREFIXES` と `enabledPrefixes` の 2 つの集合を使った二段判定が唯一の自然な実装。

**代替**: 未知 prefix を warning に留める — typo は閉包の誤りの入口であり、fail-closed 原則（inv-fail-closed-deps と同系）に従い error とする（architect 評価済み）。

**代替**: 未知 prefix の参照を C1 で拾う（宣言と同様）— C1 は「宣言」の ID 文法を検証する規則であり、「参照」の未知 prefix は C3 の責務（参照が解決できない、という閉包違反）とする。C1 を拡張しない。

### D2: 参照帰属の共有関数 `findOwningElement` を新設する

`src/check/attribution.ts`（新規ファイル）に以下の関数を作成する:

```typescript
export function findOwningElement(
  elements: Element[],
  file: string,
  line: number
): Element | undefined
```

アルゴリズム: `elements` の中から `el.file === file` かつ `el.line <= line` を満たす要素を全て抽出し、`el.line` が最大のもの（= 参照行に最も近い直前の要素宣言）を返す。該当なし（ファイル内に参照行より前の要素がない）なら `undefined`。

`checkC3` と `checkC11` の両方でこの関数を使って参照元の「所有要素」を特定する。

**Rationale**: 帰属導出の重複実装を排除することで、仮に他の規則でも同じ導出が必要になった場合に修正点が 1 箇所になる（architect 評価済み）。

**代替**: C11 のみ局所修正 — C3 にも同じ誤帰属パターンが潜在するため共有関数にする（将来の規則追加で再実装が生じる可能性を回避）。

**代替**: `findOwningElement` を `src/graph/` に置く — `mod-graph` は `mod-check` の下流であり、check 固有の帰属導出ロジックを graph に置くと凝集度が下がる。`mod-check` 内に置くことで `mod-graph` は汚染されない。

### D3: C3 の未知 prefix 参照診断メッセージ

未知 prefix の参照は `code: "C3"`, `level: "error"` で既存と同じ構造とする。メッセージは既存の未解決参照と識別可能にするため：

- 既知 prefix・未解決: `unresolved reference "[[mod-nonexist]]"`
- 未知 prefix: `unresolved reference "[[zzz-typo]]" (unknown prefix "zzz")`

この区別により診断の読者が「型定義の問題（typo）」か「宣言漏れ」かを判別できる。

**代替**: 同じメッセージ — 区別できる方が診断の有用性が高い。追加コストはゼロ。

## Risks / Trade-offs

- **[Risk] 既存テストが未知 prefix をスキップすることを前提にしている可能性** → 既存テストを精査した結果、未知 prefix の参照を明示的にスキップ確認しているテストは存在しない。`checkC3` の既存テストは既知 prefix（`seq`）の縮退を確認しており、今回の変更による影響を受けない。
- **[Risk] `findOwningElement` の境界条件** → 参照行より前に要素宣言がない場合（ファイル先頭の参照）は `undefined` を返す。現在の C3・C11 の実装は `undefined` の場合を「スキップしない（評価する）」として扱っており、共有関数に切り替えた場合も同じ動作を維持する。
- **[Trade-off] C3 の参照元スキップ精度向上は診断に影響しない** → C3 の診断 `elementId` は参照先 ID であり、参照元の誤帰属が診断内容を変えることはない。しかし `findOwningElement` の一元化によるコード整合性のために C3 の参照元チェックも修正する。

## Open Questions

なし（設計判断は architect 評価済み）。
