# Tasks: prompt propagate / prompt review

## T-01: 共有ヘルパーの抽出（src/prompt/shared.ts）

- [ ] `src/prompt/shared.ts` を新規作成する
- [ ] `SESSION_MAX_HOPS` 定数を `src/prompt/session.ts` から `src/prompt/shared.ts` に `SCOPE_MAX_HOPS` として移動する（値は `2` を維持）
- [ ] `src/prompt/session.ts` で `export { SCOPE_MAX_HOPS as SESSION_MAX_HOPS } from "./shared.ts"` として re-export し、既存の import パスを壊さない
- [ ] `FORMAT_RULES_SUMMARY` は `src/prompt/session.ts` から `src/prompt/shared.ts` に移動する（propagate / review で共有するため）。session.ts からは re-export する
- [ ] `handleSession`（src/cli/commands/prompt.ts L423-435）の term/inv 収集ロジックを `collectTermsAndInvariants(graph: Graph, files: FileInput[]): string` として `src/prompt/shared.ts` に抽出する。ID 辞書順ソート → extractAllBodies → `### id\nbody` 形式連結。body が null/空の場合は `(body not available)` プレースホルダ
- [ ] `handleSession`（src/cli/commands/prompt.ts L438-452）の static mod 縮約ロジックを `collectStaticModulesSummary(graph: Graph, files: FileInput[]): string` として `src/prompt/shared.ts` に抽出する。ID 辞書順ソート → extractElementBody → `責務:` 行抽出 → `### id\n責務: ...` 形式連結
- [ ] `handleSession` を抽出した関数の呼び出しに書き換える
- [ ] `src/prompt/shared.test.ts` を新規作成し、collectTermsAndInvariants / collectStaticModulesSummary の単体テストを書く（Graph と FileInput のミニマルなモックを使用）

**Acceptance Criteria**:
- `src/prompt/shared.ts` が存在し、SCOPE_MAX_HOPS / FORMAT_RULES_SUMMARY / collectTermsAndInvariants / collectStaticModulesSummary を export している
- `src/prompt/session.ts` が SESSION_MAX_HOPS / FORMAT_RULES_SUMMARY を re-export している
- `bun test src/prompt/session.test.ts` が全テスト pass（テストファイル無変更）
- `bun test src/prompt/derive.test.ts` が全テスト pass（テストファイル無変更）
- `bun test src/cli/commands/prompt.test.ts` の session / derive テストが全 pass（テストファイルの session/derive 部分無変更）
- `bun test src/prompt/shared.test.ts` が pass
- `tsc --noEmit` が pass

## T-02: buildPropagateInstruction 純関数の実装（src/prompt/propagate.ts）

- [ ] `src/prompt/propagate.ts` を新規作成する
- [ ] `PropagateInput` インターフェースを定義する: `adrId: string`, `adrBody: string`, `seedBodies: Map<string, string>`, `neighborBodies: Map<string, string>`, `termsAndInvariants: string`, `staticModulesSummary: string`, `enabledLayers: string[]`, `formatRulesSummary: string`, `propagateGuidance: string`
- [ ] `PROPAGATE_GUIDANCE` 定数を定義する。内容: (a) この ADR の決定を design/ の全該当層に反映せよ、(b) 反映のたびに `aozu check` を回せ、(c) 完了条件は check exit 0 かつ決定内容の全層一致、(d) `[[id]]` 引用で変更した要素を明示せよ
- [ ] `buildPropagateInstruction(input: PropagateInput): string` 純関数を実装する。セクション構成: (1) ADR（id + body）、(2) Seed Element Bodies、(3) Neighborhood Element Bodies (2-hop)、(4) Terms and Invariants、(5) Static Modules、(6) Enabled Layers、(7) Format Rules、(8) Propagation Guidance。session の buildSessionInstruction と同型の parts.push + join("\n") パターンを踏襲する
- [ ] 空の seedBodies / neighborBodies に対するプレースホルダ（`(no seed elements — ADR has no [[id]] citations)` / `(no neighborhood elements)`）を出力する
- [ ] `src/prompt/propagate.test.ts` を新規作成する。derive.test.ts / session.test.ts と同型の makeInput + セクション別テスト: 全 8 セクションの存在、各セクションの内容、空入力フォールバック、決定性（2 回呼び出しでバイト同一）

**Acceptance Criteria**:
- `src/prompt/propagate.ts` が PropagateInput / PROPAGATE_GUIDANCE / buildPropagateInstruction を export している
- `bun test src/prompt/propagate.test.ts` が全テスト pass
- buildPropagateInstruction の出力に全 8 セクションが含まれること
- 同一入力で 2 回呼び出した結果がバイト同一であること
- `tsc --noEmit` が pass

## T-03: handlePropagate CLI ハンドラの実装

- [ ] `src/cli/commands/prompt.ts` に `handlePropagate(args: string[]): Promise<number>` を追加する
- [ ] 引数解析: `--adr <adr-id>` 必須、`--dir <path>` オプション（default: `./design`）、`--help` / `-h` 対応
- [ ] design ディレクトリ不在 → exit 2 + stderr 診断
- [ ] パイプライン構築: readMarkdownFiles → parseFiles → parseManifest → buildGraph（session と同型）
- [ ] loop gate を**課さない**（isLayerEnabled のチェックなし）
- [ ] ADR 要素の検索: `graph.elements.get(adrId)` で取得、prefix が `adr` でなければ exit 2 + stderr
- [ ] ADR 本文抽出: `extractElementBody(adrId, graph, files)` で取得
- [ ] seed 抽出: `extractReferences(adrBody, adrEl.file)` → graph に存在する ID のみフィルタ → ソート
- [ ] seed 本文: `extractAllBodies(seedIds, graph, files)`
- [ ] 近傍計算: `computeNeighborhood(seedIds, graph, SCOPE_MAX_HOPS)` → ソート → `extractAllBodies`
- [ ] 常時全量枠: `collectTermsAndInvariants(graph, files)` / `collectStaticModulesSummary(graph, files)` を呼び出す（T-01 の共有ヘルパー）
- [ ] `buildPropagateInstruction` を呼び出して stdout に書き出す
- [ ] `handlePrompt` の dispatch に `"propagate"` → `handlePropagate(args.slice(1))` を追加する
- [ ] `handlePrompt` の help テキスト、error メッセージの Available リストに `propagate` を追加する

**Acceptance Criteria**:
- `src/cli/commands/prompt.test.ts` に以下の fixture テストを追加して全 pass:
  - propagate 正常系: ADR fixture（引用あり）で exit 0、stdout に ADR 本文・seed 本文・近傍本文・inv/term・static mod 縮約・format rules・propagate guidance が含まれる
  - propagate 2-hop 境界: 3-hop 要素が stdout に含まれないこと
  - propagate 引用 0 件: exit 0、seed/近傍プレースホルダが stdout に含まれる
  - propagate ADR 不存在: exit 2 + stderr 診断
  - propagate adr 以外の prefix: exit 2 + stderr 診断
  - propagate design 不在: exit 2
  - propagate --adr 引数欠落: exit 2
  - propagate loop 無効: exit 0（loop gate を課さないことの固定）
  - propagate 決定性: 2 回実行で stdout バイト同一
  - propagate stderr 空（正常系）
  - propagate ファイル書き込みなし
- `handlePrompt` の dispatch テスト: `"propagate"` を受け付けること
- `handlePrompt` の help / error メッセージに `"propagate"` が含まれること

## T-04: buildReviewInstruction 純関数の実装（src/prompt/review.ts）

- [ ] `src/prompt/review.ts` を新規作成する
- [ ] `ReviewInput` インターフェースを定義する: `allBodies: Map<string, string>`, `formatRulesSummary: string`, `reviewGuidance: string`
- [ ] `REVIEW_GUIDANCE` 定数を定義する。内容: (a) 以下の全要素を読み、意味的な矛盾・不整合を findings として列挙せよ、(b) 1 行 1 finding 形式: `<関与する要素 ID> — <矛盾の説明>`、(c) verdict（採否）は人の領分であると明記、(d) check が検出する構造違反（参照切れ・ID 重複・リンク義務欠落 — C1〜C11 の範囲）はレビュー対象外であると明記
- [ ] `buildReviewInstruction(input: ReviewInput): string` 純関数を実装する。セクション構成: (1) All Element Bodies（ID 辞書順）、(2) Format Rules、(3) Review Guidance。parts.push + join("\n") パターン
- [ ] `src/prompt/review.test.ts` を新規作成する。テスト: 全 3 セクションの存在、要素 ID 辞書順の確認、空入力フォールバック、REVIEW_GUIDANCE の check 除外指示の存在、決定性

**Acceptance Criteria**:
- `src/prompt/review.ts` が ReviewInput / REVIEW_GUIDANCE / buildReviewInstruction を export している
- `bun test src/prompt/review.test.ts` が全テスト pass
- buildReviewInstruction の出力に全 3 セクションが含まれること
- REVIEW_GUIDANCE に check 除外の文言が含まれること
- 同一入力で 2 回呼び出した結果がバイト同一であること
- `tsc --noEmit` が pass

## T-05: handleReview CLI ハンドラの実装

- [ ] `src/cli/commands/prompt.ts` に `handleReview(args: string[]): Promise<number>` を追加する
- [ ] 引数解析: `--dir <path>` オプション（default: `./design`）、`--help` / `-h` 対応。review はターゲット要素を取らない（コーパス全体が対象）
- [ ] design ディレクトリ不在 → exit 2 + stderr 診断
- [ ] パイプライン構築: readMarkdownFiles → parseFiles → buildGraph（manifest / isLayerEnabled は不要 — loop gate なし）
- [ ] 全要素の ID 辞書順ソート → `extractAllBodies` で本文取得
- [ ] `buildReviewInstruction` を呼び出して stdout に書き出す
- [ ] `handlePrompt` の dispatch に `"review"` → `handleReview(args.slice(1))` を追加する
- [ ] `handlePrompt` の help テキスト、error メッセージの Available リストに `review` を追加する

**Acceptance Criteria**:
- `src/cli/commands/prompt.test.ts` に以下の fixture テストを追加して全 pass:
  - review 正常系: 全要素の本文が stdout に含まれ、ID 辞書順であること
  - review findings 書式指示が stdout に含まれること
  - review 「check の領分は対象外」指示が stdout に含まれること
  - review loop 無効: exit 0（loop gate を課さないことの固定）
  - review design 不在: exit 2
  - review 決定性: 2 回実行で stdout バイト同一
  - review stderr 空（正常系）
  - review ファイル書き込みなし
- `handlePrompt` の dispatch テスト: `"review"` を受け付けること
- `handlePrompt` の help / error メッセージに `"review"` が含まれること

## T-06: 全体の回帰検証

- [ ] `bun test src/prompt/session.test.ts` が全テスト pass（テストファイル無変更であること）
- [ ] `bun test src/prompt/derive.test.ts` が全テスト pass（テストファイル無変更であること）
- [ ] `bun test src/cli/commands/prompt.test.ts` の既存 session / derive テストが全 pass（既存テストケースの変更なし）
- [ ] `tsc --noEmit` pass
- [ ] `bun test` 全体 pass
- [ ] package.json の dependencies が空であること

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- session.test.ts / derive.test.ts のファイル差分がゼロ（`git diff` で確認）
- prompt.test.ts の既存テストケース部分の差分がゼロ（追加のみ）
- package.json の `dependencies` フィールドが空オブジェクト `{}`
