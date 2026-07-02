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
| 1 | MEDIUM | 受け入れ基準のカバレッジ不足 | 受け入れ基準 4 項目目 / `src/check/rules/c11-layer-direction.ts` | C11 の `LAYER_ALLOWED_TARGET_PREFIXES` は `domain` / `static` / `dynamic` の 3 行が独立した hardcoded セットで、`LAYER_MAP` とは別テーブル。受け入れ基準は `domain → act` と `act → mod` のみをテスト対象としており、`mod → act`（static → domain）が C11 で正しく許可されることの検証がない。spec §10 は「static は static と domain を参照できる」と明記しており act が domain に属する以上 `mod → act` は許可されるべきだが、実装者が `LAYER_ALLOWED_TARGET_PREFIXES.static` の更新を漏らしても既存の受け入れ基準では検出できない。なお `seq → act`（dynamic → domain）は受け入れ基準 1（actors.md + act in seq で check exit 0）から implicit に要求されるため、`LAYER_ALLOWED_TARGET_PREFIXES.dynamic` の更新漏れは自然と検出される。 | 受け入れ基準に「domain の要素から act への参照に加え、mod から act への参照も C11 で許可されること」をテストケースとして追加することを推奨する。実装時のチェックポイントとして：`LAYER_ALLOWED_TARGET_PREFIXES` の `domain` / `static` / `dynamic` 全 3 行に `"act"` を追加する必要がある。 |
| 2 | LOW | 仕様書の残留不整合 | `spec/format.md §12` | §12「本仕様内の未決」の 1 項目目に「seq の登場要素にアクター・外部システムを含める扱い…業務系ドッグフーディングで決める」という pre-ADR のメモが残っている。adr/0015（status: accepted）と §2・§4・§8・§10 の更新により決定済みだが、§12 が追従していない。 | §12 の当該項目を削除するか「adr/0015 で解決済み」旨に更新することを推奨する。本 request のスコープ外だが、次の整理機会に対処するとよい。 |
| 3 | LOW | architect 注記の表現精度 | request.md「architect 評価済みの設計判断」 | 「型テーブル（LAYER_MAP）への追加だけで C3 / C11 / 縮退が波及する」と記載があるが、C11 の `LAYER_ALLOWED_TARGET_PREFIXES` は `LAYER_MAP` とは独立した別テーブルであり LAYER_MAP 追加だけでは C11 は更新されない（C3・縮退は getEnabledPrefixes 経由なので正しい）。実装者が注記を額面通り受け取ると C11 の更新を漏らすリスクがある。 | 注記を「LAYER_MAP 追加で C3・縮退は波及する。C11 の LAYER_ALLOWED_TARGET_PREFIXES は別途 3 行すべてに act を追加する」に修正することが望ましい。本 request は実装フェーズで判断すれば十分。 |

## 検証ログ

### 現状コードの前提（すべて正確）

- `src/parse/id.ts` の `KNOWN_PREFIXES`: `act` は含まれていない ✓
- `src/check/manifest.ts` の `LAYER_MAP`: domain 層は `term / ent / inv` の 3 prefix のみ ✓
- `src/check/manifest.ts` の `LAYER_TO_PREFIXES.domain`: `["term", "ent", "inv"]` ✓
- `src/check/rules/c05-seq-actors.ts`: `extractPrefix(actor.id) !== "mod"` で mod 以外を拒否 ✓
- `src/check/rules/c11-layer-direction.ts` の `domain` セット: `new Set(["term", "ent", "inv"])` ✓
- `design/rules.json`: `act` はモジュールでないため ruleset に影響なし ✓

### spec/format.md 更新確認

| セクション | 内容 | 確認 |
|---|---|---|
| §2 ディレクトリ規約 | `domain/actors.md` が `act` 要素として追記済み | ✓ |
| §4 型プレフィクス表 | `act \| アクター \| domain` 行が追記済み | ✓ |
| §8 アーティファクト型スキーマ | `act: 見出し + 本文（散文）` の記述あり | ✓ |
| §10 C5 | 「mod または act に解決される」に改訂済み | ✓ |
| §10 C11 | 「domain（term / ent / inv / act）」に改訂済み | ✓ |
| §12 未決 | item 1 がまだ未解決表記のまま（Finding 2） | 残留 |

### adr/0015 確認

- Status: accepted ✓
- 決定内容: act を domain 層のコア型として追加、C5 を「mod または act」に改訂、C11 の domain prefix 集合に act を含める ✓
- docs/findings/clearflow-2026-07-02.md finding 1 との対応: 完全に整合 ✓

### 受け入れ基準の実現可能性

| 基準 | 実現可能か | 備考 |
|---|---|---|
| actors.md + act in seq で check exit 0 | ✓ | `## 登場要素` の `- [[act-*]]` は actorId かつ reference として二重処理される。C5 で prefix 許可、C3 で解決確認、C11 で dynamic→act 許可が必要（LAYER_ALLOWED_TARGET_PREFIXES.dynamic 更新が必須） |
| 実在しない act 参照が C3 で検出 | ✓ | `extractReferences` は `## 登場要素` 内の `[[id]]` も拾うため C3 が評価する |
| domain 無効の manifest で act が段階縮退 | ✓ | getEnabledPrefixes は domain 無効時に act を含めない（LAYER_TO_PREFIXES.domain から除外される） |
| domain→act が C11 で許可・act→mod が C11 で拒否 | ✓ | LAYER_ALLOWED_TARGET_PREFIXES.domain に act を追加し、act の LAYER_MAP エントリを "domain" にすることで実現 |
| self-check と existing tests green | ✓ | design/rules.json は act がモジュールでないため影響なし |
