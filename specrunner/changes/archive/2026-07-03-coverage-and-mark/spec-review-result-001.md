# Spec Review Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- The verdict line MUST appear before the Findings table.
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:    specification is complete, consistent, and ready for implementation
  - needs-fix:   specification has issues that must be resolved before implementation
  - escalation:  unresolvable conflicts, missing context, or requires human judgment
- Findings table MUST have exactly 6 columns in this order:
  # | Severity | Category | File | Description | How to Fix
- Valid Severity values (uppercase): CRITICAL | HIGH | MEDIUM | LOW
  - CRITICAL: production outage, data loss, security breach
  - HIGH:     functional failure, clear bug, no workaround — blocks approval
  - MEDIUM:   quality degradation, maintainability issue, future risk
  - LOW:      informational, style, minor improvement
- If no findings, write a table row with "None" or omit the table body.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: needs-fix

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | HIGH | Consistency | design.md D9 / tasks.md T-07 | `computeFrontier` 内部シグネチャが D9 と T-07 で矛盾している。D9「変更後のシグネチャ」は 4 パラメータ（`frontmatters` を `addressedTopics` に置換）を明示する。T-07 の「判断」は「source 取得のために frontmatters を残す」とし 5 パラメータ `(graph, stateMap, enabledPrefixes, addressedTopics, frontmatters)` に落着する。T-07 の判断が正しいが、D9 の示す 4 パラメータをそのまま実装すると openTopics の `source` フィールドが無音消去される（`status` 出力でトピック出典が消える回帰）。 | design.md D9「変更後のシグネチャ」ブロックを T-07 判断に合わせて 5 パラメータ `(graph, stateMap, enabledPrefixes, addressedTopics: Set<string>, frontmatters: ParseResult["frontmatters"])` に修正する。または T-07 の第 1 チェックボックス「新: `computeFrontier(graph, stateMap, enabledPrefixes, addressedTopics: Set<string>)`」を「※以下の判断で 5 パラメータに変更済み」と明記して誤読リスクを除去する。 |
| 2 | MEDIUM | Specification | design.md D6 | `after:` 辺の識別方法が implicit な型判定に依存しており明示されていない。D6「after: 行はパース結果の graph.references から取得する。plan ファイル内の grp 要素から grp-* への参照が after: 辺に相当する」と書かれているが、graph の Reference は `{ targetId, file, line }` のみを持ち「from 要素 ID」を直接保持しない。実装者は `targetId` の prefix が `grp` の参照 = after 辺、そうでない参照 = elements 辺という型判定を使う必要があるが、この識別基準が D6 に明記されていない。誤った実装（例: after: を行番号でフィルタしようとする）につながるリスクがある。 | D6 に「`graph.references.all` の中で targetId の prefix が `grp` である参照 = `after:` 辺、それ以外 = `elements:` 辺として識別する（format.md §8 のスキーマ: `elements:` は実装要素、`after:` は grp 要素のみを列挙する）」と明記する。 |
| 3 | LOW | Specification | tasks.md T-01 | 空 stateMap 書式の説明に内部矛盾がある。「空の stateMap は `{}` の 2 行（`{\n}` ではなく `{}\n`）として書く」と記述されているが、`{}\n` は 1 行であり「2 行」という数値が誤り。（`{\n}\n` = 2 行の展開形式を使わないという意図は読み取れるが「2 行」という語が混乱を招く。） | 「2 行」を削除し「`{}` 形式（1 行）で書く。展開形式 `{\n}` は使わない」と書き換える。 |
| 4 | LOW | Consistency | design.md D10 | D10「配置場所: src/cli/commands/status.ts（status と coverage の両方が使う。coverage handler からは import する）」と記述されているが、coverage handler は `computeFrontier` を呼ばず `extractAddressedTopics` も不要。coverage が `extractAddressedTopics` を使うユースケースが存在しない。 | D10 の usage 説明から coverage を削除し「status handler のみが使用する。独立ユーティリティとして切り出してもよい」に修正する。 |

---

## 評価メモ

### spec.md との整合性

spec.md（シナリオ群）は request.md の要件を過不足なくカバーしており、各受け入れ基準に対応するシナリオが揃っている。以下を確認：

- **writer round-trip**: Scenario「round-trip with readDesignState」「lexicographic key order」「one entry per line」で固定 ✅
- **coverage 被覆・状態・コードフェンス**: 対応シナリオあり ✅
- **coverage 全遷移 or 全不変**: spec.md には原子性の explicit シナリオが無いが、「missing citation fails without state change」「group contains a requested element → state.json unchanged」で間接的にカバーされており、tasks.md T-03/T-04 が詳細を補完 ✅
- **mark implemented 契約**: Scenario「normal transition」「idempotent re-run」「unknown slug」「mixed states」で spec/integration.md §2 を完全カバー ✅
- **openTopics 計算導出**: Scenario 2 件で「ADR 引用あり → addressed」「旧 status frontmatter 無効」をカバー ✅
- **loop 無効 exit 1**: coverage / mark 両方のシナリオあり ✅

### 設計判断の妥当性

- **fail-closed（非 designed 要素を拒否）**: adr/0018-4 に合致。mark の上書き規則を不要にする帰結も正確。✅
- **クロスグループ辺 = 警告のみ**: 正当な並列分割で辺が残りうる点の architect 評価は妥当。✅
- **全遷移 or 全不変**: spec/integration.md §2 の原子性要件と整合。✅
- **T-03 invariant 適合 (writer を src/state/ に置く)**: writer を `src/state/writer.ts` に配置することで invariants.test.ts の scan 対象外になる。✅
- **T-04 invariant 適合 (extractReferences 経由で `[[top-*]]` 抽出)**: `src/cli/` に `\[\[` 正規表現を書かずに済む。✅

### モジュール依存チェック

design/static/dependencies.md の許可辺と照合：
- `src/plan/coverage.ts` → `mod-graph` (Graph)、`mod-state` (StateMap): いずれも許可済み ✅
- `src/cli/commands/coverage.ts` → `mod-plan`, `mod-parse`, `mod-graph`, `mod-check`, `mod-state`, `mod-fsread`: すべて許可済み ✅
- `src/cli/commands/mark.ts` → `mod-parse`, `mod-check`, `mod-state`, `mod-fsread`: すべて許可済み ✅
- `src/state/writer.ts` → 外部依存なし（StateMap は同モジュール内）: ✅

### セキュリティ観点（ローカル CLI ツール）

- OWASP Top 10 の network/auth 系は非該当（実行時依存ゼロ、ネットワーク呼び出しなし）
- slug 文法検証（`[a-z0-9]+(-[a-z0-9]+)*`）で注入リスクを限定 ✅
- 値のシリアライズは `JSON.stringify(entry)` に委ねており特殊文字エスケープ漏れなし ✅
- 並列プロセス競合: ADR-0018-4 の状態検査で 2 番目の coverage を失敗させ、git 衝突が最終安全弁。許容範囲内 ✅
