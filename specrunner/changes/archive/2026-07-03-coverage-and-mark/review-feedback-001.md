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
| 1 | low | architecture | `src/cli/commands/plan.ts` | `computeFrontier` に `new Set<string>()` を addressedTopics として渡す。plan コマンドは `frontier.designed` / `frontier.requested` のみ使用するため openTopics 計算に空集合を渡す設計は正当。コード内コメントで意図が明示されている。 | 対応不要 | no |
| 2 | low | architecture | `src/cli/commands/coverage.ts:155,168` | loop ゲートチェック (exit 1) がグループ存在チェック (exit 2) より先に実行される。loop 無効かつグループ不在が同時に発生した場合 exit 1 が返る。IO 依存の自然な順序であり、個別条件の exit コードは正しい。 | 対応不要 | no |
| 3 | low | maintainability | `src/cli/commands/coverage.ts:178-199,259-280` | "nearest-preceding-grp-in-same-file" O(G×E×M) ループがハンドラーと `buildGroupGraph` の 2 か所に重複している。正確さに問題なし、実用設計規模で性能上の問題もない。 | 対応不要（将来リファクタで共通化可） | no |
| 4 | low | testing | `src/cli/commands/status.test.ts:711` | TC-039 (ADR 本文中の `[[top-*]]` 言及は addressed に数えない) が `extractAddressedTopics` のユニットテストレベルで確認されている。subprocess レベルの統合テストはないが、他の `handleStatus` 統合テストが同一コードパスを経由するため実質的カバレッジは十分。 | 対応不要 | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 10 | 0.30 |
| security | 10 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 8 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 9 | 0.10 |

- **total**: 9.45

## Summary

**テスト結果**: 534 pass / 0 fail。`tsc --noEmit` clean、`check` exit 0、`export rules --verify` exit 0、`dependencies` 空。

**受け入れ基準**: must 18 / 18 すべて満足。

**実装品質**:

- `writeDesignState` は spec §9（辞書順ソート・1 要素 1 行）に厳密適合。手組み JSON と `JSON.stringify(value)` の組み合わせで標準 JSON 準拠を維持しながら 1 要素 1 行を実現している。
- `verifyCoverage` は純粋関数として `src/plan/` に分離され、IO は `src/cli/` に集約されており mod-plan / mod-state / mod-cli の依存方向に違反していない。
- 状態遷移は coverage・mark ともに「全遷移 or 全不変」（stateMap のコピーを構築後に一括 `writeDesignState`）で spec/integration.md §2 の部分適用禁止に適合。
- fail-closed（requested / implemented 要素を含むグループは coverage 不合格）が ADR-0018-4 に正しく適合している。
- `extractAddressedTopics` は ADR `topics:` frontmatter 値のみを参照し、ADR 本文中の `[[top-*]]` 言及を excluded している。T-04 invariant（`\[\[` パターンを src/parse/ 以外で禁じる）を `extractReferences` への委譲で回避している。
- `buildGroupGraph` の after: 辺抽出は design D6 の「targetId の prefix が grp = after: 辺」規則に正しく従っている。
- T-03 invariant（state.json 書き込み API と文字列 `state.json` の共起は `src/state/` のみ）を coverage.ts / mark.ts が `writeDesignState` 経由でのみ書き込むことで維持している。

blocking な問題はなし。

