# designed への戻りの実装 — mark の本文ハッシュ記録と乖離の計算縮退（ADR-0018 補記）

## Meta

- **type**: new-feature
- **slug**: designed-reversion
- **base-branch**: main
- **adr**: false

<!-- 設計判断は ADR-0018 補記（adr/0018-loop-write-semantics.md、merge 済み）で決定済み。本 request は確定仕様の実装であり新規 ADR は不要 -->

## 背景

要素状態機械（designed → requested → implemented、ADR-0005）の「designed への戻り」に機構が無く、implemented 要素の設計本文を後から書き換えても機械は検出しない——design-not-later-than-merge の保証が入口ゲート側しか閉じていない。ADR-0018 補記が機構を確定し、spec/format.md §9（state.json の `hash` フィールドと縮退規則）は merge 済み。本 request はこの確定仕様を src/ に実装する。

機構の要約: mark implemented が遷移時に要素本文の SHA-256 を記録し、check / status が現物との乖離を検出して当該要素を **designed 扱いに縮退**して扱う（計算遷移。state.json は書き換えない）。乖離は warning 診断 S1 で表面化し、歯はフロンティアの非空と入口ゲートの再開通が担う。

依存: [[mod-state]], [[mod-parse]], [[mod-graph]], [[mod-check]], [[mod-cli]], [[mod-plan]]

## 現状コードの前提

- StateEntry は `{state, request?, pr?}`（src/state/types.ts）。writer（src/state/writer.ts）は辞書順・1 要素 1 行で書き、値は `JSON.stringify(value)` なので追加フィールドは自然に直列化される
- mark implemented は src/cli/commands/mark.ts:101-264。`readMarkdownFiles` + `parseFiles` を既に呼んでおり（:189-190）、ファイル内容（FileInput.content）とパース済み要素（Element: id / file / line — src/parse/types.ts:10-16）が手元にある。遷移は requested → implemented の全件一括・原子的書き込み（:244-256）。既に implemented の要素は no-op（冪等、:236-242）
- 要素の帰属導出（どの行がどの要素に属すか）は src/graph/attribution.ts の `findOwningElement` に一元化されている。要素範囲 = 自要素の宣言行から同一ファイル内の次要素宣言の直前まで（ファイル末尾まで）。文書要素（seq / top / plan / adr、1 ファイル 1 要素）はファイル全体
- 通常 check は src/cli/commands/check.ts:204-231 — `runCheck(graph, manifest, stateKeys)` に **state のキーのみ**を渡す（C8 用）。exit は `diagnostics.length === 0 ? 0 : 1` なので、**warning を足すなら exit 判定を error のみに変える必要がある**（CheckDiagnostic の level は "error" | "warning" 型を確認のこと）
- check --request の状態参照は src/cli/commands/check.ts:152-164（`stateMap[id]` を直読み）
- coverage の状態検査は src/plan/coverage.ts:110-119（WRONG_STATE — designed 以外を不合格）。純関数で stateMap を受ける
- status のフロンティア計算は src/plan/frontier.ts（designed / requested の分類は stateMap 基準）
- 許可依存（design/static/dependencies.md）は変更しないこと。mod-state から mod-parse / mod-graph への辺は無い——ハッシュや縮退の計算結果は**パラメータとして渡す**（runCheck が stateKeys を受ける現行パターンと同じ）

## 要件

1. **StateEntry の拡張**（mod-state）: `hash?: string` を追加。reader は未知フィールドを落とさず読む。writer の出力順は `state, request, pr, hash`（spec §9 の例と同順）。`hash` の無いエントリは従来どおり有効（過去互換）
2. **要素本文ハッシュの計算**（決定的・共有ヘルパ）: 要素範囲（見出し要素 = 宣言行から同一ファイル内の次要素宣言の直前まで / 文書要素 = ファイル全体）のテキストの SHA-256 hex。正規化なし・完全一致（ADR-0018 補記 1 — 整形だけの変更でも乖離になる。fail-closed 側に倒す初期値）。範囲導出は findOwningElement と同じ帰属規則に従い、mark と check が**同一のヘルパ**を使うこと（規約差でハッシュが割れることを構造的に禁止する）
3. **mark implemented のハッシュ記録**: requested → implemented の遷移時、各要素の現物ハッシュを計算して `hash` に記録する。設計中に要素が解決できない場合（state エントリだけ残った削除要素等）は当該要素の `hash` を記録せず遷移は続行する（不整合の検出は C8 の責務。mark の原子性・冪等・exit code 規約は不変）。既に implemented の要素の no-op 時に `hash` を書き足さない（冪等 — spec integration.md §2）
4. **縮退判定（effective state）の一元化**: 「implemented かつ `hash` あり かつ 現物ハッシュ不一致 → designed 扱い」の判定を一箇所の純関数に置き、以下の全消費点がそれを使う。`hash` の無い implemented は判定対象外（従来どおり implemented 扱い）
5. **check の S1 警告**（通常モード）: 乖離要素ごとに warning 診断 `S1`（要素 ID・ファイル・宣言行つき、1 行 1 診断の書式は既存準拠）。**warning は exit code に影響しない**（S1 のみなら exit 0 — 縮退は機構が働いた状態であって閉包の違反ではない。ADR-0018 補記 3）。error 診断の exit 1 は従来どおり
6. **check --request の縮退適用**: R2 の状態判定を effective state で行う（乖離した implemented 要素は designed として被覆引用できる — 再実装の正規経路の再開通）
7. **status の縮退適用**: 乖離要素を Designed フロンティアに表示する（乖離由来であることが分かる注記つき。例: `ent-order (drift: 実装時記録から本文が乖離)`）。Requested フロンティアの扱いは不変
8. **coverage の縮退適用**: WRONG_STATE の状態判定を effective state で行う（乖離した implemented 要素は designed 扱いとして plan グループに束ねられ、requested へ遷移できる — ADR-0018 補記 3 の「再実装の正規経路が開く」を coverage まで通す）。requested への遷移でエントリが書き直されるとき、古い `hash` を引き継がない（hash は implemented の記録であり、次の mark で新しく付く）

## スコープ外

- ハッシュの正規化（空白・整形の緩和）— ノイズの実測を待って別決定（ADR-0018 補記 4）
- 既存 implemented エントリへの hash のバックフィル（次の再実装サイクルの mark で自然に付く — ADR-0018 補記 5）
- state.json スキーマのそれ以外の変更・format-version の増分（additive のみ）
- diff / trace 動詞
- spec-runner 側の受け口変更（mark の CLI 契約は不変）

## 受け入れ基準

- [ ] mark implemented 後の state.json に `hash`（64 桁 hex）が記録され、辞書順・1 要素 1 行・`state, request, pr, hash` 順の書式が保たれる（テスト）
- [ ] mark 後に要素本文を 1 文字変えると: check が `WARN S1 <id> ...` を出して **exit 0**（error なしの場合。テスト）
- [ ] 整形だけの変更（空白追加等）でも乖離になる（正規化なしの完全一致。テスト）
- [ ] 乖離要素が status の Designed フロンティアに注記つきで現れる（テスト）
- [ ] 乖離要素を被覆引用する request が check --request で exit 0（R2 の再開通。テスト）
- [ ] 乖離要素を含む plan グループが coverage を通過して requested に遷移し、新エントリに古い hash が残らない（テスト）
- [ ] `hash` の無い implemented エントリは S1 の対象にならず、R2 で従来どおり弾かれる（過去互換。テスト）
- [ ] mark の冪等 no-op（全件 implemented 済み）で state.json が変化しない（テスト）
- [ ] mark と check のハッシュが同一要素で一致する（共有ヘルパの等値テスト — 見出し要素・ファイル末尾要素・文書要素の 3 形）
- [ ] 既存テストが無変更で green（hash 無し運用の後方互換）
- [ ] aozu 自身の design/ の check 結果が不変（loop 無効 — S1 は state.json が無ければ発生しない）
- [ ] `bunx tsc --noEmit` && `bun test` が green

## architect 評価済みの設計判断

- **採用: 縮退は計算のみ・state.json は書き換えない** / 却下: check が state.json を designed に書き戻す — 書き手は coverage / mark の 2 動詞に閉じる（ADR-0018 の核。inv-tool-writes-state とも整合）
- **採用: ハッシュ・縮退の計算結果はパラメータで渡し、許可依存を変えない** / 却下: mod-state に parse / graph 依存を足す — runCheck が stateKeys を受ける現行パターンに従う。設計（dependencies.md）と実装の乖離を作らない
- **採用: S1 は warning・exit 0** / 却下: error — 縮退は違反ではなく機構の作動。歯はフロンティア非空と R2 再開通が担う（ADR-0018 補記 3 の明文）。この変更に伴い check の exit 判定を「error の有無」に精密化する（現状は診断の有無）
- **採用: 範囲導出は findOwningElement の帰属規則と同一** / 却下: 独自の範囲定義 — 帰属の導出が二箇所に割れると将来の要素種追加で不一致が入る
