# Code Review Feedback — iteration 001

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
- iteration line format (exact): `- **iteration**: NNN` (3-digit zero-padded integer)
- Findings table MUST have exactly 7 columns in this order:
  # | Severity | Category | File | Description | How to Fix | Fix
  - Fix column: yes = fixer should address this finding; no = skip (pre-existing / out-of-scope)
- Scores table columns: Category | Score | Weight
  - Valid Category values: correctness | security | architecture | performance | maintainability | testing
  - Score: integer 1-10
  - Weight: decimal as defined below
- total line format (exact): `- **total**: <decimal>`
- Default weights: correctness=0.30, security=0.25, architecture=0.15, performance=0.10, maintainability=0.10, testing=0.10
- Scores table is optional but recommended.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | MEDIUM | testing | src/cli/commands/prompt.test.ts | TC-011（must: "Error case has no stdout"）に対応する明示的アサーションがない。stage gate テスト（loop 無効 / topic 不存在 / design 不在 / 引数不足）はいずれも exit code と stderr のみを assert しており、`stdout === ""` を検証していない。受け入れ基準「stdout に診断が混ざらないこと」の正常系は `handleSession — stdout/stderr separation` でカバーされているが、エラー系は未ピン留め。実装は全エラーパスが stdout 書き込み前に return するため機能上の問題はないが、TC-011 は must TC であり契約テストが欠けている。 | `handleSession — stage gates` の任意の 1 ケース（例: `topic not found`）に `const stdout = await new Response(proc.stdout).text(); expect(stdout).toBe("");` を追加して TC-011 を網羅する。 | yes |
| 2 | LOW | testing | src/cli/commands/prompt.test.ts | static モジュール縮約の上限（`実装:` 行が stdout に含まれないこと）が未テスト。`createSessionFixture` は `実装: src/core/` を含む fixture を生成するが、その行が stdout に現れないことを assert するテストがない。実装は `責務:` 行のみを抽出しており正しいが、退行を検出できない。（request-review-result-001 finding #2 の継続） | 正常系テストに `expect(stdout).not.toContain("実装: src/core/")` を追加して縮約上限を固定する。 | yes |
| 3 | LOW | testing | src/cli/commands/prompt.test.ts | `--topic` に `top` 以外の prefix を持つ有効 ID（例: `ent-order`）を渡した場合の exit 2 が未テスト。実装は `topicEl.prefix !== "top"` を正しく検証しているが、このパスを通るテストケースがない。（request-review-result-001 finding #1 の継続） | `handleSession — stage gates` にケース追加: `--topic ent-order` を渡したとき exit 2 かつ stderr に診断が含まれることを assert する。`createSessionFixture` をそのまま流用可能。 | yes |
| 4 | LOW | maintainability | src/cli/commands/prompt.ts | L449 付近: `責務:` 行が存在しない mod 要素に対して `(no 責務: line found)` プレースホルダを出力しているが、design.md D5 は「見出しのみを出力する」と規定している。TC-029（should）はプレースホルダの有無をテストしていないため動作上の問題はないが、設計仕様との文言上の乖離がある。 | D5 コメントを「責務: 行欠落時はプレースホルダを出力する」に更新して実装と揃えるか、実装を `return \`### ${id}\`;`（見出しのみ）に変更して D5 に揃える。どちらが正しいかは設計の意図による。コードのみ修正する場合はコメント更新で十分。 | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 10 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 8 | 0.10 |
| testing | 7 | 0.10 |

- **total**: 8.95

## Summary

### 動作検証結果

- `bun test src/prompt/session.test.ts`: 42 pass / 0 fail ✓
- `bun test src/cli/commands/prompt.test.ts`: 48 pass / 0 fail ✓
- `bun test`（全体 50 ファイル）: 605 pass / 0 fail ✓
- `tsc --noEmit`: exit 0（型エラーなし）✓
- `package.json` `dependencies`: `{}` 空 ✓

### must TC 網羅状況（15 件）

| TC | カバー状況 |
|----|-----------|
| TC-001 引用あり topic で全注入スコープが stdout に含まれる | ✓ `handleSession — normal case stdout` 9 テスト |
| TC-002 引用 0 件 topic で縮小プロンプト | ✓ `handleSession — no-refs topic` 8 テスト |
| TC-003 3-hop 要素本文が除外される | ✓ `3-hop element body (ent-hop3) is NOT in stdout` |
| TC-006 loop 無効で exit 1 | ✓ `loop disabled → exit 1` |
| TC-007 topic 不存在で exit 2 | ✓ `topic not found → exit 2` |
| TC-008 design dir 不在で exit 2 | ✓ `design directory not found → exit 2` |
| TC-009 繰り返し呼び出しで stdout が同一 | ✓ `two runs with same fixture produce byte-identical stdout` |
| TC-010 正常系で stdout クリーン（stderr が空） | ✓ `normal case: stdout is non-empty, stderr is empty` |
| TC-011 エラー系で stdout が空 | ⚠ 未テスト（Finding #1） |
| TC-015 全 8 セクションが含まれる | ✓ `output contains all 8 required sections` |
| TC-016 同一入力でバイト同一出力 | ✓ `same input produces byte-identical output on two calls` |
| TC-020 --topic フラグで topic ID が渡る | ✓ `exit 0 on normal case` |
| TC-021 --topic 引数なしで exit 2 | ✓ `missing --topic argument → exit 2` |
| TC-025 ファイルシステムへの書き込みなし | ✓ `does not write any files to the design directory` |
| TC-026 2-hop 境界が強制される | ✓ `3-hop element body is NOT in stdout` |

15 件中 14 件カバー済み。TC-011 のみ Finding #1 として報告。

### 実装品質評価

**`src/prompt/session.ts`**: 純関数 `buildSessionInstruction` は正しく設計されている。全 8 セクション・3 種の空入力フォールバック・`SESSION_MAX_HOPS` / `FORMAT_RULES_SUMMARY` / `SESSION_GUIDANCE` の export がすべて実装されており、tasks.md T-01 の AC を満たしている。

**`src/cli/commands/prompt.ts`**: `handleSession` のパイプラインは tasks.md T-03 の 13 ステップと対応している。seed ソート（`[...seedIdSet].sort()`）・neighbor ソート（`[...neighborIdSet].sort()`）・termInv ソート・mod ソートが全箇所に実装されており、決定的出力の保証が正しい。`extractAllBodies` が入力配列順に Map を構築する実装（body.ts 確認）と組み合わせて、末端の `buildSessionInstruction` が Map をイテレーション順に出力しても決定的になる。

**セキュリティ**: `handleSession` に `resolveTemplate`（シェルコマンド実行）相当の処理はなく、`prompt derive` の shell injection surface を継承しない。ファイル書き込みなし、入力検証（topicId の prefix check + dirExists）あり、実行時依存ゼロ（`package.json` `dependencies: {}`）。

**依存関係**: `src/prompt/session.ts` は外部依存ゼロ。`src/cli/commands/prompt.ts` の追加 import（`extractReferences` = mod-parse、`buildSessionInstruction` 等 = mod-prompt）は `design/static/dependencies.md` の許可依存範囲内（`mod-cli -> mod-parse`、`mod-cli -> mod-prompt`）。

**dispatch**: `handlePrompt` に `session` 分岐追加、help テキストと Available リストに `session` 列挙済み（T-05 AC を満たす）。既存 `derive` テスト 48 件が変更なしで green。

**docs/open-questions.md 論点 8**: 初版実装済みの注記が追加されており、T-06 AC を満たす。`SESSION_MAX_HOPS` への参照も含まれている。

### 総合評価

CRITICAL / HIGH 相当の問題なし。機能的正確性は高く、spec とコードの整合性は良好。Finding #1（TC-011 未テスト）は MEDIUM であり次イテレーション以内での修正が望ましいが、実装そのものは正しいため PR のブロッカーにはならない。Finding #2・#3 は LOW であり修正推奨だが optional。Finding #4 はフィクサースキップ相当（設計判断が必要なためコードレビューの範疇外）。
