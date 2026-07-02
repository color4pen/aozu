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
| 1 | LOW | シナリオカバレッジの軽微な欠落 | spec.md §Requirement: Unresolved act references SHALL be detected by C3 | tasks.md T-08 には「resolved act reference → no C3 diagnostic」（実在する act 要素への参照は C3 エラーを出さない）というテストケースが含まれるが、spec.md の同 Requirement にはこの「正常系」シナリオが存在しない。負のシナリオ（未解決 → C3 エラー）のみが明文化されており、正のシナリオは統合テスト（T-09）で暗黙的にカバーされる。機能的な欠陥ではなく spec の記述上の漏れ。 | `#### Scenario: reference to existing act element produces no C3` として「Given 実在する act-approver 要素と同要素への参照、When C3 check、Then 診断なし」のシナリオを追加するとスペック上の対称性が保たれる。対応は実装着手前でなく次回整理機会でも問題なし。 |
| 2 | LOW | 段階縮退シナリオの前提条件が狭い | spec.md §Requirement: act references SHALL be silenced by graceful degradation when domain is disabled | 段階縮退のシナリオが「enabled: static」（domain + dynamic 両方無効）に限定されており、「enabled: static, dynamic」（domain 無効 / dynamic 有効）のケースが明文化されていない。この組み合わせでは C5 が実行され act 登場要素を ALLOWED_ACTOR_PREFIXES で判定するが、T-03 の Set 追加により act は許可される。一方 C3 は act が enabledPrefixes に含まれないためスキップされる。設計上は正しく動作するが spec のシナリオカバレッジに欠落がある。tasks.md T-07 の第 2 ケースは「dynamic も無効なので C5 自体がスキップ」という挙動で書かれており、より典型的なエッジケース（dynamic 有効・domain 無効）が設計文書全体で未明示。 | spec.md に `#### Scenario: act actor in seq with domain disabled but dynamic enabled produces no C5 diagnostic` シナリオを追加する。Given: enabled に static と dynamic が含まれ domain が含まれない manifest で、act-approver を登場要素に持つ seq。When: check 実行。Then: C5 診断なし（act は ALLOWED_ACTOR_PREFIXES に含まれる）かつ C3 診断なし（act は enabledPrefixes に含まれない）。 |
| 3 | LOW | spec/format.md §12 残留（前 review からの継続） | spec/format.md §12 | §12「本仕様内の未決」に「seq の登場要素にアクター・外部システムを含める扱い…業務系ドッグフーディングで決める」という pre-ADR メモが残存。adr/0015 accept + spec §5/§10 更新により既に決定済みだが §12 のみが追従していない。request-review-result-001 Finding 2 として既出。本 request の design.md は「spec/format.md §12 の未決項目の更新（別機会）」と明示しており、スコープ外として適切に処理されている。 | 本 request のスコープ外のため実装時対応不要。次回の仕様整理機会に §12 の当該項目を「adr/0015 で解決済み」に更新するか削除する。 |

## 検証ログ

### spec.md 構造検証

| チェック項目 | 結果 |
|---|---|
| 全 Requirement に `### Requirement:` ヘッダがある | ✓（7 件） |
| 全 Requirement に `#### Scenario:` が 1 つ以上ある | ✓ |
| 全 Requirement 本文に `SHALL` または `MUST` が含まれる | ✓ |
| Given/When/Then 形式が守られている | ✓ |
| 差分説明ではなく変更後の振る舞いとして記述されている | ✓ |

### spec.md ↔ request.md 要件整合性

| 要件 | spec.md カバレッジ | 備考 |
|---|---|---|
| 1. KNOWN_PREFIXES に act 追加 | `### Requirement: KNOWN_PREFIXES SHALL include act` ✓ | 2 シナリオ |
| 2. LAYER_MAP の domain 層に act 追加 | `### Requirement: act SHALL belong to the domain layer in LAYER_MAP` ✓ | 2 シナリオ |
| 3. C5 を mod\|act に改訂 | `### Requirement: C5 SHALL accept mod or act as seq actor prefixes` ✓ | 3 シナリオ（正常 2 + 異常 1） |
| 4. C11 の domain 許可集合に act 追加 | `### Requirement: C11 SHALL allow references to act from domain, static, and dynamic layers` ✓ | 4 シナリオ |
| 5. 未解決 act 参照が C3/C5 で検出される | `### Requirement: Unresolved act references SHALL be detected by C3` ✓ | Finding 1 参照（正常系シナリオ欠落は LOW） |

### spec.md ↔ design.md 整合性

| 設計決定 | spec.md との整合性 |
|---|---|
| D1: 4 テーブル + 1 規則関数への追加で完結 | spec は振る舞いのみを規定しており実装手段を強制しない（問題なし） |
| D2: C5 判定を Set ベースに変更（ALLOWED_ACTOR_PREFIXES） | spec §C5 Requirement は `mod or act` の振る舞いを規定。実装詳細（Set vs 条件連結）は spec の関心外（正しい分離） |
| D3: 既存テスト変更なし | `### Requirement: Existing tests SHALL pass without modification` ✓ |
| LAYER_ALLOWED_TARGET_PREFIXES の 3 行全更新（request-review Finding 1 への対処） | spec §C11 Requirement で `domain`, `static`, `dynamic` の 3 レイヤからの参照がすべてカバーされている ✓ |

### tasks.md ↔ spec.md 受け入れ基準の対応

| Task | 対応 Requirement / Scenario |
|---|---|
| T-01 KNOWN_PREFIXES | §KNOWN_PREFIXES SHALL include act ✓ |
| T-02 LAYER_MAP + LAYER_TO_PREFIXES | §act SHALL belong to domain layer ✓ |
| T-03 C5 改訂 | §C5 SHALL accept mod or act ✓ |
| T-04 C11 LAYER_ALLOWED_TARGET_PREFIXES | §C11 SHALL allow references to act ✓ |
| T-05 C11 テスト追加 | §C11 の 4 シナリオ ✓ |
| T-06 C5 テスト追加 | §C5 の 3 シナリオ ✓ |
| T-07 段階縮退テスト | §graceful degradation ✓（Finding 2 参照） |
| T-08 C3 テスト追加 | §Unresolved act references SHALL be detected ✓（正常系シナリオ欠落は Finding 1） |
| T-09 統合テスト | request.md 受け入れ基準 1「actors.md + act in seq で check exit 0」← §C5 §C11 §C3 の組み合わせで暗黙カバー |
| T-10 最終検証 | §Existing tests SHALL pass without modification ✓ |

### セキュリティレビュー

本変更は CLI ツールの内部型テーブル拡張（静的定数の追加）と規則関数の条件緩和。入力は git 管理下の設計文書ファイルのみ。ネットワーク通信・認証・外部ユーザー入力・シリアライゼーション処理の変更はなし。OWASP Top 10 の対象事項なし。セキュリティ上の懸念はない。

### ソースコードとの整合性確認（実装前ベースライン）

| 確認項目 | 現状 | spec 要求後の期待 |
|---|---|---|
| `KNOWN_PREFIXES`（src/parse/id.ts） | `act` 含まれない（18 prefix） | `act` を追加 |
| `LAYER_MAP`（src/check/manifest.ts） | domain: `term / ent / inv` のみ | `act: "domain"` 追加 |
| `LAYER_TO_PREFIXES.domain` | `["term", "ent", "inv"]` | `"act"` を追加 |
| `checkC5`（c05-seq-actors.ts） | `!== "mod"` の単一比較 | `Set(["mod","act"])` で判定 |
| `LAYER_ALLOWED_TARGET_PREFIXES`（c11-layer-direction.ts） | domain/static/dynamic それぞれ `act` なし | 3 行すべてに `"act"` 追加 |

すべて request.md の「現状コードの前提」・design.md の「現状コード」記述と一致。ソースを直接確認し、記述の正確性を検証済み。
