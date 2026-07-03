# Request Review Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- The verdict line MUST appear before the Findings table.
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approve | needs-discussion | reject
  - approve:          No blocking findings (no HIGH, no decision-needed). Request is ready for pipeline execution.
  - needs-discussion: One or more blocking findings (HIGH or decision-needed) resolvable through discussion.
  - reject:           Multiple blocking findings AND requirement contradictions or structural breakdown.
- Findings table MUST have exactly 6 columns in this order:
  # | Severity | Category | Location | Description | Recommendation
- Valid Severity values (uppercase): HIGH | MEDIUM | LOW
  - HIGH:   Request-level defect — goal unclear, acceptance criteria absent/untestable, or critical external constraint unspecified
  - MEDIUM: Scope ambiguity, recommended additions
  - LOW:    Clarity improvements, expression refinements
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approve

## Findings

| # | Severity | Category | Location | Description | Recommendation |
|---|----------|----------|----------|-------------|----------------|
| 1 | LOW | 受け入れ基準 | 受け入れ基準（exit code 節） | `--topic` に `top` 以外の prefix を持つ有効 ID（例: `ent-foo`）を渡した場合の挙動が受け入れ基準に明示されていない。"topic 不存在" の語義からは exit 2 が自然だが、実装者が edge case として見落とすリスクがある。 | 受け入れ基準に「`--topic` に top 以外の prefix の ID を指定した場合は exit 2（topic 不存在）」を一行追加する。実装の工数はゼロだが、テストが境界を固定する。 |
| 2 | LOW | 受け入れ基準 | 受け入れ基準（static 縮約節） | 要件 2(d) で「見出し + 責務行のみ」と定義しているが、受け入れ基準に「実装: 行が stdout に含まれないこと」を確認するテストが示されていない。上限の検証が欠けると、縮約でなく全文が出力されてもテストが通ってしまう。 | 受け入れ基準に「static モジュール縮約の stdout に `実装:` 行が含まれないことをテストで固定する」を追加する。 |

## Review Notes

### 検証した前提条件（すべて正確）

- `src/cli/commands/prompt.ts` — `handlePrompt` が `derive` のみにディスパッチ。`computeNeighborhood` / `extractAllBodies` をすでに import 済み。exit code 0/1/2 の契約を確認。
- `src/graph/neighborhood.ts:24` — `computeNeighborhood(seedIds, graph, maxHops)` の in/out 双方向走査・seed 除外の動作を確認。
- `src/graph/body.ts:48` / `:105` — `extractElementBody` / `extractAllBodies` のシグネチャを確認。
- `src/prompt/derive.ts:59` — `buildDeriveInstruction(input)` が純関数（I/O なし）であることを確認。
- `spec/format.md §2` / `§8` — `topics/<slug>.md` が `top` 要素、フロントマター `id` / 任意 `source`、本文=症状・動機の構造を確認。
- `spec/format.md §5〜§7` — 宣言構文 `{#id}`、参照構文 `[[id]]`、frontmatter 規約を確認。
- `design/manifest.md` — `enabled: static, domain, dynamic`（loop 無効）を確認。テストは合成 fixture で行う旨の前提と整合。
- `design/static/modules.md` — `mod-prompt` の責務「参照グラフ近傍のスコープ選択と、テンプレートへの文脈注入による指示の組み立て」が `buildSessionInstruction` の実装先として適切であることを確認。
- ADR-0008 動詞表 — `prompt session --topic <id>` が未実装として掲載されていることを確認。
- ADR-0006 — topic は曖昧でよく引用義務なし（引用 0 件を正常とする前提と整合）を確認。
- ADR-0018 — `addressed` は計算導出（ADR `topics:` 引用）、作法指示として含めることとの整合を確認。
- ADR-0012 — `prompt derive` はテンプレートを manifest 注入するが、`prompt session` はテンプレートを aozu 所有（コード内）とする設計判断の根拠と整合することを確認。

### 要件・設計判断の評価

- **注入スコープ**（要件 2）: seed = topic 本文の `[[id]]` 参照 → `computeNeighborhood` に渡す seedIds として既存 API を再利用できる。`graph.references.bySource.get(topEl.file)` でファイル内参照を取得し `ref.targetId` を seed にする経路が成立することを確認。
- **引用 0 件の正常系**（要件 3）: seedIds が空のとき `computeNeighborhood` は空集合を返す（実装確認済み）。出力 = (a)+(c)〜(f) のみ、となる。
- **pure function + I/O 分離**（要件 5）: `buildDeriveInstruction` パターンと完全に対称。`src/prompt/session.ts` に `buildSessionInstruction` を置くことを明示している点で実装誘導が適切。
- **決定的出力**（要件 6）: ID 辞書順の明示があり、受け入れ基準にバイト同一テストが含まれている。
- **設計判断 4 件**（architect 評価済み節）: すべて採択理由 + 却下代替案が明記されており、実装時の判断ブレを防ぐ品質になっている。

### 総合

HIGH / decision-needed 相当の問題なし。受け入れ基準は機械検証可能で網羅的。既存インフラの再利用経路が明確。LOW 2 件は実装前に修正すると実装者の境界が明確になるが、ブロッカーではない。
