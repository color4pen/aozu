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
| 1 | MEDIUM | Specification Gap | spec.md (§8 Req) / design.md (D4) / tasks.md (T-02) | spec.md §8 要件は「`責務:` 行・`実装:` 行・`## 登場要素` 配下 `- [[id]]` リスト・`elements:` 行を **parse result に構造化データとして** 返すこと」を SHALL で定める。しかし `ParseResult` 型（D4/T-02）が持つ構造化フィールドは `dependencyEdges: DependencyEdge[]` のみで、残り 3 種の出力先が未定義。T-07 は各認識関数の実装を要求するが、`ParseResult` へのマッピングを指定していない。将来の `mod-export`（rules export の `"paths"` 生成には `実装:` 行が必須）および `mod-check` C5（seq の `## 登場要素` リストが非空かつ全 mod）のいずれも、このデータを `ParseResult` から取得できない。次 request でフィールドを追加すると API 破壊が生じる。 | `ParseResult` に `responsibilities: Map<string, string>`、`implementations: Map<string, string[]>`、`registeredElements: Map<string, string[]>`（seq ファイルの `## 登場要素` 配下 ID リスト）のフィールドを追加し、D4・T-02・spec.md §8 要件を一致させる。または `Element` 型を `responsibility?: string; implementation?: string[]` で拡張する。T-07 の AC にも「抽出値が `ParseResult` 経由で取得できること」を追加する。 |
| 2 | LOW | Type Inconsistency | design.md (D4) / tasks.md (T-02) | `ParseResult` の `frontmatters` 値型が D4 では `Record<string, string>` だが T-02 では `Record<string, string \| string[]>` と乖離している。§7 要件（カンマ区切りリストは配列に変換）および T-04 AC（「カンマ区切りが配列に変換される」）に照らすと T-02 の版が正しい。D4 を正規定義と誤解した実装者が `string` 型で実装すると T-04 の型検査・テストが失敗する。 | design.md D4 の `ParseResult` 定義を `frontmatters: Map<string, Record<string, string \| string[]>>` に修正して T-02 と揃える。 |
| 3 | LOW | Documentation Gap | design.md (D5) | D5 のファイル構成図に `src/cli/main.ts` が含まれていない。D6 で `bin` エントリとして `./src/cli/main.ts` を明記し、T-01 で最小 stub の作成を要求しているにもかかわらず、設計のファイルツリーに記載がない。 | D5 のファイル構成図に `src/cli/main.ts` を追加する（`src/cli/` ディレクトリごと）。 |

## Notes

### 検証済み事実

- `bash tools/check.sh design` の出力: `OK: 宣言 25 要素 / 参照 15 種すべて解決`。T-10 の定量 AC（25 要素・15 参照種・16 依存辺）の根拠と一致する。
  - 25 要素: mod×10（modules.md）、ent×5（model.md）、inv×5（invariants.md）、seq×2（dynamic/）、term×3（glossary.md）= 25 ✓
  - 15 参照先 ID: T-10 の明示リストを実際の design/ 文書参照と照合、過不足なし ✓
  - 16 依存辺: dependencies.md の `- [[...]] -> [[...]]` 行数 = 16 ✓
- `design/domain/invariants.md` 16 行目に `` `[[id]]` ``（インラインコード内）が確認済み。check.sh の `gsub(/\`[^\`]*\`/, "", line)` で除外される。T-10・spec.md §6 要件の fixture 指定は正確。
- T-10 の 25 ID 明示リストを design/ の実宣言と照合：完全一致 ✓

### 仕様の整合性確認

- spec.md §5〜§8 シナリオと spec/format.md §5〜§8 の条項が一致していることを確認。
- D2（コードフェンス状態トグル・インラインコード除去）は check.sh の awk ロジック（`gsub(/\`[^\`]*\`/, "", line)`）と同等のアルゴリズムであり、実績のある手法と整合する。
- D3（診断を返して throw しない）は複数ファイルの一括報告を前提とする mod-check の設計と整合。
- D4 データ型・D7 tsconfig は greenfield スタートのプロジェクト構成として妥当。ADR-0003・ADR-0009 との整合を確認。
- `src/parse/` 配置は `design/static/modules.md` の `[[mod-parse]]` に対応 ✓

### セキュリティレビュー

本変更はローカル開発者ツール（CLI）であり、ネットワーク通信・認証・データベース・外部 API を持たない。OWASP Top 10 の直接的な該当項目はない。以下の点を確認した:

- **ファイル I/O 境界**: パーサ本体（`src/parse/`）はファイル I/O を行わない純関数（D1）。I/O は `src/fs/reader.ts` に局所化されており、攻撃面が小さい。
- **入力検証**: パーサは文字列入力を行指向で処理する。ReDoS リスクとなる複雑な正規表現は仕様上排除されている（ADR-0003「貧弱なパーサで読める」制約）。
- **パストラバーサル**: `src/fs/reader.ts` が glob で `.md` ファイルを列挙する際、呼び出し元が `design/` ディレクトリを指定する。CI 自動化等で untrusted なパスを渡す場合はパス検証が望ましいが、ローカル開発ツールとしての現スコープでは許容範囲。
- **実行時依存ゼロ方針**: サプライチェーン攻撃の surface が devDependencies のみに限定される点はセキュリティ上の利点。

HIGH 以上の所見なし。実装フェーズへの進行を承認する。
