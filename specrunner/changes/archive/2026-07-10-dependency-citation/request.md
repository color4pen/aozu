# 依存行の実装 — check --request の依存引用対応と coverage の被覆除外（ADR-0024）

## Meta

- **type**: new-feature
- **slug**: dependency-citation
- **base-branch**: main
- **adr**: false

<!-- 設計判断は ADR-0024（adr/0024-dependency-citation.md、merge 済み）で決定済み。本 request は確定仕様の実装であり新規 ADR は不要 -->

## 背景

request 文書中の `[[id]]` は被覆の宣言に単義化されており、implemented 要素の引用は入口ゲート R2 で不合格になる。「この request が変更しない依存要素」を宣言する場所が無く、実地で回避運用（コード表記による抽出除外）が発生した（docs/findings/aosora-2026-07-04.md #1）。ADR-0024 が依存行を決定し、spec/integration.md §1（依存行の文法と検証の二種類化）・§4（消費者前提の追記）は merge 済み。本 request はこの確定仕様を src/ に実装する。

依存: [[mod-parse]], [[mod-cli]], [[mod-plan]], [[mod-graph]]

## 現状コードの前提

- `check --request` は src/cli/commands/check.ts の `handleCheckRequest`（:73-169）。`extractReferences`（src/parse/references.ts — §6 のコードフェンス・インラインコード除外を実装）で全引用を抽出し、targetId で dedup 後、R0（--require-citation で引用 0 件）/ R1（未解決）/ R2（implemented 引用）を診断する。diagnostics が 1 件でもあれば exit 1
- coverage の草稿引用抽出は src/cli/commands/coverage.ts:214-215 — `extractReferences` の結果をそのまま `draftRefs: Set<string>` にして純関数 `verifyCoverage`（src/plan/coverage.ts:79）へ渡す。NOT_COVERED 判定（coverage.ts:91）はこの Set を見る
- 構造行の認識は src/parse/structured-lines.ts に集約（責務: / 実装: / 依存辺 / 登場要素 / elements: / perm 操作行 / 対象: 行）。行頭パターンの正規表現 + 認識結果の型（src/parse/types.ts）という定型がある
- request 文書は design/ の外にあり、graph には乗らない。依存行は request 文書専用の構造行であり、design 文書のパースには影響しないこと

## 要件

1. **依存行の認識**（mod-parse）: 行頭 `依存: [[id]](, [[id]])*` の行を依存宣言として認識する。§6 の除外規則を尊重する（コードフェンス内の行は依存行ではない）。認識は request 文書の引用分類として提供する — 例: `extractRequestCitations(content, path)` が「被覆引用（依存行の外）/ 依存引用（依存行の上）/ 不正な依存行」を返す。既存 `extractReferences` の挙動（design 文書での全引用抽出）は変えない
2. **不正な依存行は fail-closed**: 行頭が `依存:` で始まるのに文法全体（`依存: [[id]](, [[id]])*`、1 件以上・カンマ区切り）に一致しない行は、黙って被覆引用に落とさず error 診断（コード R3、当該行番号つき）とする。引用の静かな誤分類（依存のつもりが被覆として R2 で弾かれる/逆）を許さない
3. **check --request の二種類化**（integration.md §1）:
   - 依存引用: 実在解決のみ検証（未解決は R1）。**状態は問わない**（implemented でも合格）
   - 被覆引用: 従来どおり R1 + R2（designed | requested のみ合格）
   - 同一 ID が依存行と本文の両方に現れた場合、本文側の被覆引用として R2 の対象になる（依存宣言は被覆引用を免除しない — 分類は出現箇所ごと）
   - `--require-citation`（R0）が数えるのは**被覆引用のみ**（依存引用だけの文書は R0 不合格）
4. **coverage の被覆除外**（integration.md §1「coverage も同じ規則で除外する」）: 草稿の引用抽出を依存行対応の分類に差し替え、依存引用を `draftRefs` に含めない（依存行にしか現れない要素は NOT_COVERED になる）。草稿に不正な依存行があれば要件 2 と同じく不合格。純関数 `verifyCoverage` のシグネチャは可能な限り不変（分類は呼び出し側の責務）
5. **診断の書式維持**: `<LEVEL> <CODE> <id> <message>` の 1 行 1 診断・stderr・exit code 規約（0/1/2）は不変
6. **既存挙動の後方互換**: 依存行を含まない request 文書に対する check --request / coverage の診断・exit code は現状と完全一致（既存テスト無変更で green）

## スコープ外

- `prompt derive` テンプレート・ガイダンスへの依存行の案内追加（別 request。知らない消費者の従来運用は壊れない — ADR-0024 Consequences）
- trace 動詞（依存引用は将来の材料だが本 request では消費しない）
- design 文書側の文法変更（依存行は request 文書専用。spec §6 の参照文法は不変）
- spec-runner 側の受け口変更

## 受け入れ基準

- [ ] `依存: [[ent-a]], [[ent-b]]` 行を持つ request で、ent-a が implemented でも check --request が exit 0（依存引用は状態不問。テスト）
- [ ] 同じ ID を本文（依存行の外）でも引用すると、implemented なら R2 で exit 1（出現箇所ごとの分類。テスト）
- [ ] 依存行上の未解決 ID は R1 で exit 1（実在解決は課される。テスト）
- [ ] `依存: [[ent-a]] と [[ent-b]]` のような文法不一致行が R3 error で exit 1（fail-closed。テスト）
- [ ] `--require-citation` は被覆引用 0 件（依存引用のみ）の文書を R0 で不合格にする（テスト）
- [ ] コードフェンス内の `依存:` 行は無視される（§6 除外。テスト）
- [ ] coverage: plan グループ要素が依存行にしか現れない草稿は NOT_COVERED（テスト）
- [ ] 依存行の無い既存 request 文書・草稿に対する診断が現状と完全一致(既存テスト無変更で green)
- [ ] aozu 自身の design/ の check 結果が不変
- [ ] `bunx tsc --noEmit` && `bun test` が green

## architect 評価済みの設計判断

- **採用: 依存行の認識は mod-parse（structured-lines.ts の同族）に置く** / 却下: check.ts 内のローカル正規表現 — 構造行の認識は一箇所に集約する現行設計に従う。ただし依存行は request 文書専用なので、design 文書のパース経路（parseFiles）には組み込まないこと
- **採用: 分類（被覆/依存）は抽出時に行い、検証側は分類済みの入力を受ける** / 却下: verifyCoverage に依存行の知識を足す — 純関数の入力（Set）を保ち、mod-plan に行文法の知識を持ち込まない
- **採用: 不正依存行は error（R3）** / 却下: 警告や静かな被覆扱い — fail-closed 原則（列挙の意図が読めない行を黙って解釈しない）
