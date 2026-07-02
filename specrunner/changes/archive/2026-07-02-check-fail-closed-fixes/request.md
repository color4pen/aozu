# check の fail-open（未知 prefix 素通り）と C11 診断の誤帰属を修正する

## Meta

- **type**: bug-fix
- **slug**: check-fail-closed-fixes
- **base-branch**: main
- **adr**: false

## 背景

敵対的整合レビュー第 2 巡（docs/review/findings-takt.md #6）の指摘を実機で確認したところ、実在するバグ 2 件が確定した。いずれも check の信頼性（fail-closed・診断の正確さ）に関わる。

## 現状コードの前提

- **バグ 1（fail-open）**: `enabled: static` の design で本文に `[[zzz-typo]]`（§4 に無い未知 prefix）を書いても check が無診断で exit 0 相当の通過をする。実測: 同じ文書内の `[[mod-nonexist]]`（既知 prefix・未解決）は C3 で検出されるが、`[[zzz-typo]]` は検出されない。原因は C3 の縮退 skip（enabledPrefixes に無い prefix を skip）が「既知だが無効」と「未知」を区別していないこと（src/check/rules/c03-ref-resolved.ts）
- **バグ 2（誤帰属）**: 1 ファイルに複数の見出し要素があるとき、C11 の診断が違反箇所を含む要素ではなくファイル先頭の要素に帰属する。実測: actors.md に `{#act-sales}` と `{#act-bad}` があり、act-bad のセクション内の `[[mod-intake]]` 参照が「act-sales が参照」と報告された（ファイル・行番号は正しい）
- 仕様の正本は更新済み: `spec/format.md` §10 C3「縮退による評価除外は既知だが無効な型に限る——未知の prefix を持つ参照は縮退の対象外で、常に違反として診断する」
- `KNOWN_PREFIXES` は `src/parse/id.ts`、参照→要素の帰属は graph の bySource / 要素の行範囲から導出できる（src/graph/）

## 要件

1. 未知 prefix（`KNOWN_PREFIXES` に無い型）の参照は、manifest の enabled 集合によらず常に診断する（fail-closed）。既知だが無効な型への（からの）参照の縮退 skip は従来どおり
2. 参照の帰属要素を「参照行を含む見出しセクションの要素」に修正する。C11 に限らず、要素帰属を使うすべての規則で同じ導出を用いる（帰属導出が規則ごとに重複実装されているなら一箇所に集約する）
3. 未知 prefix の**宣言**（`{#zzz-foo}`）の扱いが未知 prefix の参照と整合すること（C1 の既存挙動を確認し、fail-open があれば同様に塞ぐ）

## スコープ外

- findings-takt.md の他の指摘（別途分流・処理する）
- C3 以外の縮退意味論の変更
- 新機能・新規則の追加

## 受け入れ基準

- [ ] 未知 prefix 参照の fixture（`enabled: static` + `[[zzz-typo]]`）で check が exit 1 になり、診断が出ることをテストで固定する
- [ ] 既知だが無効な型への参照（`enabled: static` + `[[ent-x]]` 参照）が引き続き診断されないことをテストで固定する（縮退の維持）
- [ ] 複数要素ファイルの後方要素セクション内の違反が、正しい要素 ID に帰属して報告されることをテストで固定する（act-sales / act-bad の再現 fixture）
- [ ] 本リポジトリと `design/` fixture 群で `check` の既存判定が変わらない（真の違反追加なし）
- [ ] 既存 326 テスト無変更で green / dependencies 空 / `tsc --noEmit && bun test` green

## architect 評価済みの設計判断

- 「未知」と「既知だが無効」の区別は prefix 集合（KNOWN_PREFIXES）と layer 集合（enabled 由来）の二段判定とする。却下した代替: 未知 prefix を警告に留める — typo は閉包の嘘の入口であり、fail-closed 原則（inv-fail-closed-deps と同系）に従い error とする
- 帰属導出の一元化。却下した代替: C11 のみの局所修正 — 同じ誤帰属が他規則にも潜在し得るため、導出を共有して単一修正点にする
