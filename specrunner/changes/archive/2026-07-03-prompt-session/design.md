# Design: prompt-session

## Context

ADR-0008 の動詞表に `prompt session --topic <id>` がある。topic を起票した後の設計セッション開始に、判断に必要な文脈を自動注入するプロンプト動詞である。`prompt derive` は実装済みで、mod-prompt / mod-graph の基盤（`buildDeriveInstruction`、`computeNeighborhood`、`extractAllBodies`）が確立している。

`prompt session` は derive と同じ prompt 動詞だが、入力の起点と注入スコープが異なる:

- **derive**: 起点 = plan の grp-id → grp の elements: 行に列挙された要素を seed とし、2 hop 近傍 + term/inv 全量 + テンプレート + 出力先パスを注入する。消費者は実装パイプラインであり、テンプレートと出力先は manifest 設定で注入する
- **session**: 起点 = topic の top-id → topic 本文中の `[[id]]` 引用を seed とし、2 hop 近傍 + term/inv 全量 + static モジュール一覧の縮約形 + manifest enabled 一覧 + 形式規則の要約 + セッション作法指示を注入する。消費者は設計セッション（人 + agent）であり、テンプレートは aozu 所有（コード内定数）

docs/open-questions.md 論点 8 の規則案を初版実装に昇格させる。

既存コードの制約:

- `src/cli/commands/prompt.ts` — `handlePrompt` がサブコマンド dispatch。現在 `derive` のみ。`session` を追加すれば dispatch に 1 行足すだけ
- `computeNeighborhood` と `extractAllBodies` は `handleDerive` が既に使用しているパターン。session handler からも同じ経路で利用可能
- topic は文書要素（prefix `top`）で、frontmatter に `id:` を持ち、本文は frontmatter 終了後の全体（body.ts の `extractAfterFrontmatter`）
- topic 本文中の `[[id]]` 引用は `extractReferences` で抽出できる（コード除外規則込み）
- manifest の enabled 一覧は `parseManifest` → `Manifest.enabled` で取得済み
- static モジュール一覧は `graph.elements` から prefix `mod` の要素をフィルタして取得可能。各要素の本文から `責務:` 行を抽出すれば縮約形（見出し + 責務行のみ）が得られる

## Goals / Non-Goals

**Goals**:

- G1: `aozu prompt session --topic <top-id> [--dir <path>]` を追加する。stdout に指示テキストを出力し、ファイルには何も書かない
- G2: 注入スコープの実装 — 論点 8 の規則案を初版とする（2 hop 近傍 + term/inv 全量 + static 縮約 + manifest enabled + 形式規則要約 + 作法指示）
- G3: 引用 0 件の topic を正常系として扱う（seed が空なら近傍も空で、topic 本文 + 全量枠のみの出力）
- G4: exit code を derive と同型にする（0 = 成功 / 1 = loop 無効 / 2 = 入力不正）
- G5: 出力を決定的にする（同一入力で同一 stdout）
- G6: 純関数 `buildSessionInstruction` を src/prompt/ 配下に配置し、derive と同じ分離を踏襲する

**Non-Goals**:

- `prompt propagate` / `prompt review`（別動詞、別 request）
- one-shot runner（論点 9-a、需要待ち）
- スコーピング規則の高度化（主張索引・グラフ近傍シャーディング）
- セッションプロンプトのテンプレート外部注入
- status / check の変更

## Decisions

### D1: session handler の配置 — handlePrompt のサブコマンド拡張

`handlePrompt` の dispatch に `session` 分岐を追加する。`handleSession(args)` を同一ファイル（src/cli/commands/prompt.ts）に定義する。derive と同レベルのサブコマンドとして並列配置し、help テキストに `session` を追加する。

**Rationale**: prompt 動詞のサブコマンドは同一 handler ファイルに纏め、dispatch を一望できる構成を維持する。derive handler と session handler は同じファイル内で I/O パイプラインの類似性が見えやすくなる。

**Alternatives considered**: session を別ファイル（src/cli/commands/prompt-session.ts）に分離する — ファイルの分離は dispatch 箇所を増やすだけで利点がない。handler が大きくなったら後から抽出できる。

### D2: 純関数 buildSessionInstruction の設計 — src/prompt/session.ts

src/prompt/session.ts に `buildSessionInstruction(input: SessionInput): string` を配置する。derive の `buildDeriveInstruction` と同型の純関数。

入力型 `SessionInput`:

```typescript
interface SessionInput {
  topicId: string;
  topicBody: string;
  seedBodies: Map<string, string>;
  neighborBodies: Map<string, string>;
  termsAndInvariants: string;
  staticModulesSummary: string;
  enabledLayers: string[];
  formatRulesSummary: string;
  sessionGuidance: string;
}
```

出力: 指示テキスト文字列。セクション構成:

1. **Topic** — topic ID + 本文（source 込み）
2. **Seed Element Bodies** — topic が引用する要素の本文全量
3. **Neighborhood Element Bodies (2-hop)** — seed の in/out 2 hop 近傍の本文全量
4. **Terms and Invariants** — term / inv の全量（近傍に関係なく常に）
5. **Static Modules (summary)** — 見出し + 責務行の縮約形
6. **Enabled Layers** — manifest の enabled 一覧
7. **Format Rules Summary** — 宣言・参照・型スキーマの要点
8. **Session Guidance** — セッションの作法指示

セクション内の要素列挙は ID 辞書順（`Array.from(map.keys()).sort()` で決定的）。

**Rationale**: derive と同じ「純関数が組み立て、handler が I/O」の分離。テスト容易性と mod-prompt の責務一貫性を維持する。

**Alternatives considered**: derive の入力型を拡張して 1 関数に統合する — session と derive はセクション構成が大きく異なり（テンプレート vs 作法指示、出力先 vs 形式規則要約）、統合すると条件分岐が増えて可読性を損なう。

### D3: 注入スコープの規則 — 定数の集約

スコープ規則の定数を src/prompt/session.ts の先頭に集約する:

```typescript
const SESSION_MAX_HOPS = 2;
```

hop 数は定数 1 箇所とし、調整を単一修正点にする（architect 評価済みの設計判断）。

**Rationale**: 規則値の変更は運用の証拠（文脈があふれる / 足りない実例）を待ってから行う。定数化により変更箇所を限定する。

### D4: seed の抽出 — topic 本文中の `[[id]]` 引用

handler で topic の本文を取得し、`extractReferences(topicBody, topicFile)` で `[[id]]` 引用を抽出する。抽出された targetId の配列が seed となる。

重複する seed ID は除去する（同一 ID の複数引用は 1 回だけ処理）。seed の順序は ID 辞書順に正規化する（決定的出力のため）。

引用 0 件は正常系（ADR-0006: topic は曖昧でよい）。seed が空なら `computeNeighborhood` は空集合を返すので、近傍セクションが "(no neighborhood elements)" となるだけで正常終了する。

**Rationale**: `extractReferences` は既存のコード除外規則（フェンス・インラインコード）を適用済みであり、topic 本文にも同じ除外規則を適用することで一貫性を保つ。

**Alternatives considered**: topic の frontmatter に seed を明示列挙する — topic の軽量さ（数行の症状記述）を損ない、ADR-0006 の「緩い入力」原則に反する。

### D5: static モジュール一覧の縮約形

handler で `graph.elements` から prefix `mod` の要素を収集し、各要素について本文から `責務:` で始まる行を抽出する。出力形式は各 mod について 1 エントリ:

```
### <mod-id>
責務: <responsibility line>
```

`実装:` 行やその他の本文は含めない。要素は ID 辞書順で列挙する。

`責務:` 行が見つからない mod は見出しのみを出力する（`責務:` 行は仕様上必須だが、robustness のため欠落を許容する）。

この縮約形の組み立ては handler 内で行い、結果を `staticModulesSummary` として純関数に渡す。縮約ロジックは小さい（mod 要素の本文から `責務:` 行を grep するだけ）ので、独立モジュールには切り出さない。

**Rationale**: 論点 8 の規則案「static のモジュール一覧は見出し + 責務行のみの縮約形」を直訳実装する。全文を注入しない理由は、mod 本文には `実装:` 行やサブ見出しが含まれ、設計セッションには不要な詳細が増えるため。

**Alternatives considered**: `extractAllBodies` で全文を注入する — 大きな codebase では static 全文が窓を圧迫する。縮約形は窓対策として設計されている。

### D6: 形式規則の要約 — コード内定数

セッション内で agent が要素を書き起こせるだけの形式規則要約をコード内定数として持つ。内容:

- 宣言構文: 見出し要素 `## Name {#prefix-slug}` / 文書要素 frontmatter `id: prefix-slug`
- 参照構文: `[[id]]`（コードフェンス・インラインコード内は除外）
- ID 文法: `prefix-slug`（prefix は型テーブル参照、slug は `[a-z0-9]+(-[a-z0-9]+)*`）
- 型プレフィクス表（mod / term / ent / inv / act / seq / top / plan / grp / adr）
- frontmatter 規約: flat な `key: value` のみ

この定数は `FORMAT_RULES_SUMMARY` として src/prompt/session.ts に定義する。spec/format.md の全文を注入するのではなく、セッションに必要な最小限を手書きの要約として持つ。

**Rationale**: spec/format.md は閉包規則（C1〜C11）や state.json の詳細など設計セッションには不要な情報を含む。要約はセッション中の要素書き起こしに必要な構文ルールに限定する。spec/format.md が更新されたら要約も手動更新する必要があるが、形式仕様の変更頻度は低く、要約との乖離は check で検出可能（書き起こした要素が check を通らなければ要約の更新漏れが判明する）。

**Alternatives considered**: spec/format.md をランタイムに読み込んで全文注入する — 窓を圧迫し、mod-prompt -> mod-fsread の依存が生じる。ファイルの動的読み込みは handler（mod-cli）の責務であり純関数の中に持ち込まない。

### D7: セッション作法指示 — コード内定数

セッション末尾に含める作法指示をコード内定数 `SESSION_GUIDANCE` として src/prompt/session.ts に定義する。内容:

- scaffold で新要素を作る（既存要素の ID を壊さない）
- check を回しながら編集する（閉包を維持する）
- 判断は ADR に記録する
- topic は ADR の `topics:` 引用で addressed になる（ADR-0018）

**Rationale**: セッションの作法は aozu の工程知識であり、消費者ごとに変わるものではない。コード内定数とすることで、テンプレート注入の複雑さを避ける（architect 評価済み: セッションプロンプトのテンプレートは aozu 所有）。

### D8: 段階ゲート — derive と同型

handler 冒頭で以下のゲートを実行する。exit code は derive と同型:

| 条件 | exit code | 診断 |
|---|---|---|
| loop 無効 | 1 | loop layer not enabled |
| design ディレクトリ不在 | 2 | design directory not found |
| topic 不存在（grph.elements に top-id がない / prefix が top でない） | 2 | topic not found |

derive と異なり、`request-template` / `request-output-dir` のチェックは不要（session は消費者設定に依存しない）。

**Rationale**: prompt 動詞群の契約一貫性。呼び出し側が動詞ごとの差異を覚えなくてよいようにする（architect 評価済み）。

### D9: 決定的出力の保証

出力の決定性を以下の手段で保証する:

1. seed ID 配列: `extractReferences` の結果を重複除去後 ID 辞書順にソート
2. seed / neighbor 本文の列挙: Map のイテレーション順ではなく、キー配列を sort してから列挙
3. term/inv の列挙: ID 辞書順にソート
4. static mod の列挙: ID 辞書順にソート
5. enabled 一覧: manifest の enabled 配列の順序をそのまま使用（manifest が同一なら順序も同一）

純関数 `buildSessionInstruction` 自身は入力をそのまま使うだけで、ソートは handler 側で行う（derive と同じパターン）。ただし seed / neighbor の Map は handler が ID 辞書順で構築する。term/inv は handler が ID 辞書順でソートした文字列を渡す。

**Rationale**: 受け入れ基準「同一入力で stdout がバイト同一」を満たす。

### D10: docs/open-questions.md 論点 8 の更新

実装完了後、docs/open-questions.md 論点 8 に「初版実装済み（prompt session）」の注記を追加する。規則案が実装に昇格したことを示す。論点自体は閉じない（高度化の戦略 3 が未解決のため）。

## Risks / Trade-offs

- **[Risk] 形式規則要約がspec/format.md と乖離する** → Mitigation: 要約は宣言・参照・ID 文法の最小限に限定しており、変更頻度は低い。乖離があってもセッション中の check 実行で検出される（書き起こした要素が check 不合格になる）。要約に spec/format.md のバージョン注記を含めることで、手動更新のトリガを可視化する
- **[Risk] topic 本文が大きい場合に注入量が増大する** → Mitigation: topic は ADR-0006 で「数行」と規定されており、実際の運用でも症状・動機の簡潔な記述が想定される。大きい topic は設計の警報である（論点 8 の戦略 5「正本を小さく保つ」）
- **[Risk] 2 hop 近傍が大量の要素を含む場合** → Mitigation: 初版実装ではそのまま全量注入する。窓に収まらなくなった実例が出た時点でスコーピング規則の高度化（論点 8 戦略 3）を検討する。これはスコープ外として明示済み
- **[Trade-off] static モジュールの縮約形は情報が落ちる** → 設計セッションでモジュールの詳細が必要な場合はセッション中に check / status で確認できる。全文注入は窓コストに見合わない

## Open Questions

（なし — architect 評価済みの設計判断と論点 8 の規則案により主要な選択は確定済み）
