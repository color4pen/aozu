# permission ビューの実装 — perm スキーマ・C6 二相化・export permissions（ADR-0023）

## Meta

- **type**: new-feature
- **slug**: permission-view
- **base-branch**: main
- **adr**: false

<!-- 設計判断は ADR-0023（adr/0023-permission-view.md、merge 済み）で決定済み。本 request は仕様の実装であり新規 ADR は不要 -->

## 背景

ADR-0023 が permission ビューを追補した（ビュー型機構の一件目 — ADR-0022-3）。仕様は merge 済み: spec/format.md §3（前提表: permission → domain）・§8（perm スキーマ）・§10（C6 二相化・C11 views 方向）・§11（permissions export JSON）、spec/integration.md §7（export permissions の CLI 契約）。本 request はこの確定仕様を src/ に実装する。

消費者は clearflow（業務 SaaS）の権限突合テスト。設計の操作 × アクター表と `src/domain/authorization.ts` の権限定義を CI で等値検査する。実装完了 → リリース後に clearflow 側で adoption Step 4（permission 有効化・マトリクス書き起こし・突合テスト結線を同一 PR）が走る。

## 設計要素引用

[[mod-parse]], [[mod-graph]], [[mod-check]], [[mod-export]], [[mod-cli]]

## 現状コードの前提

- C6 は enabled に現れた**すべての**ビュー型名を error にする（src/check/rules/c06-view-links.ts:20-36、メッセージ「view type schemas are not yet defined」）。サポート型の概念は存在しない
- 型表は src/check/manifest.ts に集約: `LAYER_PREREQUISITES`（:89、permission: ["static"] が :101）、`VIEW_ENABLED_NAME_TO_PREFIX`（permission → perm が :117）、`VIEW_TYPE_NAMES`（:122）。C7 が LAYER_PREREQUISITES を読んで前提組み合わせを検査する（src/check/rules/c07-manifest-prerequisites.ts）
- C11 の `LAYER_ALLOWED_TARGET_PREFIXES`（src/check/rules/c11-layer-direction.ts:21）に views 層は未収載で、**views は現状無制限**（:19 コメント「Unlisted layers (loop, adr, views) have no restriction」）。逆にコア 3 層の許可集合に perm prefix は含まれないため、**コア → views の参照は既存実装で既に違反になる**
- 構造行レコグナイザは src/parse/structured-lines.ts に集約（責務: / 実装: / 依存辺 `- [[a]] -> [[b]]` / 登場要素 / elements: — ファイル冒頭 :1-15 の一覧）
- export は subcommand 構造（src/cli/commands/export.ts:7-13 に exit code 規約、:37-45 に usage。現状 rules のみ）
- src/fs/reader.ts は design/ 配下の .md を再帰走査するため、views/permission/ 配下のファイルは**既に読まれる**（追加の走査実装は不要）
- 見出しアンカー宣言 `{#perm-*}` は既存の宣言パースに乗る（perm は LAYER_MAP で views 層に写像済み — src/check/manifest.ts）
- aozu 自身の design/manifest.md は `enabled: static, domain, dynamic`。本変更で aozu 自身の check 結果（self-hosting 閉包）は不変であること

## 要件

1. **サポート型の導入と C6 の二相化**（最重量 — 機構の中心）: サポート済みビュー型の集合（現在 `{"permission"}`）を src/check/manifest.ts の型表群と同じ場所に定数として追加し、checkC6 を二相化する — enabled のサポート型は型別のリンク義務検証へ、未サポート型は従来どおり error（メッセージは現行を維持してよい）。将来のビュー型はこの分岐に validator を足す形になる（ADR-0022-3 の機構）
2. **LAYER_PREREQUISITES の確定**: permission を `["domain"]` に変更（spec §3 確定に一致。C7 は定数変更で自動追従）
3. **perm の構造行パース**: structured-lines.ts に二つの認識を追加 — (a) 操作行 `- <operation>: [[act-id]](, [[act-id]])*`（operation は空白と `:` を含まないトークン）、(b) `対象:` 行 `対象: [[<id>]]`（任意・要素ごとに高々 1 本）。パース結果は perm 要素に紐づく構造データとして graph 層から参照できること
4. **C6 の perm 検証**: permission enabled 時、各 perm 要素について (a) 操作行が 1 本以上（非空義務）、(b) operation が要素内で一意、(c) 操作行の全参照の prefix が act であること（適格性）、を検証する。**参照の解決検証は C3 の一般規則に委ねる**（C5 と同じ分担: 適格性は型別規則・解決は C3。act は permission の前提 domain に属するため縮退で漏れない）
5. **C11 views 方向**: LAYER_ALLOWED_TARGET_PREFIXES に views を追加 — 許可 prefix は views の全 prefix + static / domain / dynamic の prefix（spec §10 C11。「無制限」から「下位層 + 自層のみ」への制限追加）
6. **export permissions**: export に permissions サブコマンドを追加。spec §11 の JSON を stdout（または `--out <path>`）へ。順序は決定的（permissions は id 昇順・operations キーは辞書順・act 配列は ID 昇順）。`target` は 対象: 行があるときのみ含める。exit code は integration.md §7: 0 = 成功 / 1 = permission が enabled でない / 2 = 入力不正。`--verify` は実装しない（ADR-0023 D4）
7. **縮退の維持**: permission が enabled でない design に perm 宣言が存在しても、check の診断は現状と完全一致（既知だが無効な型の縮退 — C3 と一貫）
8. **conformance fixture**: spec §8 の例と同形の views/permission fixture（permission + domain enabled の manifest・act 要素つき）が check exit 0 になる統合テスト

## スコープ外

- permission 以外のビュー型のサポート（screen / api / ext 等は C6 error のまま）
- scaffold の perm 対応（ADR-0023 D5 — perm は見出し宣言型）
- prompt 注入規則の変更（perm 要素は通常要素として参照グラフに乗る。ADR-0019 の規則は不変）
- state.json / loop 機構の変更（perm 要素は既存の要素状態管理に自然に乗る）
- clearflow 側の書き起こし・突合テスト結線（別リポジトリの adoption Step 4）
- README のステータス更新等の docs（実装 merge 後に別途）

## 受け入れ基準

- [ ] spec §8 の例と同形の fixture（permission + domain enabled）が `check` exit 0（統合テスト）
- [ ] 操作行の参照が act 以外の prefix / 操作行ゼロの perm / 同一 perm 内の operation 重複、のそれぞれが C6 で error になり、実在しない act への参照は C3 で error になる（テスト）
- [ ] permission を enabled にして domain を外すと C7 違反（テスト）
- [ ] 未サポートのビュー型（例: screen）を enabled にすると従来どおり C6 error（既存テスト無変更で green）
- [ ] permission 未 enabled の design に perm 宣言があっても診断が従来と完全一致（縮退テスト）
- [ ] コア層要素の本文から `[[perm-*]]` を参照すると C11 違反、perm から ent / act への参照は合法（テスト）
- [ ] `export permissions` が spec §11 のスキーマ・決定的順序で出力し、`--out` が機能し、permission 未 enabled で exit 1・design/ 不在で exit 2（テスト）
- [ ] aozu 自身の design/（enabled: static, domain, dynamic）の check 結果が不変
- [ ] `typecheck && test` が green

## architect 評価済みの設計判断

- **採用: 設計判断は ADR-0023 に固定済み**（D1 粒度 / D2 表面非依存 / D3 act 義務・domain 前提 / D4 export 契約 / D5 scaffold 対象外 / D6 C11 方向 / D7 縮退）。実装で仕様と矛盾が出たら実装を仕様に合わせ、仕様の欠陥なら halt して設計に返す（ADR-0013 の正本テスト）
- **採用: サポート型集合は manifest.ts の型表群と同居** / 却下: C6 内のローカル定数 — 型の知識は manifest.ts に集約されている現行構造（LAYER_MAP / VIEW_ENABLED_NAME_TO_PREFIX / VIEW_TYPE_NAMES）に従う
- **採用: 操作行パースは structured-lines.ts に追加** / 却下: perm 専用パーサの新設 — 構造行の認識は一箇所に集約する現行設計（依存辺・登場要素と同族）に従う
- **採用: C6 で適格性 + 解決をまとめて検証** / 却下: 解決を C3 に委ねる分担 — C3 は「参照元・参照先のどちらかの型が無効な参照は評価しない」縮退を持ち、act（domain）は permission の前提として常に有効なため二重診断の恐れはあるが、C5 が同じ分担（適格性は C5・解決は C3）を既に採っている。**C5 と同じ分担に従うこと**: 適格性（prefix が act か）は C6、解決の検証は C3 に委ねる。C6 で独自に解決を再検証しない
