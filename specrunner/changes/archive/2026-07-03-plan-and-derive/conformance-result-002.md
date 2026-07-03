# Conformance Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:   implementation conforms to tasks.md, design.md, spec.md, and request.md
  - needs-fix:  one or more upstream artifacts are not satisfied by the implementation
  - escalation: conformance cannot be determined (missing artifacts, unresolvable ambiguity)
- The Findings table records the per-artifact judgment.
-->

- **verdict**: approved

## Conformance Findings

| Artifact | Conforms | Notes |
|----------|----------|-------|
| tasks.md | ✅ YES | T-01〜T-13 全 78 チェックボックスが [x] マーク済み |
| design.md | ✅ YES | D1〜D13 全設計判断を実装が遵守。D1（act を IMPLEMENTATION_PREFIXES に追加・NOTE コメント付き）・D2（findOwningElement → mod-graph）・D3（extractElementBody）・D4（computeNeighborhood）・D5/D6（純粋関数）・D7（template デュアルモード）・D8（loop 無効 → exit 1 / 設定欠落 → exit 2）・D9/D10（注釈・指示構造）・D11/D12（CLI 構文）・D13（正本追随）すべて確認 |
| spec.md | ✅ YES | conformance-result-001 が指摘した exit code 不整合が修正済み。derive + loop 無効が独立 Requirement "derive SHALL fail with exit 1 when loop is not enabled"（lines 91–99）として切り出され、"derive SHALL fail with exit 2" 節（lines 101–134）から除去されている。実装・テスト・design.md D8・request.md §5 とすべて一致 |
| request.md | ✅ YES | 受け入れ基準 8 項目すべてを実装とテストが充足している |

## Detailed Findings

### F-1 [RESOLVED] — conformance-result-001 指摘（spec.md の exit code 不整合）

conformance-result-001 で報告した "derive + loop 無効" の exit code 不整合（spec.md が exit 2 を規定、実装・design.md・request.md が exit 1）は、本イテレーションで spec.md を修正することで解消されている。

修正後の spec.md:

- 新設 Requirement（lines 91–99）: `derive SHALL fail with exit 1 when loop is not enabled`（ステージゲート不合格として plan と同クラスに明示）
- 既存 Requirement（lines 101–134）: `derive SHALL fail with exit 2 for missing configuration or invalid input` — リストに "loop not enabled" を含まない

実装 `src/cli/commands/prompt.ts:168` は `return 1` を返し、テスト `src/cli/commands/prompt.test.ts:465` は `expect(exitCode).toBe(1)` で固定されており、spec との整合が取れている。

### F-2 — 実装の主要確認事項

| 確認項目 | 内容 | 判定 |
|---|---|---|
| computeFrontier 移設 | `src/plan/frontier.ts` に移設。`IMPLEMENTATION_PREFIXES` に act を追加（ADR-0015）。openTopics の frontmatter status 依存に NOTE コメント付き（ADR-0018-3 追随スコープ外の明示） | ✅ |
| findOwningElement 移設 | `src/graph/attribution.ts` に移設。`src/check/attribution.ts` は re-export に差し替え。`src/graph/index.ts` からも re-export | ✅ |
| extractElementBody | 見出し要素（次の `## ` までの範囲）と文書要素（frontmatter 後の全量）の 2 カテゴリ対応。純粋関数、FileInput[] を受け取る | ✅ |
| computeNeighborhood | in/out 双方向 maxHops ホップ BFS。seed 自身を結果に含まない。visited セットで循環参照を防止 | ✅ |
| generatePlan | frontmatter `id: plan-<slug>` + `status: open`、H1 見出し `# <slug>`、単一グループ `{#grp-<slug>}`、注釈 3 節（参照辺・モジュール接地・実行中要素）。`request:` 行なし（ADR-0018-2） | ✅ |
| buildDeriveInstruction | 6 節（テンプレート `---TEMPLATE BEGIN/END---`・対象要素本文・近傍本文・term/inv・引用規約・出力先）。純粋関数 | ✅ |
| plan コマンド段階ゲート | loop 無効 → exit 1・既存 slug → exit 1・designed 0 件 → exit 1（ファイル非書込）。stdout 空、stderr に診断 | ✅ |
| derive 段階ゲート | loop 無効 → exit 1。request-template 欠落・request-output-dir 欠落・plan 不在・グループ不在・未解決要素 → exit 2 | ✅ |
| テンプレート デュアルモード | ファイル存在→読み取り、非存在→`sh -c` コマンド実行（D7: `shell: true` 相当）。非ゼロ exit → exit 2 + stderr 診断 | ✅ |
| ファイル非書込（derive） | filesystem snapshot 比較テストで固定（`listAllFiles` before/after） | ✅ |
| 正本追随 | spec/format.md §3 に `request-template` / `request-output-dir` 追補。spec/integration.md §4 に manifest frontmatter 注入点明記。design/static/modules.md mod-plan 責務行から「グループへの request 記録」削除。rules.json 再 export かつ `--verify` exit 0 | ✅ |
| main.ts 登録 | `plan` / `prompt` コマンドが registry に登録済み | ✅ |
| 依存方向 | mod-plan → {mod-graph, mod-state}、mod-prompt → mod-graph、mod-cli → {mod-plan, mod-prompt, mod-graph, mod-check, mod-state, mod-fsread}。禁止依存（mod-plan → mod-check / mod-cli 等）なし。architecture.test.ts green | ✅ |

## Quality Gates Summary

| 確認項目 | 結果 |
|---|---|
| `bun test`（全テスト） | ✅ 468 pass / 0 fail（新規テスト含む） |
| `tsc --noEmit` | ✅ exit 0 |
| `bun src/cli/main.ts check` | ✅ exit 0 |
| `bun src/cli/main.ts export rules --verify` | ✅ exit 0 |
| `package.json` `dependencies` | ✅ 空（実行時依存ゼロ） |
| architecture.test.ts（歯テスト） | ✅ green |
| spec/format.md §3 更新 | ✅ `request-template` / `request-output-dir` が任意キーとして追補済み |
| spec/integration.md §4 更新 | ✅ manifest frontmatter の注入点が明記済み |
| design/static/modules.md mod-plan 責務行 | ✅ 「グループへの request 記録」が除去され「plan の生成・coverage 検証」のみ |
| design/rules.json 再 export | ✅ `export rules --verify` exit 0 で整合確認済み |
