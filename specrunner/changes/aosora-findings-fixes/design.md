# Design: aosora findings fixes — format-version fence / topics 書式統一 / CLI ergonomics

## Context

aosora（design/ フルループ + designLayer 結線を day 0 から有効化した greenfield プロジェクト）の実運用で判明した findings（docs/findings/aosora-2026-07-04.md）のうち、設計判断を要さない 5 件を修正する。

**対象 findings と現状**:

- **F6 — format-version フェンス欠落（fail-closed 違反）**: `src/check/manifest.ts` の `parseManifest` は `format-version` を文字列として読むだけでツールの対応バージョン集合と照合しない。`format-version: 99` の design/ を `check` が無診断 exit 0 で通す。manifest を読む他動詞（status / plan / coverage / derive / session / propagate / mark / scaffold）も同様。fail-closed 原則に反し、将来の format-version 増分時に旧ツールが新形式を黙って誤読する事故経路になる。

- **F3 — SESSION_GUIDANCE の topics 例示が正書式と不整合（実害あり）**: `src/prompt/session.ts` の `SESSION_GUIDANCE` が `topics: top-my-topic`（plain 形式）を例示している。正書式はブラケット付き `topics: [[top-my-topic]]` であり、spec/format.md §8・scaffold の adrTemplate・addressed 導出（`extractReferences` が `[[...]]` を抽出）・C9（frontmatter の `[[top-*]]` 参照を検証）のすべてと不整合。この例に従うと C9 で落ち、本文引用で回避しても addressed 導出が静かに失敗する（実害: aosora で解決済みの topic が status で Open のまま）。C9 の診断メッセージにも正書式への導線がない。

- **F2 — scaffold の prefix 二重指定（ergonomics）**: `scaffold topic concept` は「prefix が top でない」として exit 1 になる。type を指定しているのに id にも prefix を要求するのは冗長で、初見で詰まる。

- **F4 — derive の前提配線への導線不足（ergonomics）**: `prompt derive` が `request-template` / `request-output-dir` 欠落で config エラーを返すが、manifest frontmatter にどのキーをどう書くかの修正手順を含まない。`init` が生成する manifest テンプレのコメントにも導出キーの説明がない。

- **F5 — mark implemented の引数形式（ergonomics）**: `mark implemented foundation`（positional）が「missing --request argument」で失敗する。`aozu mark --help` がサブコマンド名のみでオプション要約を出さない。

**既存コードの正確な位置**（実装前に grep で再確認すること）:

| 対象 | 場所 |
|---|---|
| `parseManifest` | `src/check/manifest.ts:120-143` |
| format-version 読み取り（センチネルなし） | `src/check/manifest.ts:130-133` |
| `SESSION_GUIDANCE` のテンプレート | `src/prompt/session.ts:32-48` |
| C9 の診断メッセージ | `src/check/rules/c09-adr-topics.ts:26-38` |
| scaffold の ID 検証フロー | `src/cli/commands/scaffold.ts:222-309` |
| derive の request-template エラー | `src/cli/commands/prompt.ts:204-216` |
| derive の request-output-dir エラー | `src/cli/commands/prompt.ts:218-229` |
| init の MANIFEST_TEMPLATE | `src/cli/commands/init.ts:25-35` |
| mark implemented の --request 解析 | `src/cli/commands/mark.ts:122-130` |
| mark --help 出力 | `src/cli/commands/mark.ts:50-63` |

**parseManifest の呼び出し元（全動詞）**:

| ファイル | 行（目安） | 動詞 |
|---|---|---|
| `src/cli/commands/check.ts` | 59, 205 | check（request mode / normal mode） |
| `src/cli/commands/status.ts` | 240 | status |
| `src/cli/commands/plan.ts` | 117 | plan |
| `src/cli/commands/coverage.ts` | 151 | coverage |
| `src/cli/commands/prompt.ts` | 185, 390, 535, 685 | derive, session, propagate, review |
| `src/cli/commands/mark.ts` | 159 | mark implemented |
| `src/cli/commands/scaffold.ts` | 294 | scaffold |
| `src/cli/commands/export.ts` | 22, 98-99 | export（export rules） |

---

## Goals / Non-Goals

**Goals**:

- `src/check/manifest.ts` に `SUPPORTED_FORMAT_VERSIONS` 定数と `validateFormatVersion` 関数を追加し、全コマンドハンドラが `parseManifest` 直後にそれを呼び出す。未知 format-version は error 診断付きで不合格にする
- `spec/format.md` §10 に C12（format-version が対応集合に属する）を追記する
- `SESSION_GUIDANCE` の ADR 例を正書式 `topics: [[top-my-topic]]` に修正し、C9 の診断メッセージに frontmatter の正書式への言及を追加する
- `scaffold <type> <slug>` でベア slug（prefix なし）を受け付け、document 型の prefix を自動補完する。型と矛盾する prefix は error にする
- `prompt derive` のエラーメッセージに `request-template:` / `request-output-dir:` の記入例を含める。`init` の manifest テンプレのコメントに loop 有効化後に必要になる導出キーの説明を追加する
- `mark implemented <slug>`（positional）を `--request <slug>` と等価に受理する。`aozu mark --help` に implemented の主要オプションを併記する

**Non-Goals**:

- findings #1（依存引用と被覆引用の区別）— 論点 13 で扱う
- format-version の移行手段・複数バージョン読みの窓（論点 7）
- C9 の判定ロジック変更
- spec-runner 側の変更

（注: 当初 `export.ts` と `prompt review` を「parseManifest を呼ばないため対象外」としていたが、敵対的整合レビューの反証——export は出口ゲートの基準物 rules.json を生成し、review は request 要件 1 の全動詞列挙に含まれる——により両方とも C12 ゲートの対象に含めた）

---

## Decisions

### D1: format-version 判定を manifest.ts に集約し、全コマンドが parseManifest 直後に呼び出す

**決定**: `src/check/manifest.ts` に以下を追加する:
1. `SUPPORTED_FORMAT_VERSIONS: Set<string> = new Set(["0"])` — 対応バージョンの定数
2. `validateFormatVersion(manifest: Manifest, manifestPath: string): CheckDiagnostic | null` — 判定ロジックを一箇所に置く関数

各コマンドハンドラは `parseManifest` の直後に `validateFormatVersion` を呼び出し、non-null なら早期リターンする:
- `check` コマンド（normal mode / request mode とも）: C12 診断を `writeDiagnostics` で出力して exit 1
- 他の全コマンド（status / plan / coverage / derive / session / propagate / mark / scaffold）: エラーメッセージを stderr に書いて exit 2

**根拠**: 検証ロジックは manifest.ts に一箇所に集約し、チェック漏れが起きないよう各コマンドの共通パターン（parseManifest 直後）で適用する。fail-closed は「読む場所全部で効く」ことが要件。

**却下した代替案**:
- C 規則として check のみに実装: check 以外の書き込み系動詞（mark など）が未知形式を誤読するリスクが残る
- `parseManifest` 自体を変更して Result 型を返す: 既存テストと全呼び出し元の型シグネチャを大幅変更する必要があり、リスクが高い

### D2: format-version キー欠落時のセンチネルを変更する

**決定**: `parseManifest` 内で、manifest ファイルが**存在するが** `format-version` キーがない場合、`formatVersion: ""` を返す（空文字列のセンチネル）。`SUPPORTED_FORMAT_VERSIONS` が `"0"` のみを含み `""` を含まないため、欠落も自動的に C12 違反になる。manifest ファイル自体が不在の場合は従来どおり `formatVersion: "0"` を返す（別問題として扱う）。

**根拠**: 既存テストは `manifest.formatVersion` の値を直接アサートするものがなく、センチネル変更で既存テストを壊さずに「欠落 → エラー」を実現できる。

**却下した代替案**:
- `validateFormatVersion` に生の frontmatter を追加引数として渡す: 関数シグネチャが複雑になり、`Manifest` 型が持つ情報で完結すべきという設計原則に反する

### D3: scaffold の prefix 解決ロジック

**決定**: `handleScaffold` の入力 `id` が `{typePrefix}-` で始まらない場合、以下の順で判定する:
1. `extractPrefix(id)` で先頭セグメント（最初の `-` 以前）を取得する
2. 取得したセグメントが `KNOWN_PREFIXES`（`src/parse/id.ts` が公開）に含まれ、かつ `typePrefix` と異なる場合 → 型矛盾エラー（exit 2）
3. それ以外（prefix なしの bare slug、または不明な先頭セグメント）→ `typePrefix + "-" + id` に補完して以降の検証を続行する

`typePrefix + "-"` で始まる場合（フル ID）はそのまま既存の検証フローへ。

**根拠**: `ent-foo` などの typo を静かに補完しない fail-closed 側の倒し方。`KNOWN_PREFIXES` を再利用することで判定定数の二重管理を避ける。

**却下した代替案**:
- prefix 含む場合は常に error: `top-concept`（正しいフル ID）も拒否してしまう

### D4: mark positional slug の実装

**決定**: `handleMarkImplemented` の引数解析を変更し、`--` で始まらない最初の positional 引数を slug として認識する。`--request` との両指定で値が食い違う場合は exit 2。`--request` 形式の既存の呼び出し（spec-runner のフックなど）には影響しない加算的変更。

### D5: spec/format.md の C12 採番

**決定**: `spec/format.md §10` の閉包検証規則表に C12 を追加する。本文には「manifest の `format-version` が対応集合（現在 `{"0"}`）に属する。欠落も違反」と what のみを記述する（C1〜C11 と同じ書式に揃え、実装方式——全動詞共通の入口ゲート——は本設計文書 D1 の責務とする）。

---

## Risks / Trade-offs

- [Risk] **manifest ファイル不在は C12 フェンスのバイパス経路になる**（D2 の「不在は `formatVersion: "0"` として扱う」フォールバックの帰結）。manifest.md を削除した design/ は format-version 判定を素通りする。  
  許容根拠: manifest 不在は format-version の問題ではなく設計ディレクトリ自体の不備であり、その状態では `enabled: []` に縮退して全層が無効になるため、生成される成果物・遷移する状態が実質存在しない（フェンスが守るべき「未知形式の解釈」が発生しない）。manifest の存在自体を必須化する検証（spec §2 の「必須」の機械化）は独立した規則追加であり、本変更のスコープ外として意図的に分離した。「fail-closed は読む場所全部で効かせる」の適用対象は「manifest が存在して読まれる場所」である。

- [Risk] `parseManifest` のセンチネル変更（D2）が既存テストに影響する可能性: `manifest.formatVersion` を直接アサートする既存テストがあれば変更が必要になる。  
  Mitigation: 実装前に `manifest.test.ts` を確認し、`formatVersion` 値のアサーションが存在しないことを確認する。本設計時点では確認済み（既存テストは `manifest.enabled` のみを検証している）。

- [Risk] format-version フェンス導入により、`format-version` キーを持たない既存の fixture（テスト用設計ディレクトリ）が軒並み C12 違反になる可能性。  
  Mitigation: 実装前に全テスト用 fixture を `grep -r "format-version"` で確認する。本設計時点では、全 fixture が `format-version: 0` を持つことを確認済み（scaffold/check/mark/prompt テストの `writeFile` 呼び出しを参照）。fixture に `format-version` キーが欠落している場合は fixture を修正してよい（これは実装の一部）。

- [Risk] scaffold の prefix 補完ロジック変更で `validateId` の呼び出し順が変わり、エラーメッセージが変化する可能性。  
  Mitigation: 補完後のフル ID で `validateId` を呼ぶ既存フローは変更しないため、文法エラーは引き続き正しく検出される。エラーメッセージは補完後の ID で表示されるため、bare slug の場合は「`concept` が不正」ではなく「`top-concept` が不正」と出る（正しい動作）。

---

## Open Questions

なし。すべての設計判断は architect 評価済み（request.md §architect 評価済みの設計判断 参照）。
