# Regression Gate Result — Iteration 1

- **change**: aosora-findings-fixes
- **iteration**: 1
- **verdict**: needs-fix

## Verification Summary

### Finding 1 [MEDIUM] — manifest ファイル不在時の "0" フォールバックと fail-closed 原則の緊張が Risks に未記録

- **file**: specrunner/changes/aosora-findings-fixes/design.md
- **status**: fixed
- **evidence**: Risks / Trade-offs セクションに「[Risk] **manifest ファイル不在は C12 フェンスのバイパス経路になる**」が明示的に記録され、許容根拠も記述されている。

---

### Finding 2 [LOW] — C12 規則に実装アーキテクチャ情報が混在し C1〜C11 の記述スタイルと非対称

- **file**: spec/format.md
- **status**: fixed
- **evidence**: spec/format.md §10 の C12 エントリは `manifest の \`format-version\` が対応集合に属する（現在 \`{"0"}\`）。欠落も違反` のみで、実装方式（全動詞共通の入口ゲート等）への言及が完全に除去されている。C1〜C11 と同じ "what" のみのスタイルに揃っている。

---

### Finding 3 [MEDIUM] — Non-Goals に事実と反する記述 — export.ts は対象外ではなくなった

- **file**: specrunner/changes/aosora-findings-fixes/design.md
- **status**: fixed
- **evidence**: Non-Goals の「export.ts（parseManifest を呼ばないため対象外）」という誤記は除去されており、代わりに「（注: 当初 `export.ts` と `prompt review` を「parseManifest を呼ばないため対象外」としていたが…により両方とも C12 ゲートの対象に含めた）」という経緯付きの注記に置き換えられている。実装（export.ts:98-99 / prompt.ts:685-686）とも整合する。

---

### Finding 4 [LOW] — D5 の記述が spec/format.md C12 の成果物と乖離している

- **file**: specrunner/changes/aosora-findings-fixes/design.md
- **status**: fixed
- **evidence**: D5 の決定文は「本文には…と what のみを記述する（C1〜C11 と同じ書式に揃え、実装方式——全動詞共通の入口ゲート——は本設計文書 D1 の責務とする）」と改められており、実際の spec/format.md C12 出力（what のみ）と整合する。旧記述にあった「実装は全動詞共通の入口ゲート（D1）であることを注記する」は削除されている。

---

### Finding 5 [MEDIUM] — 「全動詞」テーブルが export.ts / prompt review を含まない

- **file**: specrunner/changes/aosora-findings-fixes/design.md
- **status**: regression
- **severity**: medium
- **resolution**: fixable
- **evidence**: design.md Context の「**parseManifest の呼び出し元（全動詞）**」テーブルは依然として 7 行のみ（check / status / plan / coverage / prompt×3 / mark / scaffold）で、export.ts と handleReview（prompt review）の行が追加されていない。実装では export.ts:22,98-99 と prompt.ts:685-686 の両方が `parseManifest` と `validateFormatVersion` を呼び出しており、表題「全動詞」と実際の呼び出し元が一致しない矛盾が解消されていない。Non-Goals 注記で「両方とも C12 ゲートの対象に含めた」と明記されているが、テーブル自体の更新が行われていない。
- **fix**: 以下いずれかを実施する
  - テーブルに `src/cli/commands/export.ts` / `export rules` 行、および `src/cli/commands/prompt.ts`（handleReview 該当行） / `review` 行を追加する
  - または表題「全動詞」を「parseManifest を明示的に呼ぶ動詞（C12 ゲート適用）」等の限定的な文言に変更したうえで Non-Goals 注記で補完する

---

### Finding 6 [MEDIUM] — README.md の閉包規則記述「C1〜C11」が spec/format.md の C12 追加と不整合

- **file**: README.md:111
- **status**: regression
- **severity**: medium
- **resolution**: fixable
- **evidence**: README.md 111 行目は `閉包規則 C1〜C11` と記述したままであり、この変更で spec/format.md §10 に C12 が追加されたにもかかわらず更新されていない。git diff で README.md への変更はゼロ件。
- **fix**: README.md 111 行目の `C1〜C11` を `C1〜C12` に更新する。

---

## Findings Count

| 状態 | 件数 |
|---|---|
| fixed | 4 |
| regression | 2 |
| contradiction | 0 |

## Regressions

| Finding | Severity | Resolution |
|---|---|---|
| 「全動詞」テーブルが export.ts / prompt review を含まない (design.md) | medium | fixable |
| README.md の閉包規則記述「C1〜C11」が C12 追加と不整合 (README.md:111) | medium | fixable |
