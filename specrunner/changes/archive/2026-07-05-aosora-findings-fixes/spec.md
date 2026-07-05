# Spec: aosora findings fixes — format-version fence / topics 書式統一 / CLI ergonomics

## Requirements

### Requirement: format-version が対応集合外の manifest は全動詞で error になる

The tool SHALL reject any manifest whose `format-version` value is not in the supported set (currently `{"0"}`), including absent keys, by emitting a C12 error diagnostic and exiting with a non-zero code. The diagnostic message SHALL include the supported version (`"0"`) and a notice to update the tooling.

ツールが対応する `format-version` の集合（現在 `{"0"}`）を定数として一箇所に定義し、manifest の `format-version` がその集合に属さない場合（未知の値・キー欠落を含む）、**manifest を読む全動詞が** C12 エラー診断を出力して非 0 exit しなければならない。診断メッセージには対応バージョン（`"0"`）と「ツールを更新する」旨を含めなければならない。

#### Scenario: 未知 format-version の design/ で check が不合格になる

**Given** manifest の `format-version:` が対応集合外の値（例: `99`）
**When** `aozu check` を実行する
**Then** C12 error 診断を出力して exit 1 になる

#### Scenario: format-version キーが欠落した design/ で check が不合格になる

**Given** manifest frontmatter に `format-version:` キーが存在しない
**When** `aozu check` を実行する
**Then** C12 error 診断を出力して exit 1 になる

#### Scenario: format-version: 0 の design/ で check が影響を受けない

**Given** manifest の `format-version: 0`（対応集合内）
**When** `aozu check` を実行する
**Then** C12 診断は生成されず、他の診断結果も変化しない

#### Scenario: 未知 format-version の design/ で status が error になる

**Given** manifest の `format-version:` が対応集合外の値
**When** `aozu status` を実行する
**Then** error メッセージを stderr に出力して非 0 exit する

#### Scenario: 未知 format-version の design/ で plan が error になる

**Given** manifest の `format-version:` が対応集合外の値
**When** `aozu plan` を実行する
**Then** error メッセージを stderr に出力して非 0 exit する

#### Scenario: 未知 format-version の design/ で prompt session が error になる

**Given** manifest の `format-version:` が対応集合外の値
**When** `aozu prompt session` を実行する
**Then** error メッセージを stderr に出力して非 0 exit する

#### Scenario: 未知 format-version の design/ で mark implemented が error になる

**Given** manifest の `format-version:` が対応集合外の値
**When** `aozu mark implemented --request <slug>` を実行する
**Then** error メッセージを stderr に出力して非 0 exit する

---

### Requirement: topics の正書式はブラケット付きで SESSION_GUIDANCE に例示される

The `SESSION_GUIDANCE` constant SHALL use bracket notation (`topics: [[top-xxx]]`) when showing the `topics:` field in ADR examples, and MUST NOT contain any plain-form example (`topics: top-xxx` without brackets).

`SESSION_GUIDANCE` の ADR 例示に `topics:` フィールドを含める場合、値はブラケット付き（`[[top-xxx]]`）でなければならない。plain 形式（`topics: top-xxx`）を例示してはならない。

#### Scenario: SESSION_GUIDANCE がブラケット形式を含む

**Given** SESSION_GUIDANCE 定数のテキスト
**When** テキストを検査する
**Then** `topics: [[top-` という文字列が含まれる

#### Scenario: SESSION_GUIDANCE が plain 形式を含まない

**Given** SESSION_GUIDANCE 定数のテキスト
**When** テキストを検査する
**Then** `topics: top-` という文字列（`[[` なし）が含まれない

---

### Requirement: C9 の診断メッセージに frontmatter の正書式への言及が含まれる

The C9 diagnostic message SHALL include guidance on the correct frontmatter syntax (`topics: [[top-xxx]]`) as the remediation action.

C9 違反の診断メッセージは、ADR frontmatter への `topics: [[top-xxx]]` 記入が修正手順であることを含めなければならない。

#### Scenario: C9 診断メッセージが正書式を示す

**Given** topic 参照を持たない adr 要素がある
**When** check が C9 を診断する
**Then** 診断メッセージに `topics: [[` という文字列が含まれる

---

### Requirement: scaffold はドキュメント型で prefix を自動補完する

The `scaffold` command SHALL auto-complete the type prefix when the given `<id>` does not already begin with the expected prefix, and SHALL reject with exit 2 any `<id>` whose leading segment is a known prefix that conflicts with the specified type.

`scaffold <type> <id>` において、`<id>` が該当 type の prefix で始まらない場合:
- `<id>` の先頭セグメント（最初の `-` 以前の文字列）が既知 prefix（spec/format.md §4 の全 prefix）かつ type の prefix と異なる → error（exit 2）
- それ以外（bare slug または未知の先頭セグメント）→ `{typePrefix}-{id}` に自動補完して処理を続行する

フル ID（`typePrefix-` で始まる）は引き続き受理する。

#### Scenario: bare slug で scaffold topic が prefix を補完する

**Given** `aozu scaffold topic concept`（`topic` 型、`top-` なしの bare slug）
**When** scaffold を実行する（loop 有効な design/ が存在する）
**Then** `topics/concept.md` が作成され、frontmatter の `id:` が `top-concept` になる

#### Scenario: フル ID を渡した scaffold topic も受理される

**Given** `aozu scaffold topic top-concept`
**When** scaffold を実行する
**Then** `scaffold topic concept` と同じ結果（`topics/concept.md`、`id: top-concept`）になる

#### Scenario: 型と矛盾する prefix は error になる

**Given** `aozu scaffold topic ent-foo`（`topic` 型に対して `ent` prefix）
**When** scaffold を実行する
**Then** exit 2 で終了し、エラーメッセージを stderr に出力する

---

### Requirement: derive の config エラーメッセージに frontmatter の記入例を含める

When `prompt derive` detects a missing `request-template` or `request-output-dir` key, the error message SHALL include the concrete key name and an example value format so the user knows exactly what to add to the manifest frontmatter.

`prompt derive` が `request-template` / `request-output-dir` キーの欠落を検出した場合のエラーメッセージは、manifest frontmatter に追記する具体的なキー名と値の形式（`request-template: <path-or-command>` の形式）を含めなければならない。

#### Scenario: request-template 欠落エラーに記入例が含まれる

**Given** manifest に `request-template:` キーがない
**When** `aozu prompt derive --group <grp-id>` を実行する
**Then** stderr に `request-template:` という文字列が含まれるエラーメッセージが出力される

#### Scenario: request-output-dir 欠落エラーに記入例が含まれる

**Given** manifest に `request-output-dir:` キーがない（`request-template:` は存在する）
**When** `aozu prompt derive --group <grp-id>` を実行する
**Then** stderr に `request-output-dir:` という文字列が含まれるエラーメッセージが出力される

---

### Requirement: mark implemented は positional slug を受理する

`mark implemented` SHALL accept a positional slug argument as equivalent to `--request <slug>`. When both a positional slug and `--request` are provided with conflicting values, the command SHALL exit with code 2.

`mark implemented <slug>` の形式（slug を positional 引数として渡す）は、`mark implemented --request <slug>` と等価に動作しなければならない。`--request` と positional の両方が指定されて値が食い違う場合は exit 2 でなければならない。

#### Scenario: positional slug で mark implemented が成功する

**Given** state.json に `request: "foundation"` で `state: "requested"` のエントリがある
**When** `aozu mark implemented foundation`（positional slug）を実行する
**Then** 対象エントリが `state: "implemented"` に遷移し、exit 0 になる

#### Scenario: positional slug と --request の食い違いは exit 2

**Given** 任意の loop 有効 design/
**When** `aozu mark implemented foo --request bar`（positional と --request が異なる値）を実行する
**Then** exit 2 でエラーメッセージを stderr に出力する

#### Scenario: --request 形式の既存呼び出しに影響しない

**Given** state.json に `request: "foundation"` で `state: "requested"` のエントリがある
**When** `aozu mark implemented --request foundation`（--request 形式）を実行する
**Then** 対象エントリが `state: "implemented"` に遷移し、exit 0 になる（従来と同じ動作）
