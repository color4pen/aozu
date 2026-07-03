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
| 1 | HIGH | Spec Consistency | design.md / tasks.md | `FORMAT_RULES_SUMMARY` の配置方針が design.md と tasks.md で正面から矛盾する。design.md D8 の表「FORMAT_RULES_SUMMARY / SESSION_GUIDANCE は移動しない（session 固有）」および Trade-offs セクション「[Trade-off] FORMAT_RULES_SUMMARY を shared.ts に移動しない → session.ts からの import を維持する」は、tasks.md T-01 チェックリスト「FORMAT_RULES_SUMMARY は src/prompt/session.ts から src/prompt/shared.ts に移動する（propagate / review で共有するため）」および T-01 AC「src/prompt/shared.ts が … FORMAT_RULES_SUMMARY を export している」と直接矛盾する。実装者はどちらを正とするか判断できず、tasks.md T-01 AC を通過させようとすると design.md の決定を破ることになる。 | design.md D8 の table を修正し `FORMAT_RULES_SUMMARY` の行を `shared.ts（propagate / review で共有）` に変更する。Trade-offs セクションの該当 Trade-off 項目を削除するか「FORMAT_RULES_SUMMARY を shared.ts に移動した（tasks.md T-01 方針）。session.ts からは re-export する」に書き換える。tasks.md T-01 の記述が設計判断として正しい（propagate・review が session.ts という兄弟ファイルの定数に意味的依存するより shared.ts に集約する方が self-documenting であり、re-export 1 行の増加コストは trade-off 理由として弱い）。 |
| 2 | MEDIUM | Spec Completeness | spec.md | tasks.md T-03 AC に「propagate --adr 引数欠落: exit 2」が明記されているが、spec.md の "The system SHALL reject invalid propagate inputs with exit code 2" 要件に対応するシナリオが存在しない。カバーされているのは「ADR 不存在」「adr 以外の prefix」「design 不在」の 3 ケースのみ。`--adr` 引数自体が欠落した場合（引数 0 件で呼び出し）の exit 2 は異なるコードパス（引数パーサの早期終了）であり、シナリオとして固定すべき。 | spec.md の "Requirement: The system SHALL reject invalid propagate inputs with exit code 2" セクションに以下のシナリオを追加する: **Given** a valid design directory **When** `aozu prompt propagate --dir <design-dir>` is invoked without `--adr` **Then** exit code is 2, stderr contains a diagnostic, stdout is empty |

## Review Notes

### 検証済みの整合性

以下の点はファイル間で整合しており問題なし:

- **request.md ↔ design.md**: 要件 1〜5（propagate / review の動作・loop gate 非課・共有抽出・決定的出力）はすべて design.md D1〜D8 に対応する設計判断が存在し、矛盾なし。
- **design.md D2 (PropagateInput) ↔ tasks.md T-02 ↔ spec.md**: PropagateInput の 9 フィールドが T-02 チェックリストのインターフェース定義、spec.md のシナリオ（ADR 本文・seed 本文・近傍本文・inv/term・static mod・enabled layers・format rules・propagation guidance の 8 セクション）と完全に対応する。
- **design.md D3 (ReviewInput) ↔ tasks.md T-04 ↔ spec.md**: ReviewInput の 3 フィールドが T-04 定義および spec.md シナリオ（全要素本文・format rules・check 除外指示）と整合する。
- **design.md D4 (loop gate 非課) ↔ spec.md**: "The system SHALL NOT impose a loop gate" 要件および "propagate succeeds with loop disabled" / "review succeeds with loop disabled" シナリオが design.md D4 の exit code 体系と一致する。
- **design.md D6 (SCOPE_MAX_HOPS リネームと re-export) ↔ tasks.md T-01**: re-export により既存 session.test.ts の `SESSION_MAX_HOPS` import が無変更で通ることが確認できる。
- **tasks.md T-06 回帰検証 ↔ request.md 受け入れ基準**: "session/derive の既存テストが無変更で green" の要件が T-06 チェックリスト（テストファイルのゼロ差分確認）として機械検証可能な形式で明記されている。
- **依存ルール**: `src/prompt/shared.ts` / `src/prompt/propagate.ts` / `src/prompt/review.ts` の追加は `mod-prompt` 配下であり、`mod-cli → mod-prompt` と `mod-prompt → mod-graph` の許可依存（design/static/dependencies.md）の範囲内。新規の prohibited な依存は発生しない。
- **セキュリティ**: 本変更は CLI のローカルファイル読み取り + stdout 出力のみ。ネットワーク・認証・外部入力のサニタイズが必要な面はなく、OWASP Top 10 の適用対象外。

### Finding #1 の背景

tasks.md T-01 の記述（FORMAT_RULES_SUMMARY を shared.ts に移動）は、propagate と review が FORMAT_RULES_SUMMARY を使う以上、session.ts という "session 専用" なファイルから import させるより shared.ts に集約する方が意味的に正しい。design.md Trade-offs の「移動すると session.ts からの re-export が増え、変更量が利益に見合わない」という理由は、re-export 1 行の追加がデメリットとして過小であり、design.md 側の判断を更新することを推奨する。なお、session.test.ts の既存テストは `FORMAT_RULES_SUMMARY` を `"./session.ts"` から import しており、re-export による後方互換維持のパターンは D6 の `SESSION_MAX_HOPS` で既に確立済みであるため、リスクは低い。

### Finding #2 の背景

spec.md は BDD シナリオとして T-03 AC の exit 2 ケースをカバーする責務を持つ。`--adr` 欠落は「引数パーサの早期リターン」（T-03 チェックリスト最初の項目: `--adr <adr-id>` 必須）に相当し、他の 3 ケース（ADR 不存在・prefix 不一致・design 不在）とはコードパスが異なる。テストの決定性保証のためにシナリオとして固定するのが望ましい。
