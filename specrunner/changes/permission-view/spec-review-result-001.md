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
| 1 | MEDIUM | Inconsistency | design.md § D5 vs tasks.md § T-04 | `permOperations` の型定義が両ファイルで食い違う。design.md D5 は `{ elementFile: string; elementLine: number; operation: string; actorIds: string[]; file: string; line: number }[]` を定義し「elementFile / elementLine は帰属先 perm 要素の特定に使う」と述べるが、tasks.md T-04 は `{ operation: string; actorIds: string[]; file: string; line: number }` のみを定義し、帰属は T-07 で findOwningElement（チェック時）に委ねている。両者は矛盾しており、実装者が design.md D5 を正として `elementFile`/`elementLine` をパース時に埋めようとするとアーキテクチャ上の困難が生じる（structured-lines.ts はパース時に要素情報を持たない）。 | design.md D5 の `permOperations` 型定義から `elementFile` / `elementLine` を削除し、tasks.md T-04 の型定義と一致させる。帰属はチェック時に `findOwningElement` で行う旨を D5 に明記する。 |
| 2 | MEDIUM | Inconsistency | tasks.md § T-06 | T-06 は `checkC6` のシグネチャを `checkC6(manifest: Manifest, graph: Graph)` へ拡張し、同時に「permission 以外のビュー型のテストが変更なしで green」を要求する。しかし既存テスト `c06-view-links.test.ts` は `checkC6(manifest([vt]))` を graph 引数なしで呼び出しており、`graph: Graph` を必須引数にすると既存テストが TypeScript コンパイルエラーになって「変更なしで green」を満たせない。 | `graph` をオプショナルまたはデフォルト値付き引数 (`graph: Graph = emptyGraph`) にするか、あるいは「permission 以外の既存テストも graph 引数（空 graph）を追加する最小修正を許容する」と T-06 の受け入れ基準を明示する。 |
| 3 | LOW | Completeness | request.md 要件 3, tasks.md § T-04 / T-07 | `対象:` 行は「要素ごとに高々 1 本」と仕様化されているが、1 perm 要素内に複数の `対象:` 行が存在した場合の C6 エラーは定義されておらず、tasks にも対応する検証ロジックがない。`export permissions` で複数 permTarget が帰属した場合どの target を採用するかも未定義。 | (a) C6 の perm 検証に「対象: 行が複数ある場合は C6 error」ルールを追加する、または (b) `export permissions` で「最初の対象: 行を採用」と動作を確定させた上で、対応するテストケースを T-11 / T-13 に追加する。 |
| 4 | LOW | Coverage | tasks.md § T-12 | C11 の views 層制限を追加した後、views → loop（top/plan/grp）および views → adr への参照が C11 error になるべきだが、T-12 に対応するテストケースが存在しない。T-08 の許可 prefix 集合に top / plan / grp / adr が含まれていないことの正しさを積極的に検証する機会が欠けている。 | T-12 の C11 テストに `perm -> top-xxx 参照 → C11 error`（または loop への別 prefix）のシナリオを 1 件追加する。 |
| 5 | LOW | Coverage | tasks.md § T-13 | `export permissions` は check エラーがあっても JSON を出力すること（design.md D7 / tasks.md T-09「check は実行しない」）が仕様だが、この挙動を確認するテストケースが T-13 に存在しない。 | T-13 に「C3/C6 エラーが存在するフィクスチャで `export permissions` が exit 0 かつ JSON を出力する」シナリオを追加する。 |
| 6 | LOW | Ambiguity | tasks.md § T-07 | T-07 の帰属ロジック説明が「findOwningElement を import する」と「同じファイル内で宣言行 <= 操作行 < 次の perm 宣言行」を並列で述べており、(a) findOwningElement をそのまま呼ぶのか、(b) perm 要素のみを境界に使うカスタムロジックを書くのかが曖昧。findOwningElement は全要素を対象にするため、perm ファイルに perm 以外の見出し要素が混在すると誤帰属が生じる可能性がある。 | T-07 の説明を「graph.rawElements のうち prefix が "perm" の要素だけを境界として帰属を行う（findOwningElement と同型のアルゴリズムだが対象を perm 要素に限定する）」と明確化する。 |

## Review Notes

### 全体評価

仕様の構造・一貫性・実装可能性は全体的に高水準。ADR-0023 の決定が design.md / tasks.md / spec.md に一貫して反映されており、設計判断の根拠も明確。以下は個別の確認事項。

### 仕様整合性の確認

**format.md との整合**:
- §3 前提表「permission | domain」→ tasks.md T-01 `permission: ["domain"]` ✓
- §8 perm スキーマの操作行文法 → tasks.md T-04 正規表現設計 ✓
- §10 C6 二相化・C11 views 方向 → tasks.md T-06/T-07/T-08 ✓
- §11 permissions export JSON スキーマ（id 昇順・辞書順・act ID 昇順）→ tasks.md T-09 ✓
- integration.md §7 exit code 契約（0/1/2）→ tasks.md T-09 acceptance criteria ✓

**既存テストへの影響（確認済み）**:
- `c07-manifest-prerequisites.test.ts`: permission を enabled に含むテストケースが存在しないため、`permission: ["static"]` → `["domain"]` への変更による破壊はない ✓
- `c06-view-links.test.ts`: `"all supported view types trigger C6"` が "permission" を含んでいる（Finding 2 と連動）。T-06 は permission の除外を要求しており把握済み ✓

**縮退の確認**:
- permission 未 enabled 時: T-03 により perm prefix が `getEnabledPrefixes` から除外 → C3 が perm 参照をスキップ → C6 が permission を enabled に見ないので error なし → 完全な縮退 ✓

**セキュリティ（OWASP Top 10 適用観点）**:
- 本変更は developer CLI ツールのファイル I/O 拡張。ネットワーク・認証・永続ストア・ユーザー入力エスケープの変更はない
- `--out <path>` のパスバリデーションは既存の `export rules` と同じレベル（developer tool の妥当な前提）
- JSON 出力に設計文書の記述内容（operation 名・act ID 等）がそのまま含まれるが、消費者は CI の突合テストであり機密性の問題なし
- OWASP Top 10 で懸念すべき項目は確認されない ✓

**self-hosting 閉包の不変性**:
- aozu 自身の design/ は `enabled: static, domain, dynamic` で permission を含まない
- perm prefix は `getEnabledPrefixes` に含まれない → C3/C11 の対象外 → 診断変化なし ✓
