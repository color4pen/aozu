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
| 1 | low | maintainability | src/parse/structured-lines.ts | `actorIds` 変数シャドウイング: 外側スコープの `const actorIds: StructuredLineResult["actorIds"]` を line 160 の `const actorIds: string[]` がシャドウしている。正確に動作するが可読性を低下させる | 内側変数を `const permActorIds: string[] = []` にリネームしてシャドウを解消する | no |
| 2 | low | testing | src/check/manifest.test.ts | TC-016 (must) の直接単体テストが未追加: `getEnabledPrefixes(manifest(["static","domain","permission"]))` が `"perm"` を含むことを直接アサートするテストがない。動作は conformance fixture 等で間接確認済み | manifest.test.ts に `getEnabledPrefixes` + `permission` の肯定・否定ケースを追加する | no |
| 3 | low | testing | src/check/rules/c06-view-links.test.ts | TC-027 (must) の直接アサート欠如: `SUPPORTED_VIEW_TYPES.has("permission")` と `SUPPORTED_VIEW_TYPES.has("screen")` を直接検証するテストがない。C6 行動テストで間接確認済み | manifest.test.ts または c06-view-links.test.ts に `SUPPORTED_VIEW_TYPES` の直接 has() アサートを追加する | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 10 | 0.30 |
| security | 10 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 8 | 0.10 |
| testing | 8 | 0.10 |

- **total**: 9.45

## Summary

実装はすべての受け入れ基準・設計判断・仕様（spec §3/§8/§10/§11、integration.md §7）を正確に満たしている。858 テスト全 pass・`tsc --noEmit` エラーなし・aozu 自己記述の check 結果不変・`export rules --verify` exit 0 を確認した。

**主要実装の確認**:

- **C6 二相化**: `SUPPORTED_VIEW_TYPES` による分岐が `manifest.ts` の型表群に同居し、設計判断 D1 に準拠。未サポート型は従来どおり fail-closed で error。
- **LAYER_PREREQUISITES**: `permission: ["domain"]` への変更が `manifest.ts:101` で確認済み。C7 は定数変更で自動追従。
- **構造行パース**: `PERM_OPERATION_LINE_RE` と `PERM_TARGET_LINE_RE` が `structured-lines.ts` に追加。既存の認識パターン（依存辺→操作行の順序、code fence スキップ）と整合。actor 抽出の `PERM_ACTOR_REF_RE` は `g` フラグで `lastIndex = 0` リセットが適切。
- **C6 perm 検証**: `findOwningElement` による行ベース帰属で 1 ファイル複数 perm を正確に分離。(a) 非空義務・(b) operation 一意・(c) act prefix 適格性の 3 条件が実装済み。解決検証は C3 に委ねる分担が C5 と一貫（設計判断 D4）。
- **C11 views 方向**: `LAYER_ALLOWED_TARGET_PREFIXES.views` に全ビュー prefix + static/domain/dynamic prefix を収録。loop/adr は unlisted のまま無制限。コア層の許可集合に perm が含まれないため、コア→views は既存実装で即違反。
- **export permissions**: `generatePermissions` は pure function で check と独立。id 昇順・operations キー辞書順・act 配列 ID 昇順が `Array.prototype.sort()` で保証。`target` フィールドは `対象:` 行の有無で条件付き出力。exit code 契約（0/1/2）が `export.ts` で正確に実装。
- **getEnabledPrefixes 拡張**: `SUPPORTED_VIEW_TYPES` 経由で permission → perm のみを追加。未サポート型（screen 等）は引き続き enabledPrefixes に含まれず縮退を維持（設計判断 D2）。
- **縮退の一貫性**: permission 未 enabled 時、perm は enabledPrefixes に含まれず C3・C11 が自動縮退。C6 も enabled 一覧のスキャンで "permission" を踏まないため perm 検証に到達しない。

指摘はすべて nit レベルであり、コードの正確性・安全性・アーキテクチャへの影響なし。マージ可能。
