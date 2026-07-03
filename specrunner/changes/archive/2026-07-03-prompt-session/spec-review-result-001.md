# Spec Review Result

<!-- FORMAT REQUIREMENTS (machine-parsed):
- The verdict line MUST appear before the Findings table.
- verdict line format (exact): `- **verdict**: <value>` at the start of a line
- Valid verdict values: approved | needs-fix | escalation
  - approved:    specification is complete, consistent, and ready for implementation
  - needs-fix:   specification has issues that must be resolved before implementation
  - escalation:  unresolvable conflicts, missing context, or requires human judgment
- Findings table MUST have exactly 6 columns in this order:
  # | Severity | Category | File | Description | How to Fix
- Valid Severity values (uppercase): CRITICAL | HIGH | MEDIUM | LOW
  - CRITICAL: production outage, data loss, security breach
  - HIGH:     functional failure, clear bug, no workaround — blocks approval
  - MEDIUM:   quality degradation, maintainability issue, future risk
  - LOW:      informational, style, minor improvement
- If no findings, write a table row with "None" or omit the table body.
**Verdict blocking rules (derived by CLI from the reported findings)**:
- `decision-needed` ≥ 1 → `escalation`（request-review では `needs-discussion`）
- `critical` または `high` ≥ 1 → `needs-fix`
- それ以外 → `approved`

markdown の verdict 行と報告された findings が矛盾した場合、**findings 由来の導出が優先**されます。verdict 行は人間向けの要約であり、機械ルーティングには使用されません。
-->

- **verdict**: approved

## Findings

| # | Severity | Category | File | Description | How to Fix |
|---|----------|----------|------|-------------|------------|
| 1 | LOW | 実装前提の暗黙規約 | design.md (D2), tasks.md (T-01, T-03) | `source` frontmatter フィールドの扱い: 要件 2(a) は「topic 本文（id・source 込み）」とするが、T-03 step 4 が呼ぶ `extractElementBody` は frontmatter を除去した本文のみを返す。D2 コメント「source 情報は本文に含まれる」は「topic 著者が source 情報を本文にも記述する慣行」を前提とするが、spec/format.md §8 では `source:` は frontmatter キー（任意）であり、本文記述を強制する規則はない。結果として、frontmatter のみに `source:` を書いた topic ではセッションプロンプトに source が含まれず、受け入れ基準にも source presence テストが存在しない。 | 実装者への注記として「topic 本文に source 情報を書く慣行があること、frontmatter の source: キーは出力に含まれないこと」を D2 または T-01 の コメントに一行追加する。受け入れ基準に source テストを追加するかは optional。ブロッカーではない。 |
| 2 | LOW | タスク記述の省略 | tasks.md (T-03 step 5) | `extractReferences(topicBody, topicFile)` の `topicFile` 取得元が明示されていない。step 3 で `graph.elements.get(topicId)` を呼んでおり `.file` から取得できるが、step 5 に "topicFile = el.file" の一言がない。実装時に迷う余地がある。 | T-03 step 5 冒頭に「`topicFile = graph.elements.get(topicId)!.file`（step 3 取得済み）」を添える。ブロッカーではない。 |
| 3 | LOW | テスト記述の省略 | tasks.md (T-04) | 「スコープの上限テスト」で「fixture に 3 hop 先の要素を配置し」とあるが、ベース fixture 記述（T-04 の `createSessionFixture` 節）にはその 3 hop チェーンが含まれていない。spec.md のシナリオ（ent-a→ent-b→ent-c→ent-d）が構造を補完しているが、tasks としての fixture 記述が不完全。 | T-04 の上限テスト節に「chain: `ent-a` → `ent-b` → `ent-c` → `ent-d`（topic が `[[ent-a]]` を引用）を追加 fixture として用意し、stdout に `ent-d` 本文が含まれないことを assert」と明記する。ブロッカーではない。 |
| 4 | LOW | 暗黙フォーマット依存 | design.md (D5), tasks.md (T-03 step 10) | static モジュール縮約で `責務:` 行の抽出に依存しているが、spec/format.md にはこのフォーマットの正式定義がない（design/static/modules.md の慣行から読み取る形）。現行コードは一貫しており問題は生じないが、仕様根拠が暗黙。 | spec/format.md の §2 または §5 に「mod 要素本文は `責務: <1行>` で始まる」旨を一行追記するか、D5 の Rationale に「design/static/modules.md の慣行を踏襲」と注記する。ブロッカーではない。 |

## Review Notes

### 検証した既存コードの前提（すべて正確）

- `src/cli/commands/prompt.ts` — `handlePrompt` は `derive` のみにディスパッチ。`computeNeighborhood` / `extractAllBodies` を既に import 済み。exit code 0/1/2 の契約を実装で確認。
- `src/graph/neighborhood.ts:24` — `computeNeighborhood(seedIds, graph, maxHops)` は in/out 双方向を走査し、seed 自身を result に含まない実装を確認。seedIds が空なら空 Set を返す（正常終了パス確認）。
- `src/graph/body.ts:48/105` — `extractElementBody` は `top` prefix を `DOCUMENT_PREFIXES` として扱い、frontmatter 後の本文を返すことを確認。`extractAllBodies` は ids 配列を順序通りに処理し Map で返す。
- `src/prompt/derive.ts:59` — `buildDeriveInstruction` は純関数（I/O なし）。8 セクションではなく 6 セクション構成（session と異なる）。derive との対称が設計の目標。
- `src/parse/references.ts` — `extractReferences(content, filePath)` は code fence / inline code を除外し `[[id]]` を返す。参照の `targetId` のみが seed 抽出に必要で、行番号誤差は問題なし。
- `src/check/manifest.ts` — `parseManifest` は `enabled:` を comma split → trim で配列化。順序は frontmatter 記述順で決定的。`isLayerEnabled("loop", manifest)` は `getEnabledLayers` を経由した明確な実装。
- `design/static/modules.md` — `mod-prompt` の責務「参照グラフ近傍のスコープ選択と、テンプレートへの文脈注入による指示の組み立て」が `buildSessionInstruction` の配置先として適切であることを確認。
- `design/static/dependencies.md` — `mod-cli -> mod-parse` および `mod-cli -> mod-prompt` が許可済みであることを確認。`extractReferences` の追加 import は規則内。
- `adr/0008-verb-cli.md` — 動詞表に `prompt session --topic <id>` が掲載されており、未実装の根拠と一致。

### 設計判断・仕様の評価

**D1（handler 配置）**: `handlePrompt` の同一ファイル内に `handleSession` を追加する判断は適切。dispatch の一覧性が維持される。

**D2（SessionInput 型）**: 純関数への入力型が明確に定義されている。`buildDeriveInstruction` との対称性が高く、実装誘導として有効。セクション順（8 セクション）は論点 8 の規則を直訳しており理にかなっている。

**D3（SESSION_MAX_HOPS 定数）**: 規則値を単一箇所に集約する方針は正しい。`export` を明示（T-01 AC に記載）しており、handler からの利用が可能。

**D4（seed 抽出）**: `extractReferences` を使い、topic 本文の `[[id]]` 引用を seed とする設計は既存 API の再利用として自然。引用 0 件を正常とする（ADR-0006）との整合も確認済み。存在しない ID をフィルタ除去する記述（T-03 step 5）は greenfield topic へのロバスト対応として正しい。

**D5（static 縮約）**: `graph.elements` から prefix `mod` 要素をフィルタし `責務:` 行のみ抽出する実装は、`extractAllBodies` の全文 import を避けて窓コストを削減する。要素なし（`責務:` 行欠落）のフォールバック処理も記述されている。

**D6/D7（コード内定数）**: `FORMAT_RULES_SUMMARY` / `SESSION_GUIDANCE` をコード内定数とする判断（architect 評価済み）は、mod-prompt の自律性を保ち、manifest 注入の不要な複雑化を防ぐ。spec/format.md との乖離リスクは、check が書き起こし要素の閉包違反で検出できる点でよく緩和されている。

**D8（段階ゲート）**: derive と同型の exit code 契約。stage gate の順序（loop 無効 → design 不在 → topic 不存在）は自然。`request-template` / `request-output-dir` ゲートが不要なことも明記されており実装者の混乱を防ぐ。

**D9（決定的出力）**: handler 側での辞書順ソートと pure function のパッシブ処理という分担が明確。`enabled` 配列は `parseManifest` がフロントマター記述順を保持するため同一 manifest で同一順序であることを確認済み。

**T-05（dispatch テスト更新）**: help テキストと "Available" リストへの `session` 追加に対応するテスト更新が T-05 として独立したタスクになっており、既存 derive テストが無変更で green のままであることが受け入れ基準に含まれている。

**T-07（回帰テスト）**: import 許可依存の確認、`dependencies` 空の保証、`export rules --verify`、architecture test の全列挙が受け入れ基準として明示されており、実装後品質ゲートが網羅されている。

### セキュリティレビュー

- **コマンド実行なし**: `handleSession` には `resolveTemplate`（シェルコマンド実行）相当の処理がない。`prompt derive` の shell injection surface を継承しない設計は安全。
- **ファイル書き込みなし**: `process.stdout.write()` のみ。`stat()` で存在確認→読み取りの一方向 I/O。
- **入力検証**: `--topic` は `graph.elements.get(topicId)` + prefix check で検証、`--dir` は `dirExists()` チェックを実施。悪意ある ID / パスによる被害なし。
- **実行時依存ゼロ**: `package.json` の `dependencies` を空に保つ原則が維持される（T-07 で確認される）。
- **OWASP Top 10**: A01〜A10 いずれも該当なし（ローカル CLI ツール、認証・DB・ネットワーク操作なし）。
- **プロンプトインジェクション**: 設計文書の本文をそのまま stdout に出力することで、design 文書内の悪意ある指示が LLM セッションに影響しうる。ただしこれはツールの設計意図（文脈注入）と不可分であり、緩和は scope 外。local-only ツールとして許容範囲内。

### 総合評価

HIGH / decision-needed 相当の問題なし。LOW 4 件はいずれもブロッカーではなく、実装者が気づいて補完できる程度のもの。仕様の三点セット（design.md・tasks.md・spec.md）は相互に整合しており、受け入れ基準は機械検証可能かつ網羅的。既存インフラ（`computeNeighborhood`・`extractAllBodies`・`extractReferences`・`buildDeriveInstruction` パターン）の再利用経路が明確で、実装のリスクは低い。
