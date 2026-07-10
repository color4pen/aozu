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
| 1 | LOW | Completeness | tasks.md T-01 | `extractRefsFromLine` は `string[]` を返すが、`coverageRefs` は `Reference[]`（`{ targetId, file, line }`）。T-01 の「`extractRefsFromLine(line)` で被覆引用を抽出し coverageRefs に追加」では、返された ID 文字列から `Reference` オブジェクトを組み立てる必要があることが暗黙。型定義（D1: `coverageRefs: Reference[]`）から明らかではあるが、明示するとよい。 | T-01 の該当ステップに「`{ targetId, file: filePath, line: lineNumber }` として coverageRefs に push」を追記する。実装への影響はなく、タスクの可読性向上のみ。 |
| 2 | LOW | Completeness | tasks.md T-03 | `dependencyIds` は `Set<string>`（行情報なし）のため、依存引用に対する R1 診断では `line: 1` が使われる。現行の被覆引用 R1 も `line: 1` であり後退はないが、タスクに明記がない。 | T-03 の R1 判定ステップに「依存引用の R1 は `line: 1`（`Set<string>` に行情報を持たないため、現行の被覆引用 R1 と同じ扱い）」と注記する。実装への影響はない。 |
| 3 | LOW | Ambiguity | design.md D2 | 完全一致パターン `^依存: \[\[...\]\]...$` は末尾の空白を許容しない。`依存: [[ent-a]] `（末尾スペース）はエディタで頻繁に発生するが、仕様上 fail-closed（malformedLines）になる。既存の structured-lines.ts の他パターンも末尾空白を許容しないため挙動は一貫しているが、spec.md のシナリオにも記載がなく、消費者が驚く可能性がある。 | 現行の fail-closed 挙動を維持する（変更不要）。必要であれば spec.md に「末尾空白は malformed」のシナリオを追加する。実装判断に影響しない LOW 事項。 |
| 4 | LOW | Consistency | spec.md | spec.md には coverage.ts の R3 出力フォーマット（`COVERAGE ERROR R3 - ...`）に対応する要件・シナリオがない。T-05 がフォーマットを規定しているが spec.md 側に対称する記述がない。request-review-result にも同様の指摘が LOW として記録済み。 | spec.md の「coverage の草稿に不正な依存行があれば exit 1」要件のシナリオに出力形式のメモを追加する（規範的でなくてもよい）。実装への影響はない。 |

## Summary

### 仕様一貫性の評価

**request.md ↔ spec.md のトレーサビリティ**: 受け入れ基準 8 項目はすべて spec.md の Requirement/Scenario に対応している。依存引用 exit 0、R2 での被覆引用拒否、R1（依存）、R3（malformed）、R0（被覆引用 0 件）、コードフェンス除外、coverage NOT_COVERED、既存挙動一致の全項目に Scenario が存在する。

**design.md ↔ tasks.md の対応**: D1→T-01、D2→T-01、D3→T-03、D4→T-05、D5→T-03 はすべて明確に実装タスクに落ちており、対応するテストタスク（T-02, T-04, T-06）および統合確認（T-07）も揃っている。

**既存コードとの整合性**: `extractReferences` の挙動を変えず、`extractRefsFromLine`・`stripInlineCode` を再利用する方針（D1 Rationale）は技術的に正当。`extractStructuredLines` への依存行組み込み除外（parseFiles パイプライン非影響）は Non-Goals に明記されており、設計上の意図が明確。`verifyCoverage` のシグネチャ不変要件（Requirement 末尾）も spec.md に明記されている。

**正規表現の技術的正確性**: 完全一致パターン `^依存: \[\[[a-z0-9-]+\]\](, \[\[[a-z0-9-]+\]\])*$` は仕様（1 件以上・カンマ区切り・ID は `[a-z0-9-]+`）を正しく表現する。行頭検出 `^依存:` との 2 段階で fail-closed を実現する構造は structured-lines.ts の他パターン（`^対象: ...`、`^実装:` 等）と同形式であり一貫している。

### セキュリティ評価

本機能はローカル CLI ツールの拡張であり、ネットワーク通信・認証・セッション処理を含まない。OWASP Top 10 の直接適用対象外。

- **入力バリデーション**: ID が `[a-z0-9-]+` に限定されており、文字クラスが閉じているため特殊文字のインジェクションリスクはない。
- **ReDoS**: 使用するパターンは単純な文字クラス量指定子のみで、ネスト量指定子やバックトラッキング爆発を引き起こす構造を持たない。既存の `REF_RE` がグローバルフラグ再利用時に `lastIndex = 0` でリセットされており、同じパターンで設計された新実装も同様の処理が必要（`extractRefsFromLine` の再利用で自動的に対処される）。
- **ファイルパス**: `filePath` は診断メッセージへの埋め込みのみで、ファイルオープンには使われない。パストラバーサルリスクなし。

### 総合評価

仕様は完結しており、内部一貫性があり、ADR-0024 および spec/integration.md §1・§4 の確定仕様に完全準拠している。発見事項はすべて LOW であり、実装の障害になるものは含まれない。実装開始に問題なし。
