# Spec Review Result

<!-- EVIDENCE REPORT FORMAT:
     verdict は CLI が typed findings から導出する。この file に verdict 行を書かない。
     findings は report_result（typed）で報告し、この file はその補足の evidence report である。
     decision-needed の finding がある場合は escalation として扱われる。
-->

## 検証した項目

**確認した成果物**:
- `specrunner/changes/op-element/request.md` — 要件・受け入れ基準・architect 評価済み設計判断
- `specrunner/changes/op-element/design.md` — D1〜D7 全設計判断・Goals / Non-Goals・Risks
- `specrunner/changes/op-element/tasks.md` — T-01〜T-10 全タスク・各 AC
- `specrunner/changes/op-element/spec.md` — 全 Requirement + Scenario の Given/When/Then

**確認したソースファイル（ベースライン）**:
- `src/parse/id.ts` — KNOWN_PREFIXES（op 未登録を確認）
- `src/check/manifest.ts` — LAYER_MAP、LAYER_TO_PREFIXES（op 未登録を確認）
- `src/check/rules/c11-layer-direction.ts` — LAYER_ALLOWED_TARGET_PREFIXES（domain に op なし）
- `src/plan/frontier.ts` — IMPLEMENTATION_PREFIXES（op なし）
- `src/parse/structured-lines.ts` — PERM_OPERATION_LINE_RE（旧自由トークン形式）、PERM_TARGET_LINE_RE（単一参照のみ）
- `src/parse/types.ts` — PermOperation・PermTarget・ParseResult 型（MalformedPermOperation・TargetLine 未追加）
- `src/graph/types.ts` — Graph インタフェース（permTargets フィールドあり）
- `src/graph/builder.ts` — buildGraph（permTargets を伝搬）
- `src/check/rules/c06-view-links.ts` — checkPermission（op 参照検証なし、malformed 検出なし）
- `src/export/permissions.ts` — generatePermissions（自由トークンをキーに使用）
- `src/export/permissions.test.ts` — makeGraph（permTargets フィールドあり）、既存テスト名確認
- `src/check/rules/c06-view-links.test.ts` — makeGraph（permTargets フィールドあり）

**spec.md の品質確認**:
- 全 Requirement に `SHALL` / `MUST` を含む normative keyword あり ✓
- 全 Requirement に 1 つ以上の Scenario あり ✓
- 全 Scenario が Given/When/Then 形式 ✓
- Layer-1 振る舞い中心（Layer-0 の混入は JSDoc / テスト名 Scenario 2 件のみ — 明示的要件のため許容範囲と判断）

**request.md ↔ design.md ↔ tasks.md ↔ spec.md の整合確認**:
- T-01〜T-06、T-08、T-10 は request・design・spec と整合 ✓
- T-07 (テスト名変更のみ) は request.md 要件 7 と整合 ✓
- **T-09 に不整合を検出（後述 F-1）**

**セキュリティ確認（OWASP Top 10）**:
- 本変更はローカル CLI ツールの静的テキスト解析機能であり、ネットワーク・認証・外部システム連携なし
- 新規 RE（`/^- \[\[([a-z0-9-]+)\]\]: (\[\[.+)$/`、`/^- ([^\s:]+): (\[\[.+)$/`、`/^対象: (.+)$/`）に ReDoS リスクなし（アンカー付き、交替なし、カタストロフィックバックトラックなし）
- キャプチャ対象は `[a-z0-9-]+` に厳密制限されており、入力値の injection リスクなし
- OWASP A01〜A10 いずれも N/A

## 検証できなかった項目

- `spec/format.md` の §8・§10 の現行テキスト（T-08 の変更対象）と spec.md Scenario の目標状態との乖離は確認済みだが、T-08 実装後の最終状態が正確に目標通りになるかは実装後にしか確認できない

## Findings 詳細

### F-1: tasks.md T-09 が request.md 要件 7 および design D5 と矛盾する（Medium / fixable）

**場所**: `specrunner/changes/op-element/tasks.md`、T-09 の第 1 チェック項目

**現行の T-09 記述**:
> `src/export/permissions.test.ts` の PermOperation の operation フィールドを **op ID に変更する**（直接構築テスト。generatePermissions 自体は不変なのでキーが op ID に変わる）

**request.md 要件 7**:
> 既存テスト「spec §8 example: perm-deal with list and create」（src/export/permissions.test.ts）は**自由トークンのまま残してよい**が、テスト名から spec §8 への言及を外す（generatePermissions が文法非依存の純関数であることの検証と位置づける）

**design D5 の却下理由**:
> PermOperation の直接構築 → 却下。テストが噛まない。

**矛盾の内容**:
- request・design は「直接構築テストは文法非依存の純関数テストとして free-token のまま残す。op ID キー検証は T-10 の実パース経由テストで行う」と明示
- T-09 は「直接構築テストで operation フィールドを op ID に変更する」と指示しており、これは request が「不要」と判断した変更を追加している
- さらに T-09 の指示に従うと既存アサーション（`expect(Object.keys(perm.operations)).toEqual(["create", "list"])`）も変更が必要になるが、T-09 はアサーション変更に触れておらず、実装が不完全になるか、逆に過剰な変更が生じるリスクがある
- spec.md は request と整合（"export permissions test name updated" Scenario は名前のみ変更と記述）

**修正方針**: T-09 の第 1 チェック項目を削除し、`permissions.test.ts` の変更スコープを「テスト名のみ（T-07）」と明記する。op ID キー検証は T-10 の実パース経由テストのみで行う。

---

### F-2: tasks.md T-09 が permTargets → targetLines 移行を test helper に言及していない（Low / fixable）

**場所**: `specrunner/changes/op-element/tasks.md`、T-09

**内容**:
T-02 は `ParseResult.permTargets: PermTarget[]` を `targetLines: TargetLine[]` に置換し、`PermTarget` 型を削除する。しかし `permissions.test.ts` と `c06-view-links.test.ts` の `makeGraph` ヘルパー（現在 `permTargets: []` を初期値として持つ）は `ParseResult` 型と直接マッチする形で記述されており、T-02 完了後は TypeScript コンパイルエラーになる。

T-09 はこの移行を明示的に扱っていないため、タスク記述が不完全である。ただし「`bunx tsc --noEmit` が green」という AC が両タスクにあるため、実装時に必然的に発覚し修正される。

**修正方針**: T-09 のチェック項目に「`makeGraph` ヘルパーの `permTargets` を `targetLines` に更新する（T-02 後の型整合）」を追加する。あるいは T-02 の AC に「`c06-view-links.test.ts` および `permissions.test.ts` の `makeGraph` ヘルパーが `ParseResult` 型と整合する」を追加する。
