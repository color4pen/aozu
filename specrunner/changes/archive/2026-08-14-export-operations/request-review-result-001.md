# Request Review Result

<!-- EVIDENCE REPORT FORMAT:
     verdict は CLI が typed findings から導出する。この file に verdict 行を書かない。
     findings は report_result（typed）で報告し、この file はその補足の evidence report である。
     decision-needed の finding がある場合は escalation（needs-discussion）として扱われる。
-->

## 検証した項目

### Step 1: コードアサーションのファクトチェック

| アサーション | ファイル | 検証結果 |
|---|---|---|
| `TargetLine`（`:77`） | `src/parse/types.ts` | ✓ line 77 に `export interface TargetLine { targetIds: string[]; ... }` |
| `graph.targetLines` / owner prefix === "perm" フィルタ（`:69`） | `src/export/permissions.ts` | ✓ line 69 の for ループ、line 71 で `owner.prefix === "perm"` チェック |
| `ImplementationEntry`（paths[] / file / line） | `src/parse/types.ts:56` | ✓ `paths: string[]` 含む `ImplementationEntry` が定義済み |
| `graph.implementations` | `src/graph/types.ts:49` | ✓ `implementations: ImplementationEntry[]` がフィールドとして存在 |
| `findOwningElement` | `src/graph/attribution.ts` | ✓ 純関数として実装済み |
| export サブコマンド分岐と USAGE | `src/cli/commands/export.ts` | ✓ `rules` / `permissions` の 2 subcommand、USAGE 文字列あり |
| `generatePermissions` が `src/export/permissions.ts` に分離 | `src/export/permissions.ts` | ✓ 純関数として実装済み |
| permissions exit code: 0 / 1 / 2 | `src/cli/commands/export.ts` コメント | ✓ 一致 |
| `op` prefix = domain 層 | `src/check/manifest.ts:LAYER_MAP` line 67 | ✓ `op: "domain"` |
| `mod-export` → `mod-graph` 依存が許可 | `design/static/dependencies.md:19` | ✓ `[[mod-export]] -> [[mod-graph]]` |
| `mod-cli` → `mod-export` 依存が許可 | `design/static/dependencies.md:10` | ✓ `[[mod-cli]] -> [[mod-export]]` |

### Step 2: ADR・spec との整合確認

- **ADR-0025 D3**: "export operations の追加 / --verify は持たない / 消費者は export を直接呼ぶ" — request の要件 4（`--verify` 不採用）と完全一致 ✓
- **spec §11 operations export**: JSON スキーマ（format-version / operations 配列 / id / name / target / implementation）が request 要件 2 の記述と完全一致 ✓
- **省略規則**: "target / implementation は該当行が無ければ省略" — spec §11 "省略" の記述と一致 ✓
- **決定的順序**: "operations は id 昇順、target / implementation は宣言順" — spec §11 と一致 ✓
- **exit code 意味論**: "domain 未有効 = exit 1 / op 0 件 = 空リスト exit 0" — spec §11 と一致 ✓
- **spec §8 op スキーマ**: `対象:` 行はカンマ区切り複数参照可、`実装:` 行は任意（mod と同文法） — request の背景説明と一致 ✓

### Step 3: 設計判断の妥当性確認

- **採用: 純関数分離** — `permissions.ts` の既存定型と対称。合理的 ✓
- **採用: domain 未有効 = exit 1** — permissions の "permission 未有効 = exit 1" と同意味論。一貫している ✓
- **採用: target = ID 配列** — spec §11 の `"target": ["ent-order"]`（配列）と整合 ✓

### Step 4: 受け入れ基準の実装可能性確認

- 既存の `findOwningElement` + `graph.targetLines` (owner.prefix === "op") + `graph.implementations` の 3 点で要件を充足できる実装が見通せる
- `manifest.enabled.includes("domain")` で exit 1 を実装可能（`LAYER_MAP` の `op: "domain"` と整合）
- 既存テストファイル群（`permissions.test.ts` / `op-element.test.ts` / `generator.test.ts`）は今回の変更対象外であり、後方互換を壊さない実装が可能

## 検証できなかった項目

None — 本 request は現状コードの前提が具体的かつ正確で、全アサーションを直接ファイルで確認できた。

## Findings 詳細

指摘なし。request はコードベースの実態と完全に整合しており、spec §11 / ADR-0025 の確定仕様を実装する request として適切に記述されている。
