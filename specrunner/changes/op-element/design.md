# Design: op 要素の実装 — op 型の追加と perm 操作行の op 参照化

## Context

spec/format.md は ADR-0025 により op 型（domain 層）と perm 操作行の op 参照文法を確定済み。現在の src/ は op を認識しない:

- `KNOWN_PREFIXES`（src/parse/id.ts:10）に op がない → C1 が未知 prefix として拒否
- `LAYER_MAP`（src/check/manifest.ts:62）/ `LAYER_TO_PREFIXES`（:149）に op がない → C3 縮退・C11 の層判定が効かない
- `LAYER_ALLOWED_TARGET_PREFIXES`（src/check/rules/c11-layer-direction.ts:22）に op がない → 各層から op への参照が C11 違反になる
- `IMPLEMENTATION_PREFIXES`（src/plan/frontier.ts:43）に op がない → mark implemented / frontier の対象外
- perm 操作行は `PERM_OPERATION_LINE_RE`（src/parse/structured-lines.ts:33）= `/^- ([^\s:]+): (\[\[.+)$/` で認識 → `[[op-id]]` は括弧ごと自由トークンとして誤認識
- `対象:` 行は `PERM_TARGET_LINE_RE`（:39）= `/^対象: \[\[([a-z0-9-]+)\]\]$/` で単一参照のみ → op の複数参照 `対象:` を認識できない
- `export permissions` は PermOperation.operation（自由トークン）をキーに排出 → op ID キーへの変更が必要

変更対象モジュール: mod-parse, mod-check, mod-graph, mod-export, mod-plan。
移行対象の corpus は存在しない（ADR-0025 D4）。旧文法テストは新文法へ書き換え。

## Goals / Non-Goals

**Goals**:

1. op prefix を KNOWN_PREFIXES・LAYER_MAP・LAYER_TO_PREFIXES に追加し、既存の層機構に載せる
2. C11 の LAYER_ALLOWED_TARGET_PREFIXES の domain / static / dynamic / views 全集合に op を追加する
3. op の `対象:` 行を複数参照で認識する（structured-lines に新パターン追加）
4. perm の `対象:` 行の複数参照を C6 error にする（perm は単一参照のみ — ADR-0023 D2）
5. perm 操作行を `- [[op-id]]: [[act-id]]...` に変更し、C6 で op 参照解決・op prefix 検証・一意性を検証する
6. 自由トークン操作行を malformed として検出し C6 error にする（fail-closed）
7. IMPLEMENTATION_PREFIXES に op を追加する
8. export permissions の operations キーが op ID になることを検証する
9. spec/format.md の転記漏れ箇所を更新する
10. JSDoc コメント・テスト名を新文法に整合させる

**Non-Goals**:

- `export operations` の実装（別 request）
- C5（seq の登場要素）への op 追加
- op スキーマの拡張（入出力・事前条件）
- prompt derive テンプレートへの op 案内

## Decisions

### D1: op は宣言的定数への追記だけで層機構に載せる

op 専用の検証規則は新設しない。KNOWN_PREFIXES・LAYER_MAP・LAYER_TO_PREFIXES・LAYER_ALLOWED_TARGET_PREFIXES への追記のみで C1〜C3・C11・縮退が自動的に適用される。

Rationale: 型はツールの知識（宣言的定数）、検証は層機構の一貫適用という現行設計に従う。op 固有ルールを作ると同じロジックの分散になる。
Alternative: op 専用の checkOp 関数を新設 → 却下。既存機構で十分であり冗長。

### D2: `対象:` 行の perm/op 分類は所属要素の prefix で決める

structured-lines の `対象:` 認識を汎用化する:
- 新 RE: `/^対象: (.+)$/` でキャプチャし、内部で `[[id]]` を全抽出
- findOwningElement で帰属要素を判定し、prefix で分類:
  - `op` → 新たな opTargets に格納（`OpTarget { targetIds: string[]; file; line }` — 複数参照可）
  - `perm` → permTargets に格納。参照が 2 つ以上ある行は permMultiTargetLines に行番号つきで保持し、C6 が error を発行する。permTargets には先頭 ID のみ格納（export permissions の既存挙動不変）
  - その他 → 無視

ただし、structured-lines は帰属判定（findOwningElement）を行わない設計（パーサは位置情報を付与するだけで、帰属は消費側が判定する）。この原則を維持するため:

- structured-lines は `対象:` 行を **汎用的な TargetLine 型** `{ targetIds: string[]; file; line }` として認識・格納する
- ParseResult / Graph に `targetLines: TargetLine[]` を追加する
- 消費側（C6, export）が findOwningElement で帰属を判定し、prefix に応じた検証を行う
- 既存の `permTargets` は削除し、消費側が targetLines から perm 帰属のものを抽出する

Rationale: 同一の行文面（`対象: [[ent-order]]`）が両文脈で合法なため、RE の試行順序ではなく所属要素で分類するのが正確。パーサの帰属非関与原則も維持する。
Alternative: structured-lines 内で findOwningElement を呼んで分類 → 却下。パーサに帰属ロジックを持ち込む設計上の逸脱。ただし現状の structured-lines は帰属判定をせずフラットに返す設計であり、permOperations / permTargets もフラットリストで返して消費側が findOwningElement で分類している。これと同様に targetLines もフラットに返す。

### D3: perm 操作行の二段認識（form-matching → op 参照検証）

Phase 1（structured-lines）:
- 新 RE `PERM_OPERATION_LINE_RE`: `/^- \[\[([a-z0-9-]+)\]\]: (\[\[.+)$/` → operation フィールドに op ID（括弧なし）を格納。PermOperation 型は変更不要（operation: string のまま）
- 旧形式キャッチ用 RE `PERM_OPERATION_LINE_RE_LEGACY`: `/^- ([^\s:]+): (\[\[.+)$/`（現行 RE と同一）。新 RE に不一致だが旧 RE にマッチ → malformed 操作行として `MalformedPermOperation { file; line; text }` に保持
- ParseResult / Graph に `malformedPermOperations: MalformedPermOperation[]` を追加

Phase 2（C6 checkPermission）:
- malformed 操作行: 帰属 perm ごとに error 診断を発行（行番号つき）
- 有効操作行の op 参照: graph.elements で lookup し、存在チェック + prefix が `op` であることを検証
- act 参照の prefix 検証（既存ロジックを維持）
- 非空義務: 有効操作行の本数で判定（malformed は数えない）
- op 参照の perm 内一意: seenOps の検証対象が自由トークンから op ID に変わるだけ（ロジック不変）

Rationale: 「分類は抽出時・診断は消費側」の定型（extractRequestCitations の malformedLines と同型）。パーサは error を出さない。
Alternative: structured-lines で直接 error → 却下。パーサは diagnostics を ID 文法違反のみに限定する設計。

### D4: export permissions のキーは op ID（generatePermissions の変更不要）

generatePermissions は PermOperation.operation フィールドをそのまま operations のキーに使う。op 参照化により structured-lines が operation フィールドに op ID を格納するため、出力キーは自動的に op ID になる。generatePermissions 自体のコード変更は不要。

Rationale: generatePermissions は文法非依存の純関数。入力データの意味が変わるだけで、ロジックは不変。
Alternative: generatePermissions 内で op ID への変換ロジックを追加 → 却下。不要な間接化。

### D5: export permissions の op ID キー検証テストは実パース経由

generatePermissions 自体は変更されないため、直接構築テストでは旧文法と新文法を区別できない。markdown fixture を実パース（parseFiles → buildGraph → generatePermissions）して、出力キーが op ID であることを検証する。旧実装なら `[[op-id]]` が括弧ごとトークンになるため red。

Rationale: テストが文法変更を検出する力を持つ。
Alternative: PermOperation の直接構築 → 却下。テストが噛まない。

### D6: spec/format.md 転記更新（3 箇所）

1. §8 perm の `対象:` 記述に「単一参照。複数参照は C6 違反」を追記
2. §10 C6 の義務列挙に「perm 対象行の単一制約」を追記
3. §10 C11 の記述 `domain（term / ent / inv / act）` に `op` を追加

§11 permissions export の例キー・§8 perm 操作行文法・§8 op スキーマは ADR-0025 merge 時に更新済み。

### D7: PermTarget の廃止と TargetLine への統合

現在の `PermTarget { targetId: string; file; line }` は単一参照前提。op の複数参照対応にあたり:
- `TargetLine { targetIds: string[]; file; line }` を新設
- ParseResult / Graph の `permTargets: PermTarget[]` を `targetLines: TargetLine[]` に置換
- 消費側（C6, generatePermissions）は targetLines から findOwningElement で帰属要素を判定し、perm 帰属なら `targetIds[0]` を使用（既存挙動維持）、op 帰属なら全 targetIds を保持（export operations が将来消費）

Rationale: perm と op で別の対象行型を持つより、汎用型 + 消費側分類が型数を減らす。
Alternative: PermTarget を残しつつ OpTarget を追加 → 型が増えるだけで利点なし。

## Risks / Trade-offs

[Risk] `PERM_TARGET_LINE_RE` の汎用化で既存の perm `対象:` 認識が壊れる → Mitigation: 新 RE `/^対象: (.+)$/` は旧 RE のスーパーセット。単一参照は `[[id]]` 抽出で 1 要素リストになり、消費側が `targetIds[0]` を取る既存パスが動く。既存テストで回帰検出。

[Risk] PERM_OPERATION_LINE_RE の変更で旧文法の操作行が malformed に分類される → Mitigation: 移行対象の corpus がないため実害なし（ADR-0025 D4）。テストは新文法へ書き換え。

[Risk] malformed 検出の旧 RE と新 RE の隙間で行が両方に不一致 → Mitigation: 旧 RE は `[^\s:]+` で広いため `[[op-id]]` 形式も必ずマッチする。`- ` で始まり `: [[` を含む行は必ず旧 RE にマッチするため漏れない。

[Trade-off] PermTarget の廃止は Graph 型の破壊的変更 → 消費箇所は C6 と generatePermissions の 2 箇所のみ。影響範囲は局所的で、コンパイルエラーが漏れを検出する。

## Open Questions

なし。設計判断はすべて ADR-0025 で決定済み、architect 評価済み。
