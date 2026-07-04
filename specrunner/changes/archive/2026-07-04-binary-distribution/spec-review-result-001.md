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
| 1 | HIGH | Consistency | tasks.md T-03 ↔ design.md D5 | **バイナリ命名の不一致 — install.sh が404になる**: T-03 は `--outfile aozu-<target>` と書き、matrix target は `bun-darwin-arm64` 等。これを文字通り実行すると `aozu-bun-darwin-arm64` が生成される。一方 D5 は `aozu-darwin-arm64`（`bun-` 接頭辞なし）を正規名として列挙し、T-05 の install.sh も `aozu-${os}-${arch}` でダウンロード URL を構築する。実装者が T-03 を T-05・D5 と照合せずに実装した場合、install.sh は存在しないアセット名を要求し curl が 404 で失敗する。 | T-03 の step 5 を明示的に修正する。`--outfile` は matrix target から `bun-` 接頭辞を除去した `aozu-${os}-${arch}` とすること。例: target `bun-darwin-arm64` → outfile `aozu-darwin-arm64`。変換ロジックを step 内にシェルコマンドとして示す（例: `OS=$(echo ${{ matrix.target }} \| sed 's/^bun-//') && OUTFILE="aozu-${OS}"`）。D2 の "Produces binaries named `aozu-<target>`" も D5 の例示と一致するよう "Produces binaries named `aozu-<os>-<arch>`" に修正する。 |
| 2 | MEDIUM | Security | install.sh (T-05, design.md D3) | **ダウンロードしたバイナリのチェックサム検証なし**: install.sh は GitHub Releases からバイナリを取得するが、整合性検証（SHA256 等）を行わない。spec のどこにもリリースへのチェックサムファイル添付が要求されていない。MITM や改ざんされたリリースアセットをサイレントに実行する経路が残る。`curl | bash` パターン自体は ADR-0021 および D3 で意識的に採用されているが、バイナリ本体の検証省略は別リスク。 | 対応方針を選択して spec に明記する。推奨: T-03 の upload-binaries step にチェックサムファイル生成・アップロード（`sha256sum aozu-* > checksums.txt`）を追加し、T-05 の install.sh でダウンロード後に `sha256sum --check` を実行する。代替として初版では省略し design.md の Risks セクションに「チェックサム検証は初版スコープ外（需要駆動で追加）」と明示する。どちらにせよ未解決のまま進めない。 |
| 3 | LOW | Clarity | tasks.md T-07 | **"job または steps" の二択が未解決**: "Add a `binary-smoke` job (or steps in the existing `ci` job)" と書かれ実装者の裁量に委ねている。既存 ci job への追加は差分が小さく、独立した job 追加は並列化・権限分離の恩恵がある。spec.md D4 は "job" と断言しているが tasks.md が揺れている。 | tasks.md T-07 を D4 の記述に統一し "Add a `binary-smoke` **job**" に確定する。既存 ci job への steps 追記という選択肢を削除する。 |
| 4 | LOW | Security | install.sh (T-05) | **`curl \| bash` リスクの明示**: D3 は bun.sh と同型の方式と記しているが、spec.md には `curl \| bash` が意識的なリスク受容であることの記述がない。spec だけを読むレビュアーが指摘するリスクを未然に防げる。 | spec.md の Requirements または Risks に「install.sh は curl \| bash 方式を採用。HTTPS + GitHub Releases のホスト信頼で代替する。チェックサム検証は finding #2 で別途対応」と一文追加する。 |

## Review Notes

### 前提事実との整合確認

- `src/cli/main.ts` の `--version` 実装が `fileURLToPath(new URL("../../package.json", import.meta.url))` → `Bun.file(pkgPath).json()` であることを実コードで確認。コンパイル済みバイナリでは `package.json` が存在しないため失敗するという問題認識は正確。
- `.github/workflows/publish.yml` のトップレベル `permissions: { contents: read, id-token: write }` および job 分割が存在しないことを確認。T-03 の「per-job 権限宣言への移行」は現状との差分として正しい。
- `release-please-config.json` の `include-component-in-tag: false` → タグ形式は `v<semver>` のみ。`gh release upload v${VERSION}` という構成と整合している。
- `tests/packaging.test.ts` の CI grep テストパターンを確認し、T-04 が同一パターンを踏襲していることを確認。

### 設計判断の正当性

- D1（フォールバック二段構え）・D2（job 権限分離）・D3（root 配置）・D4（native CI smoke）は要件と整合しており設計として妥当。
- D5 が命名規則を `aozu-<os>-<arch>` で確定している点は正しい判断。問題は T-03 がこれを再導出するコードを具体的に示していないこと（finding #1）。
- spec.md のシナリオは全て機械検証可能な形式になっており、受け入れ基準との対応も取れている。finding #1 が修正されれば実装の入力として十分。

### セキュリティ評価（OWASP Top 10 観点）

- **A08 Software and Data Integrity Failures**: `curl | bash` パターンおよびチェックサム不在（finding #2）が該当。D3 は bun.sh の先例を根拠にリスク受容を示唆するが、spec レベルでの明示が不十分。
- **A05 Security Misconfiguration**: `contents: write` を npm publish job から分離する設計は正しく、workflow 権限の最小化として適切。
- その他 OWASP Top 10 項目（インジェクション・認証・認可等）はインストーラスクリプトと GitHub Actions workflow の性質上、該当する攻撃面は限定的と判断する。`--define` による定数注入は `package.json` から読む値であり外部入力を経由しない。
