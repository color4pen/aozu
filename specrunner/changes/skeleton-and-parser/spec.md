# Spec: skeleton-and-parser

## Requirements

### Requirement: The parser SHALL extract all element declarations from valid design documents

The parser SHALL extract heading elements matching `^#{2,3} (.+) \{#(<id>)\}$` and document elements declared via frontmatter `id:` field. Each extracted element SHALL include its ID, type prefix, display name, source file path, and 1-based line number.

#### Scenario: Parse design/ and count 25 declared elements

**Given** the `design/` directory containing the aozu self-description documents (manifest.md, static/modules.md, static/dependencies.md, domain/glossary.md, domain/model.md, domain/invariants.md, dynamic/closure-check.md, dynamic/rules-export.md)
**When** all files are parsed
**Then** exactly 25 unique element declarations are extracted, matching the output of `tools/check.sh`

#### Scenario: Heading element extraction

**Given** a file containing `## パーサ {#mod-parse}`
**When** the file is parsed
**Then** an element is extracted with id `mod-parse`, prefix `mod`, displayName `パーサ`, and the correct file path and line number

#### Scenario: Document element extraction via frontmatter

**Given** a file containing frontmatter `id: seq-closure-check`
**When** the file is parsed
**Then** an element is extracted with id `seq-closure-check` and prefix `seq`

### Requirement: The parser SHALL extract all unique references from design documents

The parser SHALL extract `[[id]]` references from body text. Each reference SHALL include the target ID, source file path, and 1-based line number.

#### Scenario: Parse design/ and count 15 unique reference target IDs

**Given** the `design/` directory documents
**When** all files are parsed
**Then** the set of unique reference target IDs has exactly 15 members, matching `tools/check.sh`

### Requirement: The parser SHALL exclude references inside code fences and inline code

The parser SHALL NOT extract `[[id]]` occurrences within code fences (lines between `` ``` `` toggles) or within inline code (backtick-delimited spans) as references.

#### Scenario: Inline code exclusion in invariants.md

**Given** `design/domain/invariants.md` containing `` `[[id]]` `` (inline code reference to the grammar itself)
**When** the file is parsed
**Then** the `[[id]]` inside inline code is NOT present in the extracted references

#### Scenario: Code fence exclusion

**Given** a file containing:
```
\`\`\`
[[mod-parse]]
\`\`\`
```
**When** the file is parsed
**Then** `mod-parse` from the fenced block is NOT present in the extracted references

### Requirement: The parser SHALL extract dependency edges from dependencies.md

The parser SHALL recognize lines matching `^- \[\[<id>\]\] -> \[\[<id>\]\]$` as dependency edges and return structured `{from, to, file, line}` records.

#### Scenario: Parse static/dependencies.md

**Given** `design/static/dependencies.md` containing `- [[mod-cli]] -> [[mod-parse]]`
**When** the file is parsed
**Then** a dependency edge with `from: "mod-cli"` and `to: "mod-parse"` is extracted with correct file and line

### Requirement: The parser SHALL report ID grammar violations as positioned diagnostics

The parser SHALL validate extracted IDs against the grammar `prefix "-" slug` where `slug = [a-z0-9]+("-"[a-z0-9]+)*`. IDs containing uppercase letters or invalid characters SHALL produce a diagnostic with severity, message, file path, and line number. The parser SHALL NOT throw an exception.

#### Scenario: Uppercase ID produces diagnostic

**Given** a file containing `## Foo {#Mod-Parse}`
**When** the file is parsed
**Then** a diagnostic is returned with the file path, line number, and a message indicating the ID grammar violation
**And** no exception is thrown

#### Scenario: Invalid characters in ID

**Given** a file containing `## Foo {#mod_parse}`
**When** the file is parsed
**Then** a diagnostic is returned indicating the invalid character in the ID

### Requirement: The parser SHALL report non-flat frontmatter as positioned diagnostics

The parser SHALL validate that frontmatter contains only flat `key: value` pairs. Nested structures (indented lines, multi-line values) SHALL produce a diagnostic. The parser SHALL NOT throw an exception.

#### Scenario: Nested frontmatter produces diagnostic

**Given** a file containing:
```
---
nested:
  key: value
---
```
**When** the file is parsed
**Then** a diagnostic is returned with the file path and line number of the nested line

### Requirement: The parser SHALL be a pure function with no file I/O

The parser's public API SHALL accept an array of `{path: string, content: string}` inputs and return a `ParseResult` structure. The parser SHALL NOT perform any file system operations.

#### Scenario: Parser accepts in-memory input

**Given** a string content representing a valid design document
**When** `parseFiles([{path: "test.md", content: "..."}])` is called
**Then** the result is returned without any file system access

### Requirement: The parser SHALL recognize structured lines per spec format.md section 8

The parser SHALL recognize `責務:` lines, `実装:` lines, `## 登場要素` sections with `- [[id]]` lists, and `elements:` lines as structured data within the parse result.

#### Scenario: 責務 line recognition

**Given** a file containing `責務: コマンド解釈・引数検証` after a heading element
**When** the file is parsed
**Then** the responsibility text is associated with the preceding element

### Requirement: package.json SHALL have empty dependencies

The `dependencies` field in `package.json` SHALL be `{}` (empty object) or absent, enforcing the zero runtime dependency policy.

#### Scenario: Verify dependencies field

**Given** the `package.json` file in the repository root
**When** the file is read and parsed
**Then** the `dependencies` field is either absent or an empty object `{}`

### Requirement: Type checking and tests SHALL pass

`tsc --noEmit` and `bun test` SHALL both complete successfully with zero failures.

#### Scenario: Full verification

**Given** the complete project with all source files and tests
**When** `tsc --noEmit && bun test` is executed
**Then** both commands exit with status 0
