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

## Summary

前回レビュー（attempt 1）で指摘した 6 件の所見（HIGH 2 件、MEDIUM 2 件、LOW 2 件）はすべて attempt 2 の design.md / tasks.md で解消されている。具体的には:

- **Finding #1 (HIGH)**: `Graph` に `rawElements: Element[]` が明示追加され（D2・T-02）、C2 検証関数が `graph.rawElements` を走査する設計に修正済み（T-07）。
- **Finding #2 (MEDIUM)**: `src/graph/index.ts` が `validateId` / `KNOWN_PREFIXES` を `src/parse/` から re-export する経路が D2・T-02・T-06 に明記。`mod-check → mod-parse` 直接 import 禁止も明示。
- **Finding #3 (MEDIUM)**: `VIEW_ENABLED_NAME_TO_PREFIX` の全列挙（9 ビュー型）が D3・T-05 に追加。`getEnabledPrefixes` がビュー prefix を含めない理由も明記。
- **Finding #4 (MEDIUM)**: D4 が「共通シグネチャを強制しない」と訂正され、逸脱する各規則の実際のシグネチャを列挙。
- **Finding #5 (LOW)**: D2 が「解析済み Manifest オブジェクトは Graph に含まない、`parseManifest()` で別途生成」と明示。
- **Finding #6 (LOW)**: D6 と T-08 が「参照元の要素が無効な型に属する場合も C3 診断を出さない」を明示し、T-19 に対応 fixture アサーションも追加。

残存 LOW 所見は実装者が設計文書の優先順位を把握していれば解消できる範囲であり、実装をブロックしない。

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | LOW | Inconsistency | spec.md §1 vs design.md D2, tasks.md T-02 | **spec.md の "parsed manifest" 記述が曖昧**: spec.md の最初の要件「The graph module SHALL produce a `Graph` containing ... and **parsed manifest**」は Graph が解析済み `Manifest` オブジェクトを保持するように読める。しかし D2・T-02 は `Graph` に `manifestPath: string \| null` のみを含め、`Manifest` オブジェクトは含まないことを明示している。実装者が spec.md を先に読むと誤解する可能性がある。 | spec.md の該当文言を「and a `manifestPath` (the path to the manifest file)」または「and `manifestPath: string \| null`」に訂正する。優先度は低く、D2・T-02 が正であるため実装はブロックされない。 |
| 2 | LOW | Inconsistency | tasks.md T-03 vs tasks.md T-02 | **`buildGraph` のシグネチャと `Graph.manifestPath` の型の齟齬**: T-03 は `buildGraph(parsed: ParseResult, manifestPath: string): Graph` と定義し `manifestPath` を必須 `string` とするが、T-02 の `Graph` 型は `manifestPath: string \| null` と宣言している。manifest.md が存在しない最小 fixture を扱う際に型の不整合が生じる可能性がある。 | T-03 のシグネチャを `buildGraph(parsed: ParseResult, manifestPath: string \| null): Graph` に変更するか、manifest.md が常に存在する前提を tasks.md に明記する。実装上の workaround は容易であり、ブロッキング要件ではない。 |
