# Request Review Result

<!-- EVIDENCE REPORT FORMAT:
     verdict は CLI が typed findings から導出する。この file に verdict 行を書かない。
     findings は report_result（typed）で報告し、この file はその補足の evidence report である。
     decision-needed の finding がある場合は escalation（needs-discussion）として扱われる。
-->

## 検証した項目

### コードアサーションの突合（全件確認）

| アサーション | 所在 | 確認結果 |
|---|---|---|
| `KNOWN_PREFIXES` に `op` が無い | src/parse/id.ts:10 | ✓ 確認。Set に `op` は含まれない |
| `LAYER_MAP` に `op` が無い | src/check/manifest.ts:62 | ✓ 確認。perm/dpl 等はあるが `op` は未登録 |
| `LAYER_TO_PREFIXES.domain` に `op` が無い | src/check/manifest.ts:149 | ✓ 確認。`["term", "ent", "inv", "act"]` のみ |
| `HEADING_ELEMENT_RE` が prefix 非依存 | src/parse/declarations.ts:16 | ✓ 確認。`/^(#{2,3}) (.+) \{#([^}]+)\}$/` でプレフィクス非依存 |
| `PERM_OPERATION_LINE_RE` が自由トークンマッチ | src/parse/structured-lines.ts:33 | ✓ 確認。`/^- ([^\s:]+): (\[\[.+)$/` — `[[op-id]]` も括弧ごとトークンとして捕捉される |
| `PERM_TARGET_LINE_RE` が単一参照のみ | src/parse/structured-lines.ts:39 | ✓ 確認。`/^対象: \[\[([a-z0-9-]+)\]\]$/` — 複数参照は現状サイレント無視 |
| C6 が自由トークン一意を検証 | src/check/rules/c06-view-links.ts | ✓ 確認。`op.operation`（文字列）を `seenOps` で管理。op 参照解決ロジックは未実装 |
| `IMPLEMENTATION_PREFIXES` に `op` が無い | src/plan/frontier.ts:43 | ✓ 確認。`new Set(["mod", "term", "ent", "inv", "act", "seq"])` |
| `LAYER_ALLOWED_TARGET_PREFIXES` に `op` が無い | src/check/rules/c11-layer-direction.ts:22 | ✓ 確認。domain 集合は `["term", "ent", "inv", "act"]`、views 集合も `op` 欠け |
| `malformedLines` パターンが request-citations.ts に存在 | src/parse/request-citations.ts | ✓ 確認。型定義・収集・返却のすべてが実装済み |
| `extractReferences` が `対象:` 行の `[[id]]` を拾う | src/parse/references.ts | ✓ 確認。コードフェンス外の全 `[[id]]` を抽出する汎用実装 |

### spec/format.md の現状確認

- §2（配置）: `operations.md # op 要素` — 更新済み ✓
- §4（型表）: `op | 操作 | domain` — 更新済み ✓
- §5（宣言構文）: `term / ent / inv / mod / op / uc 等` — 更新済み ✓
- §8 op スキーマ: `domain/operations.md` セクションあり、`対象:` 複数参照・`実装:` 行の説明あり — 更新済み ✓
- §8 perm 操作行: `- [[op-id]]: [[act-id]](, [[act-id]])*` — 更新済み ✓
- §8 perm `対象:` 記述: 「単一参照。複数参照は C6 違反」の明記 — **未更新（転記漏れ）**
- §10 C6: `op / act への解決・非空・op 参照の perm 内一意` は記載あり。「perm 対象行の単一制約」 — **未更新（転記漏れ）**
- §10 C11: `domain の要素は domain（term / ent / inv / act）のみ` — **`op` 欠け（転記漏れ）**
- §11 permissions export サンプル: キーが `"create"` / `"list"`（自由トークン）のまま — **未更新（転記漏れ）**
- §11 operations export: 追加済み ✓
- ADR-0025: `adr/0025-operation-element.md` — accepted 済み ✓

これら 4 箇所の転記漏れはいずれも request Requirement 2 および Requirement 6 で実装スコープに含まれている（spec/format.md の更新が本 request の作業範囲であることが明示されている）。

## 検証できなかった項目

None — 全コードアサーションおよびスペック状態を実ファイルで確認した。

## Findings 詳細

typed findings なし。

observations（情報共有）:

- **`対象:` 行の多重参照 → `PermTarget` 型の拡張**: 現状 `PermTarget.targetId: string`（単一 ID）だが、op の複数参照対応では `targetIds: string[]`（複数 ID）への拡張または新型が必要になる。実装上の選択（型の変更 vs 新型追加）は実装フェーズで決定することであり、request の記述（「帰属要素と参照リストを保持する」）はこれを適切に委任している。
- **既存 C6 テストの書き換え範囲**: c06-view-links.test.ts の perm validation テスト群（line 70〜174）は全件が `operation: "create"` / `"list"` の自由トークンを直接構築しており、新文法テストへの全件書き換えが必要になる。scope 内と明示されているため問題なし。
- **permissions.test.ts テスト名変更のみ**: request 要件 7 の記述通り、`generatePermissions` 自体は変更されない純関数であり、既存データ構築テストの存続と名称変更だけで足りる。実パース経由の新テスト追加が acceptance criteria に含まれている。
