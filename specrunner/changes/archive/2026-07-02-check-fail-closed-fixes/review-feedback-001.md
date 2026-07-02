# Code Review Feedback — iteration 001

<!-- FORMAT REQUIREMENTS (machine-parsed):
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
- iteration line format (exact): `- **iteration**: NNN` (3-digit zero-padded integer)
- Findings table MUST have exactly 7 columns in this order:
  # | Severity | Category | File | Description | How to Fix | Fix
  - Fix column: yes = fixer should address this finding; no = skip (pre-existing / out-of-scope)
- Scores table columns: Category | Score | Weight
  - Valid Category values: correctness | security | architecture | performance | maintainability | testing
  - Score: integer 1-10
  - Weight: decimal as defined below
- total line format (exact): `- **total**: <decimal>`
- Default weights: correctness=0.30, security=0.25, architecture=0.15, performance=0.10, maintainability=0.10, testing=0.10
- Scores table is optional but recommended.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved
- **iteration**: 001

## Findings

| # | Severity | Category | File | Description | How to Fix | Fix |
|---|----------|----------|------|-------------|------------|-----|
| 1 | low | testing | src/check/rules/c03-ref-resolved.test.ts | TC-009 の assertion が不十分。`toContain("zzz")` は `"[[zzz-typo]]"` だけでも通過してしまう（"zzz" が "zzz-typo" の部分文字列であるため）。設計 D3 の `(unknown prefix "zzz")` アノテーション付きフォーマットを明示的に assert していない | `expect(diags[0]!.message).toContain('(unknown prefix "zzz")')` を追加し、フォーマットを固定する | no |
| 2 | low | testing | src/check/rules/c03-ref-resolved.test.ts | TC-010（could 優先度）がカバーされていない。参照元自身が未知 prefix（例: `zzz-bad`）を持つ場合、縮退スキップが適用されないことの回帰テストが存在しない。実装は正しく動作している（`KNOWN_PREFIXES.has(sourcePrefix)` が false → スキップなし）が、テストによる固定がない | `zzz-bad` を参照元とする makeGraph でゼロ診断ではなく診断が返ることを assert するテストを追加する | no |

## Scores

| Category | Score | Weight |
|----------|-------|--------|
| correctness | 9 | 0.30 |
| security | 9 | 0.25 |
| architecture | 9 | 0.15 |
| performance | 9 | 0.10 |
| maintainability | 9 | 0.10 |
| testing | 8 | 0.10 |

- **total**: 8.90

## Summary

### 全体評価

バグ 2 件（C3 fail-open・C11 誤帰属）を正確に修正した実装。設計書（design.md）の決定事項 D1〜D3 はすべて忠実に実装されており、受け入れ基準を満たしている。

### 実機検証結果

- `tsc --noEmit`: エラーゼロ ✓
- `bun test`: 335 件（既存 326 件 + 追加 9 件）全 pass ✓
- `bun test src/check/integration.test.ts`: 3 件 pass・`design/` に新規違反なし ✓
- `package.json` の `dependencies`: `{}` 維持 ✓

### C3 fail-closed 修正（バグ 1）

`KNOWN_PREFIXES.has(targetPrefix) && !enabledPrefixes.has(targetPrefix)` という二段判定への変更は正確。未知 prefix（`zzz` 等）は `KNOWN_PREFIXES.has` が false になるため、`enabledPrefixes` の状態によらず常に評価されることが確認できる。縮退スキップ（既知だが無効な型）は従来どおり維持されており、`[[ent-x]]` with `enabled:static` のテストがこれを固定している。参照元側の二段判定も同様に正しく実装されている。

### `findOwningElement` の実装（帰属導出一元化）

`src/check/attribution.ts` の実装は正確。`el.line <= line` かつ最大 `el.line` を選ぶアルゴリズムは設計 D2 の仕様と一致。単体テストが 6 ケース（単一要素・後方要素・前方要素・undefined・ファイル不在・複数ファイル混在）を網羅しており、must-priority TC をすべてカバーしている。モジュール配置（`mod-check` 内）とインポートパス（`../graph/index.ts` 経由）は許可依存方向に従っている。

### C11 誤帰属修正（バグ 2）

`graph.rawElements.find((el) => el.file === ref.file)` から `findOwningElement(graph.rawElements, ref.file, ref.line)` への切り替えは正確。追加された `multiple elements in file` テストは `act-sales`（行 1）/ `act-bad`（行 10）/ 参照行 15 という再現 fixture で `elementId: "act-bad"` を assert しており、バグの再発を防止できる。

### 軽微な指摘事項

- TC-009 のメッセージ assert が緩く、`(unknown prefix "zzz")` アノテーション形式を直接固定していない（Finding #1）。設計 D3 の意図を保護するには `toContain('(unknown prefix "zzz")')` の追加が望ましい。
- TC-010（could 優先度）の参照元未知 prefix ケースは未テスト（Finding #2）。実装は正しく動作しているが、回帰防止の観点で追加が望ましい。

いずれも低優先度の改善提案であり、既存の正しさには影響しない。**本 iteration は承認とする。**
