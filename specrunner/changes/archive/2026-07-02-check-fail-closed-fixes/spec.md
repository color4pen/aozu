# Spec: check-fail-closed-fixes

## Requirements

### Requirement: C3 は未知 prefix を持つ参照を常にエラーとして診断する

C3 の縮退スキップは「`KNOWN_PREFIXES` に存在し、かつ enabled 集合に含まれない型」に限定される。`KNOWN_PREFIXES` に存在しない prefix を持つ参照（例: `[[zzz-typo]]`）は、manifest の `enabled` 集合によらず常に `code: "C3"`, `level: "error"` として診断されなければならない（SHALL）。

#### Scenario: 未知 prefix 参照の fail-closed

**Given** manifest が `enabled: static` を宣言し、`static` 層の要素（`mod-intake` 等）が宣言されているデザイン  
**When** そのデザイン内のファイルに `[[zzz-typo]]` という参照が存在する  
**Then** `checkC3` が C3 エラー診断を返し、`bun test` で check が失敗（exit 1 相当）として固定される

#### Scenario: 既知 prefix・無効な型への参照は従来どおりスキップ

**Given** manifest が `enabled: static` のみを宣言する  
**When** `static` 層のファイルに `[[ent-x]]` という参照（`ent` は `KNOWN_PREFIXES` に存在するが `domain` が無効）がある  
**Then** `checkC3` はその参照を評価せず、C3 診断を返さない

---

### Requirement: 参照の帰属要素を「参照行を含むセクションの所有要素」で決定する

ファイル内に複数の要素宣言が存在する場合、任意の参照の帰属要素は「同ファイル内で参照行以下の最大行番号を持つ要素」でなければならない（SHALL）。この導出はすべての帰属を使用する規則（現在: C3・C11）で共通の関数 `findOwningElement` を通じて行う。

#### Scenario: 複数要素ファイルの後方要素への帰属

**Given** `actors.md` に `act-sales`（行 1）と `act-bad`（行 10）が宣言され、`act-bad` のセクション内の行 15 に C11 違反参照がある  
**When** `checkC11` が評価される  
**Then** 診断の `elementId` が `act-bad` になる（`act-sales` ではない）

#### Scenario: ファイル先頭要素の参照は先頭要素に帰属

**Given** ファイルに `act-sales`（行 1）のみが宣言され、行 3 に参照がある  
**When** `findOwningElement` が `(elements, file, 3)` で呼ばれる  
**Then** `act-sales` が返される

#### Scenario: 参照行より前に要素がない場合は undefined

**Given** ファイル内の行 2 に参照があるが、ファイル内で最初の要素宣言が行 5 にある  
**When** `findOwningElement` が `(elements, file, 2)` で呼ばれる  
**Then** `undefined` が返される

---

### Requirement: C1 の既存挙動（未知 prefix 宣言の検出）を維持する

未知 prefix の要素宣言（`{#zzz-foo}` 等）は C1 が `validateId` によりエラーとして検出する。この挙動は変更しない（SHALL NOT change）。

#### Scenario: 未知 prefix 宣言は C1 エラー（現状維持）

**Given** `{#zzz-foo}` という宣言が存在する  
**When** `checkC1` が評価される  
**Then** `code: "C1"` のエラー診断が返される（変更なし）
