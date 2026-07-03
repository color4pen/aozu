# plan / prompt derive を実装し、designed 要素から request 草稿までの導出経路を立てる

## Meta

- **type**: new-feature
- **slug**: plan-and-derive
- **base-branch**: main
- **adr**: false

## 背景

loop 動詞（plan / coverage / derive / mark）のうち、**state を書かない読み取り系 2 つ**を先に立てる。`plan` は designed 要素を束ね方の表（plan 文書）に吐き、人が統合・分割・順序・並列可否を編集する（adr/0006）。`prompt derive` は plan のグループ単位で request 草稿の生成指示を出力する（adr/0008・adr/0012）。書き込み系（coverage / mark implemented）は後続 request で実装するため、本 request では state.json への書き込みを一切追加しない。

正本: 動詞定義は adr/0008、plan の位置づけ（現在形の作業文書・`request:` 行なし）は adr/0018 と spec/format.md §8、導出の消費者非依存（テンプレート・出力先の設定注入）は adr/0012、段階ゲート（loop 無効時は明示エラー）は adr/0010。

## 現状コードの前提

- CLI registry は src/cli/main.ts:17-22。check / export / init / scaffold / status が結線済みで、plan / prompt は未結線
- `src/plan/`・`src/prompt/` は**未作成**だが、設計正本は予約済み: design/static/modules.md に mod-plan（責務: plan の生成・coverage 検証・グループへの request 記録）・mod-prompt（責務: スコープ選択とテンプレートへの文脈注入による指示の組み立て）があり、design/rules.json の paths にマップ済み（design/rules.json:41-44）。許可依存は mod-cli -> mod-plan / mod-cli -> mod-prompt / mod-plan -> {mod-graph, mod-state} / mod-prompt -> mod-graph のみ（design/static/dependencies.md）
- designed フロンティアの導出 `computeFrontier` は src/cli/commands/status.ts:66 にある。**mod-plan から mod-cli への依存は許可されていない**ため、plan が同じ導出を使うには移設または再実装が要る
- 参照の要素帰属は src/check/attribution.ts にある。**mod-plan から mod-check への依存は許可されていない**
- manifest の frontmatter パースは src/check/manifest.ts:120 `parseManifest`（Manifest 型は src/graph/types.ts:24）。mod-cli -> mod-check は許可済みで、status.ts:20 が既にこの経路で import している
- parse / graph は要素の**本文テキストを保持していない**（Element は id / prefix / displayName / file / line のみ）。要素本文の取り出しは新規実装になる
- state.json の read 側は src/state/reader.ts（エントリ無し = designed）。write 側は存在しない
- design/static/modules.md の mod-plan 責務行に「グループへの request 記録」とあるが、これは adr/0018-2（`request:` 行の廃止）以前の記述であり、本 request で責務行の更新が要る（下記要件 6）

## 要件

1. `aozu plan <slug> [--dir <path>]`: designed 要素（status の designed フロンティアと同一の導出）を列挙し、`design/plans/<slug>.md` を生成する。内容は spec/format.md §8 の plan スキーマに適合すること: frontmatter `id: plan-<slug>` / `status: open`、全 designed 要素を elements に持つ初期グループ 1 つ（人が編集して分割する出発点）。`request:` 行は書かない（adr/0018-2）
2. plan の生成物に**判断材料の注釈**を含める（adr/0006。機械の読む行と衝突しない自由 Markdown 節として): (a) 対象要素間の参照辺（順序制約の材料）、(b) 各要素が参照する / 各要素を参照する mod（並列衝突の材料）、(c) 現在 requested の要素一覧（in-flight 重複の材料）。注釈はすべて参照グラフと state.json から決定的に導出する
3. `aozu prompt derive --group <grp-id> [--dir <path>]`: plan 中の指定グループについて、request 草稿生成の**指示テキストを stdout に出力する**（プロンプト動詞。ファイルも state も書かない — adr/0008）。指示に含める: (a) request テンプレートの内容、(b) グループの対象要素の本文全量、(c) 対象要素から参照 in/out 2 hop 以内の要素の本文（open-questions 論点 8 の規則案の derive への適用）、(d) term / inv の全量、(e) 「変更対象の設計要素を `[[id]]` で本文に引用せよ。引用は被覆の宣言であり coverage が検証する」という引用規約、(f) 草稿の出力先パス
4. テンプレートと出力先は **manifest の frontmatter で注入する**（adr/0012 の設定 2 点）: `request-template:`（値が実在ファイルならその内容、そうでなければコマンドとして実行し stdout を採る）、`request-output-dir:`。derive 実行時にどちらかが欠けていれば exit 2 と明示診断。テンプレート内容は指示中で**データとして明示的に区切って**埋め込む（テンプレート由来のテキストを指示と混同させない）
5. 段階ゲートと fail-closed: plan / derive とも loop が無効なら明示エラーで案内し exit 1（adr/0010「縮退して動くふりをしない」）。plan は既存 `plans/<slug>.md` があれば何も書かず exit 1、designed 要素が 0 件なら exit 1。derive は plan 不在・グループ不在・グループ elements の未解決で exit 2。診断は stderr、成果物（derive の指示テキスト）は stdout（spec/integration.md §5）
6. 正本の追随（実装と同じ PR で）: (a) spec/format.md §3 に manifest の任意キー `request-template` / `request-output-dir` を追補する（加算的変更、format-version 不変 — adr/0016）、(b) spec/integration.md §4 の「設定で注入され」に注入点（manifest frontmatter）を明記、(c) design/static/modules.md の mod-plan 責務行から「グループへの request 記録」を落とし現状に合わせる（adr/0018-2 の追随。rules.json の再 export を忘れない）

## スコープ外

- `coverage` / `mark implemented` / state.json への書き込み一切（後続 request）
- designed への戻り遷移の機構（open-questions 論点 12）
- `prompt session` / `prompt propagate` / `prompt review` / `diff` / `trace`
- プロンプトのスコープ縮約の高度化（static 一覧の縮約形等。論点 8 の残り）
- 設定の CLI フラグによる上書き
- plan の `status: derived` への遷移（書き込み系の領分）

## 受け入れ基準

- [ ] loop 有効 fixture（designed 要素あり）で `plan <slug>` → 生成された plans/<slug>.md が spec §8 に適合し、fixture 全体で `check` が exit 0 のままであることをテストで固定する（C1 / C2 / C10 を新文書が破らない）
- [ ] plan 生成物に要件 2 の注釈 3 種が含まれることをテストで固定する（参照辺・mod 接地・requested 一覧の各 1 例）
- [ ] `plan`: loop 無効（本リポジトリ design/ で可）/ 既存 slug 衝突 / designed 0 件がそれぞれ exit 1 で、ファイルを書かないことをテストで固定する
- [ ] `prompt derive --group <id>`: fixture で stdout にテンプレート内容・対象要素本文・2 hop 近傍の本文・term / inv・引用規約・出力先パスが含まれることをテストで固定する
- [ ] derive: `request-template` がファイルパスの場合とコマンドの場合の両モードをテストで固定する
- [ ] derive: 設定キー欠落 / plan 不在 / グループ不在がそれぞれ exit 2 と stderr 診断になることをテストで固定する
- [ ] derive がファイルシステムに何も書かないことをテストで固定する
- [ ] 本リポジトリで `check` exit 0・`export rules --verify` exit 0 のまま / 既存 336 テスト無変更で green / dependencies 空 / `tsc --noEmit && bun test` green

## architect 評価済みの設計判断

- 設定 2 点は manifest frontmatter に置く。却下した代替: 専用 config ファイル — 所有権と規約が 1 つ増え、flat kv（spec §7）で足りる内容に新形式を持ち込む。却下した代替: CLI フラグ必須 — 呼び出しごとに値が揺れ、指示の決定性が下がる
- plan はファイル生成（scaffold と同型）。却下した代替: stdout 出力 — plan は人が編集する作業文書であり、リダイレクトの手間は導入体験を下げる。plan は人の所有物（state.json ではない）なので、ツールが生成し人が編集することは inv-tool-writes-state と矛盾しない
- テンプレート取得（ファイル読み / コマンド実行）は composition root（mod-cli）が行い、mod-prompt は「入力を受けて指示テキストを返す」純関数に保つ。却下した代替: mod-prompt が直接 IO — 決定性が下がり、fs 読み取りの seam（mod-fsread の責務）とも衝突する
- `computeFrontier` と参照帰属の共有は、mod-cli / mod-check から mod-plan が依存できない制約の下で解く（フロンティア導出は mod-plan または mod-state へ移設、帰属は mod-graph へ移設が自然 — check -> graph は許可済み）。却下した代替: mod-plan 内への複製 — 同じ導出の二重実装は R7 で一元化した帰属導出の逆行
- 2 hop 近傍 + term / inv 全量の注入スコープは open-questions 論点 8 の規則案をそのまま採る（実装時調整は許容されている）。却下した代替: 対象要素のみ — 草稿を書く agent が近傍の制約を知らずに引用漏れを起こす
