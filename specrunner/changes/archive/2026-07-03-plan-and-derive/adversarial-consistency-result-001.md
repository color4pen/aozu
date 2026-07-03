# 敵対的整合レビュー — Iteration 1

- **verdict**: needs-fix

---

## 1. `act` 要素が IMPLEMENTATION_PREFIXES に含まれず、ADR-0005 + ADR-0015 の状態機械から漏れる

**主張**: 本変更が `computeFrontier` を移設した `src/plan/frontier.ts` の `IMPLEMENTATION_PREFIXES` は `act` を含まないため、ADR-0015 が domain 層の正式設計要素として追加した act 要素が ADR-0005 の定める designed → requested → implemented の 3 状態機械から構造的に脱落する。

**根拠引用**:

- `adr/0005-element-state-machine.md`: 「全設計要素は 3 状態を持ち、実装状態マップ（横断アーティファクト）に記録する: designed（設計済・未起票） → requested（request 起票済） → implemented（実装済）」
- `adr/0015-actor-as-core-type.md`: 「**act 型（アクター: ロール・主体）をコアの domain 層に追加**する。」
- `src/plan/frontier.ts:39`: `export const IMPLEMENTATION_PREFIXES = new Set(["mod", "term", "ent", "inv", "seq"]);`

**矛盾引用および反例**:

`src/check/manifest.ts:103` の `LAYER_TO_PREFIXES` は `domain: ["term", "ent", "inv", "act"]` として act を domain 層プレフィクスに収め、`getEnabledPrefixes` は domain 有効時に "act" を返すことを `src/check/manifest.test.ts:110-114`（TC-015）が確認している。しかし `computeFrontier`（`frontier.ts:74`）は `IMPLEMENTATION_PREFIXES.has(el.prefix)` で act 要素を無条件に除外するため、designed フロンティアに act が現れない。

反例: clearflow ドッグフーディング（`docs/open-questions.md` §9）で追加された 5 アクター（`actors.md`）は domain 有効の設計に実在するが、`aozu plan` が生成する plan には含まれない。`aozu prompt derive` の対象にもならないため、act 型を「実装」する request が導出経路に乗らない。ADR-0015 が「domain 有効時は act も閉包の対象」と定めているにも関わらず、本変更が導入した plan コマンドはその要素を無視して動く。design.md D1 は `IMPLEMENTATION_PREFIXES` の移設を「そのまま移設する」と記載しており、act 追加（ADR-0015）との整合について言及していない。

**深刻度**: high — 二つの決定済み ADR（0005 + 0015）が両立するには IMPLEMENTATION_PREFIXES に "act" を追加する必要があるが、本変更の設計記録（design.md D1・tasks.md T-01）はこの齟齬を認識しておらず、決定の見直しまたは実装修正の要否を確認する判断が求められる。

---

## 2. `computeFrontier` の openTopics 計算が ADR-0018-3 および spec/format.md §8 に矛盾したまま正規モジュールに転記された

**主張**: 本変更が `src/cli/commands/status.ts` から `src/plan/frontier.ts` へ移設した `computeFrontier` の openTopics 計算は frontmatter の `status === "open"` を参照する旧方式を踏襲しており、ADR-0018-3 が廃止を決定した frontmatter status 依存を plan 生成の正規モジュールに定着させる。

**根拠引用**:

- `adr/0018-loop-write-semantics.md` Decision 3: 「**topic の addressed は計算で導く**。frontmatter の `status` を廃し、「ADR から `topics:` で引用された top は addressed」とみなす。」
- `spec/format.md §8`（topics スキーマ）: 「addressed の状態は frontmatter に持たず、**計算で導く**: ADR から `topics:` で引用された top は addressed とみなす（ADR-0018）。」

**矛盾引用**:

`src/plan/frontier.ts:62-68`:
```typescript
// (a) Open topics: top elements whose frontmatter status === "open"
for (const [id, el] of graph.elements) {
  if (el.prefix !== "top") continue;
  const fm = frontmatters.get(el.file);
  const status = typeof fm?.["status"] === "string" ? fm["status"] : undefined;
  if (status === "open") { ... }
}
```

ADR-0018 の決定する正しい計算は「いずれの ADR の `topics:` frontmatter にも引用されていない top 要素が open」である。現実装では: (i) ADR が `topics: [[top-x]]` で引用済みの top-x に frontmatter `status: open` が残っていれば誤って open と判定される。(ii) frontmatter に `status` フィールドが無い top 要素は、addressed/open に関わらず openTopics に現れない（ADR-0018 では open として扱われるべき）。

この計算は status.ts に元々存在したが、design.md D1 は IMPLEMENTATION_PREFIXES 同様この整合問題に言及せず「そのまま移設する」という設計を記録している。本変更後、誤った計算が plan 生成モジュールの公式実装として成立する。plan コマンド自体は `frontier.designed` のみを参照するため直接的な機能破損はないが、tasks.md T-01 の acceptance criteria は「既存の status.test.ts が green」だけを確認条件とし、openTopics の正確性は検証していない。

**深刻度**: medium — plan/derive の動作に直接影響はないが、frontier.ts が将来の coverage 等 loop 動詞の基盤となる以上、誤った openTopics 計算がそのまま引き継がれるリスクがある。記述（設計記録 D1 と tasks.md T-01）に ADR-0018 との整合確認を追記するか、openTopics 計算を ADR-0018 準拠に修正する要否を明示する必要がある。

---

## 反証を試みて不能だった観点

- **観点 3（エレガント統合型の断定）**: D7 の「ファイル実在性でモードを切り替える」方針は設計として明記された意図的な選択であり、反証可能な反例を構成できなかった。コマンドと同名ファイルが存在する場合のパス優先は ADR-0012 の記述と矛盾しない。
- **観点 4（段階・縮退の穴）**: plan の loop 無効 → exit 1 と derive の loop 無効 → exit 2 の非対称は design.md D8 に明示的な根拠が記録されており、spec/integration.md §5 の exit code 規約（同文書は check --request 向けであり plan/derive には非適用）との矛盾として反例を構成できなかった。
- **観点 5（決定と未決の食い違い）**: designed への戻り遷移は open-questions.md §12 で明示的に未決として管理されており、本変更のスコープ外として整合している。manifest の `request-template` / `request-output-dir` の追補（spec/format.md §3）は format-version 不変・加算的変更であり ADR-0016 と整合する。mod-plan の責務行更新（design/static/modules.md）は ADR-0018-2 の廃止決定への正当な追随であり矛盾しない。
