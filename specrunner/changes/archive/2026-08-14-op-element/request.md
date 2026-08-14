# op 要素の実装 — op 型の追加と perm 操作行の op 参照化（ADR-0025）

## Meta

- **type**: new-feature
- **slug**: op-element
- **base-branch**: main
- **adr**: false

<!-- 設計判断は ADR-0025（adr/0025-operation-element.md、merge 済み）で決定済み。本 request は確定仕様の実装であり新規 ADR は不要 -->

## 背景

permission ビューの操作は自由トークンであり、タイポや未定義操作は deny-by-default に黙って吸収される（ADR-0023 Context）。ADR-0025 が操作語彙を第一級要素 op へ昇格する決定を行い、spec/format.md（§2 配置・§4 型表・§5 見出し要素・§8 op スキーマと perm 操作行・C6）は merge 済み。本 request はこの確定仕様のうち **op 型の追加と perm 操作行の op 参照化**を src/ に実装する。perm の op 参照化は op 導入の完成条件（op の読む機械が perm のリンク義務）であるため、一つの request に束ねる。

依存: [[mod-parse]], [[mod-check]], [[mod-graph]], [[mod-export]], [[mod-plan]]

## 現状コードの前提

- 既知 prefix は src/parse/id.ts の `KNOWN_PREFIXES`（:10）。`op` は未登録であり、C1/C3 は未知 prefix を常に違反とする（fail-closed）
- prefix → 層の対応は src/check/manifest.ts の `LAYER_MAP`（:62）。同ファイルの `LAYER_TO_PREFIXES`（:149）は getEnabledPrefixes が参照する層 → prefix の逆引きマップであり、**ここに op を足さないと enabledPrefixes に op が入らず C3 / C11 が op をスキップする**。C11（src/check/rules/c11-layer-direction.ts）は層ごとの許可参照先集合 `LAYER_ALLOWED_TARGET_PREFIXES`（:22）も持つ。層の前提表は `LAYER_PREREQUISITES`（:89）— op は domain 層内の型なので前提表の変更は不要
- 見出し要素の宣言認識は src/parse/declarations.ts の `HEADING_ELEMENT_RE`（:16）で prefix 非依存。ID の合法性は C1 が KNOWN_PREFIXES で判定する
- 構造行の認識は src/parse/structured-lines.ts に集約。`実装:` 行は prefix 非依存に認識済み（:133、カンマ区切り → `ImplementationEntry`）。`対象:` 行は perm 用の単一参照のみ（`PERM_TARGET_LINE_RE` :39）。perm 操作行は自由トークン（`PERM_OPERATION_LINE_RE` :33 — `/^- ([^\s:]+): (\[\[.+)$/`。`[[op-id]]` も空白・`:` を含まないため、このままでは括弧ごと自由トークンとして誤認識される点に注意）
- C6 は src/check/rules/c06-view-links.ts — perm 操作行の act 解決・非空義務・操作トークンの perm 内一意を検証する
- `export permissions`（src/cli/commands/export.ts）は operations のキーに自由トークンを排出し、キーは辞書順
- 実装可能要素の prefix 集合は src/plan/frontier.ts の `IMPLEMENTATION_PREFIXES`（:43 — mod / term / ent / inv / act / seq）。mark implemented・フロンティア計算・hash 記録の対象判定に使われる
- aozu 自身の design/ は op / perm とも未使用。permission ビューを有効化した corpus は存在しない（旧文法の移行対象なし — ADR-0025 D4）

## 要件

1. **op prefix の追加**（mod-parse / mod-check）: `KNOWN_PREFIXES` に `op` を追加し、`LAYER_MAP` で `op: "domain"`、**`LAYER_TO_PREFIXES.domain` にも `op` を追加**する。C11 の `LAYER_ALLOWED_TARGET_PREFIXES` は domain / views / static / dynamic の各参照先集合に `op` を追加する（op 専用の検証規則は新設しない — 既存集合への追記のみ）。見出し要素として宣言でき（§5）、C1〜C3・C11・縮退規則は既存の層機構がそのまま適用されること
2. **op の `対象:` 行**（mod-parse / mod-graph）: op 要素に帰属する `対象:` 行はカンマ区切りの複数参照を許す（§8）。認識は structured-lines に置き、帰属要素と参照リストを保持する（後続の export operations が消費する）。**`対象:` 行の perm / op への分類は解析パターンの試行順序ではなく所属要素の prefix で決める**こと（同一の行文面が両文脈で合法なため。単一参照の op `対象: [[ent-order]]` が op 側に分類されること）。**perm の `対象:` 行は単一参照のみ有効**（ADR-0023 D2 のスキーマ）: 単一参照の既存挙動・診断は不変とし、**複数参照の perm `対象:` 行は C6 error（行番号つき）とする**——黙って先頭だけ採る切り詰めや黙殺は fail-open であり許さない。op 要素の `対象:` 行（複数可）は error にならない。あわせて spec/format.md §8 perm の `対象:` 記述に「単一参照。複数参照は C6 違反」を、§10 C6 の義務列挙に「perm 対象行の単一制約」を明記する（スキーマの転記）。`対象:` 行上の `[[id]]` は通常参照として C3 の一般解決を受ける（現行の references 抽出が拾う挙動を変えない）
3. **op の `実装:` 行**（mod-parse / mod-plan）: 既存の `実装:` 認識を op 要素へ帰属させ、`IMPLEMENTATION_PREFIXES` に `op` を追加する（op が mark implemented・フロンティア・hash 記録の対象になる）
4. **perm 操作行の op 参照化**（mod-parse / mod-check）: 操作行を `- [[op-id]]: [[act-id]](, [[act-id]])*` と定める（§8）。C6 の検証は:
   - op 参照が実在の op 要素に解決されること（未定義・削除済み・タイポの検出）
   - act 参照の解決（既存）
   - 操作行の非空義務（既存）
   - op 参照の perm 内一意（自由トークン一意の置き換え）
5. **操作行の fail-closed**: 操作行の形をした行（`- <token>: [[...]]`）で token が `[[op-id]]` 形式でないものは error 診断とする（行番号つき）。新文法に一致しない行を黙って非操作行として落とさない（意図の読めない行の静かな誤分類を許さない — ADR-0024 要件 2 と同型）。実現方式: structured-lines は malformed 操作行を行番号つきデータとして結果に保持し（診断は発行しない）、error 診断の発行は C6 が行う — extractRequestCitations（malformedLines を返し check --request が R3 を発行）と同じ「分類は抽出時・診断は消費側」の定型に従う。**非空義務との関係**: 非空義務は有効な操作行の本数で判定し、malformed の存在は義務判定を変えない（規則間に抑制関係を作らない）。malformed 操作行のみを含む perm は malformed error と非空義務 error の両方を発行する（2 errors）
6. **export permissions のキー更新**（mod-export）: operations のキーを op ID（例: `"op-create-deal"`）とする。キー辞書順・出力の決定性は不変。spec/format.md の転記漏れ 2 箇所も更新する（いずれも ADR-0025 の帰結の転記であり新規判断ではない）: §11 permissions export の例のキーを op ID へ、§10 C11 の記述「domain の要素は domain（term / ent / inv / act）のみを参照できる」の列挙に op を追加
7. **文書コメントの整合**（mod-parse / mod-export）: 旧文法を例示する JSDoc を新文法へ更新する — src/parse/types.ts の PermOperation コメント（`- [[op-id]]: [[act-id]](, [[act-id]])*`）と src/export/permissions.ts の出力例（op ID キー）。既存テスト「spec §8 example: perm-deal with list and create」（src/export/permissions.test.ts）は自由トークンのまま残してよいが、テスト名から spec §8 への言及を外す（generatePermissions が文法非依存の純関数であることの検証と位置づける）
8. **診断の書式維持**: `<LEVEL> <CODE> <id> <message>` の 1 行 1 診断・stderr・exit code 規約（0/1/2）は不変
9. **既存挙動の後方互換**: perm 操作行の文法テスト（旧自由トークン）は新文法へ書き換える（移行対象の corpus は存在しない — ADR-0025 D4）。それ以外の既存テストは無変更で green であること。aozu 自身の design/ の check 結果は不変

## スコープ外

- `export operations`（別 request。§11 operations export は本 request では実装しない）
- C5（seq の登場要素）への op 追加（open-questions 論点 17。trace の実装判断まで触らない）
- uc / scr の去就（論点 17）
- `prompt derive` テンプレート・ガイダンスへの op の案内追加
- 入出力・事前条件など op スキーマの拡張（ADR-0025 非目標）

## 受け入れ基準

- [ ] `## 受注を確定する {#op-confirm-order}` を含む domain 文書が check exit 0（op 見出し要素の宣言。テスト）
- [ ] op の `対象: [[ent-a]], [[ent-b]]` 行の複数参照が認識され、未解決参照は C3 で exit 1（テスト）
- [ ] op から static 要素への参照は C11 違反（op は domain 層。テスト）
- [ ] perm 操作行 `- [[op-a]]: [[act-x]]` が op / act とも解決すれば C6 合格（テスト）
- [ ] 未定義 op への操作行参照が C6 error で exit 1（テスト）
- [ ] 実在するが op でない prefix の操作行参照 `- [[ent-order]]: [[act-x]]` が C6 error で exit 1（存在チェックとは独立のコードパス。テスト）
- [ ] op→ent 参照を含む design の check が exit 0 で C11 診断が発行されない（正のケースの観察可能な確認。テスト）
- [ ] 同一 perm 内で同じ op を参照する操作行 2 本が C6 error（一意性。テスト）
- [ ] 自由トークンの操作行 `- create: [[act-x]]` が error で exit 1（fail-closed。テスト）
- [ ] malformed 操作行のみを含む perm が malformed error + 非空義務 error の 2 errors（テスト）
- [ ] perm の `対象: [[ent-a]], [[ent-b]]`（複数参照）が C6 error で exit 1、op の複数参照 `対象:` 行は error なし（テスト）
- [ ] 同一 perm 内の重複 op 参照テストは C6 error 1 件のみの発行を厳密に assert する（op 要素を実在させ、prefix 違反エラーを混入させない）
- [ ] `export permissions` の operations キーが op ID・辞書順で排出される（テスト）
- [ ] `実装:` 行つき op 要素が mark implemented の対象になる（IMPLEMENTATION_PREFIXES。テスト）
- [ ] perm 文法テスト以外の既存テストが無変更で green
- [ ] aozu 自身の design/ の check 結果が不変
- [ ] `bunx tsc --noEmit` && `bun test` が green

## architect 評価済みの設計判断

- **採用: LAYER_MAP への追加だけで層機構（C3 縮退・C11）に載せる** / 却下: op 専用の検証規則の新設 — 型はツールの知識・検証は層機構の一貫適用という現行設計に従う
- **採用: `対象:` の複数化は認識層（structured-lines）で行い、perm の単一検証は消費側に残す** / 却下: perm の `対象:` も複数化 — perm のスキーマ変更は本 request の決定範囲外（ADR-0023 D2 のまま）
- **採用: 操作行は form-matching（`- token: [[...]]`）→ op 参照検証の二段** / 却下: 新 RE 不一致の黙殺 — fail-closed。操作行のつもりの行が非操作行として静かに落ちると、非空義務だけでは検出できない誤設計が残る
- **採用: export permissions のキーは op ID** / 却下: op の表示名 — 機械の identity は ID のみ。表示名は人間向けであり突合の照合キーにしない
- **採用: export permissions の op ID キー検証テストは markdown fixture の実パース経由で書く**（パース → graph 構築 → generatePermissions）/ 却下: PermOperation の直接構築 — generatePermissions 自体は変更されないモジュールであり、直接構築では旧文法実装と区別できない（テストが噛まない）。実パース経由なら旧実装は操作トークンを括弧ごと拾いキーが一致せず red になる
