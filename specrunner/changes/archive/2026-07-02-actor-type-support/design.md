# Design: actor-type-support

## Context

ドッグフーディング（clearflow-2026-07-02）で seq の登場要素が mod 限定のためロール・承認者を記述できない構造的欠落が確認された。adr/0015 により act 型（アクター）を domain 層のコア型として追加する決定が確定し、spec/format.md の §2・§4・§8・§10 は既に更新済み。本変更は実装を仕様に追随させる。

現状コード:

- `src/parse/id.ts` の `KNOWN_PREFIXES`: 18 prefix。`act` は含まれていない
- `src/check/manifest.ts` の `LAYER_MAP`: domain 層は `term / ent / inv` の 3 prefix
- `src/check/manifest.ts` の `LAYER_TO_PREFIXES.domain`: `["term", "ent", "inv"]`
- `src/check/rules/c05-seq-actors.ts`: `extractPrefix(actor.id) !== "mod"` で mod 以外を拒否
- `src/check/rules/c11-layer-direction.ts` の `LAYER_ALLOWED_TARGET_PREFIXES`: `domain` / `static` / `dynamic` の 3 行がそれぞれ独立した hardcoded Set で `LAYER_MAP` とは別テーブル
- 既存テスト 310 件 green、`design/rules.json` 正常

レビュー結果（request-review-result-001）からの注意点:

- C11 の `LAYER_ALLOWED_TARGET_PREFIXES` は `LAYER_MAP` とは独立した別テーブル。LAYER_MAP 追加だけでは C11 は更新されない（request.md の architect 注記は C3・縮退のみ正確）
- `LAYER_ALLOWED_TARGET_PREFIXES` の `domain` / `static` / `dynamic` 全 3 行に `act` を追加する必要がある

## Goals / Non-Goals

**Goals**:

- `KNOWN_PREFIXES` に `act` を追加する（ID 文法: `act-<slug>`）
- `LAYER_MAP` に `act: "domain"` を追加する
- `LAYER_TO_PREFIXES.domain` に `"act"` を追加する（getEnabledPrefixes / 段階縮退の一貫性）
- C5 を改訂する: seq 登場要素の prefix 許可を `mod` のみから `mod | act` に拡張する
- C11 の `LAYER_ALLOWED_TARGET_PREFIXES` の `domain` / `static` / `dynamic` 全 3 行に `act` を追加する
- act を含むテスト fixture で受け入れ基準をすべて回帰固定する
- 既存 310 テストを変更なしで green に保つ

**Non-Goals**:

- permission ビュー（act × 操作のマトリクス）
- scaffold への actors.md 対応
- init テンプレートへの actors.md 追加
- clearflow 側の design/ の書き直し
- spec/format.md §12 の未決項目の更新（別機会）

## Decisions

### D1: テーブル駆動 — 4 箇所の宣言的テーブルへの追加で完結させる

変更対象は以下の 4 つの宣言的テーブルと 1 つの規則関数のみ:

1. `KNOWN_PREFIXES`（`src/parse/id.ts`）— `"act"` を追加
2. `LAYER_MAP`（`src/check/manifest.ts`）— `act: "domain"` を追加
3. `LAYER_TO_PREFIXES.domain`（`src/check/manifest.ts`）— `"act"` を追加
4. `LAYER_ALLOWED_TARGET_PREFIXES`（`src/check/rules/c11-layer-direction.ts`）— `domain` / `static` / `dynamic` の 3 行すべてに `"act"` を追加
5. `checkC5`（`src/check/rules/c05-seq-actors.ts`）— prefix 判定を `!== "mod"` から `!== "mod" && !== "act"` に変更

act に対する特別扱い分岐（if prefix === "act" のような条件分岐）は書かない。テーブル駆動の原則を維持する。

**Rationale**: architect 評価済みの設計判断に従う。C3 の参照解決・段階縮退は `LAYER_MAP` + `LAYER_TO_PREFIXES` への追加で自動的に波及する。C11 のみ独立テーブルのため別途更新が必要。C5 は規則の意味が変わる（mod-only → mod|act）ため、判定条件の修正が必要。

**代替**: act prefix を特別扱いする分岐を各規則に追加する — テーブル駆動の設計原則に反する。将来の型追加時に同様の分岐が増殖するリスクがある。却下。

### D2: C5 の prefix 判定を Set ベースに変更する

現在の C5 は `extractPrefix(actor.id) !== "mod"` という単一比較。act 追加により許可 prefix が 2 つになるため、`const ALLOWED_ACTOR_PREFIXES = new Set(["mod", "act"])` として Set.has() による判定に変更する。

**Rationale**: 将来さらに許可 prefix が増えた場合も Set への追加で済む。`!== "mod" && !== "act"` のような論理積の連鎖より可読性が高い。

**代替**: `!== "mod" && !== "act"` の条件連結 — 許可 prefix が 3 つ以上になった場合に条件式が肥大化する。拡張性で劣る。

### D3: 既存テストを変更せず新規テストのみ追加する

既存の 310 テストは一切変更しない。act 追加に関するテストはすべて新規テストとして追加する。既存テストが変更なしで green であることが受け入れ基準の一つ。

**Rationale**: 既存テストが act 未対応の前提で書かれている（例: C5 テストの「non-mod actor → C5 diagnostic」は `ent-order` を使用しており act とは無関係）。これらは act 追加後も同じ振る舞いを期待できる。

**代替**: 既存テストのケース名やコメントを更新する — 不要な差分が生じ、レビュー負荷が増す。

## Risks / Trade-offs

- **[Risk] LAYER_ALLOWED_TARGET_PREFIXES の更新漏れ** → D1 で 3 行すべての更新を明示。テスト（T-05）で domain→act 許可・static→act 許可・dynamic→act 許可を個別に検証することで漏れを検出する。request-review で指摘された mod→act の検証もテストに含める
- **[Risk] 既存 C5 テストの「non-mod actor → C5 diagnostic」が act 追加で壊れる可能性** → 既存テストは `ent-order`（prefix: ent）を使っているため act 追加の影響を受けない。リスク低
- **[Risk] act から他の層への参照が C11 で許可される誤実装** → act は domain 層に属するため、domain の参照制約（domain 内のみ参照可）が適用される。act→mod 参照が C11 でブロックされることをテストで固定する
- **[Trade-off] C5 の docstring 更新が必要** → ファイル冒頭コメントの仕様記述が「mod に解決される」のままだと misleading。更新する

## Open Questions

（なし — adr/0015 で設計判断確定済み、request-review で指摘された LAYER_ALLOWED_TARGET_PREFIXES の更新漏れリスクも D1 で対処済み）
