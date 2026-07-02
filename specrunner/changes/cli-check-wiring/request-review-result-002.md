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
| 1 | LOW | Clarity | 要件 3 / 受け入れ基準 | `check --request` が design ディレクトリをどう探すかが明示されていない。integration.md §1 の exit code 2 定義（design/ 不在も 2）から必要なことは分かるが、`--dir <path>` を受け付けるかどうかが要件 3 に書かれていない（要件 2 には明記あり）。 | 実装者は `check --request` でも `--dir` を同様に受け付ける設計を取るのが自然だが、スコープを明確にするため一文追記しておくと望ましい。ブロッカーではない。 |
| 2 | LOW | Clarity | 要件 3 / spec/integration.md §1 | `check --request` 違反時の診断コード（`<CODE>` フィールド）が定義されていない。C1〜C11 は閉包検証用であり、引用未解決・状態不正には独自コードが必要になる。実装者が決定するスコープだが、テスト固定のために実装段階で決める必要がある。 | 実装者に任せて問題ない実装詳細。ただし将来の契約安定性のため spec/integration.md §1 にコード体系を補記することを推奨する。 |

## Review Notes

### 前提コードの確認

以下をすべて読取り確認した:

- `src/check/checker.ts`: `runCheck(graph, manifest, stateKeys?)` のシグネチャ、`CheckDiagnostic[]` の返却 — request の記述と一致
- `src/check/types.ts`: `CheckDiagnostic` 型（level / code / elementId / message / file / line）— CLI 層が契約形式文字列に整形可能
- `src/parse/references.ts`: `extractReferences(content, filePath)` がコードフェンス・インラインコード除外込みで `[[id]]` を抽出 — request 文書の引用抽出への再利用が可能
- `src/fs/reader.ts`: `readMarkdownFiles(dir)` で再帰的 .md 読み取り
- `src/graph/builder.ts`: `buildGraph(parsed, manifestPath)` の存在
- `src/check/manifest.ts`: `parseManifest(frontmatters, manifestPath)` の存在
- `design/static/dependencies.md`: `mod-cli -> mod-state` が許可依存として明示
- `src/state/` ディレクトリは未存在 — 本 request で新設が必要（request の前提と一致）
- `src/cli/main.ts`: スタブ（console.log 1 行）— 本 request で実装が必要（一致）
- `package.json`: `dependencies` が空 — 受け入れ基準の前提を満たしている

### 技術的整合性

- `check` コマンドの結線フロー（readMarkdownFiles → parseFiles → buildGraph → parseManifest → runCheck）は既存 API との整合が取れている
- `check --request` のフロー（request ファイル読み取り → extractReferences → design ディレクトリのグラフ構築 → (a) ID 解決 + (b) state 照合）は要件・受け入れ基準・integration.md §1 との整合が取れている
- `stateKeys` を `runCheck` へ渡す用途（C8 規則）と、`check --request` で state エントリを直接参照する用途（状態検証 (b)）が要件 4 の state モジュール設計で適切に分離されている
- 診断フォーマット `<LEVEL> <CODE> <id> <message>` を CLI 層に置く方針は `src/check/types.ts` の設計（check モジュールは構造体のみ返す）と一致している

### 受け入れ基準の評価

受け入れ基準はすべて具体的かつテスト固定可能:
- 自己チェック（exit 0・stderr なし）: `design/` が閉包を満たすため成立見込み
- 違反 fixture → exit 1 + stderr 診断: `runCheck` が診断を返す経路で固定可能
- design 不在 → exit 2: ディレクトリ存在チェックで固定可能
- `check --request` の各シナリオ: 引数・fixture・モックで完全固定可能
- stdout/stderr 分離: Bun テストのプロセス起動と出力キャプチャで確認可能
- `dependencies` 空維持: 既存テスト（`src/package.test.ts`）が確認済み
- `tsc --noEmit && bun test` green: CI で確認可能
