# Regression Gate Result — Iteration 2

- **change**: aosora-findings-fixes
- **iteration**: 2
- **verdict**: approved

## Verification Summary

### Finding 1 [MEDIUM] — manifest ファイル不在時の "0" フォールバックと fail-closed 原則の緊張が Risks に未記録

- **file**: specrunner/changes/aosora-findings-fixes/design.md
- **status**: fixed
- **evidence**: Risks / Trade-offs セクションに「[Risk] **manifest ファイル不在は C12 フェンスのバイパス経路になる**」が明示的に記録され、許容根拠（manifest 不在では enabled:[] に縮退して実質的な成果物が存在しないため）も記述されている。前 iteration から継続して修正済み。

---

### Finding 2 [LOW] — C12 規則に実装アーキテクチャ情報が混在し C1〜C11 の記述スタイルと非対称

- **file**: spec/format.md
- **status**: fixed
- **evidence**: spec/format.md §10 の C12 エントリは `manifest の \`format-version\` が対応集合に属する（現在 \`{"0"}\`）。欠落も違反` のみで、実装方式（全動詞共通の入口ゲート等）への言及が存在しない。C1〜C11 と同じ "what" のみのスタイルに揃っている。前 iteration から継続して修正済み。

---

### Finding 3 [MEDIUM] — Non-Goals に事実と反する記述 — export.ts は対象外ではなくなった

- **file**: specrunner/changes/aosora-findings-fixes/design.md
- **status**: fixed
- **evidence**: Non-Goals セクションに「export.ts（parseManifest を呼ばないため対象外）」という誤記は存在しない。代わりに「（注: 当初 `export.ts` と `prompt review` を「parseManifest を呼ばないため対象外」としていたが、敵対的整合レビューの反証により両方とも C12 ゲートの対象に含めた）」という経緯付きの注記が置かれており、事実と整合する。前 iteration から継続して修正済み。

---

### Finding 4 [LOW] — D5 の記述が spec/format.md C12 の成果物と乖離している

- **file**: specrunner/changes/aosora-findings-fixes/design.md
- **status**: fixed
- **evidence**: D5 の決定文は「本文には…と what のみを記述する（C1〜C11 と同じ書式に揃え、実装方式——全動詞共通の入口ゲート——は本設計文書 D1 の責務とする）」と記述されており、実際の spec/format.md C12 出力（what のみ）と整合する。旧記述の「実装は全動詞共通の入口ゲート（D1）であることを注記する」は存在しない。前 iteration から継続して修正済み。

---

### Finding 5 [MEDIUM] — 「全動詞」テーブルが export.ts / prompt review を含まない

- **file**: specrunner/changes/aosora-findings-fixes/design.md
- **status**: fixed
- **evidence**: design.md Context の「parseManifest の呼び出し元（全動詞）」テーブルに `src/cli/commands/export.ts | 22, 98-99 | export（export rules）` 行が追加された。また `src/cli/commands/prompt.ts` の動詞列に `review` が明記されており（derive, session, propagate, review）、export.ts と handleReview の両方がテーブルに収録されている。iteration 1 での regression が本 iteration で解消された。

---

### Finding 6 [MEDIUM] — README.md の閉包規則記述「C1〜C11」が spec/format.md の C12 追加と不整合

- **file**: README.md:111
- **status**: fixed
- **evidence**: README.md 111 行目が `閉包規則 C1〜C12` に更新されており、spec/format.md §10 の C12 追加と整合する。iteration 1 での regression が本 iteration で解消された。

---

## Findings Count

| 状態 | 件数 |
|---|---|
| fixed | 6 |
| regression | 0 |
| contradiction | 0 |
