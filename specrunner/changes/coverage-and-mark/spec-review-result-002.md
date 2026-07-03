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

- **verdict**: approved

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | LOW | Clarity | design.md D10 | `extractAddressedTopics` の実装方針の記述が自己矛盾している。「`[[top-*]]` の抽出には extractReferences は使わない」と書いた直後に「対策: `extractReferences(topicsValue, "<synthetic>")` を呼んで...」と逆の結論を示している。最終的な採用方針（extractReferences を使う）は tasks.md T-07 と一致しており機能的問題はないが、実装者が D10 を読む際に混乱する可能性がある。 | D10 の「extractReferences は使わない」の文を削除し、「frontmatter の値に直接正規表現を書くと T-04 の歯に引っかかるため、`extractReferences(topicsValue, "<synthetic>")` を呼んで `top-` prefix の結果をフィルタする方式を採用する」と一本化する。 |
| 2 | LOW | Consistency | design.md D7 / tasks.md T-05 | `mark implemented` の処理フロー上で loop 無効チェックの順序が D7 と T-05 で異なる。D7（処理フロー step 4-5）は「slug 一致 0 件 → exit 1」の後に「loop 無効 → exit 1」を置くが、T-05 の実装手順は「parseManifest → loop チェック（exit 1）→ readDesignState → slug 照合（exit 1）」の順で loop チェックが先行する。どちらも exit 1 を返す点で観測可能な動作差は小さいが、D7 は readDesignState を parseManifest より先に実行する暗示を持ち、T-05 の方が実装上の自然な順序である。 | D7 の処理フローを T-05 の順序（parseManifest → loop チェック → readDesignState → slug 照合）に合わせて書き直す。または D7 の step 2-5 の記述を削除し「詳細は T-05 の実装手順を正とする」と明記する。 |

---

## 評価メモ

### 前回エスカレーション（spec-review-result-001）からの対応確認

前回は以下の 4 件が報告された。現行ドキュメントでの対応状況を確認:

- **[HIGH] computeFrontier シグネチャ不一致（D9 4 パラメータ vs T-07 5 パラメータ）**: design.md D9 が「変更後のシグネチャ（T-07 の判断と同一。5 パラメータ）」として `(graph, stateMap, enabledPrefixes, addressedTopics: Set<string>, frontmatters)` を明示し、`frontmatters は残す` と注記された。T-07 と完全一致している。**対応済み ✅**
- **[MEDIUM] after: 辺の識別基準が D6 に未明文化**: D6 に「`識別基準: graph.references.all のうち、plan ファイル内の grp 要素セクションを源とし、targetId の prefix が grp である参照 = after: 辺、それ以外 = elements: 辺とする（...行番号でのフィルタは行わない）」の段落が追加された。**対応済み ✅**
- **[LOW] T-01 空 stateMap 書式の「2 行」**: 「空の stateMap は `{}` 形式（1 行、`{}\n`）で書く。展開形式 `{\n}` は使わない」に修正され「2 行」の語は除去された。**対応済み ✅**
- **[LOW] D10 が coverage も extractAddressedTopics を使うと誤記**: D10 が「使用者は status handler のみ。coverage は computeFrontier / addressedTopics を必要としない」に修正された。**対応済み ✅**

### spec.md 受け入れ基準カバレッジ

request.md の受け入れ基準と spec.md シナリオの対応:

| 受け入れ基準 | spec.md シナリオ |
|---|---|
| writer: round-trip・辞書順・1 要素 1 行 | Scenario「round-trip」「lexicographic key order」「one entry per line」 ✅ |
| coverage: 被覆完全 → exit 0・requested 遷移 | Scenario「full coverage passes and transitions to requested」 ✅ |
| coverage: 引用漏れ → exit 1・state 不変 | Scenario「missing citation fails without state change」 ✅ |
| coverage: requested 要素含む → exit 1 | Scenario「group contains a requested element」 ✅ |
| coverage: implemented 要素含む → exit 1 | Scenario「group contains an implemented element」 ✅ |
| coverage: コードフェンス内を被覆に数えない | Scenario「code fence citations are excluded」 ✅ |
| coverage: クロスグループ辺 + after 無し → 警告 + exit 0 | Scenario「cross-group edge without after emits warning but passes」 ✅ |
| mark: 正常遷移・--pr 記録 | Scenario「normal transition with --pr」 ✅ |
| mark: 冪等再実行 exit 0 | Scenario「idempotent re-run」 ✅ |
| mark: 未知 slug exit 1 | Scenario「unknown slug」 ✅ |
| mark: 混在 slug → requested のみ遷移 | Scenario「mixed states — only requested transitions」 ✅ |
| coverage / mark: loop 無効 exit 1 | Scenario「coverage with loop disabled」「mark with loop disabled」 ✅ |
| openTopics: ADR 引用あり → addressed | Scenario「topic cited in ADR topics is not open」 ✅ |
| openTopics: 引用なし → open（旧 status frontmatter 無効） | Scenario「topic not cited is open regardless of status frontmatter」 ✅ |
| scaffold: status 行なし | Scenario「generated topic has no status line」 ✅ |

### 設計判断の妥当性

- **fail-closed（非 designed 要素を拒否）**: adr/0018-4 に合致。mark 上書き規則が不要になる帰結も正確。✅
- **クロスグループ辺 = 警告のみ**: 正当な並列分割で辺が残り得るという architect 評価は妥当。✅
- **全遷移 or 全不変**: spec/integration.md §2・D7 ともに原子性を明示。✅
- **writer を src/state/ に配置（T-03 invariant 適合）**: src/state/writer.ts は invariants.test.ts の scan 対象（`src/state/` 配下）に収まる。✅
- **mod-plan に参照文法正規表現を持たせない（T-04 適合）**: extractReferences 経由で `[[top-*]]` を抽出する設計により T-04 の制約を回避。✅
- **openTopics を frontmatter topics: の厳密抽出で判定（adr/0018-3）**: ADR 本文中の文脈引用を addressed の根拠にしない設計は adr/0018-3 の字義に合致。✅

### モジュール依存チェック

設計文書 design/static/dependencies.md の許可辺と照合:

- `src/state/writer.ts`（mod-state）: 外部依存なし（StateMap 型は同モジュール内）✅
- `src/plan/coverage.ts`（mod-plan）: mod-plan → mod-graph（Graph）、mod-plan → mod-state（StateMap）いずれも許可済み ✅
- `src/cli/commands/coverage.ts`（mod-cli）: mod-cli → mod-plan / mod-parse / mod-graph / mod-check / mod-state / mod-fsread すべて許可済み ✅
- `src/cli/commands/mark.ts`（mod-cli）: mod-cli → mod-parse / mod-check / mod-state / mod-fsread すべて許可済み ✅

### セキュリティ評価（ローカル CLI ツール）

- OWASP Top 10 の network / auth 系は非該当（実行時依存ゼロ・ネットワーク呼び出しなし）
- slug 文法検証（`[a-z0-9]+(-[a-z0-9]+)*`）により不正な文字列の注入リスクを限定 ✅
- 値のシリアライズは `JSON.stringify(entry)` に委ねており特殊文字エスケープ漏れなし ✅
- 並列プロセス競合: adr/0018-4 の状態検査で 2 番目の coverage を失敗させ、git 衝突が最終安全弁として機能。許容範囲内 ✅
- ファイルパス構築は `${designDir}/state.json` に固定（利用者指定の path traversal リスクは designDir の存在チェックで限定） ✅
