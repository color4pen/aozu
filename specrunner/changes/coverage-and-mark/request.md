# coverage / mark implemented を実装し、状態機械の書き込み経路を立てる

## Meta

- **type**: new-feature
- **slug**: coverage-and-mark
- **base-branch**: main
- **adr**: false

## 背景

loop 動詞の書き込み系を立てる。`coverage` は request 草稿が plan グループの全要素を被覆していることを機械検証し、合格要素を requested に遷移する（adr/0005・adr/0006）。`mark implemented` は取り込み完了 hook から呼ばれ、requested 要素を implemented に遷移する（spec/integration.md §2）。これで designed → requested → implemented の状態機械（adr/0005）が一周结線され、フルループ検証（docs/open-questions.md 論点 9）の前提が揃う。

あわせて、adr/0018-3 が決定した topic の addressed 計算導出（「ADR の `topics:` frontmatter から引用された top は addressed」）への実装追随を行う。前 request（plan-and-derive）が src/plan/frontier.ts に NOTE として残した暫定（frontmatter `status` 依存）の解消である。

state.json への書き込みはこれが初であり、書き込み規約は spec/format.md §9（辞書順ソート・1 要素 1 行・ツールのみが書く）が正本。並列 request の重なりは adr/0018-4「要素は同時に 1 request にのみ属する」（coverage が既 requested 要素を拒否）で封じ、mark の上書き規則は不要になっている。

## 現状コードの前提

- src/state/reader.ts:16 に `readState`、:31 に `readDesignState(designDir)` がある。**writer は存在しない**。state.json のファイル名の知識は mod-state に封じる方針が readDesignState で確立済み
- tests/invariants.test.ts の T-03 が「ファイル書き込み API と文字列 `state.json` の共起は `src/state/` 配下のみ」を機械強制している。新しい writer は src/state/ に置き、CLI handler は mod-state の関数経由で書く（リテラルを持たない）
- src/plan/frontier.ts:63-77 の openTopics 計算は frontmatter `status === "open"` を読む pre-adr/0018 の暫定であり、NOTE コメントで「coverage / mark の request で移行する」と明示されている。IMPLEMENTATION_PREFIXES は act を含む（前 request で修正済み）
- src/cli/commands/scaffold.ts:66-72 の topic テンプレートに `status: open` 行が残っている。spec/format.md §8 の topic スキーマは既に status を持たない（計算導出）
- src/check/rules/c09-adr-topics.ts:13-24 のとおり、adr frontmatter の `topics:` 行の `[[top-*]]` は extractReferences が拾い graph.references.bySource に載る。frontmatter の生値は parsed.frontmatters からも取れる
- src/cli/main.ts:20-26 の registry に check / export / init / plan / prompt / scaffold / status が結線済み。coverage / mark は未結線。2 語コマンド（`mark implemented`）は `prompt derive` と同じサブコマンド分岐の前例がある（src/cli/commands/prompt.ts）
- spec/integration.md §2 が mark の契約を確定済み: 「該当 0 件」は slug 一致（状態不問）で判定、requested のみ遷移、全件 implemented 済みは no-op exit 0、一致 0 件は exit 1、部分適用状態を作らない
- 草稿からの `[[id]]` 抽出は check --request が同じことをしている（src/cli/commands/check.ts の request モード。spec §6 のコード除外規則適用済み）
- 既存テストは 471 件 green

## 要件

1. **mod-state に writer を新設**: `writeDesignState(designDir, stateMap)`。出力書式は spec/format.md §9 に厳密適合 — キーの辞書順ソート・1 要素 1 行。読み戻しとの round-trip をテストで固定する。state.json のファイル名・書式の知識は mod-state の外に漏らさない
2. **`aozu coverage --group <grp-id> --draft <path> --request <slug> [--dir <path>]`**: 検証と遷移を行う
   - 検証: (a) **被覆** — グループの `elements:` 全件が draft 中に `[[id]]` 引用されている（spec §6 のコード除外規則で抽出。テンプレート構造は解釈しない — adr/0012）、(b) **実在** — elements 全件が graph に解決される、(c) **状態** — elements に designed 以外（requested / implemented）の要素が含まれれば不合格（adr/0018-4。要素は同時に 1 request にのみ属する）、(d) **依存辺と並列指定の矛盾**（adr/0006） — グループをまたぐ参照辺があるのに `after:` 順序で結ばれていないグループ対を**警告**として診断する（不合格にしない）
   - 合格時のみグループ elements を requested に遷移し request slug を記録する（writer 経由・全遷移 or 全不変）。不合格時は state.json に触れない
   - exit code: 0 = 合格（遷移済み）/ 1 = 不合格または loop 無効（書き込みなし）/ 2 = 入力不正（draft 不在・グループ不在・slug 文法違反・設計ディレクトリ不在）
   - request slug は**引数で受ける**。draft の中身から slug を推定しない（消費者形式に依存しない — adr/0012）
3. **`aozu mark implemented --request <slug> [--pr <番号>] [--dir <path>]`**: spec/integration.md §2 の契約に厳密適合する。slug 一致（状態不問）が 0 件なら exit 1、一致があり requested の要素をすべて implemented に遷移（`--pr` があれば記録）、全件 implemented 済みは no-op で exit 0。loop 無効は exit 1。部分適用状態を作らない
4. **status の openTopics を計算導出に置換**（adr/0018-3）: 「どの adr の `topics:` frontmatter からも引用されていない top」を open とする。frontmatter の `status` は**読まない**（`status: addressed` が残っていても ADR 引用が無ければ open と表示する）。src/plan/frontier.ts の NOTE ブロックを解消する
5. **scaffold の topic テンプレートから `status: open` 行を除去**する（spec §8 追随）
6. 診断は stderr・1 行 1 診断、成果物は stdout（spec/integration.md §5）。coverage / mark の遷移結果の要約（何件遷移したか）は stderr に出す

## スコープ外

- designed への戻り遷移の機構（docs/open-questions.md 論点 12。別 request）
- plan の `status: derived` の書き込み・計算（未決のまま維持）
- coverage による draft 側の「グループ外引用」の検証（implemented 要素の文脈引用は入口ゲート `check --request` (b) の領分であり二重実装しない）
- C9 の判定を bySource 近似から frontmatter 厳密抽出に揃えること（check 側の将来課題）
- `diff` / `trace` / `prompt session` / `prompt propagate` / `prompt review`

## 受け入れ基準

- [ ] writer: 書き込んだ state.json がキー辞書順・1 要素 1 行であることをテストで固定する（read との round-trip 含む）
- [ ] coverage: 被覆完全な fixture で exit 0、グループ全要素が requested + slug 記録されることをテストで固定する
- [ ] coverage: 引用漏れ 1 件の fixture で exit 1、漏れた ID が診断に現れ、state.json が不変であることをテストで固定する
- [ ] coverage: グループに requested 済み要素を含む fixture で exit 1（adr/0018-4）、implemented 済み要素を含む fixture でも exit 1、いずれも state.json 不変をテストで固定する
- [ ] coverage: コードフェンス内の `[[id]]` を被覆に数えないことをテストで固定する（spec §6）
- [ ] coverage: グループをまたぐ参照辺 + after 無しの fixture で警告診断が stderr に出るが、被覆が満ちていれば exit 0 であることをテストで固定する
- [ ] mark: 正常遷移（--pr 記録含む）/ 冪等再実行 exit 0 / 未知 slug exit 1 / requested と implemented の混在 slug で requested のみ遷移、をそれぞれテストで固定する
- [ ] coverage / mark: loop 無効 fixture で exit 1 をテストで固定する
- [ ] status: adr の `topics:` に引用された top がフロンティアから消えること、引用の無い top が（旧 `status:` frontmatter の値に依らず）open と表示されることをテストで固定する
- [ ] scaffold: topic 生成物に `status` 行が無いことをテストで固定する
- [ ] 既存テストは、意味論変更の対象（status の openTopics 系・scaffold topic 系）の更新を除き無変更で green
- [ ] 本リポジトリで `check` exit 0・`export rules --verify` exit 0 / dependencies 空 / `tsc --noEmit && bun test` green

## architect 評価済みの設計判断

- request slug は coverage の引数で受ける。却下した代替: draft の frontmatter / Meta 節からの推定 — テンプレート構造の解釈は adr/0012（消費者非依存）に反する
- グループ内の非 designed 要素は不合格（fail-closed）。却下した代替: 警告に留める — adr/0018-4「要素は同時に 1 request にのみ属する」が破れ、mark の上書き規則が復活してしまう
- クロスグループ参照辺 + after 無しは警告に留める。却下した代替: 不合格 — 読み取り専用の参照など正当な並列分割でも辺は残り得るため、順序判断は人の領分（plan の注釈と同じ位置づけ）
- 状態遷移は「全遷移 or 全不変」。却下した代替: 部分適用 — spec/integration.md §2 が明示的に禁じており、coverage も同じ原子性に揃える
- openTopics は adr frontmatter の `topics:` 値からの厳密抽出で判定する（adr/0018-3 の字義: 本文中の文脈引用は addressed の根拠にしない）。却下した代替: C9 と同じ bySource 近似 — adr 本文の `[[top-*]]` 言及が addressed と誤判定される
- writer は mod-state のみに置き、coverage / mark の handler（mod-cli）は writeDesignState / readDesignState を経由する。却下した代替: handler 直書き — invariants の歯（T-03）に反し、書式規約の実装が散る
