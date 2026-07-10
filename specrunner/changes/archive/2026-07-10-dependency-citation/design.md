# Design: dependency-citation

## Context

`check --request` と `coverage` は、request 文書中のすべての `[[id]]` 引用を等価に扱う。引用は被覆宣言の意味しか持たず、implemented 要素を引用すると R2 で弾かれる。ADR-0024 が行頭 `依存: [[id]](, [[id]])*` を依存宣言行として定め、spec/integration.md §1・§4 は改訂済み。本設計はこの確定仕様を src/ に実装する。

現行コードの構造:

- `extractReferences(content, filePath)` (src/parse/references.ts) — `[[id]]` をすべて抽出する汎用関数。design 文書の全引用抽出にも使われる
- `handleCheckRequest` (src/cli/commands/check.ts:73-169) — extractReferences で全引用を取得し、dedup 後に R0/R1/R2 を診断
- `handleCoverage` (src/cli/commands/coverage.ts:213-215) — extractReferences の結果を `Set<string>` にして `verifyCoverage` に渡す
- `extractStructuredLines` (src/parse/structured-lines.ts) — 行指向の構造行認識。request 文書では使われていない

## Goals / Non-Goals

**Goals**:

- request 文書の `[[id]]` 引用を「被覆引用」と「依存引用」に分類する関数を mod-parse に追加する
- `check --request` を分類結果に基づいて二種類の検証に分岐させる
- `coverage` の草稿引用抽出で依存引用を被覆集合から除外する
- 不正な依存行（文法不一致）を R3 error として fail-closed で拒絶する
- 既存挙動の後方互換を維持する

**Non-Goals**:

- `extractReferences` の挙動変更（design 文書のパース経路に影響しない）
- `extractStructuredLines` への依存行の組み込み（依存行は request 文書専用）
- `parseFiles` パイプラインへの組み込み（依存行は graph に乗せない）
- `prompt derive` テンプレートへの依存行案内
- trace 動詞の実装

## Decisions

### D1: 新関数 `extractRequestCitations` を src/parse/request-citations.ts に配置する

request 文書専用の引用分類関数を新ファイル `src/parse/request-citations.ts` に作る。

```
extractRequestCitations(content: string, filePath: string): RequestCitationResult
```

返り値:
- `coverageRefs: Reference[]` — 依存行の外にある通常の `[[id]]` 引用（被覆引用）
- `dependencyIds: Set<string>` — 依存行上の `[[id]]` の targetId 集合
- `malformedLines: { line: number; text: string }[]` — 行頭 `依存:` だが文法不一致の行

この関数は `extractReferences` と同じコードフェンス/インラインコード除外ロジック（§6）を内部で適用する。`extractReferences` 自体は呼び出さず、行走査で依存行と通常行を分類しながら引用を抽出する。

**Rationale**: `extractReferences` を修正すると design 文書パースに波及する。references.ts の `stripInlineCode` と `extractRefsFromLine` は再利用する。依存行の認識は request 文書専用であり、design 文書の `extractStructuredLines` とは別ファイルにする。mod-parse の公開 API（index.ts）からエクスポートする。

**Alternatives considered**:
- `extractReferences` にオプション引数で依存行モードを追加 — 汎用関数の責務肥大。design 文書パースの後方互換リスク
- `extractStructuredLines` に依存行を追加 — structured-lines は parseFiles パイプラインの一部であり、request 文書専用の構造を混入させるべきでない

### D2: 依存行の文法認識は正規表現 + 行頭判定で行う

正規表現で厳密にマッチする:
- 完全一致パターン: `依存: [[id]](, [[id]])*` — `^依存: \[\[[a-z0-9-]+\]\](, \[\[[a-z0-9-]+\]\])*$`
- 行頭検出パターン: `^依存:` — 行頭が `依存:` なら依存行の意図を検出

処理フロー:
1. 行がコードフェンス内 → skip
2. 行頭が `依存:` → 完全一致パターンで検証
   - 一致 → 依存行として認識、行上の `[[id]]` を dependencyIds に収集
   - 不一致 → malformedLines に追加
3. それ以外 → 通常行として `extractRefsFromLine` で被覆引用を抽出

**Rationale**: structured-lines.ts と同じ「行頭パターン + 正規表現」の定型に従う。fail-closed: 行頭 `依存:` の意図を持つ行が文法に合わない場合、被覆引用に静かに落ちない。

### D3: `handleCheckRequest` の検証を分類結果に基づいて分岐する

`extractReferences` の呼び出しを `extractRequestCitations` に差し替え、以下の診断を行う:

1. **R3 (malformed dependency line)**: malformedLines が 1 件でもあれば error 診断（行番号つき）。即座に他の検証を止める必要はないが、diagnostics に追加する
2. **R0 (--require-citation)**: `coverageRefs` から dedup した被覆引用の件数が 0 なら R0 error
3. **R1 (unresolved)**: 被覆引用と依存引用の**両方**について、graph に存在しない ID は R1 error
4. **R2 (implemented coverage citation)**: 被覆引用のみ。implemented 要素は R2 error。依存引用は状態を問わない

同一 ID が依存行と本文の両方に現れた場合:
- 依存行上の出現は dependencyIds に入る（状態不問で R1 のみ）
- 本文上の出現は coverageRefs に入る（R1 + R2 の対象）
- 分類は出現箇所ごと — 依存宣言は被覆引用を免除しない

**Rationale**: architect 評価済み「分類は抽出時に行い、検証側は分類済みの入力を受ける」に従う。

### D4: `handleCoverage` の草稿引用抽出を差し替える

coverage.ts:213-215 の `extractReferences` 呼び出しを `extractRequestCitations` に差し替える:

1. malformedLines が存在すれば error 出力して exit 1
2. `draftRefs` は `coverageRefs` から構築（dependencyIds を含めない）
3. `verifyCoverage` のシグネチャは不変

**Rationale**: architect 評価済み「verifyCoverage に依存行の知識を足さない。分類は呼び出し側の責務」に従う。

### D5: R3 診断コードの追加

CheckDiagnostic の `code` フィールドに `"R3"` を使用する。code フィールドは string 型であり型の変更は不要。

診断メッセージの書式: `ERROR R3 - malformed dependency line: '<行内容>' (<file>:<line>)`

elementId は null（不正な行から ID を抽出するのは不適切）。

## Risks / Trade-offs

[Risk] `extractRequestCitations` と `extractReferences` でコードフェンス走査ロジックが重複する → Mitigation: `stripInlineCode` と `extractRefsFromLine` は共有する。コードフェンスの toggle ロジック（3行）の重複は許容する。共通化のために `extractReferences` の内部構造を変えると design 文書パースへの波及リスクが生じる

[Risk] 同一 ID の被覆/依存両出現の処理が複雑になる → Mitigation: 分類は出現箇所ごとに独立。`coverageRefs` は Reference[] で行情報を持ち、`dependencyIds` は Set<string> で dedup 済み。検証側は各分類の入力をそれぞれ処理するだけ

[Risk] coverage の malformed 依存行検出が check --request と二重実装になる → Mitigation: 同一の `extractRequestCitations` 関数を使うため、認識ロジックは一箇所。malformed の処理（error 出力）は各コマンドハンドラが行う

## Open Questions

（なし — 仕様は ADR-0024 と spec/integration.md §1 で確定済み）
