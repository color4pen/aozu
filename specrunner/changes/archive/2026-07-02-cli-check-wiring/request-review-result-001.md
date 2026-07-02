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
| 1 | LOW | Clarity | 要件2・3 | `<LEVEL> <CODE> <id> <message>（ファイル:行 を含む）` において `ファイル:行` の出力位置が未指定。`CheckDiagnostic` は `file`・`line` フィールドを持つが、その配置（message 末尾付加か、前置か）は仕様書（spec/integration.md §1）にも記載がない。 | 実装者は任意に決定してよい。テストでフォーマット文字列を固定してドキュメントコメントで補足することを推奨。 |
| 2 | LOW | Clarity | 要件3 | `aozu check --request <path>` が `--dir` と組み合わせ可能かどうかを要件が明示していない。design ディレクトリが必要なため `--dir` が暗黙的に適用されると解釈できるが、コマンド仕様として明文化されていない。 | 実装者は `check` コマンド全体に `--dir` が適用されるものとして実装してよい。spec/integration.md §1 exit code 2 に「design/ 不在」が含まれることで implicitly 確認できる。 |
| 3 | LOW | Clarity | 受け入れ基準（要件3 (b)） | 「implemented のみを引用する request が不合格になること」のテストが、引用 ALL implemented のケースのみカバーすると読めるが、spec/integration.md §1 (b) は「引用要素の状態が designed または requested である」（= 1 件でも implemented は不合格）と定義している。 | テストに「一部のみ implemented な request」も追加することを推奨。ただしテスト設計は実装者の裁量範囲であり、受け入れ基準の文言は integration.md の権威仕様で補完できる。 |

## Summary

コードベースとの突合結果：

- `src/cli/main.ts` がスタブであること（console.log 1 行）✅ 確認
- `src/check/checker.ts` に `runCheck(graph, manifest, stateKeys?)` が存在し `CheckDiagnostic[]` を返すこと ✅ 確認
- `src/fs/reader.ts` に `readMarkdownFiles(dir)` が存在すること ✅ 確認
- `src/parse/references.ts` にコード除外規則付き `extractReferences` が実装済みであること ✅ 確認
- `package.json` の `bin: { "aozu": "./src/cli/main.ts" }` および `dependencies: {}` が空であること ✅ 確認
- `design/static/dependencies.md` に `[[mod-cli]] -> [[mod-state]]` 辺が存在すること ✅ 確認
- 既存テスト 184 件が green であること ✅ `bun test` で確認
- `adr/0009` で CLI framework 不使用が決定済みであること ✅ 確認
- `spec/format.md §9` に `state.json` の形式（`{ id: { state, request, pr } }`）が定義済みであること ✅ 確認

設計判断の事前整合性（CLI framework 不使用・診断 stderr / 成果物 stdout・state 読み取りを `src/state/` に配置）はすべて ADR または設計文書で根拠を持ち、矛盾は検出されなかった。HIGH / MEDIUM 所見なし。実装を開始してよい。
