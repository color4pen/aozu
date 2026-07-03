# Tasks: prompt-session

## T-01: buildSessionInstruction 純関数の実装（src/prompt/session.ts）

src/prompt/session.ts を新規作成し、セッション指示テキストの組み立てロジックを実装する。

- [x] `SessionInput` インターフェースを定義する:
  - `topicId: string` — topic の ID
  - `topicBody: string` — topic の本文（frontmatter 含まず、source 情報は本文に含まれる）
  - `seedBodies: Map<string, string>` — topic が引用する要素の本文（ID → 本文）
  - `neighborBodies: Map<string, string>` — 2 hop 近傍要素の本文（ID → 本文）
  - `termsAndInvariants: string` — term / inv の結合テキスト
  - `staticModulesSummary: string` — mod の縮約形テキスト
  - `enabledLayers: string[]` — manifest の enabled 一覧
  - `formatRulesSummary: string` — 形式規則の要約テキスト
  - `sessionGuidance: string` — セッション作法指示テキスト
- [x] `buildSessionInstruction(input: SessionInput): string` を実装する。8 セクションを組み立てる:
  1. `## Topic` — `input.topicId` + `input.topicBody`
  2. `## Seed Element Bodies` — seedBodies の各エントリを `### <id>` + body で列挙。空なら "(no seed elements — topic has no [[id]] citations)"
  3. `## Neighborhood Element Bodies (2-hop)` — neighborBodies の各エントリ。空なら "(no neighborhood elements)"
  4. `## Terms and Invariants` — termsAndInvariants。空なら "(no terms or invariants defined)"
  5. `## Static Modules` — staticModulesSummary
  6. `## Enabled Layers` — enabledLayers をカンマ区切りで列挙
  7. `## Format Rules` — formatRulesSummary
  8. `## Session Guidance` — sessionGuidance
- [x] `FORMAT_RULES_SUMMARY` 定数を定義する。内容:
  - 宣言構文（見出し要素 / 文書要素）
  - 参照構文（`[[id]]`、コード内除外）
  - ID 文法（prefix-slug）
  - 型プレフィクス表（mod / term / ent / inv / act / seq / top / plan / grp / adr と各層）
  - frontmatter 規約（flat key: value のみ）
- [x] `SESSION_GUIDANCE` 定数を定義する。内容:
  - scaffold で新要素を作る
  - check を回しながら編集する
  - 判断は ADR に記録する
  - topic は ADR の `topics:` 引用で addressed になる（ADR-0018）
- [x] `SESSION_MAX_HOPS` 定数を定義する（値: `2`）。export する（handler が使用）

**Acceptance Criteria**:
- `buildSessionInstruction` が全 8 セクションを含む文字列を返す
- seedBodies が空の場合に "(no seed elements" を含むプレースホルダが出力される
- neighborBodies が空の場合に "(no neighborhood elements)" が出力される
- termsAndInvariants が空の場合に "(no terms or invariants defined)" が出力される
- `FORMAT_RULES_SUMMARY` / `SESSION_GUIDANCE` / `SESSION_MAX_HOPS` が export されている
- `tsc --noEmit` が成功する

## T-02: buildSessionInstruction のテスト（src/prompt/session.test.ts）

src/prompt/session.test.ts を新規作成する。

- [x] `makeInput` ヘルパーを作成する（derive.test.ts と同パターン。デフォルト値を持つ `Partial<SessionInput>` オーバーライド）
- [x] セクション存在テスト:
  - 出力に "## Topic" セクションが含まれ、topicId と topicBody の内容が含まれる
  - 出力に "## Seed Element Bodies" セクションと seed 本文が含まれる
  - 出力に "## Neighborhood Element Bodies (2-hop)" セクションと近傍本文が含まれる
  - 出力に "## Terms and Invariants" セクションと term/inv テキストが含まれる
  - 出力に "## Static Modules" セクションと mod 縮約テキストが含まれる
  - 出力に "## Enabled Layers" セクションと enabled 一覧が含まれる
  - 出力に "## Format Rules" セクションと形式規則テキストが含まれる
  - 出力に "## Session Guidance" セクションと作法テキストが含まれる
- [x] 空入力のフォールバックテスト:
  - seedBodies が空 → プレースホルダが出力される
  - neighborBodies が空 → "(no neighborhood elements)" が出力される
  - termsAndInvariants が空 → "(no terms or invariants defined)" が出力される
- [x] 全 8 セクションが 1 出力に含まれることの統合テスト
- [x] 決定的出力テスト: 同一入力で 2 回呼び出し、出力がバイト同一であることを assert

**Acceptance Criteria**:
- 8 セクションの存在テストが各 1 件以上
- 空入力フォールバック 3 件
- 全セクション統合テスト 1 件
- 決定的出力テスト 1 件
- `bun test src/prompt/session.test.ts` が green

## T-03: session handler の実装（src/cli/commands/prompt.ts への追加）

src/cli/commands/prompt.ts に `handleSession` を追加し、`handlePrompt` の dispatch に `session` 分岐を追加する。

- [x] `handlePrompt` の help テキストに `session` サブコマンドを追加する:
  - `"  session  Start a design session for a topic"` を Sub-commands に追加
  - Available リストに `session` を追加
- [x] `handlePrompt` の dispatch に `session` 分岐を追加する:
  ```typescript
  if (subcommand === "session") {
    return handleSession(args.slice(1));
  }
  ```
- [x] `handleSession(args: string[]): Promise<number>` を実装する:
  - `--help` / `-h`: session の usage を stderr に出力して return 0
  - `--topic <top-id>` をパース。不足は stderr エラー出力して return 2
  - `--dir <path>` をパース（デフォルト: `./design`）
  - design ディレクトリ存在チェック → 不在は return 2
- [x] パイプライン（段階ゲート + データ組み立て）を実装する:
  1. `readMarkdownFiles` → `parseFiles` → `buildGraph` → `parseManifest`
  2. 段階ゲート: `isLayerEnabled("loop", manifest)` → false なら stderr 診断 + return 1
  3. topic 検索: `graph.elements.get(topicId)` → 不在 or prefix !== "top" なら stderr 診断 + return 2
  4. topic 本文取得: `extractElementBody(topicId, graph, files)` で本文を取得
  5. seed 抽出: `extractReferences(topicBody, topicFile)` で `[[id]]` を抽出。targetId を重複除去・辞書順ソートする。存在しない ID はフィルタで除外する（topic が参照する要素が未作成の場合、無視する）
  6. seed 本文: `extractAllBodies(seedIds, graph, files)` で取得
  7. 近傍計算: `computeNeighborhood(seedIds, graph, SESSION_MAX_HOPS)` → 近傍 ID の Set。ID を辞書順ソート
  8. 近傍本文: `extractAllBodies(sortedNeighborIds, graph, files)` で取得
  9. term/inv 収集: `graph.elements` から prefix が `term` / `inv` の要素 ID を収集、辞書順ソート。`extractAllBodies` で本文取得。`### <id>\n<body>` 形式で結合
  10. static mod 縮約: `graph.elements` から prefix が `mod` の要素 ID を収集、辞書順ソート。各要素の本文から `責務:` で始まる行を抽出し、`### <id>\n責務: <line>` 形式で結合
  11. enabled 一覧: `manifest.enabled`
  12. `buildSessionInstruction` で指示テキストを組み立て
  13. `process.stdout.write(instruction)` で出力、return 0
- [x] `handleSession` を export する（テストから呼べるように）

**Acceptance Criteria**:
- `handlePrompt(["session", "--topic", "top-xxx", "--dir", dir])` が動作する
- loop 無効で exit 1
- topic 不存在で exit 2
- design ディレクトリ不在で exit 2
- `--topic` 引数不足で exit 2
- stdout にセッション指示テキストが出力される
- ファイルシステムに何も書かない
- `tsc --noEmit` が成功する

## T-04: session handler の統合テスト（src/cli/commands/prompt.test.ts への追加）

既存の prompt.test.ts に session のテストを追加する。

- [x] session 用 fixture ヘルパーを作成する（`createSessionFixture`）:
  - manifest: loop 有効（`enabled: static, domain, dynamic, loop`）
  - static/modules.md: mod-core（責務行あり）、mod-cli（責務行あり）
  - static/dependencies.md: `[[mod-cli]] -> [[mod-core]]`
  - domain/model.md: ent-order（`[[inv-order-valid]]` を参照）
  - domain/invariants.md: inv-order-valid
  - domain/glossary.md: term-status
  - topics/my-topic.md: frontmatter `id: top-my-topic`、本文に `[[ent-order]]` 引用
- [x] 引用 0 件 fixture ヘルパーを作成する（`createSessionNoRefsFixture`）:
  - 上記と同じだが topic 本文に `[[id]]` 引用を含まない
- [x] 正常系テスト（subprocess 実行、stdout 検証）:
  - exit 0
  - stdout に topic 本文が含まれる
  - stdout に seed 要素（ent-order）の本文が含まれる
  - stdout に 2 hop 近傍（inv-order-valid — ent-order の参照先）の本文が含まれる
  - stdout に term/inv 全量（term-status / inv-order-valid）が含まれる
  - stdout に static mod 縮約（mod-core / mod-cli の見出し + 責務行）が含まれる
  - stdout に形式規則要約テキストが含まれる
  - stdout に作法指示テキストが含まれる
- [x] スコープの上限テスト:
  - 2 hop 近傍の外の要素本文が stdout に含まれないことを検証する（fixture に 3 hop 先の要素を配置し、その本文が出力に含まれないことを assert）
- [x] 引用 0 件 topic テスト:
  - exit 0
  - stdout に topic 本文が含まれる
  - stdout に seed / neighbor のプレースホルダが含まれる
  - stdout に term/inv 全量・static 縮約・形式規則要約・作法指示が含まれる
- [x] 段階ゲートテスト:
  - loop 無効 fixture で exit 1
  - topic 不存在（`--topic top-nonexistent`）で exit 2 + stderr 診断
  - design ディレクトリ不在で exit 2
  - `--topic` 引数なしで exit 2
- [x] 決定的出力テスト:
  - 同一 fixture で 2 回 subprocess 実行し、stdout がバイト同一であることを assert
- [x] stdout/stderr 分離テスト:
  - subprocess 実行し、stderr に診断が含まれないこと（正常系）
  - 正常系で stdout が非空、stderr が空であること
- [x] ファイルシステム非書き込みテスト:
  - 実行前後でファイルシステムの内容が同一であることを検証する

**Acceptance Criteria**:
- 正常系: topic 本文・seed 本文・2 hop 近傍本文・term/inv 全量・static 縮約・形式規則要約・作法指示の存在テストが各 1 件以上
- 2 hop 近傍の外の要素本文が含まれないテスト 1 件
- 引用 0 件テスト 1 件
- 段階ゲートテスト 4 件（loop 無効 / topic 不存在 / design 不在 / 引数不足）
- 決定的出力テスト 1 件
- stdout/stderr 分離テスト 1 件
- ファイルシステム非書き込みテスト 1 件
- `bun test src/cli/commands/prompt.test.ts` が green（既存 derive テストも含め）

## T-05: handlePrompt dispatch の既存テスト更新

既存の `handlePrompt dispatch` テストで `Available subcommands: derive` のような文言をハードコードしている箇所がある場合は `session` を含む形に更新する。

- [x] `handlePrompt(["unknown-sub"])` のエラーメッセージに `session` が含まれることを確認する（Available リストの更新により自動的に変わる）
- [x] `handlePrompt(["--help"])` の出力に `session` が含まれることを確認するテストを追加する
- [x] `handlePrompt([])` のエラーメッセージに `session` が含まれることを確認する

**Acceptance Criteria**:
- help テキストに `session` が含まれる
- 既存 derive テストが変更なしで green
- `bun test src/cli/commands/prompt.test.ts` が green

## T-06: docs/open-questions.md 論点 8 への注記追加

docs/open-questions.md の論点 8「プロンプト注入のスコープ規則」に、初版実装済みの注記を追加する。

- [x] 論点 8 の冒頭（「規則案（実装時に調整）」の部分）に以下の注記を追加する:
  - 「**初版実装済み**: `prompt session` が本規則案（2 hop・inv/term 全量・static 縮約）を実装した。規則値は src/prompt/session.ts の定数 `SESSION_MAX_HOPS` に集約されている。高度化（戦略 3）は窓に収まらなくなった実例の証拠を待つ。」
- [x] 論点自体は閉じない（高度化が未解決のため）

**Acceptance Criteria**:
- docs/open-questions.md 論点 8 に初版実装済みの注記がある
- 論点のセクションが削除されていない

## T-07: 全体回帰テスト

既存テストと設計整合性の最終確認。

- [x] `tsc --noEmit` が green
- [x] `bun test` が全テスト green（既存テスト + 新規テスト）
- [x] `package.json` の `dependencies` が空のまま
- [x] 新規ファイルの import が許可依存に違反しないことを確認する:
  - src/prompt/session.ts（mod-prompt）: 外部依存なし（引数を受け取る純粋関数 + 定数）
  - src/cli/commands/prompt.ts（mod-cli）の追加 import: `extractReferences`（mod-parse、mod-cli -> mod-parse は許可済み）、`buildSessionInstruction` / `SESSION_MAX_HOPS`（mod-prompt、mod-cli -> mod-prompt は許可済み）。他の import（mod-graph、mod-check、mod-fsread）は既存の derive handler で使用済み
- [x] `bun src/cli/main.ts check` が exit 0（本リポジトリの design/ に対して。ただし loop 無効のため topic/plan は check 対象外）
- [x] architecture test（tests/architecture.test.ts）が green
- [x] `bun src/cli/main.ts export rules --verify` が exit 0（mod-prompt のパスに変更なし。session.ts は同一ディレクトリに追加されるだけ）

**Acceptance Criteria**:
- `tsc --noEmit && bun test` が exit 0
- 既存テストが無変更で green
- `dependencies` が空
- architecture test green
- `export rules --verify` が exit 0

## 依存関係

```
T-01 (buildSessionInstruction) ─── T-02 (純関数テスト)
        │
        └──── T-03 (session handler) ─── T-04 (統合テスト)
                      │
                      └──── T-05 (dispatch テスト更新)
                      │
T-01〜T-05 ───────────┴──── T-06 (open-questions 注記) ─── T-07 (全体回帰)
```

T-01 と T-02 は独立して先行可能。T-03 は T-01 に依存（buildSessionInstruction を使う）。T-04 は T-03 に依存。T-05 は T-03 に依存（dispatch が変わるため）。T-06 は独立だが T-07 の前に完了する。T-07 は全タスク完了後。
