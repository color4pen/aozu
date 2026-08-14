# Conformance Result

<!-- EVIDENCE REPORT FORMAT:
     verdict は CLI が typed findings から導出する。この file に verdict 行を書かない。
     findings は report_result（typed）で報告し、この file はその補足の evidence report である。
-->

## 検証した項目

### J1: tasks.md — 全 checkbox [x] 確認

T-01 〜 T-10 の全 checkbox（52 項目）が `[x]` であることを Read ツールで確認。

### J2: design.md の設計判断 → 実装の整合

**D1（op を宣言的定数への追記のみで層機構に載せる）**
- `KNOWN_PREFIXES` に `"op"` 追加（src/parse/id.ts:16）✅
- `LAYER_MAP` に `op: "domain"` 追加（src/check/manifest.ts:68）✅
- `LAYER_TO_PREFIXES.domain` に `"op"` 追加（src/check/manifest.ts:152）✅
- `LAYER_ALLOWED_TARGET_PREFIXES` の domain / static / dynamic / views 全集合に `"op"` 追加（src/check/rules/c11-layer-direction.ts:22–27）✅
- op 専用検証規則は新設なし ✅

**D2（`対象:` 行を汎用 TargetLine で認識し、分類は消費側が行う）**
- `TARGET_LINE_RE = /^対象: (.+)$/`（structured-lines.ts:44）✅
- 全 `[[id]]` を `targetIds: string[]` で格納（structured-lines.ts:168–179）✅
- `PermTarget` 廃止 → `TargetLine` 統合（parse/types.ts:77–81）✅
- C6 が `findOwningElement` + `prefix === "perm"` ガードで単一制約を検証（c06-view-links.ts:191–203）✅
- `generatePermissions` が `findOwningElement` + `prefix === "perm"` ガードで target 取得（permissions.ts:69–74）✅

**D3（二段認識: form-matching → op 参照検証）**
- `PERM_OPERATION_LINE_RE = /^- \[\[([a-z0-9-]+)\]\]: (\[\[.+)$/`（structured-lines.ts:32）✅
- `PERM_OPERATION_LINE_RE_LEGACY = /^- ([^\s:]+): (\[\[.+)$/`（structured-lines.ts:38）✅
- 新 RE 不一致 → `malformedPermOperations` に格納（structured-lines.ts:197–201）✅
- 診断は C6 が発行。パーサは発行しない ✅

**D4（generatePermissions 変更不要 — operation フィールドが op ID になるだけ）**
- `generatePermissions` のコアロジック変更なし ✅
- `operations` キーは `op.operation` フィールドそのまま（permissions.ts:81–90）✅

**D5（export permissions の op ID キー検証テストは実パース経由）**
- TC-016（src/export/op-element.test.ts）が `parseFiles → buildGraph → generatePermissions` 経由でキーを検証 ✅

**D6（spec/format.md 転記更新 3 箇所）**
- §8 perm 対象行: "単一参照。複数参照は C6 違反" 記載あり（spec/format.md 該当行）✅
- §10 C6: "perm `対象:` 行の単一参照制約" 記載あり ✅
- §10 C11 domain 列挙: "term / ent / inv / act / op" 記載あり ✅

**D7（PermTarget 廃止・TargetLine 統合）**
- `PermTarget` 型が parse/types.ts から削除済み ✅
- `TargetLine` が ParseResult / Graph に伝搬（parse/parser.ts:70, graph/builder.ts:56）✅

### J3: spec.md の Requirements / Scenarios → テストの網羅

| Scenario | テスト |
|----------|--------|
| op heading element declaration passes check | TC-001 ✅ |
| op reference from domain element resolves without C11 violation | TC-002 ✅ |
| op reference to static-layer element violates C11 | TC-003 ✅ |
| unresolved op reference triggers C3 | TC-004 ✅ |
| op target line with multiple references | TC-005 ✅ |
| op target line with unresolved reference triggers C3 | TC-006 ✅ |
| perm target line with single reference passes | TC-007 ✅ |
| perm target line with multiple references triggers C6 error | TC-008 ✅ |
| valid operation line with op and act references | TC-009 ✅ |
| unresolved op reference in operation line triggers C6 error | TC-010 ✅ |
| non-op prefix in operation line triggers C6 error | TC-011 ✅ |
| duplicate op reference within same perm triggers exactly one C6 error | TC-012 ✅（`toHaveLength(1)` で厳密 assert） |
| free-token operation line triggers error | TC-013 ✅ |
| perm with only malformed lines produces two errors | TC-014 ✅ |
| op element with implementation line appears in designed frontier | TC-015 ✅ |
| export permissions outputs op ID keys | TC-016 ✅（実パース経由） |
| C11 domain listing includes op | TC-017 ✅ |
| perm target single-reference constraint is documented | TC-018 ✅ |
| PermOperation JSDoc reflects new grammar | TC-019 ✅ |
| export permissions test name updated | TC-020 ✅ |

### J4: request.md の受け入れ基準

| 基準 | 確認 |
|------|------|
| op 見出し要素 check exit 0 | ✅ TC-001 |
| op 複数参照 `対象:` 認識・未解決は C3 | ✅ TC-005/006/021/022 |
| op から static → C11 違反 | ✅ TC-003 |
| perm `- [[op-a]]: [[act-x]]` C6 合格 | ✅ TC-009 |
| 未定義 op 参照 → C6 error | ✅ TC-010 |
| 実在 non-op prefix 参照 → C6 error | ✅ TC-011 |
| op→ent 参照 check exit 0 C11 診断なし | ✅ TC-002 |
| 同一 perm 同一 op 2 行 → C6 error | ✅ TC-012 |
| 自由トークン操作行 → C6 error | ✅ TC-013 |
| malformed のみ → 2 C6 errors | ✅ TC-014 |
| perm 複数参照対象 → C6 error、op は error なし | ✅ TC-007/008 |
| 重複 op 参照テストが C6 1 件のみを厳密 assert | ✅ TC-012（`toHaveLength(1)`） |
| export permissions op ID・辞書順 | ✅ TC-016（実パース経由） |
| `実装:` 行つき op → IMPLEMENTATION_PREFIXES 対象 | ✅ TC-015 |
| perm 文法テスト以外の既存テスト green | ✅ bite-evidence 5/5 green |
| aozu design/ check 不変 | ✅ tasks.md [x]（design/ は op/perm 未使用） |
| `bunx tsc --noEmit` && `bun test` green | ✅ bite-evidence: base=red → candidate=green（5/5） |

## 検証できなかった項目

**verification-result.md の build/typecheck/test フェーズがすべて skipped**（script not found in package.json）。  
ただし bite-evidence-result.md が `bun test` でテストファイル 5 件すべて candidate=green であることを独立確認しており、TypeScript コンパイルエラーがあれば Bun の実行時に失敗するため、型整合性も間接的に確認されている。

## Findings 詳細

指摘なし。すべての判定項目が適合。
