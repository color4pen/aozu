# 参照グラフと閉包検証（C1〜C11）を実装する

## Meta

- **type**: new-feature
- **slug**: graph-and-check
- **base-branch**: main
- **adr**: false

## 背景

R1（#1 merge 済み）で strict プロファイルパーサが確立した。次は aozu の中核である閉包検証を実装する。`design/static/modules.md` の [[mod-graph]]（参照グラフ）と [[mod-check]]（閉包検証）に相当する。CLI 結線は次 request で行うため、本 request は純粋なロジック層までとする。

## 現状コードの前提

- `src/parse/`（parser.ts:1 ほか）が要素・参照・依存辺・構造化行・構文診断を抽出する。`src/parse/types.ts:1` にデータ型がある
- `src/fs/reader.ts:1` がファイル読み込みの薄い層
- `design/` に 25 要素の自己記述があり、`src/parse/integration.test.ts:14` が抽出数を回帰固定している
- `tools/check.sh:1` は C1〜C5 と C11（domain のみ）の暫定 bash 実装
- 閉包規則の正本は `spec/format.md` §10 の C1〜C11 表。診断形式は `spec/integration.md` §1

## 要件

1. 参照グラフを `src/graph/` に実装する: parse 結果から要素表（ID → 要素）と参照辺の集合を構築し、ID 解決を提供する
2. 閉包検証を `src/check/` に実装する: `spec/format.md` §10 の C1〜C11 を評価し、位置つき診断の配列を返す
3. manifest 読み込み: `design/manifest.md` の frontmatter `enabled` リストを解釈する。型の前提関係（loop は static 前提、screen は use-case 前提 等）はコード内の宣言的な表として定義し、C7 で検証する
4. **段階縮退**: 無効な型の義務は評価しない（例: `enabled: static` のみなら domain / dynamic / loop の規則は skip）。C8・C9・C10 は loop 有効時のみ評価する
5. **C6（ビューのリンク義務）**: ビュー型のスキーマは仕様上未追補のため、`enabled` にビュー型が含まれる場合は「unsupported view type」の診断を出す（fail-closed）。ビュー型が無ければ C6 は自明に成立
6. 診断は `spec/integration.md` §1 の形式（`<LEVEL> <CODE> <id> <message>`）へ整形できる構造体とする（stdout / exit code の結線は次 request）
7. 判定系は純関数とする: 入力は parse 結果 + manifest、出力は診断配列。ファイル I/O を持たない

## スコープ外

- CLI コマンド結線（`check` / `check --request` / exit code。次 request）
- rules export / diff / state.json / prompt / plan
- ビュー型スキーマの定義（仕様側の未決）

## 受け入れ基準

- [ ] `design/` に対する評価が違反ゼロであることをテストで固定する（`tools/check.sh` と同判定）
- [ ] C1〜C11 の各規則について、違反を含む fixture で検出されることをテストで固定する（規則ごとに最低 1 つの陽性テスト）
- [ ] 段階縮退のテスト: `enabled: static` のみの fixture で domain / dynamic / loop の義務が評価されないことを固定する
- [ ] `enabled` にビュー型を含む fixture で「unsupported view type」診断が出ることを固定する
- [ ] `package.json` の dependencies が空のまま（既存 TC-013 が green のまま）
- [ ] `tsc --noEmit && bun test` が green（既存テスト無変更で green）

## architect 評価済みの設計判断

- 規則評価は診断を集約して返し、最初の違反で打ち切らない（R1 のパーサと同方針。check の UX は一括報告）。却下した代替: fail-fast — 複数違反の修正往復が増える
- 型の前提関係・層間参照方向（C11）はコード内の宣言的テーブルとして持つ。却下した代替: manifest でユーザー定義可能にする — ADR-0002 のとおり型はツールの知識であり、設定可能にすると閉包の意味が repo ごとに揺れる
- C6 の fail-closed（未対応ビュー型は診断）。却下した代替: 無言 skip — 「有効化したのに検証されない」は closure の嘘になる
