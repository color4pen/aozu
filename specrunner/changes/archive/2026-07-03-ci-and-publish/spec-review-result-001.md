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
| 1 | MEDIUM | Security | design.md / tasks.md T-04 | CI workflow（ci.yml）の設計に `permissions` ブロックが明示されていない。GitHub Actions のデフォルト権限はリポジトリ設定によって `write-all` になり得る。CI ジョブはチェックアウトと読み取り専用操作のみ行うため、GITHUB_TOKEN の最小権限化（`contents: read`, `pull-requests: read` 程度）を設計書に明記すべき。 | T-04 のステップ定義に `permissions: contents: read` を追加する。既存の release-please.yml / publish.yml には権限が明記されているため、ci.yml も同じ水準に合わせる。 |
| 2 | MEDIUM | Security | design.md D2 / tasks.md T-05 | `RELEASE_PLEASE_TOKEN` として使用する PAT に必要なスコープが設計書に記載されていない。スコープ過多の PAT が登録されるリスクがある（human 側作業ではあるが、spec としての明示は重要）。 | design.md D2 または tasks.md T-05 の Non-Goals コメントに、PAT に必要なスコープ（`contents: write`, `pull-requests: write`）を一行記載する。 |
| 3 | MEDIUM | Coverage | spec.md | request 要件 6（README 導入節の追加）に対応する spec.md の Requirement / Scenario が存在しない。tasks.md T-07 は README 更新を定義しているが、機械検証可能な受け入れ条件がなく、実装後の回帰防止が手動確認に委ねられる。 | spec.md に「Requirement: README SHALL include an installation section」を追加し、`## 導入` セクション・`bunx aozu`・`bun add -g aozu` の各文字列を Scenario で固定する。または T-09（workflow grep テスト）の要領で `tests/packaging.test.ts` に README の grep テストを追加する。 |
| 4 | LOW | Risk | design.md D5 / tasks.md T-08 | `tests/packaging.test.ts` から `npm pack --json` を呼び出すが、CI ジョブは `oven-sh/setup-bun` のみをセットアップし `actions/setup-node` を使わない。ubuntu-latest には npm がプリインストールされているため実質問題ないが、この前提が design.md に記載されていない。将来 runner を変更した場合に壊れる可能性がある。 | design.md D1 または D5 に「ubuntu-latest の npm プリインストールに依存する」旨を一行追記する。または CI 側で `actions/setup-node` を追加して明示的に保証する（ただし publish.yml にはすでに存在するため整合性はとれる）。 |
| 5 | LOW | Style | spec.md | 各 Scenario の Given 句（例：`Given .npmignore is configured to exclude **/*.test.ts`）が実装手段（`.npmignore`）に言及している。Given はシステムの初期状態を記述すべきであり、実装詳細は含まない方が仕様の独立性を保つ。機能上の問題はない。 | Given 句を「`Given the package is configured to exclude test files from the tarball`」のように状態レベルの記述に変更する（任意）。 |

## Validation Notes

### 要件カバレッジ（request.md → spec.md の対応）

| 要件 | spec.md の対応 |
|------|---------------|
| 1. CI workflow（4 コマンド） | Requirement: CI workflow SHALL execute the 4 quality gate commands ✓ |
| 2. release-please config + workflow | Requirement: release-please config SHALL use node release-type … ✓ |
| 3. publish workflow | （直接シナリオなし。tasks.md T-06 でカバー。低リスク） |
| 4. package.json 整備 | Requirement: package.json SHALL be configured for public publishing ✓ |
| 5. LICENSE ファイル | tarball の required files シナリオで LICENSE 含有を検証 ✓ |
| 6. README 導入節 | **spec.md に対応 Requirement なし（Finding #3）** |
| 7. packaging smoke | Requirement: The packaged binary SHALL be executable ✓ |

### 設計判断の一貫性

- **D1（CI ワークフロー）**: 4 コマンドの選定・順序・bun 専用セットアップはすべて設計上の根拠が明示されており妥当。`paths-ignore: specrunner/changes/**` の push 限定適用（PR では全パス対象）は意図的な設計であり問題なし。
- **D2（release-please）**: PAT 採用理由（GITHUB_TOKEN の連鎖 workflow 非発火）は spec-runner での実証を根拠とする正当な選択。`bump-patch-for-minor-pre-major: true` が design.md・tasks.md には含まれるが spec.md の Requirement には記載がない——実装上は追加されるため機能的問題はないが、spec.md との軽微な乖離。
- **D3（publish workflow）**: `npm publish --provenance` + `id-token: write` の組み合わせは正しい。Node.js セットアップが publish でのみ必要な理由（`.npmrc` の registry 設定）も明記されており整合的。
- **D4（package.json）**: `.npmignore` による `*.test.ts` 除外は request-review Finding #1 への適切な対処。`files` + `.npmignore` の二段構えは npm の既知挙動を踏まえた設計として妥当。
- **D5（packaging smoke）**: テストファイルへの統合によりローカルと CI の検証範囲を統一する判断は正しい。
- **D6（workflow grep テスト）**: 品質ゲートコマンドの意図せぬ削除を防ぐ safeguard として適切。

### タスク完全性

- T-01〜T-11 がすべての要件（README を除く）をカバーしており、各タスクの受け入れ基準が機械検証可能な形式で記述されている。
- T-10 で `src/package.test.ts` に新規テストを追加しつつ既存テストを不変に保つ設計は、既存の歯の保護と整合している。
- T-11 の最終検証タスクが全コマンドを再確認する構造になっており、実装完了の定義が明確。

### セキュリティ評価

- **シークレット管理**: `NPM_TOKEN`・`RELEASE_PLEASE_TOKEN` はいずれも GitHub Secrets 経由での参照であり、YAML にハードコードされない設計。
- **SLSA provenance**: `npm publish --provenance` の採用はサプライチェーンセキュリティのベストプラクティスに沿っている。
- **Action バージョン固定**: `@v4`・`@v2` のメジャーバージョン固定は一般的な運用。セキュリティ要件が高まれば SHA ピン留めへの移行が望ましいが、本 request のスコープでは許容範囲。
- **OWASP CI/CD Top 10 観点**: PPE（Poisoned Pipeline Execution）リスク——外部 PR からのワークフロー改ざん——は `pull_request` トリガ（`pull_request_target` ではない）の使用により適切に緩和されている。
