# Tasks: dependency-citation

## T-01: request-citations.ts — 依存行認識と引用分類関数の実装

- [x] `src/parse/request-citations.ts` を新規作成する
- [x] 返り値の型 `RequestCitationResult` を定義する:
  ```
  interface RequestCitationResult {
    coverageRefs: Reference[];   // 依存行の外の通常引用
    dependencyIds: Set<string>;  // 依存行上の [[id]] の targetId 集合
    malformedLines: { line: number; text: string }[]; // 行頭 依存: だが文法不一致
  }
  ```
- [x] `extractRequestCitations(content: string, filePath: string): RequestCitationResult` を実装する
- [x] 行走査で以下を処理する:
  1. コードフェンス toggle（`line.trimStart().startsWith("```")`）— フェンス内は skip
  2. 行頭 `依存:` の検出 → 完全一致パターン `^依存: \[\[[a-z0-9-]+\]\](, \[\[[a-z0-9-]+\]\])*$` で検証
     - 一致 → 行上の `[[id]]` を dependencyIds に追加
     - 不一致 → malformedLines に `{ line, text }` を追加
  3. 通常行 → `extractRefsFromLine(line)` で被覆引用を抽出し coverageRefs に追加
- [x] `stripInlineCode` と `extractRefsFromLine` は `./references.ts` から import して再利用する
- [x] `src/parse/index.ts` に `extractRequestCitations` と `RequestCitationResult` のエクスポートを追加する

**Acceptance Criteria**:
- `extractRequestCitations` が `依存: [[a]], [[b]]` 行から dependencyIds `{"a", "b"}` を返す
- 本文の `[[c]]` は coverageRefs に入り dependencyIds には入らない
- `依存: [[a]] と [[b]]` は malformedLines に入り、coverageRefs にも dependencyIds にも入らない
- `依存:` や `依存:   ` は malformedLines に入る
- コードフェンス内の `依存:` 行は無視される（dependencyIds にも malformedLines にも入らない）
- インラインコード内の `[[id]]` は coverageRefs に入らない
- 同一 ID が依存行と本文の両方にある場合、dependencyIds と coverageRefs の両方に含まれる
- 依存行の無い文書は coverageRefs に全引用、dependencyIds は空、malformedLines は空
- `bunx tsc --noEmit` が通る

## T-02: request-citations.test.ts — 分類関数のユニットテスト

- [x] `src/parse/request-citations.test.ts` を新規作成する
- [x] 以下のテストケースを実装する:
  - 単一依存行（`依存: [[ent-a]]`）→ dependencyIds に ent-a
  - 複数 ID の依存行（`依存: [[ent-a]], [[ent-b]]`）→ dependencyIds に両方
  - 複数の依存行 → dependencyIds に全 ID が集約
  - 本文の被覆引用 → coverageRefs に含まれる
  - 依存行と本文に同一 ID → 両方に含まれる
  - malformed 依存行（`依存: [[ent-a]] と [[ent-b]]`）→ malformedLines に入る
  - malformed 依存行（`依存:`、`依存:   `）→ malformedLines に入る
  - コードフェンス内の `依存:` 行 → 無視
  - コードフェンス内の `[[id]]` → coverageRefs に入らない
  - インラインコード内の `[[id]]` → coverageRefs に入らない
  - 依存行の無い文書 → 既存の extractReferences と同一の被覆引用、dependencyIds 空、malformedLines 空
- [x] `bun test src/parse/request-citations.test.ts` が green

**Acceptance Criteria**:
- 上記の全テストケースが pass する
- 依存行の無い文書のテストで `extractReferences` の結果と `coverageRefs` が同等であることを検証する

## T-03: check.ts — handleCheckRequest の二種類化

- [x] `src/cli/commands/check.ts` に `extractRequestCitations` の import を追加する
- [x] `handleCheckRequest` 内の `extractReferences` 呼び出しを `extractRequestCitations` に差し替える
- [x] malformedLines の処理を追加: 各行に対して R3 error 診断を生成する
  ```
  {
    level: "error",
    code: "R3",
    elementId: null,
    message: `malformed dependency line: '${text}'`,
    file: requestPath,
    line: lineNumber,
  }
  ```
- [x] R0 の判定を変更: `coverageRefs` から dedup した被覆引用の件数が 0 なら R0（従来は全引用で判定）
- [x] R1 の判定を変更: 被覆引用の uniqueIds と dependencyIds の両方について、graph に存在しない ID は R1
- [x] R2 の判定を変更: 被覆引用の uniqueIds のみ。implemented 要素は R2（dependencyIds は状態を問わない）
- [x] `extractReferences` の import が不要になった場合は削除する（他に使用箇所がないことを確認）

**Acceptance Criteria**:
- `依存: [[ent-a]]` で ent-a が implemented → exit 0
- 本文の `[[ent-a]]` で ent-a が implemented → R2 で exit 1
- 同一 ID が依存行と本文の両方 → 本文側が R2 の対象
- 依存行の未解決 ID → R1 で exit 1
- `依存: [[ent-a]] と [[ent-b]]` → R3 で exit 1
- `--require-citation` で被覆引用 0 件（依存引用のみ）→ R0 で exit 1
- 依存行の無い request 文書の挙動が既存と完全一致
- `bunx tsc --noEmit` が通る

## T-04: check-request.test.ts — check --request の依存引用テスト追加

- [x] `src/cli/commands/check-request.test.ts` に以下のテストを追加する:
  - implemented 要素の依存引用が exit 0（受け入れ基準 #1）
  - 同一 ID が本文にもある場合、implemented なら R2 で exit 1（受け入れ基準 #2）
  - 依存行の未解決 ID は R1 で exit 1（受け入れ基準 #3）
  - 文法不一致の依存行が R3 で exit 1（受け入れ基準 #4）
  - `--require-citation` で被覆引用 0 件（依存引用のみ）→ R0 で exit 1（受け入れ基準 #5）
  - コードフェンス内の `依存:` 行は無視される（受け入れ基準 #6）
  - 依存行の無い既存テストが全て引き続き green（受け入れ基準 #8）
- [x] テストフィクスチャに `createDesignFixture` の拡張が必要な場合は追加する（implemented 状態の要素が必要）
- [x] `bun test src/cli/commands/check-request.test.ts` が green

**Acceptance Criteria**:
- 受け入れ基準 #1〜#6, #8 に対応するテストがすべて pass する
- 既存テストが無変更で green

## T-05: coverage.ts — 草稿引用抽出の依存行対応

- [x] `src/cli/commands/coverage.ts` に `extractRequestCitations` の import を追加する
- [x] 草稿の引用抽出箇所（L213-215）を差し替える:
  ```typescript
  const draftContent = await Bun.file(draftPath).text();
  const citations = extractRequestCitations(draftContent, draftPath);
  ```
- [x] malformedLines の処理を追加: 1 件でもあれば error 出力して return 1
  ```typescript
  if (citations.malformedLines.length > 0) {
    for (const ml of citations.malformedLines) {
      process.stderr.write(
        `COVERAGE ERROR R3 - malformed dependency line: '${ml.text}' (${draftPath}:${ml.line})\n`
      );
    }
    return 1;
  }
  ```
- [x] `draftRefs` を `coverageRefs` から構築する（dependencyIds を含めない）:
  ```typescript
  const draftRefs = new Set(citations.coverageRefs.map((r) => r.targetId));
  ```
- [x] `extractReferences` の import が不要になった場合は削除する

**Acceptance Criteria**:
- 依存行にしか現れない要素は NOT_COVERED で exit 1（受け入れ基準 #7）
- 草稿に不正な依存行があれば error で exit 1
- 依存行の無い草稿の挙動が既存と完全一致（受け入れ基準 #8）
- `verifyCoverage` のシグネチャが不変
- `bunx tsc --noEmit` が通る

## T-06: coverage.test.ts — coverage の依存行テスト追加

- [x] `src/cli/commands/coverage.test.ts` に以下のテストを追加する:
  - 依存行にしか現れない要素が NOT_COVERED で exit 1（受け入れ基準 #7）
  - 草稿に不正な依存行があれば exit 1
  - 依存行と本文の両方に引用がある要素は被覆される（exit 0）
  - 依存行の無い既存テストが全て引き続き green（受け入れ基準 #8）
- [x] `bun test src/cli/commands/coverage.test.ts` が green

**Acceptance Criteria**:
- 受け入れ基準 #7, #8 に対応するテストがすべて pass する
- 既存テストが無変更で green

## T-07: 全体検証 — tsc / bun test / design check

- [x] `bunx tsc --noEmit` が green
- [x] `bun test` が全 green（既存テスト含む）
- [x] aozu 自身の `bun src/cli/main.ts check --dir design` の結果が不変（受け入れ基準 #9）

**Acceptance Criteria**:
- `bunx tsc --noEmit` が exit 0
- `bun test` が全件 pass
- aozu 自身の design/ check が exit 0
