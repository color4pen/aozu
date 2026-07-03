# aozu 自身の不変条件に決定的な歯を立てる

## Meta

- **type**: new-feature
- **slug**: invariant-teeth
- **base-branch**: main
- **adr**: false

## 背景

aozu の自己検証の歯は現在、依存構造（tests/architecture.test.ts が design/rules.json と src/ の import を突合）のみで、design/domain/invariants.md に宣言された不変条件 inv-* は機械検証されていない（docs/open-questions.md 論点 11 の第 3 層。adr/0007 の修正で明記したとおり、出口ゲートが捕まえるのは依存構造の乖離のみ）。不変条件のうち機械化できるものを grep ベースのテストに落とし、機械化できないものは除外理由を記録して「未機械化の検証残額」を可視化する。

## 現状コードの前提

- 不変条件の正本は design/domain/invariants.md の 5 本: inv-deterministic-verdict / inv-immutable-id / inv-tool-writes-state / inv-fail-closed-deps / inv-single-reference-grammar
- tests/architecture.test.ts は src/ の import 辺を rules.json と突合し、未マップファイルを違反とする（fail-closed）。inv-fail-closed-deps の歯はここに実在する
- state.json の書き込み API は src/ に存在しない（read 側のみ src/state/reader.ts）。現時点で inv-tool-writes-state 違反はゼロのはず
- `[[id]]` の参照抽出は src/parse/ が唯一の実装（extractReferences）。ただし文字列としての `[[` はテンプレート生成（src/cli/commands/init.ts / scaffold.ts）にも現れる — 「参照を**解釈**するコード」と「`[[id]]` テキストを**生成**するコード」の区別が要る
- src/ に subprocess 実行（Bun.spawn / child_process 等)・ネットワーク呼び出し（fetch）は現在存在しないはず（書く直前に grep で再確認すること）。なお並行する request（plan-and-derive）が mod-cli にテンプレート取得のためのコマンド実行を追加する予定があるため、subprocess の禁止域に mod-cli を含めてはならない

## 要件

1. `tests/invariants.test.ts` を新設し、5 本の不変条件それぞれについて「決定的テスト」「既存の歯で担保済み」「機械化不能（理由）」のいずれかを冒頭の対応表（コメント）で宣言する。全 inv が表に現れること（漏れの禁止）
2. **inv-tool-writes-state の歯**: ファイル書き込み API（Bun.write / fs の write 系）と文字列 `state.json` が同一ソースファイルに共起するのは `src/state/` 配下のみ、とする grep テスト。src/ の非テストファイル全走査
3. **inv-single-reference-grammar の歯**: `[[...]]` 参照を解釈する正規表現（`\[\[` を含む regex リテラルまたは RegExp 構築）が現れるのは `src/parse/` 配下のみ、とする grep テスト。`[[id]]` テキストの生成（テンプレート文字列への埋め込み）は違反としない
4. **inv-deterministic-verdict の歯**: 合否を所有するモジュール（`src/check/` / `src/export/` / `src/state/` / `src/plan/` が存在すれば含める）に subprocess 実行（Bun.spawn / spawnSync / child_process / `$`）とネットワーク（fetch）が現れない、とする grep テスト。mod-cli / mod-prompt は禁止域に**含めない**（composition root のテンプレート取得を許すため）
5. **inv-fail-closed-deps**: 新テストは追加せず、対応表で tests/architecture.test.ts（未マップ = 違反・許可リスト方式）が歯であることを明記する
6. **inv-immutable-id**: 機械化不能として記録する（改名 = 削除 + 新規の意味論は diff 実装（mod-diff）が立つまで観測点が無い。mod-diff 実装時に再訪、と対応表に書く）
7. 各 grep テストに**違反を仕込んだ fixture による検出実証**を付ける（fixture 文字列をテスト内に置き、検出関数がそれを違反と判定することを固定する。実ソースツリーへの違反ファイル追加はしない）

## スコープ外

- 不変条件の追加・変更（design/domain/invariants.md は読み取りのみ）
- tests/architecture.test.ts の変更
- mod-diff の実装
- lint 導入や AST 解析（行指向の grep で足りる範囲に留める）

## 受け入れ基準

- [ ] tests/invariants.test.ts の対応表に design/domain/invariants.md の全 5 inv が現れることをテスト自身が検証する（invariants.md をパースして ID 集合を突合し、宣言漏れで fail する）
- [ ] 要件 2〜4 の各 grep テストが、違反を仕込んだ fixture 文字列を検出することをテストで固定する
- [ ] 要件 2〜4 の各 grep テストが現在の src/ に対して green であることを固定する
- [ ] 本リポジトリで `check` exit 0・`export rules --verify` exit 0 のまま / 既存 336 テスト無変更で green / dependencies 空 / `tsc --noEmit && bun test` green

## architect 評価済みの設計判断

- grep ベース（行指向）で立てる。却下した代替: AST 解析（TypeScript compiler API）— 検出精度は上がるが依存極小の方針に対し過剰で、実装パイプラインプロジェクトの core-invariants と同じ grep パターンで十分な検出力がある
- 対応表を invariants.md との突合で機械検証する。却下した代替: コメントのみの対応表 — inv が増えたときに表の更新漏れが検出されず、「全量が表に現れる」保証が腐る
- subprocess 禁止域を合否所有モジュールに限定する。却下した代替: src/ 全域禁止 — 並行 request が mod-cli に追加するテンプレート取得（コマンド実行）と衝突する。合否の決定性（inv の本文）が守るべき範囲は verdict を出すモジュールである
- fixture は文字列内蔵とする。却下した代替: 違反ファイルを一時生成 — テストの独立性・並列実行の安全性が下がる
