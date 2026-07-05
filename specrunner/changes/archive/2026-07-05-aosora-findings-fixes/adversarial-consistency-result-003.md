# Adversarial Consistency Review — aosora-findings-fixes (iteration 3)

- **verdict**: needs-fix

---

## Finding 1: design.md Context の「全動詞」テーブルがスコープ拡張後も export.ts / prompt review を含まない

**主張**: design.md Context セクションの "parseManifest の呼び出し元（全動詞）" テーブルは 7 行のみで export.ts と handleReview を収録していないが、同文書 Non-Goals の注記は両者を C12 ゲートの対象に追加したと明記している。テーブル表題「全動詞」と実態が矛盾する。

**根拠引用**:

- `specrunner/changes/aosora-findings-fixes/design.md`（Context — parseManifest 呼び出し元テーブル）:
  > | `src/cli/commands/prompt.ts` | 185, 390, 535 | derive, session, propagate |

  export.ts と `handleReview`（行 686）の行が存在しない。

**矛盾引用**:

- `specrunner/changes/aosora-findings-fixes/design.md`（Non-Goals セクション注記）:
  > 当初 `export.ts` と `prompt review` を「parseManifest を呼ばないため対象外」としていたが、敵対的整合レビューの反証——export は出口ゲートの基準物 rules.json を生成し、review は request 要件 1 の全動詞列挙に含まれる——により両方とも C12 ゲートの対象に含めた

- `specrunner/changes/aosora-findings-fixes/design.md`（Goals）:
  > 全コマンドハンドラが `parseManifest` 直後にそれを呼び出す

- `src/cli/commands/export.ts:22-23`（実装）:
  ```ts
  import { parseManifest, validateFormatVersion } from "../../check/manifest.ts";
  const fvDiag = validateFormatVersion(manifest, manifestPath);
  ```

- `src/cli/commands/prompt.ts:686`（実装）:
  ```ts
  const fvDiagReview = validateFormatVersion(manifestReview, manifestPath);
  ```

**構成した反例**:

design.md の「全動詞」テーブルを信頼した将来の実装者が、prompt.ts を書き換える際に「derive / session / propagate の 3 動詞が対象」と判断し、handleReview の validateFormatVersion 呼び出しを不要な重複とみなして削除する。テーブルが「全動詞」と称している以上、コードレビューでも指摘が出にくい。C12 の fail-closed が prompt review で抜ける退行を設計記録が誘発する。

**深刻度**: medium — Non-Goals 注記の「追加した」という記述と、テーブル表題「全動詞」の「含まれていない」実態が同一文書内で矛盾する。テーブルに export.ts と prompt review の行を追加するか、表題を「主要呼び出し元（全一覧は実装を参照）」に変更するかのいずれかが必要。

---

## Finding 2: README.md の閉包規則記述「C1〜C11」が spec/format.md の C12 追加と不整合

**主張**: README.md は形式仕様の閉包規則を「C1〜C11」と明記しているが、この変更で spec/format.md §10 に C12 が追加されており、README.md の記述は実際の仕様と矛盾する。

**根拠引用**:

- `README.md`（仕様セクション）:
  > \- [形式仕様 v0](spec/format.md) — ID 文法・宣言/参照構文・型スキーマ・閉包規則 **C1〜C11**・state.json・rules export

**矛盾引用**:

- `spec/format.md §10`（閉包検証規則表、この変更で追加された行）:
  > \| C12 \| manifest の `format-version` が対応集合に属する（現在 `{"0"}`）。欠落も違反 \|

- `specrunner/changes/aosora-findings-fixes/design.md`（Goals D5）:
  > `spec/format.md §10` の閉包検証規則表に C12 を追加する

**深刻度**: medium — README.md は敵対的整合レビューの審査対象文書（`adr/` 全件、`spec/` 全件、`docs/open-questions.md`、`README.md`）であり、その記述が spec/format.md と直接矛盾する。README.md の「C1〜C11」を「C1〜C12」に更新する必要がある。

---

## 反証を試みて不能だった観点

- **原理間矛盾 — ADR-0020 exit code 体系と C12 ゲートの exit 2**: ADR-0020 Decision 3 の exit code テーブルは "入力不正（design 不在・…）→ 2" と記録しており、unsupported format-version は意味論上この「入力不正」カテゴリに収まる。ADR-0020 は "exit 1（loop disabled）は発生しない" の例示として表を掲げており、exit 2 を網羅的に列挙したものではないと解釈できる。矛盾は構成できなかった（不完全さとしては残るが反証要件を満たさない）。
- **エレガント統合型の断定 — scaffold の prefix 自動補完と `plan` 型**: `scaffold plan plan-feature` は `id.startsWith("plan-")` が真となり既存フローへ進む。`scaffold plan top-feature` は `extractPrefix` が `top`（KNOWN_PREFIXES 所属 / plan ≠ top）で型矛盾エラー。`scaffold plan my-feature` は補完されて `plan-my-feature`。いずれも D3 の仕様に沿った動作であり反例を構成できなかった。
- **段階・縮退の穴 — C12 ゲートと全動詞の評価順序**: validateFormatVersion は parseManifest の直後・buildGraph の前に呼ばれる。未知 format-version では他の C 規則・loop gate・type enabled check に到達しない。未定義になるケースは見つからなかった。
- **決定と未決の食い違い — open-questions.md 論点 7（移行手段）との整合**: 論点 7 は「format-version 1 が視野に入った時点で決める」とあり、C12 フェンスはその前提（未知バージョンを早期拒否する機構）であって移行手段ではない。矛盾は構成できなかった。
- **原理間矛盾 — D2（manifest 不在フォールバック）と fail-closed 原則**: design.md Risks セクションに「manifest 不在は format-version の問題ではなく設計ディレクトリ自体の不備であり…フェンスが守るべき『未知形式の解釈』が発生しない」という許容根拠が記録済みであり、矛盾は解消されている（イテレーション 1 Finding 2 対応）。
- **設計記録の追補 — ADR-0008 動詞表と mark positional 形式**: ADR-0008 表は `mark implemented --request <slug>` を記録しているが、positional 形式の追加はアドオン的 ergonomics であり spec/integration.md §2 の機械間契約は --request 形式を保持している。ADR-0008 が「--request 形式のみを正とし他を禁じる」とは読めないため矛盾は構成できなかった。
