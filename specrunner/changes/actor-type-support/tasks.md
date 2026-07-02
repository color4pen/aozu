# Tasks: actor-type-support

## T-01: KNOWN_PREFIXES に act を追加する

- [x] `src/parse/id.ts` の `KNOWN_PREFIXES` Set に `"act"` を追加する（domain 層の他の prefix（`term`, `ent`, `inv`）の近傍に配置）

**Acceptance Criteria**:
- `KNOWN_PREFIXES.has("act")` が `true` を返す
- `validateId("act-approver")` が `{ valid: true }` を返す
- `tsc --noEmit` が成功する
- 既存テスト（`src/parse/id.test.ts`）が変更なしで green

## T-02: LAYER_MAP と LAYER_TO_PREFIXES に act を追加する

- [x] `src/check/manifest.ts` の `LAYER_MAP` に `act: "domain"` を追加する（`inv: "domain"` の直後に配置）
- [x] `src/check/manifest.ts` の `LAYER_TO_PREFIXES.domain` 配列に `"act"` を追加する（`["term", "ent", "inv", "act"]`）

**Acceptance Criteria**:
- `LAYER_MAP["act"]` が `"domain"` を返す
- `getEnabledPrefixes({ formatVersion: "0", enabled: ["static", "domain"] })` の結果に `"act"` が含まれる
- `getEnabledPrefixes({ formatVersion: "0", enabled: ["static"] })` の結果に `"act"` が含まれない（domain 無効時の段階縮退）
- `tsc --noEmit` が成功する
- 既存テスト（`src/check/manifest.test.ts`）が変更なしで green

## T-03: C5 の prefix 判定を mod|act に改訂する

- [x] `src/check/rules/c05-seq-actors.ts` のファイル冒頭コメントを更新: 「resolve to mod elements」→「resolve to mod or act elements」
- [x] `checkC5` 関数内に `const ALLOWED_ACTOR_PREFIXES = new Set(["mod", "act"])` を定義する
- [x] prefix 判定を `extractPrefix(actor.id) !== "mod"` から `!ALLOWED_ACTOR_PREFIXES.has(extractPrefix(actor.id))` に変更する
- [x] エラーメッセージを更新: `"is not a mod element"` → `"is not a mod or act element"` に変更する

**Acceptance Criteria**:
- act prefix の登場要素が C5 エラーを出さない
- mod prefix の登場要素が引き続き C5 エラーを出さない
- ent / term 等の prefix の登場要素が C5 エラーを出す
- 空の登場要素リストが C5 エラーを出す
- `tsc --noEmit` が成功する
- 既存テスト（`src/check/rules/c05-seq-actors.test.ts`）が変更なしで green

## T-04: C11 の LAYER_ALLOWED_TARGET_PREFIXES に act を追加する

- [x] `src/check/rules/c11-layer-direction.ts` のファイル冒頭コメントを更新: `domain (term/ent/inv)` → `domain (term/ent/inv/act)`
- [x] `LAYER_ALLOWED_TARGET_PREFIXES.domain` に `"act"` を追加: `new Set(["term", "ent", "inv", "act"])`
- [x] `LAYER_ALLOWED_TARGET_PREFIXES.static` に `"act"` を追加: `new Set(["mod", "term", "ent", "inv", "act"])`
- [x] `LAYER_ALLOWED_TARGET_PREFIXES.dynamic` に `"act"` を追加: `new Set(["seq", "mod", "term", "ent", "inv", "act"])`

**Acceptance Criteria**:
- domain 要素（term/ent/inv/act）から act への参照が C11 エラーを出さない
- static 要素（mod）から act への参照が C11 エラーを出さない
- dynamic 要素（seq）から act への参照が C11 エラーを出さない
- act 要素から mod への参照が C11 エラーを出す（domain → static は禁止）
- `tsc --noEmit` が成功する
- 既存テスト（`src/check/rules/c11-layer-direction.test.ts`）が変更なしで green

## T-05: C11 の act 関連テストを追加する

- [x] `src/check/rules/c11-layer-direction.test.ts` に以下のテストケースを **新規追加** する（既存テストは変更しない）:
  - `domain (act) → domain (term) reference → no diagnostics`: act 要素が term を参照 → C11 エラーなし
  - `domain (act) → mod reference → C11 diagnostic`: act 要素が mod を参照 → C11 エラー
  - `static (mod) → act reference → no diagnostics`: mod 要素が act を参照 → C11 エラーなし
  - `dynamic (seq) → act reference → no diagnostics`: seq 要素が act を参照 → C11 エラーなし
- [x] テスト内の `ALL_PREFIXES` 定数に `"act"` を追加する（既存テストの enabledPrefixes に act を含めて一貫性を保つ）
- [x] `STATIC_DOMAIN` 定数に `"act"` を追加する

**Acceptance Criteria**:
- 4 つの新規テストケースが green
- 既存テストケースが変更なしで green（ALL_PREFIXES / STATIC_DOMAIN の拡張は既存テストの意味を変えない）
- `bun test src/check/rules/c11-layer-direction.test.ts` が green

## T-06: C5 の act 関連テストを追加する

- [x] `src/check/rules/c05-seq-actors.test.ts` に以下のテストケースを **新規追加** する（既存テストは変更しない）:
  - `seq with act-only actors → no diagnostics`: 登場要素が act のみ → C5 エラーなし
  - `seq with mixed mod and act actors → no diagnostics`: 登場要素が mod + act → C5 エラーなし
  - `seq with act and ent actors → C5 diagnostic for ent only`: act と ent → ent のみ C5 エラー

**Acceptance Criteria**:
- 3 つの新規テストケースが green
- 既存テストケースが変更なしで green
- `bun test src/check/rules/c05-seq-actors.test.ts` が green

## T-07: 段階縮退の act 関連テストを追加する

- [x] `src/check/degradation.test.ts` に以下のテストケースを **新規追加** する（既存テストは変更しない）:
  - `act reference with domain disabled → no C3 diagnostic`: domain 無効時に act 参照が C3 で報告されない
  - `act actor in seq with domain disabled → no C5 diagnostic for act prefix`: domain 無効の fixture で seq の登場要素に act がある場合、C5 の prefix 判定は走らない（dynamic も無効なので C5 自体がスキップ）

**Acceptance Criteria**:
- 新規テストケースが green
- 既存テストケースが変更なしで green
- `bun test src/check/degradation.test.ts` が green

## T-08: C3 の未解決 act 参照テストを追加する

- [x] `src/check/rules/c03-ref-resolved.test.ts` に以下のテストケースを **新規追加** する（既存テストは変更しない）:
  - `unresolved act reference → C3 diagnostic`: 実在しない `act-nonexistent` への参照 → C3 エラー（enabledPrefixes に act を含む前提）
  - `resolved act reference → no C3 diagnostic`: 実在する act 要素への参照 → C3 エラーなし

**Acceptance Criteria**:
- 2 つの新規テストケースが green
- 既存テストケースが変更なしで green
- `bun test src/check/rules/c03-ref-resolved.test.ts` が green

## T-09: 統合テスト — act 要素を含む fixture で check exit 0

- [x] `src/check/integration.test.ts` または新規テストファイルに以下のテストケースを追加する:
  - actors.md（`{#act-approver}` 見出し要素）+ act を登場要素に含む seq の fixture を構築し、`runCheck` が exit 0（診断 0 件）になることを検証する
  - fixture は in-memory の ParseResult として構築する（ファイル I/O 不要）
  - fixture 構成: mod 要素、act 要素、seq 要素（登場要素: mod + act）、manifest enabled: static, domain, dynamic

**Acceptance Criteria**:
- act 要素 + seq の登場要素に act を含む fixture で `runCheck` が 0 件の診断を返す
- `bun test` で該当テストが green

## T-10: 最終検証

- [x] `tsc --noEmit` が成功する
- [x] `bun test` が全テスト green（既存 310 件 + 新規テスト）
- [x] `package.json` の `dependencies` が `{}` のまま
- [x] design/ に対する self-check（`src/check/integration.test.ts`）が引き続き green
- [x] `design/rules.json` に対する `export rules --verify` が exit 0

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- 既存 310 テストが変更なしで green
- `dependencies` が空
- `export rules --verify` が exit 0
