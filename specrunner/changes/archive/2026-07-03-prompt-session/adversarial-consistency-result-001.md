# Adversarial Consistency Review — prompt-session (Iteration 1)

- **verdict**: approved

---

## Finding 1: FORMAT_RULES_SUMMARY の「agent が要素を書き起こせる分量」という主張は、ビュー型が enabled な設計セッションで崩れる

**主張**: design.md D6 は「セッション内で agent が要素を書き起こせるだけの形式規則要約を持つ」と述べているが、ビュー型（uc / scr / api / dat / flow / evt / ext / perm / dpl）が manifest で有効化された設計においては、FORMAT_RULES_SUMMARY にビュー型の prefix・宣言構文が含まれていないため、エージェントはビュー要素の書き起こしに必要な情報を得られない。

**根拠引用（design.md D6）**:

> セッション内で agent が要素を書き起こせるだけの形式規則要約をコード内定数として持つ。内容: ... 型プレフィクス表（mod / term / ent / inv / act / seq / top / plan / grp / adr）

**矛盾引用（spec/format.md §4）**:

> | uc / scr / api / dat / flow / evt / ext / perm / dpl | 各ビュー | views |

spec/format.md §4 ではビュー型 prefix が正式に定義されており、ADR-0010 §4 段階は「+ビュー」を有効な導入段階として位置づけている。

**反例**:

manifest `enabled: static, domain, use-case, loop` の設計で `aozu prompt session --topic top-uc-design` を実行した場合、`Enabled Layers` セクションには `use-case` が含まれるが、`Format Rules` セクションには `uc` prefix の存在も宣言構文（`## Title {#uc-slug}`）も記載されていない。エージェントが `uc` 要素を新規作成しようとしても、FORMAT_RULES_SUMMARY からは正しい宣言方法を知ることができない。

**深刻度**: medium — 記述の修正が必要（FORMAT_RULES_SUMMARY の主張「agent が要素を書き起こせる分量」か、ビュー型を除外するという制約の明示のどちらかを修正する必要がある）

---

## Finding 2: design.md Risks の「FORMAT_RULES_SUMMARY にバージョン注記を含める」Mitigation が実装に未反映

**主張**: design.md の Risks/Trade-offs セクションは、FORMAT_RULES_SUMMARY と spec/format.md の乖離に対する Mitigation として「要約に spec/format.md のバージョン注記を含めることで、手動更新のトリガを可視化する」と明示しているが、実装された FORMAT_RULES_SUMMARY にはバージョン参照が含まれていない。

**根拠引用（design.md Risks/Trade-offs）**:

> [Risk] 形式規則要約がspec/format.md と乖離する → Mitigation: ... 要約に spec/format.md のバージョン注記を含めることで、手動更新のトリガを可視化する

**矛盾引用（src/prompt/session.ts FORMAT_RULES_SUMMARY 全文）**:

FORMAT_RULES_SUMMARY には `format-version: 0` 等の参照が存在しない。宣言・参照・ID 文法・型テーブル・frontmatter 規約の記述のみ。spec/format.md の先頭行 `- format-version: 0` に対するアンカーが欠落している。

**深刻度**: low — 曖昧さの解消が望ましい（Mitigation として記録された措置が未実施であることで、将来の乖離時に手動更新のトリガが機能しない）

---

## Finding 3: docs/open-questions.md §8「manifest の要約は常に注入」と design.md D2「Enabled Layers のみ」の解釈乖離が記録されていない

**主張**: docs/open-questions.md 論点 8 の規則案は「manifest と形式規則の要約は常に注入」と定め、この規則案を「そのまま初版とする」（design.md「architect 評価済みの設計判断」）と決定しているが、「manifest の要約」が何を指すかの定義が記録されておらず、design.md D2 / tasks.md T-01 では `Enabled Layers`（enabled 一覧のみ）に縮小解釈されている。縮小解釈の根拠が設計記録に存在しない。

**根拠引用（docs/open-questions.md §8）**:

> manifest と形式規則の要約は常に注入

（初版実装済み注記追加後も、この規則案の原文は変更されていない）

**矛盾引用（design.md D2 / SessionInput §6）**:

> `## Enabled Layers` — manifest の enabled 一覧

spec/format.md §3 の manifest には `request-template`・`request-output-dir` 等の任意キーも定義されているが、これらは注入対象外とされている。D8 で「session は消費者設定に依存しない」とあるのが実質的な根拠だが、論点 8 の「manifest の要約」との対応関係（「enabled 一覧 = manifest の要約」という解釈）は明記されていない。

**深刻度**: low — 曖昧さの解消が望ましい（論点 8 の規則案と実装の対応を設計記録に明示することで、将来「manifest のどのキーを注入するか」を議論する際の参照点が確立する）

---

## 反証を試みて不能だった観点

1. **原理間矛盾（ADR-0012 消費者非依存 vs セッションテンプレートのコード内所有）**: design.md は architect 評価済みとして「request テンプレは消費者（実装パイプライン）の所有物だから注入するのであって、設計セッションは aozu 自身の工程」と根拠を明示。ADR-0012 との分離は設計文書上で整合しており、矛盾を構成できない。

2. **exit code 同型性（derive と session の exit 2 条件の相違）**: ADR-0008 は exit code の意味論を動詞テーブルに記載していない。request.md が「exit code は derive と同型（0/1/2 の意味）」と定義し、exit 2 の発生条件は各動詞の入力に依存することは一貫している。矛盾を構成できない。

3. **ADR-0007（機械強制）と SESSION_GUIDANCE の「check を回す」推奨の関係**: ADR-0007 の「機械強制」は merge gate（入口ゲート・出口ゲート）を指す。設計セッション内の check 実行は attended モードの補助であり、ADR-0007 の強制機構の射程外。矛盾を構成できない。

4. **C9 閉包規則と session handler が ADR 作成を促す作法指示の関係**: SESSION_GUIDANCE が「判断は ADR に記録する」「topics: 引用で addressed になる」と指示することで、C9（「loop 有効時、adr が top を引用する義務」）の充足が session の外側で担保される設計。check コマンドが C9 を検証するため整合している。矛盾を構成できない。

5. **段階縮退の穴（domain 無効 + loop 有効）**: manifest `enabled: static, loop`（domain なし）は C7 を満たす。session は loop ゲートのみで通過し、term/inv が空の場合は `(no terms or invariants defined)` を出力する。実装（prompt.ts:423-435）で prefix フィルタが graph.elements に基づくため、domain 無効時には term/inv が存在せず空集合になる。未定義動作はない。ただし FORMAT_RULES_SUMMARY のビュー型欠落問題（Finding 1）は同じ縮退文脈でも発現するため、Finding 1 として記録済み。
