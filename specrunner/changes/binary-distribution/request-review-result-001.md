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
| 1 | LOW | Clarity | 要件 3 / install.sh | install.sh の配置先が「リポジトリ直下（または `scripts/`）」と二択のまま開放されている。README のインストール一行コマンドは raw URL を静的に指定する必要があるため、パスが実装者任せだと README との整合を後追いで取ることになる。 | 実装前に `scripts/install.sh` か `/install.sh` のどちらかに一本化し、要件 5（README 追記）と同時に確定させること。 |
| 2 | LOW | Clarity | 要件 3 / 受け入れ基準 | install.sh は curl \| bash 形式（POSIX bash）のため Windows ユーザーは手動で `.exe` をダウンロードする必要があるが、このことがスコープ外にも要件文にも明記されていない。README に「Windows は Release ページから直接ダウンロード」と一文添えることで、サポート範囲の誤解を防げる。 | 要件 5（README 追記）の中で Windows の手順を一行補足として入れることを推奨する。 |

## Review Notes

### 前提事実との整合

- `publish.yml` の `contents: read` 制限・`id-token: write`（provenance）の構成は request の記述と完全一致。要件 2 の「job 分割で最小権限」は現行 workflow の権限設計を崩さない正しい判断。
- `src/cli/main.ts` の `--version` 実装が `Bun.file(pkgPath).json()` の実行時読み込みであることを確認。コンパイル済みバイナリでは `import.meta.url` が埋め込みパスに解決されるため `../../package.json` は存在せず、要件 4 の問題認識は正確。
- `release-please-config.json` の `include-component-in-tag: false` / `.release-please-manifest.json` の `0.1.1` を確認。タグ形式は `v*` で publish.yml トリガと整合。
- ADR-0021 が「release-please のリリースに自動添付」「install.sh を提供」「bun-native 維持」を決定済みであり、本 request はその実施に留まる（adr: false は妥当）。
- `bun build --compile` のターゲット 5 種（darwin-arm64/x64・linux-x64/arm64・windows-x64）は ADR-0021 および Bun クロスコンパイル対応と一致。
- 受け入れ基準はすべて機械検証可能な文になっており（grep テスト・exit 0 テスト・shellcheck・packaging smoke）、要件と 1 対 1 対応している。

### 設計判断の確認

- バージョン埋め込みを「ビルド時定数優先、実行時読みフォールバック」とすることで npm 配布経路の挙動を変えない方針は、ソース実行ユーザーへの影響ゼロを保証する。
- binary job と npm publish job の権限分離（`contents: write` と `id-token: write` を同居させない）は provenance 署名の信頼境界を守る正しい設計。
