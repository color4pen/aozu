# Adversarial Consistency Review — aosora-findings-fixes (iteration 2)

- **verdict**: needs-fix

---

## Finding 1: design.md Non-Goals の事実誤認 — export.ts は対象外ではなくなった

**主張**: design.md の Non-Goals に「`export.ts`（`parseManifest` を呼ばないため対象外）」と記録されているが、イテレーション 1 の Finding 1（high）への対応として export.ts が修正された結果、export.ts は現在 `parseManifest` と `validateFormatVersion` の双方を呼んでおり、記録された除外理由は事実と相反する。

**根拠引用**:

- `specrunner/changes/aosora-findings-fixes/design.md`（Non-Goals）:
  > `export.ts`（`parseManifest` を呼ばないため対象外）

**矛盾引用**:

- `src/cli/commands/export.ts:22-23`（コミット 68b1f0e 追加分）:
  ```ts
  import { parseManifest, validateFormatVersion } from "../../check/manifest.ts";
  ```
  ```ts
  const manifest = parseManifest(parsed.frontmatters, manifestPath);
  const fvDiag = validateFormatVersion(manifest, manifestPath);
  ```

- `specrunner/changes/aosora-findings-fixes/design.md`（D1 — Goals）:
  > check だけでなく manifest を読む全動詞…で同じ判定が効くこと

**構成した反例**:

「`export.ts` は `parseManifest` を呼ばないため対象外」という Non-Goals を読んだ実装者が、将来 export.ts をリファクタリングする際に `validateFormatVersion` 呼び出しを意図せず削除する。設計記録が「export は除外」と明示しているため、コードレビューでも指摘が発生しない。fail-closed の退行を設計記録が誘発する経路が存在する。

**深刻度**: medium — design.md の Non-Goals に事実と反する記述が残っており、コミット 68b1f0e が export.ts を対象に追加したこととの矛盾が設計記録内に解消されないまま存在する。Non-Goals を「export.ts は C12 ゲートを適用する（イテレーション 1 Finding 1 対応）」に修正するか、または除外理由の記述を削除する必要がある。

---

## Finding 2: `prompt review` の C12 ゲートが request.md 要件から漏れており、除外根拠が設計記録に存在しない

**主張**: request.md 要件 #1 は「manifest を読む全動詞（… review …）で同じ判定が効くこと」と明示しているが、design.md は `prompt review` を `parseManifest` 呼び出し元テーブルから暗黙に除外し、Non-Goals にも除外根拠を記録していない。実装（`handleReview`）も `validateFormatVersion` を呼ばない。

**根拠引用**:

- `specrunner/changes/aosora-findings-fixes/request.md`（要件 #1）:
  > check だけでなく manifest を読む全動詞（status / plan / coverage / derive / session / propagate / **review** / mark / export）で同じ判定が効くこと（parseManifest の直後など、一箇所の共通経路で判定する）

**矛盾引用**:

- `specrunner/changes/aosora-findings-fixes/design.md`（Context — parseManifest 呼び出し元テーブル）:
  > | `src/cli/commands/prompt.ts` | 185, 390, 535 | derive, session, propagate |

  `review` が列挙から欠落している。

- `specrunner/changes/aosora-findings-fixes/design.md`（Non-Goals）:
  > `export.ts`（`parseManifest` を呼ばないため対象外）

  `export.ts` は明示的に除外されているが、`prompt review` については一切言及がない。

- `src/cli/commands/prompt.ts:679-683`（handleReview 内）:
  ```ts
  // Build pipeline (no loop gate, no manifest check needed for layer enablement)
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const graph = buildGraph(parsed, manifestPath);
  ```

  `parseManifest` も `validateFormatVersion` も呼ばれていない。

**構成した反例**:

`format-version: 99` の manifest を持つ design/ で `aozu prompt review` を実行する。`handleReview` は manifest.md を含む全 .md ファイルを `readMarkdownFiles` で読み、`buildGraph` を呼ぶが、`parseManifest` を経由しないため C12 ゲートが一切適用されない。未知 format-version の design corpus から review 指示文が無診断で出力される。request.md が「fail-closed は manifest を読む全動詞で効かせる」と記録しているにもかかわらず、review だけが素通りする経路が存在する。

**深刻度**: medium — request.md 要件と実装・設計の三者間の不整合が記録として存在しない。`prompt review` を C12 ゲートの対象外とする判断は defendable（review は manifest の有効化セマンティクスに依存せず要素本文のみを読む）だが、その判断が設計記録にない。「`prompt review` は parseManifest を呼ばないため対象外」という記述を design.md Non-Goals に追加し、その許容根拠（review は enabled 層の解釈を行わず要素本文のみを使うため、format-version の意味論的解釈を誤読するリスクが発生しない）を明示する必要がある。または review に C12 ゲートを適用して要件と実装を一致させる。

---

## Finding 3: design.md D5 が spec/format.md C12 の成果物と乖離している

**主張**: design.md D5 は spec/format.md の C12 記述に「実装は全動詞共通の入口ゲート（D1）であることを注記する」と明示しているが、実際の spec/format.md §10 の C12 行にはその注記が含まれない。

**根拠引用**:

- `specrunner/changes/aosora-findings-fixes/design.md`（D5）:
  > 本文には「manifest の `format-version` が対応集合（現在 `{"0"}`）に属する」と記述し、規則の目的と対応バージョンを明示する。**実装は全動詞共通の入口ゲート（D1）であることを注記する**。

**矛盾引用**:

- `spec/format.md §10`（C12 行）:
  > \| C12 \| manifest の `format-version` が対応集合に属する（現在 `{"0"}`）。欠落も違反 \|

  D5 が指示する「実装詳細の注記」が存在しない。

**背景**: イテレーション 1 の Finding 3（low）は「spec §10 の C12 記述に実装詳細が混在している」と指摘し、コミット 68b1f0e で当該注記が spec から除去された。この修正は正しい（what のみ記述する C1〜C11 との一貫性を回復する）。しかし design.md D5 の決定記録がその変更を反映していない。

**深刻度**: low — 実装と spec の整合は正しく（C12 は clean な what 記述）、D5 の記述が成果物と乖離しているのは文書の精度の問題。D5 の「実装は全動詞共通の入口ゲート（D1）であることを注記する」という記述を削除するか、「イテレーション 1 Finding 3 対応で除去した」旨の注記に変更することが望ましい。

---

## 反証を試みて不能だった観点

- **原理間矛盾 — D2 の manifest 不在フォールバックと fail-closed 原則**: イテレーション 1 Finding 2 で指摘された緊張関係は、design.md Risks セクションに「manifest 不在は format-version の問題ではなく設計ディレクトリ自体の不備」という許容根拠が明記された（コミット 68b1f0e）。バイパス経路の存在は認識かつ説明済みであり、矛盾は解消されている。
- **原理間矛盾 — spec/format.md §10 の C12 と C1〜C11 の対称性**: C12 は `| C12 | manifest の \`format-version\` が... |` の形式で what のみを記述しており、C1〜C11 と同形式。対称性の矛盾は構成できない。
- **エレガント統合型の断定 — export の C12 ゲート（exit code）**: export.ts の C12 ゲートは exit 1 を返す（`writeDiagnostics([fvDiag]); return 1`）。他の動詞は exit 2（stderr 書き込み）。両者は export の既存の exit code 体系（1 = 実装エラー、2 = 入力エラー）と一致しており、設計の意図と一貫している。矛盾は構成できない。
- **段階縮退の穴 — format-version フェンスと C12 の評価順序**: validate-format-version は parseManifest 直後、buildGraph / isLayerEnabled の前に評価される。未知 format-version では他の規則に到達しない。意味論が未定義になるケースは見つからなかった。
- **決定と未決の食い違い — open-questions 論点 7（移行手段）との整合**: 論点 7 は「format-version 1 が視野に入った時点で決める」とあり、C12 フェンスはその前提であって移行手段ではない。矛盾は構成できない。
