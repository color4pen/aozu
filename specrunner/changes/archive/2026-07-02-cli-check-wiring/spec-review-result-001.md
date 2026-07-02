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
| 1 | MEDIUM | Consistency | design.md §D7 | D7 が「引用要素に designed/requested のものが 1 つでもあれば、implemented の引用があっても合格」と書いた後、「ただし上記の最後の条件は誤り」と即座に否定する構成になっている。最終結論（各要素個別に判定：implemented な引用があればその引用に対して診断を出す）は明確だが、誤りの解釈を先に肯定文で述べる構造は実装者を誤誘導するリスクがある。さらに spec/integration.md §1 の "(b) 引用要素の状態が designed または requested である（implemented **のみ**を引用する request は…）" という文言は、「すべての引用が implemented の場合にのみ不合格」（解釈 B）とも読める。spec.md は明示的に「各要素個別に判定」（解釈 A）と定義しており両者に緊張がある。 | design.md D7 の本文から誤解を招く最初の解釈（「一部 implemented でも合格」）を削除し、結論のみを記述する。またはコメントとして「却下した解釈」として区別する。integration.md §1 の "(implemented のみを引用する request は…)" の括弧書きを "（引用要素の中に implemented のものがある request は…）" のように修正し、解釈 A を明示する。 |
| 2 | LOW | Coverage | spec.md | spec.md に "manifest not found → exit 2" のシナリオがない。request.md 要件 2 は "exit code: 2 = 入力不正（design ディレクトリ不在・**manifest 不在**）" と明記し、tasks.md T-04 の受け入れ基準にも manifest 不在の扱いは書かれているが、spec.md のシナリオには "missing design directory" しかなく "missing manifest" が抜けている。実装者が manifest 不在を exit 0 または無検出にしてもテスト違反にならない。 | spec.md の `aozu check` 要件ブロック内に "Scenario: missing manifest produces exit 2" を追加する。T-07 の統合テストにも対応するテストケースを追加する。 |
| 3 | LOW | Coverage | tasks.md §T-08 | tasks.md T-08 に「一部の引用要素が implemented で残りが designed/requested」という partial-implemented ケースのテストがない。D7 の結論（各要素個別に判定）と spec.md の記述（"An element whose state is `implemented` SHALL produce a diagnostic"）を確認するために必要なケースだが、全件 implemented のケースのみをカバーしている。 | T-08 に "テスト: implemented と designed が混在する引用で exit 1（implemented 要素の診断が出る）" のケースを追加する。request 文書に `[[mod-cli]]`（implemented）と `[[mod-parse]]`（state.json なし = designed）を含め、exit 1 かつ `[[mod-cli]]` の診断が stderr に出ることを assert する。 |
| 4 | LOW | Clarity | design.md §D3 | design.md D3 は "code は `"REQ"` とする（C1〜C11 とは区別する）" と定義しているが、spec.md の check --request シナリオはコード値を検証していない。テストで診断コードを固定しないと、将来的に実装間で `"REQ"` / `"REF"` / `"CITATION"` 等がばらける可能性がある。 | spec.md の check --request 出力関連シナリオに "(code is `REQ`)" のような一文を補記するか、format.ts のフォーマッタテスト（T-03）で `code: "REQ"` を fixture に含めて固定する。 |

## Summary

### 検証方法

以下のファイルを読み取り確認した: request.md, design.md (D1〜D7), tasks.md (T-01〜T-09), spec.md, spec/integration.md, spec/format.md, src/check/types.ts, src/check/checker.ts, src/parse/references.ts, src/fs/reader.ts, src/graph/builder.ts, src/check/manifest.ts, design/static/modules.md, design/static/dependencies.md。

### 仕様の内部整合性

- **requirements → spec シナリオ対応**: request.md の受け入れ基準はすべて spec.md の Given-When-Then シナリオに対応が取れている（manifest 不在除く、Finding #2）
- **exit code 規約**: request.md 要件 2・3、design.md D6、spec.md、integration.md §1 のすべてで 0/1/2 の意味が一致している ✅
- **診断の出力先 (stderr/stdout)**: request.md 要件 5・spec.md "Scenario: stdout remains empty"・integration.md §5 で一貫している ✅
- **extractReferences 再利用**: design.md D3、tasks.md T-05、src/parse/references.ts の実装が揃っており再利用可能 ✅
- **src/state/ 配置**: design.md D4、design/static/modules.md [[mod-state]] の責務定義、design/static/dependencies.md [[mod-cli]] -> [[mod-state]] 辺が整合している ✅
- **CheckDiagnostic → 文字列整形**: design.md D5、tasks.md T-03、src/check/types.ts の構造体設計が整合している ✅

### セキュリティ評価

- **入力バリデーション**: `--dir` / `--request` のパス引数はファイルシステムの任意パスを受け付ける。パストラバーサル（例: `../../etc/passwd`）は理論上可能だが、本ツールは開発者ローカルで実行する CLI であり、利用コンテキストから許容リスクと判断する
- **state.json の JSON.parse**: スキーマ検証なしでの JSON.parse はランタイムエラーになりうる。design.md の Risks セクションに明記されており、後続 request での対応が明示されている。ローカル設計ツールとしてのリスクは低い
- **ネットワーク/外部接続**: なし。ファイルシステム読み取りのみ ✅
- **実行時依存ゼロ**: dependencies 空の制約により外部ライブラリの脆弱性リスクがない ✅
- **process.exit をハンドラ外に隔離**: テスト容易性と同時に、テスト実行中の意図しない exit を防ぐ設計になっている ✅
- OWASP Top 10 で適用可能な項目（A03: Injection, A01: Broken Access Control 等）はローカル CLI の性質上リスクレベルが低く、追加のセキュリティ制御は不要と判断する

### 総評

CRITICAL・HIGH の所見はなし。Finding #1（D7 の記述順序による解釈の揺れ）が MEDIUM だが、spec.md で解釈 A（各要素個別に判定）が明文化されているため実装上のリスクは限定的。Finding #2〜4 は LOW 品質改善事項。spec 全体の完成度は高く、既存コードベースとの整合性が取れており、実装に進んで差し支えない。
