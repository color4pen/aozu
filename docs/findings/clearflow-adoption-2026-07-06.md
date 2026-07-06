# clearflow brownfield 導入 findings — 2026-07-06

- 対象: /Users/seki/Documents/GitHub/clearflow（受託開発向け案件管理 SaaS。docs/design/ に既存設計資産、spec-runner 運用）
- 実施: docs/adoption.md Step 0〜3。Step 4（ビュー）はビュー型機構が本体未実装のため未実施（ADR-0022。permission が最初の候補で、clearflow は named consumer = `src/domain/authorization.ts` との突合テストを提供できる）
- 前提: 2026-07-02 のドッグフーディング（docs/findings/clearflow-2026-07-02.md）による一括転写物が design/ に既存
- 結果: Step ごとに 1 PR（計 3 PR）。check exit 0（76 要素）、architecture test green、入口ゲート E2E 4 ケース確認（実在引用 pass / 未知要素 fail / 引用なし spec-change fail / bugfix pass）

各件、「adoption.md / 仕様のどの箇所か / 何が起きたか / 所感」を記す。重要度順。

## 1. 【実証】fail-closed の歯は導入初日に実在の漏れを検出した

- **箇所**: adoption.md Step 1、ADR-0007（機械強制できるのは順序ではなく整合）
- **起きたこと**: ドッグフーディング転写の static/dependencies.md は「実際の import 方向をコードから確認して列挙する」と明記して書かれたものだが、architecture test を結線した瞬間に未マップ実装ファイル 6 件（layout/page・instrumentation・proxy・seed/reset）と未列挙の実在依存 3 本（mod-auth → mod-db / mod-repo、mod-webhook → mod-db）が検出された。是正の過程で mod 2 件（リクエストプロキシ・開発スクリプト）が新設され、モジュール構成の記述が実装に対して完全になった。
- **所感**: 「コードを見て列挙した」人手の静的構造記述は漏れる、が実測で示された。書き起こしと歯の結線を同一 PR に載せる Step 1 の設計（結線されるまで正本は拘束力を持たない）は正しい。

## 2. 【重要】既存転写物がある brownfield の経路が手順に無い

- **箇所**: adoption.md 三原則（一括転写はドッグフーディングのみ正当）、dogfooding-runbook.md
- **起きたこと**: clearflow にはドッグフーディング由来の一括転写物（74 要素）が既にあった。手順どおり「Step 3 で需要駆動に書き起こす」と転写済み素材を捨てることになり、かといって全量 enabled のまま導入すると「書き起こしだけの PR」アンチパターンになる。実際には「転写物をファイルとして全量保持し、manifest の enabled を最小（static）に絞ってから、読む機械の結線とともに型ごとに解禁する」運用で矛盾なく回った。
- **所感**: ドッグフーディング → 導入 という順序はツール検証の標準経路なので、adoption.md に「転写物が既にある場合: enabled を絞って素材化し、型ごとに解禁する」の節があるとよい。

## 3. 【重要】無効型の引用解決が導入順の自由度を生んだ — 仕様上の意図なら明文化したい

- **箇所**: spec/format.md の段階縮退（既知だが無効な型）、integration.md §1
- **起きたこと**: manifest が static のみの段階で、`check --request` は domain 要素（ent 等）の引用を実在として解決した（既知だが無効な型の要素も引用の解決対象になる）。このおかげで Step 2（入口ゲート結線）を Step 3（domain / dynamic 有効化）より先に完了でき、「ゲートが先・正本化が後」という安全な導入順が成立した。
- **所感**: これが仕様の意図なら「無効型の要素も引用解決の対象である」と明文化する価値がある。将来「無効型の引用は error」に変えると、この導入順（adoption.md Step 2 → Step 3）が壊れる。

## 4. 【中】原則 3 の「該当箇所」は節単位より細かいことがある

- **箇所**: adoption.md 原則 3（正本は型ごとに移る・該当箇所はポインタ化）、Step 0 の資産マップ（文書（節）ごとに型対応を列挙）
- **起きたこと**: clearflow のユビキタス言語辞書は、同一の表の中に「意味・定義（domain の事実 → design/ へ移管）」と「日本語表記 ⇔ コード識別子の対応・命名規約・表記規約（形式に載らない事実 → 既存文書が正本のまま）」が混在していた。ポインタ化は節単位ではなく**表の列単位の分解**になった（意味の列を落として識別子の列を残す）。
- **所感**: 資産マップの粒度「文書（節）ごと」では足りない場面がある。「同一の節に複数の型（または形式外の事実）が混在する場合は事実単位で分解する」と Step 0 に一言あると迷わない。

## 5. 【中】受け入れ基準「CI 上で green」は実行環境に依存する

- **箇所**: adoption.md Step 1 受け入れ基準（architecture test green（CI 上））
- **起きたこと**: clearflow は GitHub Actions を持たない。merge に至る経路上で必ず実行される場所は spec-runner の verification（bun test）だったため、architecture test はテストスイート（`src/__tests__/static/architecture.test.ts`）として結線した。
- **所感**: 「CI」を「変更が merge に至る経路上で必ず実行される場所」と読み替えて成立した。adoption.md の表現をそう改めると実行環境非依存になる。

## 6. 【小】文書に要素数を書くと即座に drift する

- **箇所**: Step 0 の資産マップ
- **起きたこと**: 資産マップに「74 要素」と書いた直後、Step 1 の是正で mod が 2 件増えて 76 になり、書いた数が同一導入作業の中で古くなった。
- **所感**: 要素数は `status` で都度取得できるので、文書には書かないか「時点付き」でのみ書くのがよい。

## 7. 【小】mark implemented hook は loop 無効でも安全に縮退した

- **箇所**: integration.md §2（loop 層が無効な design でも exit 1）
- **起きたこと**: designLayer 有効 + loop 無効の組み合わせで、archive 時の `mark implemented` は exit 1 → 呼び出し側（spec-runner）が「aozu の状態管理下にない」として warn + 続行する想定どおりの縮退を確認（コード読解による確認。実 archive はまだ）。
- **所感**: 導入途中（ゲートだけ有効・loop 未有効）の状態でパイプラインが壊れないのは、段階導入の成立に効いている。

## 8. 【参考・呼び出し側】spec-runner doctor が designLayer を読まない false negative

- **箇所**: integration.md §5（推奨結線）の周辺。問題自体は spec-runner 側
- **起きたこと**: `specrunner doctor` の aozu-cli チェックが、プロジェクトローカル config（.specrunner/config.json）を読まず常に「disabled」と誤表示し、aozu CLI の presence 検証が効かない（doctor が repoRoot なしで config をロードするため）。ゲート本体は正しくロードするので実害なし。
- **所感**: spec-runner 側へ issue として報告する。交換面契約としては、doctor 相当の「結線の事前検証」を呼び出し側が持つ場合の検証項目（command の presence・design/ の存在）を integration.md に一行示唆してもよい。
