# ADR-0011: 薄い one-shot runner — agent は動くが管理しない

- Status: accepted（ADR-0001 の「agent 実行ループを内蔵しない」を修正する）
- Date: 2026-07-02

## Context

ADR-0001 は agent 実行機構の再開発（実装パイプライン・汎用 workflow ツールとの三重実装）を避けるため、プロンプト出力までを責務としていた。しかしこの線引きは実行機構の重さを区別していない:

- **重い機構**: queue、worktree 隔離、resume、リトライ/レビューループ、provider adapter・SDK 統合。オーケストレーション状態を所有する
- **軽い機構**: 設定されたコマンドにプロンプトを渡して完了を待つだけの同期一発呼び出し。状態を所有しない

プロンプト出力のみでは、日常動詞（propagate / derive / review）のたびに人手の貼り付け往復が発生し、CLI としての UX が成立しない。軽い機構まで拒否するのは過剰防衛であり、三重実装の懸念は重い機構にのみ適用されるべきである。

## Decision

- プロンプト動詞（`propagate` / `review` / `derive` / `session`）は既定で **runner を起動**する。runner は設定ファイルのコマンドテンプレートであり、provider 固有の知識を持たない（任意の agent CLI を指定できる）
- **合否は常に決定的ゲート**（`check` / `coverage`）が出す。sd は agent の出力テキストを解釈せず、verdict を導出しない。agent の成果物はファイル編集であり、その整合を機械が検証する
- **オーケストレーション状態を持たない**: 同期一発実行、自動リトライなし、queue なし、worktree 管理なし、resume なし。ゲート不合格は報告して人に返す
- `--print` でプロンプトのみを stdout に出すモードを維持する（attended セッションでの知識注入、workflow ツールからの利用、他ツール連携はこれを使う）
- `session` は対話モードの runner を初期プロンプト注入付きで起動する

一言で: **agent は sd の中で動くが、sd は agent を管理しない。**

## Consequences

- sd 単体で「propagate → check」の一巡が完結し、動詞型 CLI の日常 UX が成立する
- 決定的コアの純粋性は保たれる。runner は殻であり、CI・テストは check / coverage のみに依存する
- リトライループ・並列実行・worktree 隔離が欲しくなったら、それは workflow ツールまたは実装パイプラインの領分であり sd に足さない。これが再開発ガードの線となる
- agent 出力の意味解釈（findings パース等）を構造的に持たないため、パース健全性の問題が発生しない
- runner はユーザーのシェル環境でユーザー設定のコマンドを起動するだけであり、sd が credential を保持・伝搬する立場に立たない
