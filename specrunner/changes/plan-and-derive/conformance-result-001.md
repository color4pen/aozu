# Conformance Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:   implementation conforms to tasks.md, design.md, spec.md, and request.md
  - needs-fix:  one or more upstream artifacts are not satisfied by the implementation
  - escalation: conformance cannot be determined (missing artifacts, unresolvable ambiguity)
- The Findings table records the per-artifact judgment.
-->

- **verdict**: needs-fix

## Conformance Findings

| Artifact | Conforms | Notes |
|----------|----------|-------|
| tasks.md | ✅ YES | T-01〜T-13 の全チェックボックス（78 項目）が [x] マーク済み |
| design.md | ✅ YES | D1〜D13 の全設計判断を実装が遵守。特に D8（loop 無効 → exit 1）・D1（act を IMPLEMENTATION_PREFIXES に追加）・D2/D3/D4（mod-graph への移設）が正しく実装されている |
| spec.md | ❌ NO | "Requirement: derive SHALL fail with exit 2" 内の "Scenario: derive rejects when loop is not enabled"（line 119–124）が exit 2 を規定しているが、実装は exit 1 を返す。design.md D8 が明示的に exit 1 を決定したにもかかわらず spec.md が更新されなかった（詳細は下記）|
| request.md | ✅ YES | 全 8 受け入れ基準が実装・テストで充足されている。request.md §5「plan / derive とも loop が無効なら exit 1」は実装と一致 |

## Detailed Findings

### F-1 [HIGH] — spec.md と実装の exit code 不整合（derive + loop 無効）

**対象**: `spec.md` lines 93, 119–124

**現状の spec.md 記述**:

```
### Requirement: derive SHALL fail with exit 2 for missing configuration or invalid input

Derive SHALL return exit 2 with diagnostic on stderr for: (a) loop not enabled, ...

#### Scenario: derive rejects when loop is not enabled
...
Then exit code is 2 and stderr contains a message about loop being required
```

**実装の実際の挙動**: `src/cli/commands/prompt.ts` line 168 が `return 1` を返す。テスト `src/cli/commands/prompt.test.ts` line 465 も `expect(exitCode).toBe(1)` で固定。

**不整合の根本原因**:  
design.md D8 が「当初案は『設定不備 = exit 2』だったが、段階ゲート（ADR-0010 の明示エラー）は設定欠落とはクラスが異なり、plan と同じ検証不合格 = exit 1 に揃える」と明示的に exit 2 を却下し exit 1 を決定した。tasks.md T-09/T-10 もこれを踏まえ exit 1 と明記している。しかし spec.md の当該シナリオと Requirement 本文は更新されなかった。

**文書間の一致状況**:

| 文書 | derive + loop 無効の exit code |
|---|---|
| request.md §5 | exit 1（「plan / derive とも loop が無効なら exit 1」） |
| design.md D8 | exit 1（明示的に決定・正当化済み） |
| tasks.md T-09/T-10 | exit 1 |
| 実装 (prompt.ts:168) | exit 1 |
| テスト (prompt.test.ts:465) | exit 1 を期待 |
| **spec.md (lines 93, 119–124)** | **exit 2（更新漏れ）** |

spec-review-002 Finding #1 はこの問題を「request.md のみ旧記述が残る」と誤記しており、実際には spec.md 側が更新漏れ状態である。

**修正方針**:  
`spec.md` の "Requirement: derive SHALL fail with exit 2" 節において:
1. "(a) loop not enabled" を列挙から削除する
2. "Scenario: derive rejects when loop is not enabled" の exit code を 2 → 1 に修正し、この失敗がステージゲート（exit 1）であることを明記する（または独立したステージゲート Requirement として切り出す）

実装の変更は不要。spec.md のみの修正。

## Quality Gates Summary

| 確認項目 | 結果 |
|---|---|
| `bun test`（全テスト） | ✅ 467 pass / 0 fail |
| `bun tsc --noEmit` | ✅ exit 0 |
| `bun src/cli/main.ts check` | ✅ exit 0 |
| `bun src/cli/main.ts export rules --verify` | ✅ exit 0 |
| `package.json` `dependencies` | ✅ 空（実行時依存ゼロ） |
| architecture.test.ts（歯テスト） | ✅ green |
| spec/format.md §3 更新（`request-template` / `request-output-dir`） | ✅ 確認 |
| spec/integration.md §4 更新（manifest frontmatter 明記） | ✅ 確認 |
| design/static/modules.md mod-plan 責務行更新 | ✅ 「グループへの request 記録」が削除されている |
| design/rules.json 再 export | ✅ verify exit 0 で確認 |
