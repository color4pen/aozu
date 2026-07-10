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
| 1 | LOW | Implicit dependency | req 1 / req 5 | `getEnabledPrefixes()` (manifest.ts) currently excludes all view prefixes ("View type prefixes are NOT included"). For perm elements to participate in C11 direction checks (both as source and target) and for C3 縮退 to toggle correctly when permission is enabled/disabled, `perm` must appear in `enabledPrefixes` when permission is enabled. This is derivable from the requirements and acceptance criteria ("コア層要素の本文から `[[perm-*]]` を参照すると C11 違反"), but not called out explicitly in any requirement. | In the implementer task description, note that req 1's "enabled のサポート型は型別のリンク義務検証へ" implies updating `getEnabledPrefixes` to include the prefix of supported and enabled view types. No change to request.md is needed — the behavior is unambiguous from the acceptance criteria. |
| 2 | LOW | Clarity | req 3 | The return type extension for `StructuredLineResult` (new perm operation/target fields) and the corresponding `ParseResult` / `Graph` type additions are not spelled out. The requirement states "パース結果は perm 要素に紐づく構造データとして graph 層から参照できること" without naming the new fields. | Acceptable as written — the implementer determines the exact type shape. No change needed. |

## Review Notes

**Codebase cross-check (read-only)**

All claims in "現状コードの前提" were verified against the repository:

- `LAYER_PREREQUISITES` has `permission: ["static"]` at manifest.ts:101 — confirmed, change to `["domain"]` is correct per spec §3 and ADR-0023 D3.
- `checkC6` errors on **all** VIEW_TYPE_NAMES including "permission" — confirmed (c06-view-links.ts:20-36). Two-phase split is needed.
- `LAYER_ALLOWED_TARGET_PREFIXES` has no "views" entry; comment "Unlisted layers (loop, adr, views) have no restriction" — confirmed (c11-layer-direction.ts:19-25). Adding restriction is correct per spec §10 C11.
- `structured-lines.ts` has no perm-specific parsing — confirmed. New operation-line and 対象-line recognizers must be added.
- `export.ts` has only the `rules` subcommand — confirmed. `permissions` subcommand is absent.
- `fs/reader.ts` recursively scans all `.md` under `designDir` — confirmed. `views/permission/` files require no additional reader work.
- `perm` is in `KNOWN_PREFIXES` (id.ts:28) and `LAYER_MAP` (manifest.ts:80) — confirmed. C3 縮退 will work correctly once `enabledPrefixes` is updated.
- `VIEW_ENABLED_NAME_TO_PREFIX` already has `permission → perm` (manifest.ts:117) — confirmed.

**Spec / ADR traceability**

All 8 requirements trace cleanly to confirmed sources:
- Reqs 1, 7 → spec §10 C6 + ADR-0023 D7
- Req 2 → spec §3 table + ADR-0023 D3
- Reqs 3, 4 → spec §8 (perm schema) + ADR-0023 D2/D3
- Req 5 → spec §10 C11 + ADR-0023 D6
- Req 6 → spec §11 (permissions export) + integration.md §7 + ADR-0023 D4
- Req 8 → spec §8 conformance fixture

**Acceptance criteria** are all testable against defined behavior. Self-hosting invariant (req 8: aozu's own `enabled: static, domain, dynamic` check result unchanged) is correctly scoped — no permission in aozu's manifest means縮退 applies, so no behavioral change. The `architect 評価済み` section correctly resolves the C5/C6 分担 (適格性 = C6, 解決 = C3), consistent with existing C5 implementation in c05-seq-actors.ts.
