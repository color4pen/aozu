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
| 1 | LOW | Acceptance Criteria | 受け入れ基準 propagate 1 件目 | `(e) enabled 一覧` は要件に明記されているが、propagate の stdout 内容を検証する受け入れ基準に「enabled 一覧が含まれること」の assertion が列挙されていない（`(a)〜(g)` のうち `(e)` のみ抜けている）。実装者は session のパターンに倣い含めるはずだが、テスト仕様上の明示的な検証が欠ける。 | 受け入れ基準 1 件目の列挙に「enabled 一覧」を追記するか、実装時のテストで `enabled` に関する assertion を追加する。省略しても実装の障害にはならない。 |

## Review Notes

### 背景検証

コードベースを確認した結果、request.md に記載されたすべての前提コードが実在し正確であることを確認した。

- `src/cli/commands/prompt.ts` — `handlePrompt` が `derive` / `session` をディスパッチ。`handleSession` のパターン（引数解析 → design 存在確認 → graph 構築 → seed 抽出 → `computeNeighborhood` → `extractAllBodies` → 常時全量枠の組み立て → 純関数呼び出し → stdout）を確認。
- `src/prompt/session.ts` — `buildSessionInstruction` 純関数・`SESSION_MAX_HOPS = 2`・`FORMAT_RULES_SUMMARY`・`SESSION_GUIDANCE` の存在を確認。
- `src/graph/neighborhood.ts` / `body.ts` — `computeNeighborhood`・`extractAllBodies`・`extractElementBody` の API を確認。propagate/review が再利用できる。
- `src/plan/frontier.ts` — ADR の `topics:` frontmatter 解析実績（`extractAddressedTopics` が `extractReferences` を frontmatter 値に適用）を確認。propagate の seed 抽出（body [[id]] 引用）とは別の経路であることも確認。
- `spec/format.md §10` — C9「adr が top を引用している（loop 有効時）」・C11「loop と adr は制限なし」を確認。loop gate 非課の根拠が仕様と整合する。
- `design/static/dependencies.md` — `mod-cli -> mod-prompt`・`mod-prompt -> mod-graph` が許可依存として存在。`src/prompt/` への実装追加と `src/cli/commands/prompt.ts` からの呼び出しはモジュール依存ルール上問題なし。
- `design/adr/` が `design/` 配下に存在しない（`design/**/*.md` に `adr/` サブディレクトリなし）ことを確認。テストは合成 fixture で行う必要がある旨、request と一致。

### 設計判断の妥当性

- **propagate の loop gate 非課** — adr が常時層（C11: 層間参照制限なし）であることと、request.md の `architect 評価済みの設計判断` セクションの説明が仕様と完全に整合している。
- **seed = ADR 本文 [[id]] 引用のみ** — ADR は document element であり、body は frontmatter 後のテキスト。`topics:` frontmatter 値の [[id]] は body に含まれないため seed 対象外となる。これは session で top body [[id]] を seed とするパターンと対称的であり、意図的かつ正しい。
- **review の全量注入** — docs/open-questions.md 論点 8 の「現在形の正本を小さく保つ」前提のもと初版全量注入とし、高度化は実例証拠待ち、という判断が request に明記されており、ADR-0004 の原則と整合。
- **check の領分を review 指示から除外** — C1〜C11 の決定的検証との重複排除という設計が docs/open-questions.md 論点 8 戦略 4「規則への卒業 = 台帳の縮小」と一致。
- **共有関数抽出と非回帰要件** — 既存 session/derive テストの無変更 green という受け入れ基準が、リファクタリングの安全網として明示されている。

### 受け入れ基準の評価

全受け入れ基準が機械検証可能な形式で記載されている。finding #1 を除き、要件 `(a)〜(g)` のすべての injection 要素に対応する検証項目が存在する。
