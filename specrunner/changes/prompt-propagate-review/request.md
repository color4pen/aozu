# prompt propagate / prompt review を実装し、prompt 動詞群を完成させる

## Meta

- **type**: new-feature
- **slug**: prompt-propagate-review
- **base-branch**: main
- **adr**: true

<!-- adr 判断基準: 新しい port/adapter 追加、既存パターンと異なる設計選択、振る舞い/契約を変える修正、構造的リファクタリング → true。いずれにも該当しない → false -->
<!-- 注入スコープ規則の ADR 起点への適用と、review の全量注入方針という設計選択を伴うため true -->

## 背景

ADR-0008 の動詞表のうち prompt 群は `prompt propagate --adr <id>`（決定の全層整合反映プロンプト。適用後は check が合否）と `prompt review`（矛盾の findings 列挙プロンプト。verdict は人）が未実装で残っている。derive（PR #9）と session（PR #11）で確立した「純関数 build*Instruction + CLI ハンドラの I/O 層」の分離と注入スコープ規則（ADR-0019）を再利用し、prompt 動詞群を完成させる。

docs/open-questions.md 論点 8 の規則案は注入の対象要素を「topic / ADR が引用する要素」と定めており、topic 起点は ADR-0019 で確定済み。本 request はその ADR 起点への適用（propagate）と、コーパス横断レビュー（review)の初版注入方針を確定する。

## 現状コードの前提

<!-- 書く直前に grep で再検証する。 -->

- src/cli/commands/prompt.ts — `handlePrompt` が sub-command dispatch（derive / session）。`handleSession` が確立したパターン: 引数解析 → design 存在確認 → graph 構築 → 対象要素の実在 + prefix 検証（exit 2）→ seed 抽出（`extractReferences`）→ `computeNeighborhood`（`SESSION_MAX_HOPS = 2`）→ `extractAllBodies` → 常時全量枠（inv/term 全量・static 縮約・enabled 一覧）の組み立て → 純関数呼び出し → stdout
- src/prompt/session.ts — `buildSessionInstruction` 純関数、定数 `SESSION_MAX_HOPS` / `FORMAT_RULES_SUMMARY` / `SESSION_GUIDANCE`。ADR-0019 が注入スコープ規則（2 hop・inv/term 全量・static 縮約）を決定として確定している
- spec/format.md §8 — adr は document element（frontmatter `id:`、`topics:` キーで top を引用）。§2 — `adr/NNNN-<slug>.md` が design/ 配下の置き場
- spec/format.md §10 — C9「adr が top を引用している」は **loop 有効時のみ**。C11 で「loop と adr は制限なし」（adr は常時層であり、loop 無効プロファイルでも存在しうる）
- src/plan/frontier.ts — ADR の `topics:` frontmatter 解析の実績（addressed 導出、ADR-0018-3）
- src/cli/commands/prompt.test.ts — session の fixture テストパターン（`createSessionFixture`、スコープ上限 assert、決定性、stdout/stderr 分離、fs 非書き込み）
- aozu 自身の design/ には adr/ が無い（テストは合成 fixture で行う）

## 要件

<!-- 実装の最重量部を名指しする。 -->

1. **`prompt propagate --adr <adr-id> [--dir <path>]`**（最重量部）: 決定の全層整合反映プロンプトを stdout に出力する。注入内容は ADR-0019 の規則を ADR 起点に適用する — (a) 対象 ADR の本文（id・`topics:` 込み）、(b) seed = ADR 本文中の `[[id]]` 引用と in/out 2 hop 近傍の本文全量、(c) inv / term 全量、(d) static 縮約、(e) enabled 一覧、(f) 形式規則要約、(g) 反映の作法指示（決定を design/ の全該当層に反映する・反映のたびに check を回す・完了条件は check exit 0 と決定内容の全層一致）。引用 0 件の ADR は正常系（プレースホルダ出力）
2. **`prompt review [--dir <path>]`**: 矛盾の findings 列挙プロンプトを stdout に出力する。注入内容は (a) 全要素の本文全量（ID 辞書順）、(b) 形式規則要約、(c) findings の書式指示 — 1 行 1 finding で「関与する要素 ID・矛盾の説明」を列挙させ、verdict（採否）は人の領分と明記する。**check が検出する構造違反（参照切れ・ID 重複・リンク義務欠落）はレビュー対象外と指示に明記する**（決定的検証との重複を作らない）
3. **loop gate を課さない**: propagate / review とも loop 無効の design で動作する（session の loop gate は対象の top が loop 層だから。adr は常時層で、review は対象を持たない）。design 不在・ADR 不存在・adr 以外の prefix は exit 2
4. **実装の分離と共有**: 純関数 `buildPropagateInstruction` / `buildReviewInstruction`（src/prompt/ 配下）+ CLI ハンドラ。session と共通する組み立て（常時全量枠・縮約・本文抽出の呼び出し列)は関数として共有し、三重実装にしない
5. **決定的出力**: 同一入力でバイト同一の stdout（要素列挙は ID 辞書順）。stdout は指示のみ・診断は stderr・ファイル書き込みなし（ADR-0008 の prompt 動詞意味論）

## スコープ外

- one-shot runner（論点 9-a、需要待ち）
- review のスコープ規則高度化（主張索引・ペア照合・グラフ近傍シャーディング — 論点 8 戦略 3。窓に収まらない実例の証拠待ち）
- `diff` / `trace`（prompt 群ではない未実装動詞。別 request）
- ADR の scaffold テンプレート変更・C9 の挙動変更
- session / derive の既存挙動の変更（共有関数への抽出でバイト出力が変わらないこと）

## 受け入れ基準

<!-- 機械検証できる文にする。 -->

- [ ] propagate: 引用ありの ADR fixture で、ADR 本文・seed 本文・2 hop 近傍本文・inv/term 全量・static 縮約・形式規則要約・反映作法指示が stdout に含まれることをテストで固定する
- [ ] propagate: 2 hop 近傍の外の要素本文が stdout に含まれないことをテストで固定する
- [ ] propagate: 引用 0 件の ADR で exit 0、ADR 不存在・adr 以外の prefix（例: `ent-order`）・design 不在で exit 2 をテストで固定する
- [ ] review: 全要素の本文が stdout に含まれ、findings 書式指示と「check の領分は対象外」の指示が含まれることをテストで固定する
- [ ] **loop 無効の design で propagate / review とも exit 0** になることをテストで固定する（gate を課さないことの固定）
- [ ] 両動詞: 同一入力でバイト同一の stdout・stderr 空（正常系）・design ディレクトリへのファイル書き込みなしをテストで固定する
- [ ] session / derive の既存テストが無変更で green（共有化でスナップショットが変わらない）
- [ ] `tsc --noEmit && bun test` green / dependencies 空

## architect 評価済みの設計判断

- **propagate / review に loop gate を課さない**。session の loop gate は対象（top）が loop 層の型だから課されるのであり、adr は常時層（C11「loop と adr は制限なし」・C9 のみ loop 条件）。段階導入プロファイル（static + domain のみ等）でも決定の反映と矛盾レビューは有用で、gate を課すと採用勾配（ADR-0010）を狭める。却下した代替: prompt 動詞一律で loop gate — 一貫性はあるが根拠が型体系と合わない
- **propagate の注入スコープは ADR-0019 の規則を ADR 起点に適用する**（論点 8 規則案「対象要素（topic / ADR が引用する要素）」の後半の実装）。hop 数は session と同じ定数を共有し、調整を単一修正点に保つ。却下した代替: propagate 専用の別スコープ — 規則が二系統になり、調整の証拠も分散する
- **review の初版は全量注入**。正本を小さく保つ原理（ADR-0004、論点 8 戦略 5）が窓を守る前提で、ペア照合への高度化は「窓に収まらない実例」の証拠が出てから（論点 8 戦略 3）。却下した代替: 初版からシャーディング — 複雑さに対して証拠がない
- **check の領分を review の指示から除外する**。構造違反は決定的検証（C1〜C11）が全量恒常で検出しており、LLM レビューに重複させると「規則への卒業 = 台帳の縮小」（論点 8 戦略 4）に逆行する。却下した代替: 網羅性のため全部見せる — findings の S/N 比を下げ、決定的合否と非決定的指摘の境界を曖昧にする
