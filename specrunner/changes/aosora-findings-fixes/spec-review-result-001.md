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
| 1 | LOW | Consistency | request.md | 要件 #1 の "manifest を読む全動詞" 一覧に `review` が含まれているが、`handleReview` は `parseManifest` を呼び出さずマニフェストデータを使用しない。design.md のテーブルと tasks.md の T-01 Step 3 はともに review を対象外としており、実装カバレッジとの記述不一致がある。review はマニフェストの設定値を消費しないため機能的影響はなく、fail-closed の意図も損なわれない。 | 優先度低。実装時に design.md の "Non-Goals" に `review`（`parseManifest を呼ばないため対象外`）を明示的に追記しておくことで記述を整合させることができる。実装自体は tasks.md のとおり進めてよい。 |
| 2 | LOW | Risk Documentation | design.md | D2 センチネル変更（manifest ファイル在・`format-version` キー欠落 → `""` を返す）は "既存テストが `manifest.formatVersion` 値を直接アサートするものがない" ことを前提とする。manifest.test.ts を確認すると、`formatVersion: "0"` を直接オブジェクトリテラルで構築しているケースがほとんどだが、`parseManifest` を呼び出すテスト（frontmatter 側から `"format-version": "0"` を渡す）が複数存在する。センチネルは `parseManifest` の返値にのみ影響するため、手動構築の `Manifest` を使うテストは安全。ただし fixture ファイルに `format-version:` キーがない場合の想定がやや暗黙的で、tasks.md の「grep で事前確認・必要なら fixture に追記してよい」が実装時の唯一の安全網になっている。 | 実装前に T-01 の "実装前の確認事項" を必ず実行すること（`grep -r "format-version" tests/ src/`）。その際、`parseManifest` を直接呼び出すテスト（fixture 文字列を引数に渡す形式）も同じ grep で拾い、`format-version: 0` の有無を確認する。fixture に欠落があれば `format-version: 0` を追加してよいと tasks.md に明記されており、対処方針は明確。 |

## Review Summary

仕様書群（request.md / design.md / tasks.md / spec.md）の整合性・実装可能性・リスク対処を確認した。

**確認した主要事項**

- **コード前提の裏付け**: request.md・design.md が主張する現状コードの位置・挙動（`parseManifest` のセンチネル、`SESSION_GUIDANCE` の plain 形式 `topics: top-my-topic`、scaffold の prefix 必須、mark の `--request` 専用 parse）を実際のソースで確認済み。設計の前提はすべて正確。
- **parseManifest 呼び出し元の網羅性**: design.md のテーブルと実際の grep 結果が一致（check.ts 2箇所・status.ts・plan.ts・coverage.ts・prompt.ts 3箇所・mark.ts・scaffold.ts）。`handleReview` は `parseManifest` を呼ばないため design の除外判断は正しい。
- **D3（scaffold prefix 解決）のロジック検証**: `extractPrefix` の挙動（ダッシュなし → 文字列全体を返す）と `KNOWN_PREFIXES`（`src/parse/id.ts`）の内容から、bare slug / 型矛盾 prefix / フル ID の 3 パターンがすべて正しく分岐することを確認。`validateId` の呼び出しが補完後の ID に対して行われるため既存の grammar 検証も維持される。
- **D2 センチネルの影響範囲**: manifest.test.ts の既存テストはほぼ `Manifest` をオブジェクトリテラルで直接構築しており、`parseManifest` の返値を経由しない。センチネル変更が既存テストを破壊するリスクは低い（ただし T-01 の事前 grep で確認必須）。
- **spec.md シナリオの受け入れ基準との一致**: spec.md の全 Given/When/Then シナリオが tasks.md の各 AC および request.md の「受け入れ基準」と整合していることを確認。
- **セキュリティ**: 開発者向け CLI ツールであり外部入力を HTTP 経由で受け取らない。OWASP Top 10 に該当するリスクなし。

**結論**: 仕様は完全・整合的かつ実装可能。上記 2 件の LOW 指摘は実装判断を要するものではなく、実装者向けの注意事項として参照すること。
