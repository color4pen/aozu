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

## Summary

仕様全体の完成度は高い。request.md / design.md / spec.md / tasks.md の間の整合性は概ね取れており、既存コードベースの構造（ParseResult・Graph・CLI registry パターン）との適合も確認できた。CRITICAL・HIGH の問題はなし。以下に MEDIUM 1 件・LOW 3 件を記録する。

**検証済み事項**

- `src/parse/types.ts` の `ParseResult` に `implementations` フィールドが存在しないこと（T-01 の前提として正しい）
- `src/graph/types.ts` の `Graph` に `implementations` フィールドが存在しないこと（同上）
- `src/check/manifest.ts:8` が `ParseResult` を `../parse/types.ts` から直接 import していること（既知違反・T-02 の前提として正しい）
- `src/graph/index.ts` が `ParseResult` を re-export していないこと（T-02 の前提として正しい）
- `src/parse/structured-lines.ts` が `実装:` 行を `{ paths, file, line }[]` として既にパースしていること（D1 の根拠として正しい）
- `src/parse/parser.ts` が `implementations` を `ParseResult` に伝搬していないこと（T-01 の前提として正しい）
- `design/static/dependencies.md` の 19 本すべての辺が mod prefix 同士であること（generator の安全な前提）
- CLI registry パターン（handler が exit code を返し、`main.ts` のみが `process.exit` を呼ぶ）が D4 と整合すること
- セキュリティ面: ローカル CLI ツールのため OWASP Top 10 の主要項目（injection・認証・CSRF 等）は非適用。`JSON.stringify` によるJSON出力は安全。`--dir` / `--out` のパス指定はユーザー自身の操作環境内に限定される。実行時依存ゼロの方針により、サプライチェーン攻撃面は排除されている。

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | MEDIUM | Consistency | tasks.md | T-04 の実装説明「`rules` 以外（または未指定）は usage を stderr に出力し exit 2」が "未指定" を exit 2 にグルーピングしているが、design.md D4「サブコマンドなし / `--help` は usage を stderr に出力し exit 0」およびT-04 内のテストケース「`handleExport([])` が exit 0 を返す（usage 表示）」と矛盾する。実装者が説明テキストを優先すると誤実装になる。 | T-04 の実装説明を「サブコマンド未指定および `--help` は exit 0（usage 表示）、未知サブコマンドは exit 2」と明確に分けて記述する。 |
| 2 | LOW | Spec Gap | design.md | D2/T-03 にて `graph.dependencyEdges` から `allowed` を生成する際、mod prefix 以外の edge（例: `[[term-x]] -> [[ent-y]]`）が含まれた場合の generator の動作が未定義。現状の `design/static/dependencies.md` は全辺が mod-mod だが、仕様として明示されていない。 | generator の仕様に「`from` / `to` どちらかが mod prefix でない edge は除外する」または「入力 Graph は check 通過済みを前提とする（C4 が保証）」旨を D2 または T-03 に一行追記する。 |
| 3 | LOW | Spec Gap | tasks.md | T-05 で architecture test が `design/` および `src/` を読む際のリポジトリルートの発見方法が未記述。`process.cwd()` 前提か `import.meta.dirname` 起点の上方探索かにより、`bun test` の起動ディレクトリが変わった場合の挙動が変わる。 | T-05 に「`import.meta.dirname` を起点としてリポジトリルートを解決する」または「`bun test` をリポジトリルートから実行することを前提とし `process.cwd()` を使用する」のいずれかを明記する。 |
| 4 | LOW | Spec Gap | design.md | D3 は同一 mod 要素に対して複数の `実装:` 行が出現した場合の動作（パスの concat か、後勝ち上書きか、診断を出すか）を定義していない。現在の `modules.md` では各 mod に `実装:` 行は 1 行だが、将来の拡張またはユーザーミスの際の仕様が空白。 | D3 に「同一 mod への複数 `実装:` 行はパス配列を結合する（concat）」または「2 行目以降は診断を出し無視する」のいずれかの方針を一行追記する。 |
