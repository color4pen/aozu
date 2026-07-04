# Tasks: aosora findings fixes — format-version fence / topics 書式統一 / CLI ergonomics

<!-- FORMAT REQUIREMENTS:
Task heading format: `## T-NN: <task name>` (2-digit zero-padded, e.g. T-01)
Sub-task format:     `- [ ] <implementation detail>` (checkbox)

Each task MUST end with an **Acceptance Criteria** section listing verifiable conditions.
Tasks must be granular enough for the implementer to execute without additional clarification.
-->

## T-01: format-version フェンスの実装（manifest.ts + 全コマンド + spec/format.md）

### 実装前の確認事項

実装開始前に以下を grep で確認すること:
- `grep -r "format-version" tests/ src/` — テスト用 fixture の `format-version:` 行の有無を確認する。`format-version: 0` が無い fixture があれば、そのテスト内の `writeFile` 呼び出しに `format-version: 0` 行を追加してよい（既存テストの AC 変更ではなくフィクスチャの正規化）
- `grep -n "formatVersion" src/check/manifest.test.ts` — 既存テストが `manifest.formatVersion` 値を直接アサートしていないことを確認する

### ステップ 1: manifest.ts の変更

- [ ] `src/check/manifest.ts` に `SUPPORTED_FORMAT_VERSIONS: Set<string>` を定数として追加する（値: `new Set(["0"])`）。export する
- [ ] `src/check/manifest.ts` の `parseManifest` 関数を修正する: `fm` が存在する（manifest ファイルが在る）が `fm["format-version"]` が文字列でない場合（キー欠落を含む）、`formatVersion: ""` を返す（空文字列のセンチネル）。`fm` 自体が undefined（ファイル不在）の場合は従来どおり `formatVersion: "0"` を返す
- [ ] `src/check/manifest.ts` に `validateFormatVersion(manifest: Manifest, manifestPath: string): CheckDiagnostic | null` を実装して export する。`manifest.formatVersion` が `SUPPORTED_FORMAT_VERSIONS` に属さない場合、以下の CheckDiagnostic を返す:
  - `level: "error"`
  - `code: "C12"`
  - `elementId: null`
  - `message`: 対応バージョン（`"0"`）と「このバージョンのツールを更新する必要があります」（または同旨の英語）を含む文
  - `file: manifestPath`
  - `line: 1`

### ステップ 2: check コマンドの修正

- [ ] `src/cli/commands/check.ts` の `buildPipeline` 関数（normal mode / request mode 共用）で、`parseManifest` の直後に `validateFormatVersion` を呼び出す。non-null なら `[fvDiag]` を返す（または null を返して呼び出し元でエラー処理する）。具体的な実装選択肢:
  - 選択肢 A: `buildPipeline` の返値に `fvDiag?: CheckDiagnostic` を追加し、呼び出し元で処理する
  - 選択肢 B: `buildPipeline` で直接 stderr に書いて null を返す（呼び出し元は null で exit 2 を返す）— ただし check コマンドの violation は exit 1 なので、`buildPipeline` を分岐させるか、呼び出し元で C12 diagnostic を出力して exit 1 を返す形にする
  - **推奨**: `handleCheck`（normal mode）で `manifest` を取得した直後に `validateFormatVersion` を呼び、non-null なら `writeDiagnostics([fvDiag])` して `return 1`。`handleCheckRequest` でも同様
- [ ] `src/cli/commands/check.ts` の `handleCheck`（normal mode パス、行 202 以降）に上記を適用する
- [ ] `src/cli/commands/check.ts` の `handleCheckRequest` にも同様に適用する

### ステップ 3: 他の全コマンドへの適用

以下のファイルそれぞれで、`parseManifest(...)` の直後に `validateFormatVersion(manifest, manifestPath)` を呼び出し、non-null なら stderr にエラーメッセージを書いて `return 2` する:

- [ ] `src/cli/commands/status.ts`（`parseManifest` の行を grep で特定してから編集）
- [ ] `src/cli/commands/plan.ts`
- [ ] `src/cli/commands/coverage.ts`
- [ ] `src/cli/commands/prompt.ts` — `parseManifest` の呼び出しが 3 箇所（derive / session / propagate の各ハンドラ）あるので、それぞれに適用する
- [ ] `src/cli/commands/mark.ts`（`handleMarkImplemented` 内）
- [ ] `src/cli/commands/scaffold.ts`

エラーメッセージの形式（各コマンドで統一）:
```
ERROR CONFIG - unsupported format-version "<value>" in <manifestPath>.
Supported versions: 0. Update your tooling if you are using a newer format.
```
（空文字列センチネルの場合は `"<value>"` を `"(missing)"` 等で表現する）

### ステップ 4: spec/format.md への C12 追記

- [ ] `spec/format.md §10` の閉包検証規則表（C11 の行の下）に C12 を追記する:

  | C12 | manifest の `format-version` が対応集合に属する（現在 `{"0"}`）。実装は全動詞共通の入口ゲート（check コマンドでは C12 規則として診断されるが、他の動詞でも manifest 読み取りの直後に同じ判定が適用される） |

### ステップ 5: テストの追加

- [ ] `src/check/manifest.test.ts` にユニットテストを追加する:
  - `validateFormatVersion` が `formatVersion: "0"` の Manifest で `null` を返す
  - `validateFormatVersion` が `formatVersion: "99"` の Manifest で code `"C12"` の CheckDiagnostic を返す
  - `validateFormatVersion` が `formatVersion: ""` の Manifest（センチネル）で code `"C12"` の CheckDiagnostic を返す
  - C12 診断メッセージに `"0"` と「update」（または「更新」）が含まれる
  - `parseManifest` がファイル不在の場合に `formatVersion: "0"` を返す（変更なし）
  - `parseManifest` がファイル在るが `format-version` キー欠落の場合に `formatVersion: ""` を返す（新規）

- [ ] `src/cli/commands/check.test.ts` に以下のテストを追加する:
  - `format-version: 99` の manifest を持つ fixture で `handleCheck` が exit 1 になる
  - `format-version:` キーなしの manifest を持つ fixture で `handleCheck` が exit 1 になる
  - 上記 2 ケースで stderr に `C12` が含まれる（`writeDiagnostics` の出力を確認）

- [ ] `src/cli/commands/status.test.ts`（または統合テストとして適切な場所）に: 未知 format-version の design/ で `handleStatus`（または相当する関数）が非 0 exit になるテストを追加する

- [ ] `src/cli/commands/plan.test.ts` に: 未知 format-version の design/ で `handlePlan` が非 0 exit になるテストを追加する

- [ ] `src/cli/commands/prompt.test.ts` に: 未知 format-version の design/ で `handlePrompt` の `session` サブコマンドが非 0 exit になるテストを追加する

- [ ] `src/cli/commands/mark.test.ts` に: 未知 format-version の design/ で `handleMarkImplemented` が非 0 exit になるテストを追加する

**Acceptance Criteria**:

- `format-version: 99` の manifest を持つ design/ で `aozu check` が exit 1 になり、stderr に `C12` を含む error 診断が出力される
- `format-version:` キーなしの manifest（ファイルは存在する）を持つ design/ で `aozu check` が exit 1 になり、stderr に `C12` を含む error 診断が出力される
- `format-version: 0` の既存テストがすべて変更なし（green のまま）
- `status` / `plan` / `prompt session` / `mark implemented` のそれぞれで、未知 format-version が非 0 exit を引き起こすことがテストで保証されている
- C12 診断メッセージに対応バージョン `"0"` とツール更新の旨が含まれる
- `spec/format.md §10` に C12 規則が追記されている
- `tsc --noEmit && bun test` が green

---

## T-02: SESSION_GUIDANCE の topics 書式修正と C9 診断メッセージの改善

### ステップ 1: SESSION_GUIDANCE の修正

- [ ] `src/prompt/session.ts` の `SESSION_GUIDANCE` 定数（行 32-48）を修正する。ADR frontmatter の例示ブロック内の `topics:` 行を以下に変更する:
  - 変更前: `topics: top-my-topic`
  - 変更後: `topics: [[top-my-topic]]`
- [ ] 上記変更後、SESSION_GUIDANCE のテキスト全体に `topics: top-` という文字列（`[[` なし）が残っていないことを目視確認する

### ステップ 2: C9 診断メッセージの改善

- [ ] `src/check/rules/c09-adr-topics.ts` の `checkC9` 関数内の診断メッセージ（行 28-34 付近）を修正する。現在のメッセージ:
  ```
  adr element "${adrEl.id}" does not reference any topic (top-*)
  ```
  改善後のメッセージ（例）:
  ```
  adr element "${adrEl.id}" does not reference any topic (top-*). Add "topics: [[top-xxx]]" to the ADR frontmatter.
  ```
  または日本語で「`topics: [[top-xxx]]` を frontmatter に追記する」の旨を含む文。`topics: [[` という部分文字列を含めること

### ステップ 3: テストの追加

- [ ] SESSION_GUIDANCE のテキスト検証テストを追加する（適切な場所: `src/prompt/session.ts` と同じモジュールのテスト、または `src/cli/commands/prompt.test.ts` の session 関連テスト）:
  - `SESSION_GUIDANCE` に `topics: [[top-` が含まれる
  - `SESSION_GUIDANCE` に `topics: top-`（`[[` なし）が含まれない

- [ ] C9 診断メッセージのテストを追加する（`src/check/rules/c09-adr-topics.test.ts` が存在する場合はそこに、なければ新規作成または `src/check/checker.test.ts` に追加）:
  - topic 参照を持たない adr 要素に対する C9 診断メッセージに `topics: [[` が含まれる

**Acceptance Criteria**:

- `SESSION_GUIDANCE` のテキストに `topics: [[top-` が含まれる（テストで固定）
- `SESSION_GUIDANCE` のテキストに plain 形式の `topics: top-`（`[[` なし）が含まれない（テストで固定）
- C9 診断メッセージに `topics: [[` が含まれる（テストで固定）
- `tsc --noEmit && bun test` が green

---

## T-03: scaffold の prefix 自動補完

### ステップ 1: KNOWN_PREFIXES のインポート

- [ ] `src/cli/commands/scaffold.ts` の import 文に `KNOWN_PREFIXES` を追加する:
  ```ts
  import { validateId, extractPrefix, KNOWN_PREFIXES } from "../../parse/id.ts";
  ```

### ステップ 2: prefix 解決ロジックの追加

- [ ] `handleScaffold` の入力解析部（`typeName` と `id` を取得した後、型チェック・ID検証フロー（D5）の手順 3 の前）に prefix 解決ロジックを挿入する。具体的には:

  ```
  // prefix 解決（D3）
  if (!id.startsWith(typePrefix + "-")) {
    const extractedPrefix = extractPrefix(id);   // 最初の "-" 以前の文字列
    if (KNOWN_PREFIXES.has(extractedPrefix) && extractedPrefix !== typePrefix) {
      // 型と矛盾する既知 prefix → exit 2
      process.stderr.write(`ERROR INPUT - ID '${id}' has prefix '${extractedPrefix}', which conflicts with type '${typeName}' (expected prefix: '${typePrefix}')\n`);
      return 2;
    }
    // bare slug または不明な先頭セグメント → 補完
    id = typePrefix + "-" + id;
  }
  ```

  このロジックは既存の D5 validation フロー（heading element チェック・unknown type チェック・ID grammar チェック・prefix チェック）のうち、**ID grammar 検証（validateId 呼び出し）の直前**に挿入すること。`id` 変数を補完後の値で上書きし、以降の検証はその値で進める

- [ ] 補完後の ID が grammar 検証（validateId）・prefix 照合（extractPrefix !== typePrefix）を通過するとき、既存コードの「ID prefix must match type prefix」チェック（ステップ 4）が補完済み ID に対して正しく動作することを確認する（補完後は必ず typePrefix で始まるため、ここで再度 error にならないことを確認）

### ステップ 3: テストの追加

- [ ] `src/cli/commands/scaffold.test.ts` に以下のテストを追加する（loop 有効 fixture を使用）:

  - `scaffold topic concept`（bare slug）が exit 0 になり、`topics/concept.md` が作成され、その frontmatter に `id: top-concept` が含まれることを確認する
  - `scaffold topic top-concept`（フル ID）も同じく exit 0 になり、`topics/concept.md` に `id: top-concept` が含まれることを確認する（両形式が同一ファイルを作成しようとする場合は 2 回目実行が ID 衝突になる点に注意して、別 slug を使うこと）
  - `scaffold topic ent-foo` が exit 2 になることを確認する（型と矛盾する prefix）
  - `scaffold adr 0001-my-decision`（bare slug にハイフンを含む）が exit 0 になり、`id: adr-0001-my-decision` で作成されることを確認する（先頭セグメント `0001` は KNOWN_PREFIXES に無いため補完される）

**Acceptance Criteria**:

- `scaffold topic concept` が `topics/concept.md` を作成し、`id: top-concept` が frontmatter に含まれる（テストで固定）
- `scaffold topic top-concept` が同じ結果になる（テストで固定）
- `scaffold topic ent-foo` が exit 2 になる（テストで固定）
- 既存の scaffold テスト（フル ID 指定のケース）が変更なし（green のまま）
- `tsc --noEmit && bun test` が green

---

## T-04: derive のエラーメッセージ改善と init の manifest テンプレ更新

### ステップ 1: prompt.ts のエラーメッセージ改善

- [ ] `src/cli/commands/prompt.ts` の `handlePromptDerive` 内、`request-template` 欠落エラー（行 204-216 付近）を修正する。現在のエラーメッセージに以下を追加（または置換）する。メッセージに `request-template:` という文字列と、値の具体例（ファイルパスまたはコマンドの形式）を含めること:

  改善例:
  ```
  ERROR CONFIG - missing 'request-template' in manifest frontmatter.
  Add to design/manifest.md frontmatter:
    request-template: path/to/request-template.md
  Value can be a file path (relative to design dir) or a shell command whose stdout is used.
  ```
  （既存メッセージがすでにこの形式に近い場合は、キー名 `request-template:` の記入例が含まれているかのみ確認して不足分を追記する）

- [ ] 同様に `request-output-dir` 欠落エラー（行 218-229 付近）を修正する。メッセージに `request-output-dir:` という文字列と具体例を含めること:

  改善例:
  ```
  ERROR CONFIG - missing 'request-output-dir' in manifest frontmatter.
  Add to design/manifest.md frontmatter:
    request-output-dir: path/to/output/
  ```

### ステップ 2: init.ts の MANIFEST_TEMPLATE 更新

- [ ] `src/cli/commands/init.ts` の `MANIFEST_TEMPLATE` 定数（行 25-35 付近）のコメントブロックに、loop 有効化後に必要になる導出キー 2 つの説明を追加する。追加位置はコメント内の適切な場所（`enabled:` の説明の後、または末尾）。追加内容例:

  ```
  <!-- loop 有効化後、prompt derive を使う場合は以下のキーも追加する:
       request-template: <ファイルパスまたはシェルコマンド>
         - ファイルパスの場合: design dir からの相対パスで内容を読む
         - コマンドの場合: stdout をテンプレートとして使用する
       request-output-dir: <出力先ディレクトリパス>
         - prompt derive が草稿を出力するディレクトリ
       詳細: spec/format.md §3 -->
  ```

### ステップ 3: テストの追加

- [ ] `src/cli/commands/prompt.test.ts` に以下のテストを追加する:
  - loop 有効・`request-template` なしの fixture で `handlePromptDerive` が exit 2 になり、stderr に `request-template:` という文字列が含まれることを確認する
  - loop 有効・`request-template` あり・`request-output-dir` なしの fixture で `handlePromptDerive` が exit 2 になり、stderr に `request-output-dir:` という文字列が含まれることを確認する

**Acceptance Criteria**:

- `request-template` 欠落エラーの stderr に `request-template:` という文字列が含まれる（テストで固定）
- `request-output-dir` 欠落エラーの stderr に `request-output-dir:` という文字列が含まれる（テストで固定）
- `MANIFEST_TEMPLATE` のコメントに `request-template` と `request-output-dir` の説明が追加されている
- 既存テストが変更なし（green のまま）
- `tsc --noEmit && bun test` が green

---

## T-05: mark implemented の positional slug 受理と mark --help 改善

### ステップ 1: handleMark の --help 改善

- [ ] `src/cli/commands/mark.ts` の `handleMark` 内、`--help` の出力（行 50-63 付近）を修正する。`implemented` サブコマンドの説明行の後または help テキスト末尾に、主要オプション（`--request <slug>` / `<slug>` positional / `--pr <number>` / `--dir <path>`）の要約を追記する:

  改善例:
  ```
  Usage: aozu mark <subcommand> [options]

  Sub-commands:
    implemented  Transition requested elements to implemented state
                 Usage: aozu mark implemented <slug> [--pr <number>] [--dir <path>]
                         aozu mark implemented --request <slug> [--pr <number>] [--dir <path>]

  Run 'aozu mark implemented --help' for details.

  Exit codes: 0 = success / 1 = unknown slug or loop disabled / 2 = input error
  ```

### ステップ 2: handleMarkImplemented の positional slug 解析

- [ ] `src/cli/commands/mark.ts` の `handleMarkImplemented` 関数を修正する。`--request` の解析（行 122-130 付近）の**前に**、positional slug の抽出ロジックを追加する:

  ```ts
  // Extract positional slug (first arg that does not start with '-')
  const positionalSlug = args.find((a) => !a.startsWith("-"));

  // Parse --request
  const requestIdx = args.indexOf("--request");
  const requestSlug = requestIdx >= 0 ? args[requestIdx + 1] : undefined;

  // Resolve slug: positional and --request must not conflict
  const slug = (() => {
    if (positionalSlug && requestSlug && positionalSlug !== requestSlug) {
      process.stderr.write(
        `ERROR INPUT - conflicting slug: positional '${positionalSlug}' and --request '${requestSlug}' must match\n` +
        `Usage: aozu mark implemented <slug> [options]\n`
      );
      return null; // signals error
    }
    return requestSlug ?? positionalSlug;
  })();

  if (slug === null) return 2;
  if (!slug) {
    process.stderr.write(
      "ERROR INPUT - missing slug\nUsage: aozu mark implemented <slug> [--pr <number>] [--dir <path>]\n"
    );
    return 2;
  }
  ```

  - `args.find((a) => !a.startsWith("-"))` は `--request` フラグの**値**（flag の後ろの引数）も拾ってしまう可能性がある。フラグ値と positional を区別するため、フラグペア（`--flag value`）をスキップする改良版を使うこと。具体的には: `--` で始まるトークンの直後のトークンはフラグ値とみなしてスキップするループを使う
  - または、`--request` / `--pr` / `--dir` のフラグ値として使われるトークンのインデックスを事前に収集し、それ以外かつ `--` で始まらないトークンを positional として扱う

- [ ] 既存の `slug` 変数の命名衝突を避けるため、従来の `slug` 定数は削除し、上記ロジックで導出した `slug` 変数に一本化する

- [ ] `handleMarkImplemented` の `--help` の Usage 行も positional 形式を含むよう更新する:
  ```
  Usage: aozu mark implemented <slug> [--pr <number>] [--dir <path>]
         aozu mark implemented --request <slug> [--pr <number>] [--dir <path>]
  ```

### ステップ 3: テストの追加

- [ ] `src/cli/commands/mark.test.ts` に以下のテストを追加する:

  - positional slug で `handleMarkImplemented` が遷移を行い exit 0 になることを確認する（`handleMarkImplemented(["foundation", "--dir", designDir])` 形式）
  - positional slug と `--request` が同じ値なら正常動作することを確認する（`handleMarkImplemented(["foundation", "--request", "foundation", "--dir", designDir])`）
  - positional slug と `--request` が異なる値なら exit 2 になることを確認する（`handleMarkImplemented(["foo", "--request", "bar", "--dir", designDir])`）
  - 既存の `--request foundation` 形式テストが変更なし（green のまま）

**Acceptance Criteria**:

- `mark implemented <slug>` (positional) が `mark implemented --request <slug>` と同じ遷移を行い exit 0 になる（テストで固定）
- `mark implemented foo --request bar`（食い違い）が exit 2 になる（テストで固定）
- `--request` 形式の既存テストが変更なし（green のまま）
- `aozu mark --help` の出力に `--request <slug>` または positional 形式の説明が含まれている
- `tsc --noEmit && bun test` が green

---

## 最終確認（全 Task 完了後）

- [ ] `tsc --noEmit` が 0 exit（型エラーなし）
- [ ] `bun test` が green（既存テスト変更なし・新規テスト追加分も green）
- [ ] `dependencies` フィールドが空のまま（`package.json` の `dependencies` に新規追加なし）
- [ ] この design/ の `aozu check` が通る（aozu 自己適用）
