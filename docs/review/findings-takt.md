# 敵対的整合レビュー findings（takt / 2026-07-02）

対象: `adr/` 全件、`spec/` 全件、`docs/open-questions.md`、`README.md`（照合先としてリポジトリ全ファイル）

## 1. coverage の被覆母集合が ADR 間で食い違う

- **主張**: coverage の合格条件の母集合が「plan の全要素」（ADR-0005）と「全 designed 要素」（ADR-0006）で食い違っており、同一入力で合否が分かれる。
- **根拠引用**: adr/0005-element-state-machine.md「`coverage` 合格（plan の全要素が request 草稿に被覆） → `requested`（request slug を記録）」
- **矛盾引用または反例**: adr/0006-input-ladder.md「`coverage` が機械検証する: 全 designed 要素の被覆、引用 ID の実在、依存辺と並列指定の矛盾」。反例: designed 要素が 10 個あり、人が plan で 3 個だけ束ねて（ADR-0006 は「人が統合・分割・順序・並列可否を編集する」を認める）derive し、草稿が 3 要素を全引用した場合 — ADR-0005 の定義では合格して 3 要素が requested に遷移するが、ADR-0006 の定義では 7 要素が未被覆で不合格。さらに ADR-0005 の status フロンティア 2「designed のままの要素（起票待ち = 設計負債）」は未起票 designed の常在を前提としており、「全 designed 要素の被覆」を合格条件にするとこのフロンティアの常在と coverage 合格が両立しない。
- **深刻度**: high

## 2. README の一周の流れでは coverage が検査対象（request 草稿）より先に来る

- **主張**: README の一周の流れは coverage を request 生成の前に置くが、決定済みの coverage 定義は request 草稿を検査対象とするため、この順序では検査対象が存在しない。
- **根拠引用**: README.md「→ plan（人が request への束ね方を決める）→ coverage（機械検証）→ request 生成 → 実装パイプラインへ」
- **矛盾引用または反例**: adr/0005-element-state-machine.md「`coverage` 合格（plan の全要素が request 草稿に被覆）」、adr/0012-consumer-agnostic-derive.md「`coverage` は草稿中の `[[id]]` 引用のみを検査する（形式仕様 §6 の一文法）」。草稿は README の流れでは coverage の後の「request 生成」で初めて生じる。
- **深刻度**: medium

## 3. designed への戻り遷移を実行する動詞・結線がどの記録にも存在しない

- **主張**: 「設計 delta の merge → designed」の状態遷移は「自動」と決定されているが、それを実行する動詞も呼び出し側の結線も定義されていない。
- **根拠引用**: adr/0005-element-state-machine.md「状態遷移は**自動**とし、人の規律に依存させない」「設計 delta の merge → 対象要素が `designed` に（新規または戻り）」、spec/format.md §9「**人は編集しない**。coverage / mark / 設計 delta の merge がツール経由で書く」
- **矛盾引用または反例**: adr/0008-verb-cli.md の動詞表（init / scaffold / check / status / diff / trace / prompt 4 種 / plan / coverage / check --request / export rules / mark implemented）に merge 時に designed を書く動詞が無く、spec/integration.md §5 の推奨結線「request 検証 step で §1、取り込み完了 hook で §2、CI で `check` + §3 `--verify`」にも設計 delta merge 時の結線が無い。反例: implemented 状態の要素を再設計する delta が merge されたとき、state.json の当該エントリを designed に書き戻す手段が記録上存在しない（新規要素は「エントリが無い要素は designed とみなす」で自動だが、戻りは既存エントリの書き換えを要する）。ADR-0005 Context が目的に挙げる「実装済みだが再設計中」の判別が成立しない。
- **深刻度**: medium

## 4. C5 の縮退 skip 意味論が仕様に無く、ADR-0015 は存在しない規定を引用している

- **主張**: ADR-0015 は「C3 / C5 の無効型 skip」を既定の意味論として引用するが、spec の C5 には skip 規定が無く、skip 後に登場要素が空になるケースも未定義。
- **根拠引用**: adr/0015-actor-as-core-type.md「domain 層を有効化しないプロジェクト（段階① + dynamic）では act は使えないが、段階縮退（C3 / C5 の無効型 skip）により無害」
- **矛盾引用または反例**: spec/format.md C5「seq の登場要素リストが空でなく、すべて mod または act に解決される」には縮退時の扱いの記載が無い。同仕様は C4 には「**C3 の縮退スキップの対象外**」と明示しており、明示の欠落は省略ではなく未定義を意味する。反例: `enabled: static, dynamic`（domain 無効）で登場要素が `[[act-approver]]` のみの seq — act 参照を skip すると残りは空リストとなり「空でなく」に違反するか否かが判定できず、skip しないなら ADR-0015 の「無害」が成立しない。
- **深刻度**: medium

## 5. C7 が参照する「型の前提関係」の全体がどこにも列挙されていない

- **主張**: 閉包規則 C7 は「型の前提関係を満たす」ことを検証するが、その前提関係は例示 2 件を除きどの記録にも列挙されておらず、enabled 組み合わせの合法性が仕様から判定できない。
- **根拠引用**: spec/format.md §3「型の前提関係（例: screen は use-case が前提、loop は static が前提）はツールが知っており、check が組み合わせの不正を検出する」、同 C7「manifest の enabled 組み合わせが型の前提関係を満たす」
- **矛盾引用または反例**: 反例: `enabled: static, use-case` — C6 は「uc→seq」のリンク義務を課すが dynamic が無効であり、C3 の skip を適用すれば uc の義務は常に空洞化する。この組み合わせを C7 が不正とするかは仕様から判定できない。ADR-0015 が前提にする「段階① + dynamic」（domain 無しの dynamic）の合法性も同様に判定不能。adr/0010-adoption-gradient.md の段階梯子は「有効化の段階の目安」であり合法な組み合わせの定義ではない。
- **深刻度**: medium

## 6. C3 の「無効な型」が未定義で、未知 prefix（typo）が無診断で通過する読みが成立する

- **主張**: C3 の縮退 skip が対象とする「無効な型」の定義が無く、未知 prefix への参照が診断されずに通過する fail-open の読みと C1 違反になる読みの両方が成立する。
- **根拠引用**: spec/format.md C3「ただし**参照元・参照先のどちらか**の型が無効な参照は評価しない（無効な型の義務は評価しない、の一貫適用）」、§4 の文法「id = prefix "-" slug」は prefix の生成規則を持たない
- **矛盾引用または反例**: 反例: 本文中の `[[emt-order]]`（`ent` の typo）。§4 の型プレフィクス表を文法の一部と読めば C1 違反で捕まるが、文法を字形のみと読めば emt は「無効な型」として C3 が評価をスキップし、typo が無診断で通過する。後者の読みは同仕様 §8「列挙されない依存はすべて禁止（fail-closed）」および spec/integration.md §3「（fail-closed）」が示す fail-closed 方針と両立しない。機械実行される閉包規則が二読みを許す。
- **深刻度**: medium

## 7. ADR-0007「bug-fix と偽って構造を変えても出口ゲートが捕まえる」は過大主張

- **主張**: 出口ゲートはモジュール間の依存構造のみを検査するため、依存構造を変えない構造変更は bug-fix 偽装で両ゲートを素通りでき、「捕まえる」の断定は成立しない。
- **根拠引用**: adr/0007-gates.md「入口の型は自己申告でよい。bug-fix と偽って構造を変えても出口ゲートが fail-closed で捕まえるため、入口に分類判定の賢さを持たせない」
- **矛盾引用または反例**: 出口ゲートの定義は同 ADR で「静的構造の許可依存から `export rules` で中立な ruleset（JSON）を生成し、実装リポジトリの architecture test が消費する。設計と実装の依存構造が乖離したら CI が赤くなり merge できない」。反例: bug-fix 型と自己申告した request が、既存モジュールの `実装:` ディレクトリ内部で新しい業務ルール（承認フローの遷移条件変更、新規ユースケース関数の追加等）を実装する — モジュール集合・許可依存・パス配置のいずれも変わらないため ruleset は不変で architecture test は緑、入口は bug-fix 免除（引用不要）であり、両ゲートを素通りする構造変更が成立する。adr/0013-escalation-triage.md 自身も「文書の意味論の乖離は捕まえられないため、レビュー時の観点として残る」と限界を明記しており、ADR-0007 の断定と食い違う。
- **深刻度**: medium

## 8. status の「縮退集合では要約表示に退化して意味を保つ」の中身がどの記録にも無い

- **主張**: status の定義する表示内容はすべて loop 由来であり、段階①〜②で status が何を表示して「意味を保つ」のかがどの記録にも定義されていない。
- **根拠引用**: adr/0010-adoption-gradient.md「status は縮退集合では要約表示に退化して意味を保つが、**loop 前提の動詞（plan / coverage / derive / mark）は段階③で初めて有効**であり、それ未満の段階では明示的なエラーで案内する（縮退して動くふりをしない）」
- **矛盾引用または反例**: adr/0008-verb-cli.md の status 定義「open topic / designed 要素 / requested 要素のフロンティア表示」の 3 フロンティアはすべて topics/（loop）と state.json（loop）に由来する。spec/format.md §2「最小プロファイル（ADR-0010 段階①）は `manifest.md` + `static/` のみ」では state.json も topics/ も存在せず、表示すべき内容の定義が無い。定義の無い表示で「意味を保つ」ことは、同じ文の「縮退して動くふりをしない」と整合しない。
- **深刻度**: medium

## 9. plan の「永続する記録」と ADR-0004「過去形の記録は ADR のみ」および C10 が両立しない

- **主張**: plan を永続する記録とする決定は、「過去形の記録は ADR のみが積層する」という決定、および derived 済み plan にも無差別に適用される C10 と両立しない。
- **根拠引用**: adr/0006-input-ladder.md「plan は永続する横断アーティファクトとし、『なぜこの束で切ったか』の記録を兼ねる」
- **矛盾引用または反例**: adr/0004-living-docs-computed-delta.md「過去形の記録は **ADR のみが積層**する」。反例: `status: derived` の plan が `[[ent-x]]` を elements に持ち、後の再設計で ent-x が削除されると、spec/format.md C10「plan の elements がすべて実在し、after の grp が実在する」が恒久的に fail する。記録として不変に保てば check が永遠に赤く、check を通すには過去の記録を書き換えるしかない。state.json には同型の問題への明示規定（C8「削除要素の残骸検出」）があるが、plan には無い。
- **深刻度**: medium

## 10. README のステータス節がリポジトリの実態と他記録の双方に反する

- **主張**: README の「コードはまだない」「次は業務システムでの粒度検証と、実装着手の判断」は、リポジトリに存在する実装と open-questions の完了記録の双方と矛盾する。
- **根拠引用**: README.md「設計段階。コードはまだない。形式仕様 v0 は自己記述ドッグフードで検証済み。次は業務システムでの粒度検証と、実装着手の判断。」
- **矛盾引用または反例**: リポジトリには実装が存在する（src/cli/main.ts、src/check/checker.ts、src/export/generator.ts、src/cli/commands/{check,check-request,export,init,scaffold,status}、tests/architecture.test.ts。package.json は `"bin": { "aozu": "./src/cli/main.ts" }` を宣言）。また docs/open-questions.md §9 は業務 SaaS 対象を「**書き起こしは完了**（2026-07-02、経緯ゼロの別 agent が実施）: 69 要素・check exit 0」とし、残タスクを「実装パイプラインプロジェクトでの段階①検証と、loop 動詞実装後のフルループ一周検証」としており、「次は業務システムでの粒度検証」「実装着手の判断」はいずれも既に過ぎた状態を指す。
- **深刻度**: medium

## 11. 入口ゲート検証 (b) の規則文と括弧書きが異なる合否を与える

- **主張**: `check --request` の検証 (b) は、規則文の読み（全引用が designed|requested）と括弧書きの読み（implemented のみの request が不合格）で、混在引用の request に対する合否が分かれる。
- **根拠引用**: spec/integration.md §1「(b) 引用要素の状態が designed または requested である（implemented のみを引用する request は設計 delta を経ていない疑い）」
- **矛盾引用または反例**: 反例: 変更対象 `[[ent-order]]`（designed）と文脈参照 `[[mod-billing]]`（implemented）を併記する request — 規則文では implemented の引用を含むため不合格、括弧書きでは「implemented **のみ**」ではないため合格。入口ゲートは exit code で機械消費される契約（同 §1「0 = 合格 / 1 = 不合格」）であり、二読みは実装の分岐になる。
- **深刻度**: medium

## 12. mark implemented の冪等条項と「該当 0 件は exit 1」条項が再実行時に衝突する

- **主張**: hook 再実行（全要素遷移済み）のとき、冪等条項は exit 0 を、「該当要素が 0 件（未知の slug）は exit 1」の字義は exit 1 を与え、契約が自己矛盾する。
- **根拠引用**: spec/integration.md §2「**冪等**: 既に implemented の要素は no-op。再実行しても結果が変わらない」「**exit code**: 0 = 遷移完了（no-op 含む）」
- **矛盾引用または反例**: 同節「state.json 中で `request` が `<slug>` に一致する requested 要素をすべて implemented に遷移し」「該当要素が 0 件（未知の slug）は exit 1 と診断」。反例: slug X の全要素が implemented 済みの状態で hook が再実行されると、「`request` が X に一致する **requested** 要素」は 0 件であり、字義どおりなら既知の slug に対して「未知の slug」として exit 1 になる — 冪等条項と両立しない。「該当」が state を問わない request 一致を指すのか requested のみを指すのかが未定義。
- **深刻度**: medium

## 13. ビュー 9 種の能力一括追補計画のうち 6 種に読む機械の名指しが無い

- **主張**: 「全 9 種を揃える・残りを一括追補」という能力計画は、同じ段落が掲げる消費者駆動原理および spec §12 の証拠駆動トリガと矛盾し、6 種は読む機械が名指しされていない。
- **根拠引用**: docs/open-questions.md §2「ツールの**能力**としては最終的に全 9 種（uc / scr / api / dat / flow / evt / ext / perm / dpl）を揃える。順序は、機構（宣言構文・リンク義務・scaffold・C6 結線）を最初の型で検証 → 残りを一括追補」
- **矛盾引用または反例**: 同段落「ビューの記述・移行は『そのビューを読む機械（または強制力）』が特定できるときのみ実用であり（ADR-0004 の適用）、消費者不在の移行はセレモニーである。例: permission の消費者候補 = 認可整合テスト…、use-case = derive の引用の的、screen = 現時点で消費者未特定（人間向け文書のままが正解）」。読む機械が名指しされているのは perm と uc のみで、scr は「人間向け文書のままが正解」と自認したまま追補対象に残り、api / dat / flow / evt / ext / dpl の 6 種はどの記録にも読む機械の名指しが無い。さらに「残りを一括追補」は spec/format.md §12「ビュー型それぞれのスキーマ詳細（有効化する実プロジェクトが現れた時点で追補）」の型ごと・需要駆動のトリガと食い違う。
- **深刻度**: medium

## 14. パイプライン起点 topic の「機械的に排出される」に排出主体・契約・受け口が無い

- **主張**: パイプライン起点 topic の機械排出は 2 つの ADR で決定・参照されているが、交換面契約にもパイプライン側受け口の起票予定にも対応する項目が無い。
- **根拠引用**: adr/0006-input-ladder.md「**パイプライン起点**（実装工程で出た設計レベルの摩擦 — レビューの構造指摘・スコープ外 finding 等 — が機械的に排出される）」、adr/0013-escalation-triage.md「本ツールのループが適用される環境では、これはパイプライン起点 topic（ADR-0006）として機械排出される事象に相当する」
- **矛盾引用または反例**: spec/integration.md の契約は §1 `check --request` / §2 `mark implemented` / §3 `export rules` / §4 derive 前提 / §5 共通規約のみで topic 排出の契約が無く、docs/open-questions.md §5 の実装パイプライン側受け口一覧「request 検証からの `check --request` 呼び出し / 取り込み完了時の `mark implemented` hook / request テンプレートへの設計要素引用欄の追加」にも topic 排出が含まれない。排出の実行主体はパイプライン側だが、その変更予定のどこにも現れない。
- **深刻度**: medium

## 15. topic の status: open → addressed を書く主体がどの記録にも無い

- **主張**: topic の status 遷移（open → addressed）を実行する動詞・hook が定義されておらず、人手の frontmatter 編集に頼るなら記録済みの反規律原則と衝突する。
- **根拠引用**: adr/0006-input-ladder.md「frontmatter に `status: open → addressed`」、spec/format.md §8「`status: open | addressed`」
- **矛盾引用または反例**: adr/0008-verb-cli.md の動詞表に topic を書き換える動詞が無く、閉包規則にも addressed への遷移を強制する規則が無い。adr/0007-gates.md は「規律を文化・習慣で守らせるのは、『判断場面を消す』という原則の真逆であり、破られる」を原則として記録しており、人手の消し込みに頼る運用はこれと矛盾する。反例: topic を引用する ADR が merge されても（C9 は引用のみ検証）status は open のまま残り、adr/0006 Consequences「status が open topic を常時可視化する」の可視化が処理済み topic で汚染される。
- **深刻度**: low

## 16. 「決定済み」を称する方針が ADR 化されず open-questions にのみ存在する

- **主張**: バージョニング・リリース方針は「方針決定済み」とされながら対応する ADR が無く、「決定の正本は ADR」および open-questions 自身の運用規約と矛盾する。
- **根拠引用**: docs/open-questions.md 冒頭「決定済み事項は adr/ を参照。ここは詰め残しの一覧。解決したら ADR 化または形式仕様へ反映して消す」、同 §7「方針決定済み（二軸分離）: **ツール本体**: semver + release-please + conventional commits + npm publish…」
- **矛盾引用または反例**: adr/ の 0001〜0015 にバージョニング・リリース方針を主題とする ADR は存在しない（各 ADR の主題は位置づけ / 成果物 / 文法 / living docs / 状態機械 / 入力階段 / ゲート / 動詞 / 技術選定 / 段階性 / 導出 / エスカレーション / 所有権 / アクター）。adr/0006-input-ladder.md「（意図を書いてよい。ただし提案であって決定ではなく、決定の正本は ADR）」に照らすと、決定済みを称する事項の正本が「詰め残しの一覧」にのみ存在する。
- **深刻度**: low

## 17. C8 と ID 不変規則により、要素削除でトレースが途切れる

- **主張**: 「トレースが途切れない」という帰結は、削除要素の state.json エントリ削除を強制する C8 の下では要素の削除・ID 変更で成立しなくなる。
- **根拠引用**: adr/0006-input-ladder.md「トレースが topic → ADR → 要素 → request → PR で途切れない」
- **矛盾引用または反例**: spec/format.md C8「state.json の全キーが実在要素（削除要素の残骸検出）」、同 §4「ID を変えることは要素の削除 + 新規作成を意味する」。反例: implemented の要素（state.json に request slug と PR 番号を保持）を機能廃止で削除すると、C8 を満たすにはエントリごと削除するしかなく、当該要素の要素→request→PR 対応が消失する。改名を ID 変更で行った場合も同様に旧 ID のトレースが失われる。
- **深刻度**: low

## 18. state.json は「人は編集しない」が、衝突解消は「人が裁く」

- **主張**: state.json の編集禁止と、git 衝突を人が裁くという規定が同一節内で両立せず、裁定を仲介する動詞も存在しない。
- **根拠引用**: spec/format.md §9「**人は編集しない**。coverage / mark / 設計 delta の merge がツール経由で書く」
- **矛盾引用または反例**: 同節「同一要素への並行更新は git の衝突として表面化させ、機械的な後勝ち解決を行わない（同一要素の並行変更は設計上の真の衝突であり、人が裁く）」。git 衝突の解消は conflict marker を含む state.json を人が直接編集する行為そのものであり、裁定を仲介する動詞は adr/0008-verb-cli.md の動詞表に存在しない。
- **深刻度**: low

## 19. 「トレースはすべて [[id]] 文法に還元される」は request / PR 区間で成立しない

- **主張**: トレースの要素↔request↔PR 区間は state.json の JSON フィールドで表現され、`[[id]]` の一文法には還元されない。
- **根拠引用**: adr/0003-id-reference-grammar.md「参照は **`[[id]]` の一文法のみ**。リンク義務の検証・差分・トレースはすべてこの文法に還元される」
- **矛盾引用または反例**: adr/0008-verb-cli.md「`trace <id>` | 要素 ↔ topic / ADR / request / PR の対応表示」、spec/format.md §9 の例 `"mod-cli": { "state": "implemented", "request": "cli-split", "pr": 123 }`。request slug と PR 番号は `[[id]]` 文法の外（JSON フィールド）にあり、trace の少なくとも request / PR 区間は一文法に還元されない。
- **深刻度**: low

## 20. plan の `request:` 行を記録する主体が未定義（プロンプト動詞は書き込まない）

- **主張**: plan スキーマの `request:` 行は「derive 後にツールが記録」とされるが、derive はプロンプト動詞で書き込みを行わず、他に plan ファイルへ書くと定められた動詞も無い。
- **根拠引用**: spec/format.md §8（plan スキーマ）「- request: （derive 後にツールが記録）」
- **矛盾引用または反例**: adr/0008-verb-cli.md「プロンプト動詞は文脈注入済みテキストを stdout に出すまでを責務とし、実行しない」（derive = `prompt derive` はプロンプト動詞）。derive 自身はファイルを書けないため記録主体たり得ず、adr/0005-element-state-machine.md が coverage 合格時に定めるのは「`requested`（request slug を記録）」= state.json への記録のみで、plan ファイルへの書き込みを担う動詞はどの記録にも無い。
- **深刻度**: low
