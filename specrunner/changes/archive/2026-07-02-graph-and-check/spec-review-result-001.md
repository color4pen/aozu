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
| 1 | HIGH | Design Gap | design.md D2, tasks.md T-02/T-07/T-17 | **C2 raw elements access gap**: `Graph.elements` は `Map<string, Element>` であり、`buildGraph` がこの Map を構築した時点で重複 ID のエントリは上書き消失する。`runCheck(graph, manifest, stateKeys?)` には raw な `Element[]` を受け取るパラメータがなく、`checkC2(graph, elements: Element[])` に渡す元配列を `checker.ts` が取得できない。このままでは C2（ID 一意性）を実装できない。 | `Graph` 型（T-02）に `rawElements: Element[]` フィールドを追加し、T-03 の `buildGraph` で `parsed.elements` をそのまま格納する。T-07 の `checkC2` は `graph.rawElements` を参照するよう修正し、T-17 の `runCheck` シグネチャは変更不要。 |
| 2 | MEDIUM | Dependency Violation | tasks.md T-06, design.md D4, src/parse/id.ts | **C1 `validateId` の依存経路が未定義**: T-06 は「全要素の ID を `validateId` で検証し」と記述するが、`validateId` は `src/parse/id.ts` に存在する。`design/static/dependencies.md` には `mod-check → mod-parse` の辺がなく（許可は `mod-check → mod-graph` のみ）、C1 ルールが `src/parse/` を直接 import すると設計の依存方向に違反する。 | T-06 に「`validateId` および `KNOWN_PREFIXES` は `src/graph/` の re-export 経由で参照する」か「c01-id-grammar.ts 内にインラインで ID 文法チェックを再実装する」のいずれかを明記する。前者の場合は T-02/T-03 の graph モジュールが `validateId` を re-export することも tasks.md に追加する。 |
| 3 | MEDIUM | Design Gap | design.md D3, tasks.md T-05 | **VIEW_TYPE_NAMES → prefix のマッピングが未定義**: `LAYER_MAP` は prefix → layer（例: `uc → views`）を定義するが、`manifest.enabled` に現れるビュー型名（例: `use-case`）と prefix（例: `uc`）の対応表が設計・タスクのどこにも存在しない。`getEnabledPrefixes` がビュー型の enabled 名を prefix に変換できないため、C3・C11 の `enabledPrefixes` 計算がビュー型に対して未規定のまま実装される。 | T-05 / `manifest.ts` に `VIEW_ENABLED_NAME_TO_PREFIX: Record<string, string>` を追加し（例: `"use-case" → "uc"`, `"screen" → "scr"` 等、`spec/format.md §4` のビュー prefix 全列挙）、`getEnabledPrefixes` がこのマップを参照することを明示する。また、C6 で unsupported として診断されたビュー型の prefix を `enabledPrefixes` に含めるか否かの扱いも明確化する。 |
| 4 | MEDIUM | Inconsistency | design.md D4 vs tasks.md T-07/T-11/T-12/T-13/T-16 | **D4 の「規則関数の共通シグネチャ」が実態と乖離**: D4 は「各規則関数のシグネチャ: `(graph: Graph, manifest: Manifest) => CheckDiagnostic[]`」と記述するが、少なくとも 5 規則が逸脱する（C2: `elements: Element[]`、C6・C7: `manifest` のみ、C8: `stateKeys: string[]`、C3・C11: `enabledPrefixes: Set<string>`）。この記述は実装者を誤解させ、C2 の gap（Finding #1）を見逃しやすくする。 | D4 の記述を「各規則は必要な入力のみを取る。共通インタフェースは強制しない」に改め、逸脱する規則の実際のシグネチャを明示するか、tasks.md の各 T-06〜T-16 のシグネチャ定義に委ねる旨を明記する。 |
| 5 | LOW | Inconsistency | design.md D2 vs tasks.md T-02 | **Graph 型定義の `manifest` 記述の齟齬**: D2 は「`Graph` は `ElementTable` + `ReferenceIndex` + `DependencyEdge[]` + `actorIds` + `elementItems` + **manifest** を束ねる構造」と記述するが、T-02 の Graph 型定義には `manifestPath: string \| null` のみが含まれ、解析済み `Manifest` オブジェクトは含まれない。読み手が Graph に Manifest が内包されると誤解するリスクがある。 | D2 の記述を「Graph は `manifestPath: string \| null` を持つ。解析済み `Manifest` オブジェクトは `parseManifest()` で別途生成し `runCheck` に渡す」に訂正する。 |
| 6 | LOW | Design Gap | design.md D6, tasks.md T-08 | **C3 ソース要素の無効化未定義**: D6 は C3 を「参照先 ID の prefix が有効な prefix に含まれない場合はスキップ」と定義するが、参照元（ソース）が無効化層に属する要素の場合の扱いが未定義。例として `enabled: static` で `seq-foo`（dynamic・無効）が存在しない `mod-nonexistent`（static prefix）を参照すると、ターゲット prefix は enabled 内のため C3 診断が発火し「無効な型の義務は評価しない」方針と矛盾する。 | D6 と T-08 に「ソース要素の prefix が disabled 層に属する場合も C3 診断を出さない」か「C3 は参照元の有効化状態を問わず常時評価する（intentional）」かを明確に記述する。段階縮退テスト（T-19）にこのケースの fixture とアサーションを追加する。 |
