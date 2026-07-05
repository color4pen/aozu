# Adversarial Consistency Review — aosora-findings-fixes (iteration 1)

- **verdict**: needs-fix

---

## Finding 1: export 動詞の fail-closed 適用除外 — request.md 要件と design.md Non-Goals の矛盾

**主張**: request.md が「manifest を読む全動詞（... export）で同じ判定が効くこと」を要件として明示し、architect 評価済みの設計判断として「fail-closed は読む場所全部で効かせる」と記録しているが、design.md はこれを撤回して export を対象外とし、その撤回が設計記録内で完結していない。

**根拠引用**:

- `specrunner/changes/aosora-findings-fixes/request.md`（要件 #1）:
  > check だけでなく manifest を読む全動詞（status / plan / coverage / derive / session / propagate / review / mark / **export**）で同じ判定が効くこと（parseManifest の直後など、一箇所の共通経路で判定する）

- `specrunner/changes/aosora-findings-fixes/request.md`（architect 評価済みの設計判断）:
  > **format-version 判定は parseManifest 直後の共通経路に一箇所で置く**。…**fail-closed は読む場所全部で効かせる**。

**矛盾引用**:

- `specrunner/changes/aosora-findings-fixes/design.md`（Non-Goals）:
  > `export.ts`（`parseManifest` を呼ばないため対象外）

**構成した反例**:

`format-version: 99` の manifest を持つ design/ で `aozu export rules` を実行する。`export.ts` は `readMarkdownFiles` → `parseFiles` → `buildGraph` の経路で manifest.md を含むファイルを読むが、`parseManifest` も `validateFormatVersion` も呼ばない。C12 ゲートは素通りし、未知 format-version の設計から rules.json が生成される。`aozu export rules --verify` が CI で回るとき（ADR-0007 §出口ゲート）、この rules.json が比較基準になる。fail-closed が「全動詞で効く」ことの反例が構成できる。

**深刻度**: high — 決定（fail-closed は読む場所全部で効かせる）の見直しが必要。export を除外するなら、その根拠（ADR-0007 の出口ゲートとしての export との整合、未知形式から rules.json を生成することの安全性）を明示した決定記録（設計文書内または ADR）が存在すべきであり、現状は存在しない。

---

## Finding 2: manifest ファイル不在時の "0" フォールバックと fail-closed 要件の緊張

**主張**: D2 の「manifest ファイル自体が不在の場合は `formatVersion: "0"` を返す（別問題として扱う）」という設計は、「fail-closed は読む場所全部で効かせる」という記録された原則に対して構成可能なバイパス経路を持つ。

**根拠引用**:

- `specrunner/changes/aosora-findings-fixes/request.md`（architect 評価済みの設計判断）:
  > fail-closed は読む場所全部で効かせる

- `spec/format.md §3`（manifest の例示）: `design/manifest.md` は `#` 節の冒頭で「必須」として例示されている（`format-version: 0` / `enabled:` を持つ frontmatter が必須キーとして示されている）

**矛盾引用・構成した反例**:

- `specrunner/changes/aosora-findings-fixes/design.md`（D2）:
  > manifest ファイル自体が不在の場合は従来どおり `formatVersion: "0"` を返す（別問題として扱う）

- 実装（`src/check/manifest.ts:167-169`）:
  ```ts
  if (!fm) {
    return { formatVersion: "0", enabled: [] };
  }
  ```

具体的反例: `design/manifest.md` を削除した状態で `aozu check` を実行する。`parseManifest` は `fm = undefined` → `formatVersion: "0"` を返し C12 通過。spec §3 が必須とするファイルの削除が C12 フェンスのバイパス経路になる。D2 で「別問題」として分離した判断は設計文書内に明示されているが、「fail-closed は全動詞で効かせる」という原則との緊張関係が記録されていない。

**深刻度**: medium — 決定の見直しは不要だが、D2 の Risks セクションにバイパス経路の存在とその許容根拠（manifest 不在は別の C 規則群でほぼ無効化される、manifest 不在は設計ディレクトリ自体の壊れであり format-version の問題とは独立）を明示的に記述する修正が必要。

---

## Finding 3: spec/format.md §10 に実装アーキテクチャ情報が混在

**主張**: C12 規則の記述が「実装は全動詞共通の入口ゲート（check コマンドでは C12 規則として診断されるが、他の動詞でも manifest 読み取りの直後に同じ判定が適用される）」という実装の選択を仕様節に含んでおり、C1〜C11 が仕様（what）に留まるのと非対称である。

**根拠引用**:

- `spec/format.md §10`（C12 行）:
  > \| C12 \| manifest の `format-version` が対応集合に属する（現在 `{"0"}`）。**実装は全動詞共通の入口ゲート（check コマンドでは C12 規則として診断されるが、他の動詞でも manifest 読み取りの直後に同じ判定が適用される）** \|

**矛盾引用**:

- `spec/format.md §10`（C1〜C11）: すべての規則がどのコマンドが適用するか・実装方式を記述していない。規則の内容（what）のみ。例: 「| C1 | すべての ID が文法に適合する |」

**深刻度**: low — 曖昧さの解消が望ましい。spec §10 は閉包規則（check が実施する）の節であり、「他の動詞でも同じ判定が適用される」という情報は設計文書（design.md D1）の責務。spec §10 の C12 記述から実装詳細を削除し、what（manifest の format-version が対応集合に属する）のみに絞ることが望ましい。

---

## 反証を試みて不能だった観点

- **原理間矛盾 — ADR-0016 との整合**: C12 フェンス導入は format-version を増分しない変更であり、ADR-0016「増分は破壊的変更のときのみで移行手段とセット」との矛盾は構成できない。
- **原理間矛盾 — ADR-0018 との整合**: SESSION_GUIDANCE の `topics: [[top-my-topic]]` 修正は ADR-0018-3（「ADR の top 引用はその topic への決定の宣言」）と整合する。addressed の計算による導出に変更はない。
- **原理間矛盾 — ADR-0003 との整合**: scaffold の prefix 自動補完は、ID 文法（`id = prefix "-" slug`）の範囲内で補完後の ID を生成する。`validateId` を補完後の ID に適用するため文法検証が維持されており、strict プロファイル方針との矛盾は構成できない。
- **エレガント統合型の断定 — D3 の型矛盾検出**: `scaffold topic ent-foo` が exit 2 になる反面、`scaffold adr 0001-my-decision`（`0001` は KNOWN_PREFIXES に含まれない）が `adr-0001-my-decision` に補完される動作は、D3 の判定順序と KNOWN_PREFIXES の定義から論理的に一貫している。崩れる反例は構成できなかった。
- **段階縮退の穴 — C12 と enabled の組み合わせ**: C12 は enabled の前に評価される（validateFormatVersion → loop gate の順）。manifest に未知 format-version と `enabled: loop` が共存しても、全動詞が C12 で早期 return するため enabled の段階縮退ロジックへ到達しない。意味論が未定義になるケースは見つからなかった。
- **決定と未決の食い違い — open-questions 論点 7 との整合**: 論点 7「移行手段の具体と後方互換の窓」は format-version 1 が視野に入った時点で決めるとある。C12 フェンスは「移行手段」ではなく「フェンス（前提）」であり、論点 7 のスコープ外として設計に明記されている。矛盾は構成できない。
- **消費者不在の形式化 — C9 メッセージ改善**: 診断メッセージへの「正書式（`topics: [[top-xxx]]` を frontmatter に書く）」追記は、C9 を読む消費者（check を実行する開発者）が明確であり、消費者不在の形式化には当たらない。
