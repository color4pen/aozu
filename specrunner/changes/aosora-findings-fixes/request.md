# aosora findings の即修正群 — format-version フェンス・topics 書式の統一・CLI ergonomics

## Meta

- **type**: bug-fix
- **slug**: aosora-findings-fixes
- **base-branch**: main
- **adr**: false

<!-- adr 判断基準: 新しい port/adapter 追加、既存パターンと異なる設計選択、振る舞い/契約を変える修正、構造的リファクタリング → true。いずれにも該当しない → false -->
<!-- 既存仕様への適合修正と ergonomics であり、新たな構造判断を伴わないため false。設計判断が要る findings #1 は論点 13 に分流済みで本 request のスコープ外 -->

## 背景

aosora（design/ フルループ + designLayer 結線を day 0 から有効化した greenfield プロジェクト）の実運用 findings（docs/findings/aosora-2026-07-04.md）のうち、設計判断を要さない 5 件を修正する。うち 2 件は fail-closed 原則・仕様との不整合（実害確認済み）、3 件は初見の実施者が実際に詰まった CLI ergonomics。

## 現状コードの前提

<!-- 書く直前に grep で再検証する。 -->

- src/check/manifest.ts:127-142 — `parseManifest` は `format-version` を文字列として読むだけで、ツールの対応バージョン集合と照合しない。実測: `format-version: 99` の design/ を `check` が無診断 exit 0 で通す（fail-closed 違反。findings #6）
- src/prompt/session.ts:41-47 — `SESSION_GUIDANCE` の ADR 例が `topics: top-my-topic`（plain 形式）。正書式はブラケット付きで、spec/format.md §8（`topics: [[top-duplicate-slug]]`）・scaffold の adrTemplate（src/cli/commands/scaffold.ts:118-119 `topics: （[[top-xxx]] を記入する）`）・addressed 導出（src/cli/commands/status.ts:51-80 が `extractReferences` で frontmatter 値から `[[top-*]]` を抽出）・C9（src/check/rules/c09-adr-topics.ts が参照グラフを走査）のすべてと不整合。plain 形式で書くと C9 が落ち、本文引用で回避しても addressed 導出が静かに失敗する（実害: aosora で解決済みのはずの topic が Open のまま。findings #3）
- src/check/rules/c09-adr-topics.ts:26-34 — C9 の診断メッセージは「does not reference any topic」のみで、正書式（frontmatter への `topics: [[top-x]]`）への導線が無い
- src/cli/commands/scaffold.ts:233-242 — `scaffold <type> <id>` は id にフル ID（prefix 込み）を要求する。`scaffold topic concept` は後段の ID 検証で落ち、`scaffold topic top-concept` が要る（findings #2）。document 型 ↔ prefix の対応は同ファイルの `DOCUMENT_TYPE_DIR`（topic / plan / seq / adr）から導出できる
- src/cli/commands/prompt.ts:204-210 — derive の stage gate は `request-template` 欠落で config エラーを返すが、「manifest frontmatter にどのキーをどう書くか」の修正手順を含まない（findings #4）。init が生成する manifest テンプレ（src/cli/commands/init.ts）のコメントにも導出キーの説明が無い
- src/cli/commands/mark.ts:122-130 — `mark implemented` は `--request <slug>` のみ受理し、positional slug（`mark implemented foundation`）は「missing --request argument」になる（findings #5）。`aozu mark --help`（mark.ts:50-63）はサブコマンド名のみでオプション要約が無い
- spec/format.md §3 — manifest の `format-version` は仕様上必須キー。§10 の C 規則には format-version 検証が存在しない

## 要件

<!-- 実装の最重量部を名指しする。 -->

1. **format-version フェンス（最重量部）**: ツールが対応する format-version 集合（現在 `{"0"}`）を定数一箇所に定義し、manifest の `format-version` が集合外（未知の値・欠落を含む）なら **error 診断 + 不合格**にする。check だけでなく manifest を読む全動詞（status / plan / coverage / derive / session / propagate / review / mark / export）で同じ判定が効くこと（parseManifest の直後など、一箇所の共通経路で判定する）。診断メッセージには対応バージョンと「新しい形式ならツールを更新する」旨を含める。spec/format.md §10 に対応する規則（C12 として採番）を追記する
2. **topics 書式の統一**: SESSION_GUIDANCE の ADR 例を `topics: [[top-my-topic]]` に修正する。C9 の診断メッセージに「frontmatter に `topics: [[top-xxx]]` を書く」という修正手順を含める
3. **scaffold の prefix 自動補完**: document 型（topic / plan / seq / adr）で id が該当 prefix で始まらない場合、自動補完する（`scaffold topic concept` → `top-concept`）。フル ID 指定も引き続き受理し、**型と矛盾する prefix**（`scaffold topic ent-foo`）は error
4. **derive の導線改善**: `request-template` / `request-output-dir` 欠落時のエラーメッセージに、manifest frontmatter への具体的な記入例（キー名と値の形式）を含める。init が生成する manifest テンプレのコメントに、loop 有効化時に必要になる導出キー 2 つの説明を追記する
5. **mark の ergonomics**: `mark implemented <slug>` の positional 指定を `--request <slug>` と等価に受理する（両方指定され食い違う場合は error）。`aozu mark --help` の要約に implemented の主要オプション（--request / --pr / --dir）を併記する

## スコープ外

- findings #1（依存引用と被覆引用の区別）— 設計判断が要るため論点 13 で扱う（本 request では触れない）
- format-version の移行手段・複数バージョン読みの窓（論点 7。フェンスはその前提であって移行機構ではない）
- C9 の判定ロジック自体の変更（正書式なら frontmatter 一箇所で C9 と addressed の両方が満たされることは検証済み — 変えるのは例示とメッセージのみ）
- spec-runner 側の変更

## 受け入れ基準

<!-- 機械検証できる文にする。 -->

- [ ] `format-version: 99`（未知）と format-version 欠落の design/ で check が error 診断つき不合格になることを fixture テストで固定する
- [ ] `format-version: 0` の既存 fixture 群・design/ で check の判定が変わらない（既存テスト無変更で green）
- [ ] manifest を読む動詞の代表（status / plan / prompt session / mark implemented）でも未知 format-version が同じ error になることをテストで固定する
- [ ] SESSION_GUIDANCE の出力に `topics: [[top-my-topic]]`（ブラケット形式）が含まれ、plain 形式の例が含まれないことをテストで固定する
- [ ] C9 診断メッセージに frontmatter の正書式（`topics: [[`）への言及が含まれることをテストで固定する
- [ ] `scaffold topic concept` が `topics/concept.md` に `id: top-concept` を生成すること、`scaffold topic top-concept` も同結果になること、`scaffold topic ent-foo` が exit 2 になることをテストで固定する
- [ ] derive の template 欠落エラーに `request-template:` の記入例が含まれることをテストで固定する
- [ ] `mark implemented <slug>` が `--request <slug>` と同じ遷移を行い、両指定の食い違いが exit 2 になることをテストで固定する
- [ ] 既存テスト無変更で green / `tsc --noEmit && bun test` green / dependencies 空

## architect 評価済みの設計判断

- **format-version 判定は parseManifest 直後の共通経路に一箇所で置く**。却下した代替: C 規則として check のみに実装 — check 以外の動詞（mark 等の書き込み系）が未知形式を誤読するリスクが残る。fail-closed は読む場所全部で効かせる。spec 上は C12 として採番するが、実装は全動詞共通の入口ゲート
- **C9 のロジックは変えず、例示とメッセージだけ直す**。裏取りで「二重要件」は存在せず（正書式なら frontmatter 一箇所で充足）、壊れていたのはガイダンスの一貫性だけと確認済み。ロジック変更は不要なリスク
- **scaffold の自動補完は document 型に限る**。見出し要素（mod / term 等）は既存ファイルへの追記であり scaffold の対象外（現仕様どおり）。型と矛盾する prefix を error にするのは、typo（`scaffold topic ent-foo`）を静かに補完しない fail-closed 側の倒し方
- **mark の positional は --request の糖衣に留める**。既存の呼び出し（spec-runner の mark hook は `--request` 形式）に影響を与えない加算的変更
