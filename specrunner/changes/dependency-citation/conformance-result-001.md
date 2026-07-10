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
| tasks.md | ✅ yes | T-01〜T-07 の全チェックボックスが [x] 完了 |
| design.md | ✅ yes | D1〜D5 の設計判断がすべて実装に忠実に反映されている |
| spec.md | ✅ yes | 14 件の SHALL/MUST 要件と全シナリオが実装・テストで充足されている |
| request.md | ✅ yes | AC#1〜#10 の受け入れ基準がすべてテストで pass している |

---

## 1. Tasks Completeness

全タスク（T-01〜T-07）のチェックボックスがすべて `[x]` で完了している。

| Task | Title | Status |
|------|-------|--------|
| T-01 | request-citations.ts — 依存行認識と引用分類関数 | ✅ 完了 |
| T-02 | request-citations.test.ts — 分類関数ユニットテスト | ✅ 完了 |
| T-03 | check.ts — handleCheckRequest の二種類化 | ✅ 完了 |
| T-04 | check-request.test.ts — 依存引用テスト追加 | ✅ 完了 |
| T-05 | coverage.ts — 草稿引用抽出の依存行対応 | ✅ 完了 |
| T-06 | coverage.test.ts — coverage 依存行テスト追加 | ✅ 完了 |
| T-07 | 全体検証 — tsc / bun test / design check | ✅ 完了 |

---

## 2. Design Decisions Conformance

### D1: `extractRequestCitations` を `src/parse/request-citations.ts` に配置

- `src/parse/request-citations.ts` が新規作成されており、`RequestCitationResult` インターフェースと `extractRequestCitations` 関数が定義されている ✅
- `extractReferences` は変更されていない（design 文書パース経路に影響なし）✅
- `parseFiles` パイプラインへの組み込みなし（request 文書専用）✅
- `src/parse/index.ts` から `extractRequestCitations` と `RequestCitationResult` がエクスポートされている ✅

### D2: 依存行の文法認識は正規表現 + 行頭判定

- `DEPENDENCY_LINE_RE = /^依存: \[\[[a-z0-9-]+\]\](, \[\[[a-z0-9-]+\]\])*$/` — 仕様どおりの完全一致パターン ✅
- `line.startsWith("依存:")` で意図検出 → `DEPENDENCY_LINE_RE.test(line)` で検証 ✅
- コードフェンス toggle（`line.trimStart().startsWith("```")`）→ フェンス内 skip ✅
- fail-closed: 行頭 `依存:` が文法不一致 → `malformedLines` に追加、被覆引用にも依存引用にも含めない ✅

### D3: `handleCheckRequest` の検証を分類結果に基づいて分岐

- R3 → R0 → R1(coverage) + R2(coverage) → R1(dependency) の順で処理 ✅
- R2 は `uniqueCoverageIds` のみ対象（`dependencyIds` は状態不問）✅
- R0 は `uniqueCoverageIds.length === 0` で判定（依存引用は R0 を充足しない）✅
- 同一 ID が両方に現れた場合、`seenCoverage` で重複 R1 を抑制しつつ被覆側は R2 対象 ✅
- `extractReferences` のインポートが削除されている ✅

### D4: `handleCoverage` の草稿引用抽出を差し替え

- `extractRequestCitations(draftContent, draftPath)` に差し替え済み ✅
- `malformedLines` 存在時 → `COVERAGE ERROR R3 - malformed dependency line: '...' (file:line)` を stderr に出力して return 1 ✅
- `draftRefs = new Set(citations.coverageRefs.map((r) => r.targetId))` — `dependencyIds` を含まない ✅
- `verifyCoverage` のシグネチャ不変（`Set<string>` を受け取る）✅
- `extractReferences` のインポートが削除されている ✅

### D5: R3 診断コードの追加

- `check.ts` の R3 診断: `writeDiagnostics` 経由で `ERROR R3 - malformed dependency line: '...' (file:line)` を出力 ✅
- `coverage.ts` の R3: `COVERAGE ERROR R3 - malformed dependency line: '...' (file:line)` を直接 stderr に出力 ✅
- `elementId: null`（不正行から ID を抽出しない）✅

---

## 3. Spec Requirements Conformance

| # | Requirement | Verdict |
|---|-------------|---------|
| R-01 | `依存: [[id]](, [[id]])*` の文法で認識される | ✅ |
| R-02 | 不正な依存行は malformedLines として報告 | ✅ |
| R-03 | コードフェンス内の依存行は無視される | ✅ |
| R-04 | インラインコード内の参照は除外される | ✅ |
| R-05 | 同一 ID は出現箇所ごとに分類 | ✅ |
| R-06 | check --request: 依存引用の状態を問わない | ✅ |
| R-07 | check --request: 被覆引用の implemented を R2 で拒否 | ✅ |
| R-08 | 未解決の依存引用は R1 で拒否 | ✅ |
| R-09 | --require-citation は被覆引用のみを数える | ✅ |
| R-10 | 不正な依存行は R3 error で exit 1 | ✅ |
| R-11 | coverage: 依存引用を被覆集合から除外 | ✅ |
| R-12 | coverage: 不正な依存行があれば exit 1 | ✅ |
| R-13 | 依存行の無い文書は既存挙動と完全一致 | ✅ |
| R-14 | verifyCoverage のシグネチャは不変 | ✅ |

---

## 4. Request Acceptance Criteria Conformance

| AC | 内容 | テスト | Verdict |
|----|------|--------|---------|
| #1 | 依存引用で ent-a が implemented → exit 0 | check-request.test.ts AC#1 | ✅ |
| #2 | 同じ ID を本文でも引用 → implemented → R2 exit 1 | check-request.test.ts AC#2 | ✅ |
| #3 | 依存行の未解決 ID → R1 exit 1 | check-request.test.ts AC#3 | ✅ |
| #4 | 文法不一致行 → R3 exit 1 | check-request.test.ts AC#4 | ✅ |
| #5 | `--require-citation`、被覆引用 0 件（依存引用のみ） → R0 exit 1 | check-request.test.ts AC#5 | ✅ |
| #6 | コードフェンス内の `依存:` 行は無視 | check-request.test.ts AC#6 | ✅ |
| #7 | coverage: 依存行のみに現れる要素 → NOT_COVERED | coverage.test.ts AC#7 | ✅ |
| #8 | 依存行なし既存文書の診断が不変（既存テスト green） | 全 895 テスト pass | ✅ |
| #9 | aozu 自身の design check → exit 0 | 手動確認 | ✅ |
| #10 | `bunx tsc --noEmit` && `bun test` green | tsc exit 0 / 895 pass / 0 fail | ✅ |

---

## 5. 検証実行結果

```
bunx tsc --noEmit   → exit 0（型エラーなし）
bun test            → 895 pass / 0 fail（全ファイル）
bun src/cli/main.ts check --dir design → exit 0（既存 design check 不変）
```

新規・変更テストファイルの個別結果（70 pass / 0 fail / 3 ファイル）:

```
src/parse/request-citations.test.ts      — 全テスト pass
src/cli/commands/check-request.test.ts   — 全テスト pass（既存 + AC#1〜#6）
src/cli/commands/coverage.test.ts        — 全テスト pass（既存 + AC#7 相当）
```

---

## 6. 軽微な観察事項（verdict に影響なし）

1. **R1 診断の `line` フィールドが `1` 固定**: `dependencyIds` は `Set<string>` で行番号を保持しないため、依存引用の R1 エラー位置が `(file:1)` になる。変更前からの既存挙動の踏襲であり、設計（D3）も行番号精度を要求しない。スコープ外。
2. **R3 の stderr 文字列をサブプロセス経由で照合するテストなし**: exit code のみ検証。実装は `format.ts` の `writeDiagnostics` 経由で D5 の書式に準拠していることをコードレベルで確認済み。低優先。
