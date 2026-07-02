# Test Cases: skeleton-and-parser

## Summary

- **Total**: 38 cases
- **Automated** (unit/integration): 35
- **Manual**: 3
- **Priority**: must: 25, should: 13, could: 0

---

### TC-001: Parse design/ and count 25 declared elements

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL extract all element declarations from valid design documents > Scenario: Parse design/ and count 25 declared elements

---

### TC-002: Heading element extraction from h2 heading

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL extract all element declarations from valid design documents > Scenario: Heading element extraction

---

### TC-003: Document element extraction via frontmatter id field

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL extract all element declarations from valid design documents > Scenario: Document element extraction via frontmatter

---

### TC-004: Parse design/ and count 15 unique reference target IDs

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL extract all unique references from design documents > Scenario: Parse design/ and count 15 unique reference target IDs

---

### TC-005: Inline code exclusion validated against invariants.md fixture

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL exclude references inside code fences and inline code > Scenario: Inline code exclusion in invariants.md

---

### TC-006: Code fence exclusion suppresses [[id]] extraction

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL exclude references inside code fences and inline code > Scenario: Code fence exclusion

---

### TC-007: Dependency edge extraction from static/dependencies.md

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL extract dependency edges from dependencies.md > Scenario: Parse static/dependencies.md

---

### TC-008: Uppercase ID produces positioned diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL report ID grammar violations as positioned diagnostics > Scenario: Uppercase ID produces diagnostic

---

### TC-009: Invalid character in ID produces positioned diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL report ID grammar violations as positioned diagnostics > Scenario: Invalid characters in ID

---

### TC-010: Nested frontmatter produces positioned diagnostic

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL report non-flat frontmatter as positioned diagnostics > Scenario: Nested frontmatter produces diagnostic

---

### TC-011: Parser API accepts in-memory input without file I/O

**Category**: unit
**Priority**: must
**Source**: spec.md > Requirement: The parser SHALL be a pure function with no file I/O > Scenario: Parser accepts in-memory input

---

### TC-012: 責務 line text associated with preceding element

**Category**: unit
**Priority**: should
**Source**: spec.md > Requirement: The parser SHALL recognize structured lines per spec format.md section 8 > Scenario: 責務 line recognition

---

### TC-013: package.json dependencies field is empty or absent

**Category**: integration
**Priority**: must
**Source**: spec.md > Requirement: package.json SHALL have empty dependencies > Scenario: Verify dependencies field

---

### TC-014: tsc --noEmit and bun test both exit with status 0

**Category**: manual
**Priority**: must
**Source**: spec.md > Requirement: Type checking and tests SHALL pass > Scenario: Full verification

---

### TC-015: Valid IDs are accepted by ID validation function

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-03: ID 文法検証の実装

**GIVEN** the strings `"mod-parse"`, `"ent-order"`, and `"seq-closure-check"`
**WHEN** each is passed to the ID validation function
**THEN** all three return valid with no errors

---

### TC-016: Unknown prefix is rejected by ID validation

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03: ID 文法検証の実装

**GIVEN** the string `"xxx-foo"` (prefix `xxx` is not in the known prefix list)
**WHEN** the ID validation function is called
**THEN** it returns invalid, indicating an unknown prefix

---

### TC-017: Prefix-only or no-prefix ID is rejected by ID validation

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-03: ID 文法検証の実装

**GIVEN** the string `"parse"` (no hyphen, no recognized prefix)
**WHEN** the ID validation function is called
**THEN** it returns invalid, indicating the ID does not conform to `prefix "-" slug` grammar

---

### TC-018: Comma-separated frontmatter values are converted to string array

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-04: frontmatter パーサの実装

**GIVEN** a file whose frontmatter contains the line `enabled: static, domain`
**WHEN** the frontmatter parser processes the file
**THEN** the `"enabled"` key maps to `["static", "domain"]` (trimmed string array)

---

### TC-019: File with no frontmatter returns empty record with no diagnostics

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04: frontmatter パーサの実装

**GIVEN** a Markdown file that contains no `---` delimiter at the top
**WHEN** the frontmatter parser processes the file
**THEN** an empty `Record` is returned and no diagnostics are produced

---

### TC-020: Unclosed frontmatter block does not throw an exception

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-04: frontmatter パーサの実装

**GIVEN** a file that starts with `---` but never has a closing `---`
**WHEN** the frontmatter parser processes the file
**THEN** no exception is thrown; available key-value pairs up to EOF are returned (or empty), and any ambiguity may be reported as a diagnostic

---

### TC-021: Multiple [[id]] references on the same line are all extracted

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05: 参照抽出の実装（コードフェンス・インラインコード除外）

**GIVEN** a body line containing `[[mod-cli]] and [[mod-parse]] and [[mod-graph]]`
**WHEN** reference extraction is performed on that line
**THEN** all three IDs (`mod-cli`, `mod-parse`, `mod-graph`) appear in the extracted references with the same line number

---

### TC-022: Inline code and normal reference coexist correctly on the same line

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-05: 参照抽出の実装（コードフェンス・インラインコード除外）

**GIVEN** a body line containing `` `[[mod-cli]]` and [[mod-parse]] ``
**WHEN** reference extraction is performed
**THEN** `"mod-parse"` is present in the extracted references; `"mod-cli"` (inside backticks) is NOT present

---

### TC-023: Code fence with language specifier still triggers fence-state toggle

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-05: 参照抽出の実装（コードフェンス・インラインコード除外）

**GIVEN** a file containing:
```
```markdown
[[mod-parse]]
```
```
**WHEN** reference extraction is performed over the full file
**THEN** `"mod-parse"` is NOT in the extracted references (the language specifier after ` ``` ` does not prevent fence-state entry)

---

### TC-024: h3 heading (###) is extracted as an element declaration

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-06: 宣言抽出の実装

**GIVEN** a file containing the line `### 小見出し {#inv-foo}`
**WHEN** the file is parsed
**THEN** an element is extracted with `id: "inv-foo"`, `prefix: "inv"`, `displayName: "小見出し"`, and the correct file path and line number

---

### TC-025: h1 heading (#) is NOT extracted as an element declaration

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-06: 宣言抽出の実装

**GIVEN** a file containing the line `# トップ見出し {#top-foo}`
**WHEN** the file is parsed
**THEN** no element with `id: "top-foo"` appears in the extracted elements (only h2/h3 headings qualify)

---

### TC-026: Invalid ID in heading yields element record AND diagnostic (no exception)

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-06: 宣言抽出の実装

**GIVEN** a file containing the line `## Foo {#Mod-Parse}` (uppercase in ID)
**WHEN** the file is parsed
**THEN** the parse result contains a diagnostic with the file path, line number, and an ID grammar violation message; no exception is thrown

---

### TC-027: 実装 line values are parsed as a comma-separated list

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-07: 構造化行の認識

**GIVEN** a structured line `実装: src/cli/, src/core/`
**WHEN** structured-line recognition is applied
**THEN** the implementation field contains `["src/cli/", "src/core/"]` (trimmed entries)

---

### TC-028: 登場要素 section list items are recognized as element references

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-07: 構造化行の認識

**GIVEN** a file section containing `## 登場要素` followed by `- [[mod-cli]]` and `- [[mod-parse]]`
**WHEN** structured-line recognition is applied
**THEN** both `"mod-cli"` and `"mod-parse"` are recognized as 登場要素 list entries (distinct from body references)

---

### TC-029: elements body line items are recognized

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-07: 構造化行の認識

**GIVEN** a structured line `elements: [[ent-order]], [[inv-3]]`
**WHEN** structured-line recognition is applied
**THEN** `"ent-order"` and `"inv-3"` are extracted as element reference entries from the `elements:` field

---

### TC-030: Multiple file parse results are correctly merged into a single ParseResult

**Category**: unit
**Priority**: must
**Source**: tasks.md > T-08: メインパーサの統合

**GIVEN** two in-memory files: file A containing one element declaration and one reference; file B containing one element declaration and one reference
**WHEN** `parseFiles([fileA, fileB])` is called
**THEN** the returned `ParseResult` contains 2 elements and 2 references (from both files combined), with correct `file` paths on each record

---

### TC-031: Empty file array returns an empty ParseResult

**Category**: unit
**Priority**: should
**Source**: tasks.md > T-08: メインパーサの統合

**GIVEN** an empty array `[]`
**WHEN** `parseFiles([])` is called
**THEN** the returned `ParseResult` has empty arrays for `elements`, `references`, `dependencyEdges`, and `diagnostics`

---

### TC-032: fs reader returns all .md files from design/ as FileInput[]

**Category**: integration
**Priority**: should
**Source**: tasks.md > T-09: ファイル読み込み層の実装

**GIVEN** the `design/` directory containing 8 Markdown files
**WHEN** the fs reader function is called with `"design/"` as the target directory
**THEN** 8 `FileInput` objects are returned, each with a non-empty `path` string and non-empty `content` string

---

### TC-033: Exact 25-element ID regression list matches expected IDs

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-10: design/ 全文書に対する統合テスト

**GIVEN** the `design/` directory is parsed via `parseFiles`
**WHEN** the set of extracted element IDs is compared against the known-good list
**THEN** the set exactly equals: `ent-artifact`, `ent-element`, `ent-manifest`, `ent-reference`, `ent-state-entry`, `inv-deterministic-verdict`, `inv-fail-closed-deps`, `inv-immutable-id`, `inv-single-reference-grammar`, `inv-tool-writes-state`, `mod-check`, `mod-cli`, `mod-diff`, `mod-export`, `mod-gitread`, `mod-graph`, `mod-parse`, `mod-plan`, `mod-prompt`, `mod-state`, `seq-closure-check`, `seq-rules-export`, `term-closure`, `term-degradation`, `term-frontier` (25 IDs, no more, no less)

---

### TC-034: Exact 15 reference target ID regression list matches expected IDs

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-10: design/ 全文書に対する統合テスト

**GIVEN** the `design/` directory is parsed via `parseFiles`
**WHEN** the set of unique reference target IDs is collected
**THEN** the set exactly equals: `ent-artifact`, `ent-element`, `ent-reference`, `ent-state-entry`, `mod-check`, `mod-cli`, `mod-diff`, `mod-export`, `mod-gitread`, `mod-graph`, `mod-parse`, `mod-plan`, `mod-prompt`, `mod-state`, `term-closure` (15 IDs, no more, no less)

---

### TC-035: design/static/dependencies.md yields exactly 16 dependency edges

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-10: design/ 全文書に対する統合テスト

**GIVEN** `design/static/dependencies.md` is parsed
**WHEN** `DependencyEdge` records are collected from the parse result
**THEN** exactly 16 edges are returned, each with valid `from`, `to`, `file`, and `line` fields

---

### TC-036: Normal design/ parse produces zero diagnostics

**Category**: integration
**Priority**: must
**Source**: tasks.md > T-11: 診断テスト

**GIVEN** the `design/` directory (which must be valid per the format specification)
**WHEN** all files are parsed
**THEN** the `diagnostics` array in the returned `ParseResult` is empty (no ID violations, no non-flat frontmatter)

---

### TC-037: tsconfig.json contains required strict configuration options

**Category**: manual
**Priority**: should
**Source**: design.md > D7: tsconfig.json の strict 構成

**GIVEN** the `tsconfig.json` file at the repository root
**WHEN** the file is inspected
**THEN** the following options are all present: `"strict": true`, `"noEmit": true`, `"moduleResolution": "bundler"`, `"types": ["bun-types"]`, and `"include": ["src/**/*.ts"]`

---

### TC-038: tools/check.sh still reports OK after implementation

**Category**: manual
**Priority**: should
**Source**: tasks.md > T-13: 最終検証

**GIVEN** the implementation is complete and all source files are committed
**WHEN** `bash tools/check.sh design` is executed
**THEN** the output reports `OK: 宣言 25 要素 / 参照 15 種` (identical to the pre-implementation baseline; the bash checker is not broken by the new TypeScript files)

---

## Result

```yaml
result: completed
total: 38
automated: 35
manual: 3
must: 25
should: 13
could: 0
blocked_reasons: []
```
