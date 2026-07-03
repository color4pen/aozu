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
| 1 | LOW | Incompleteness | spec.md | spec.md に slug 形式バリデーション（`[a-z0-9]+(-[a-z0-9]+)*` 以外 → exit 2）の BDD シナリオが存在しない。tasks.md T-06「slug が `[a-z0-9]+(-[a-z0-9]+)*` に適合しない場合は stderr にエラーを出力して return 2」と T-07「不正な slug 形式（例: `../evil`, `My Batch`, `UPPER`）で exit 2、ファイルが生成されない」が実装仕様とテストを明記しているが、spec.md の "Requirement: plan SHALL fail-closed" 節（lines 43–63）には対応シナリオがない。spec-review-002 finding #2 の未解消継続。 | spec.md の "Requirement: plan SHALL fail-closed with exit 1" 節に「(d) slug が `[a-z0-9]+(-[a-z0-9]+)*` に適合しない場合は exit 2」を追記し、シナリオ「`aozu plan ../evil --dir <path>` → exit 2, ファイル未生成」を追加する。exit 1（ゲート違反）と exit 2（不正入力）の分類を正確に反映させること。 |
| 2 | LOW | Incompleteness | spec.md | spec.md に「`request-template` をコマンドとして実行した結果が非ゼロ exit の場合 → exit 2」のシナリオが存在しない。design.md Risks 節（D3 mitigation）「コマンド実行が失敗した場合（非ゼロ exit）は stderr に診断を出して exit 2」および tasks.md T-09「非ゼロ exit → return 2 + stderr 診断」が動作を規定し、実装（prompt.ts lines 305–322）と TC-044 テスト（prompt.test.ts lines 419–448）も存在するが、spec.md の "Requirement: derive SHALL fail with exit 2" 節（line 103）の列挙 (a)–(e) にこのケースが含まれていない。spec-review-002 finding #3 の未解消継続。 | spec.md の "Requirement: derive SHALL fail with exit 2" 節の列挙に「(f) `request-template` をコマンドとして実行した結果が非ゼロ exit の場合」を追加し、シナリオ「Given manifest with `request-template: exit 1`（ファイル不在のコマンド）, When derive is executed, Then exit code is 2 and stderr contains diagnostic」を追記する。 |

## Summary

本 spec-review-003 は conformance-result-001 が HIGH finding として報告した「spec.md と実装の exit code 不整合（derive + loop 無効時に spec.md が exit 2 を規定し、実装・他全文書が exit 1 を返す）」の解消を確認するために実施した。

**確認結果: 当該 HIGH finding は現在の spec.md で解消済み。**

spec.md（lines 91–99）に「Requirement: derive SHALL fail with exit 1 when loop is not enabled」が独立要件節として追加され、シナリオも `exit code is 1` を明示している。「Requirement: derive SHALL fail with exit 2」節（line 101–103）の列挙 (a)–(e) から「loop not enabled」が除去されている。これにより request.md §5・design.md D8・tasks.md T-09/T-10・実装（prompt.ts:168 `return 1`）・テスト（prompt.test.ts:465 `expect(exitCode).toBe(1)`）との整合が回復した。

過去のレビューサイクルで積み上がった全 HIGH/MEDIUM 所見の対応状況:

| 出所 | 重篤度 | 内容 | 対応状況 |
|------|--------|------|---------|
| spec-review-001 #1 | HIGH | derive + loop 無効の exit code がドキュメント間で矛盾（spec.md: exit 2, 他: exit 1） | **解消済み**（spec.md に exit 1 要件節を新設、exit 2 列挙から除外） |
| spec-review-001 #2 | MEDIUM | Bun.spawn のシェルモード（shell: true/false）が未定義 | **解消済み**（design.md D7 が shell: true を明示・信頼境界内の根拠を記録） |
| adversarial-001 #1 | HIGH | IMPLEMENTATION_PREFIXES に act が欠落（ADR-0005/0015 との齟齬） | **解消済み**（frontier.ts に "act" 追加、design.md D1 に整合裁定記録） |
| adversarial-001 #2 | MEDIUM | openTopics 計算が ADR-0018-3 に違反 | **解消済み**（NOTE コメントと design.md D1 で deferral を正式記録） |
| adversarial-002 #1 | MEDIUM | design.md D8 の Decision と Rationale が exit code で矛盾 | **解消済み**（design.md D8 が「どちらも exit 1」に統一） |
| adversarial-002 #2 | MEDIUM | D8 Rationale が spec/integration.md §5 の存在しない規約を参照 | **解消済み**（「ADR-0010 の原則から自己完結する」に修正） |
| adversarial-002 #3 | LOW | body.ts の見出し境界パターンが design.md/spec.md と乖離（`^#{2,3}` vs `^## `） | **解消済み**（body.ts と tasks.md T-03 が `^## ` に統一） |
| conformance-001 F-1 | HIGH | spec.md の exit 2 シナリオと実装の exit 1 が矛盾 | **解消済み**（現 spec.md で確認済み） |

残存所見はすべて LOW（spec.md の BDD 補完）であり、実装は既に tasks.md・テスト・コード全層で仕様を充足している。実装品質確認済み項目: `bun test` 467 pass / 0 fail、`tsc --noEmit` exit 0、`aozu check` exit 0、`export rules --verify` exit 0、`dependencies` 空、architecture.test.ts 全 pass。
