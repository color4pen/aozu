/**
 * Shared constants and helpers for prompt instruction builders (mod-prompt).
 *
 * Extracted from session.ts so that propagate and review can share:
 *   - SCOPE_MAX_HOPS: neighborhood radius used by session and propagate
 *   - FORMAT_RULES_SUMMARY: injected into every prompt instruction
 *   - collectTermsAndInvariants: builds the always-full term/inv context block
 *   - collectStaticModulesSummary: builds the condensed static-mod context block
 *
 * ADR-0019: injection scope rules (2-hop · inv/term full · static condensed).
 */

import { extractAllBodies, extractElementBody } from "../graph/body.ts";
import type { Graph } from "../graph/types.ts";
// FileInput is re-exported from mod-graph (graph/index.ts) so mod-prompt → mod-graph is satisfied
import type { FileInput } from "../graph/index.ts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum hops for neighborhood computation around seed elements.
 * Shared between session (topic-based) and propagate (ADR-based) scopes.
 * Rule from ADR-0019 / docs/open-questions.md §8 initial version.
 */
export const SCOPE_MAX_HOPS = 2;

/**
 * Summary of the aozu format rules injected into every instruction.
 *
 * Covers the points an agent needs to write design elements:
 * declaration syntax, reference syntax, ID grammar, type prefix table,
 * and frontmatter convention.
 */
export const FORMAT_RULES_SUMMARY = `\
Summary of spec/format.md (format-version: 0). When the spec changes, update this summary to match.

### Declaration syntax

- **Heading element** (mod / term / ent / inv / act / grp): declared as a level-2 heading with \`{#id}\` suffix.
  Example: \`## Order Entity {#ent-order}\`
- **Document element** (seq / top / plan / adr): declared via frontmatter \`id:\` key at the top of the file.
  Example:
  \`\`\`
  ---
  id: top-my-topic
  ---
  \`\`\`

### Reference syntax

- Use \`[[id]]\` to reference another element in body text.
- References inside code fences (\`\`\`) and inline code spans (\`\\\`...\`\\\`) are excluded from the reference graph.

### ID grammar

IDs follow the pattern \`<prefix>-<slug>\` where slug is lowercase alphanumeric with hyphens.
Examples: \`ent-order\`, \`inv-order-valid\`, \`mod-core\`, \`top-my-topic\`

### Type prefix table

| Prefix | Type | Layer |
|--------|------|-------|
| mod    | Module | static |
| term   | Term (glossary) | domain |
| ent    | Entity | domain |
| inv    | Invariant | domain |
| act    | Actor | domain |
| seq    | Sequence | dynamic |
| top    | Topic | loop |
| plan   | Plan | loop |
| grp    | Group (within plan) | loop |
| adr    | Architecture Decision Record | always |
| uc     | Use case | views |
| scr    | Screen | views |
| api    | API | views |
| dat    | Data | views |
| flow   | Dataflow | views |
| evt    | Event | views |
| ext    | External | views |
| perm   | Permission | views |
| dpl    | Deployment | views |

### Frontmatter convention

Only flat \`key: value\` pairs are permitted in frontmatter. No nested YAML.
Keys: \`id\`, \`source\` (optional, for topics), \`status\`, \`topics\` (for ADRs), etc.\
`;

// ---------------------------------------------------------------------------
// Shared context-assembly helpers
// ---------------------------------------------------------------------------

/**
 * Collect all term and inv element bodies as a pre-formatted string.
 *
 * Elements are sorted by ID (lexicographic order) and formatted as:
 *   ### <id>
 *   <body>
 *
 * If body is null or empty, a `(body not available)` placeholder is used.
 * Returns an empty string when no term/inv elements exist.
 *
 * @param graph  Graph containing element declarations.
 * @param files  Raw file inputs.
 * @returns      Pre-formatted string ready for injection into an instruction.
 */
export function collectTermsAndInvariants(graph: Graph, files: FileInput[]): string {
  const termInvIds = [...graph.elements.keys()]
    .filter((id) => {
      const prefix = graph.elements.get(id)?.prefix;
      return prefix === "term" || prefix === "inv";
    })
    .sort();
  const termInvBodies = extractAllBodies(termInvIds, graph, files);
  return termInvIds
    .map((id) => {
      const body = termInvBodies.get(id);
      return `### ${id}\n${body?.trim() ?? "(body not available)"}`;
    })
    .join("\n\n");
}

/**
 * Collect static module condensed summaries as a pre-formatted string.
 *
 * Elements are sorted by ID (lexicographic order) and formatted as:
 *   ### <id>
 *   責務: <duty text>
 *
 * If no `責務:` line is found in the element body, a placeholder is used.
 * Returns an empty string when no mod elements exist.
 *
 * @param graph  Graph containing element declarations.
 * @param files  Raw file inputs.
 * @returns      Pre-formatted string ready for injection into an instruction.
 */
export function collectStaticModulesSummary(graph: Graph, files: FileInput[]): string {
  const modIds = [...graph.elements.keys()]
    .filter((id) => graph.elements.get(id)?.prefix === "mod")
    .sort();
  return modIds
    .map((id) => {
      const body = extractElementBody(id, graph, files) ?? "";
      const dutyLine = body
        .split("\n")
        .find((line) => line.trimStart().startsWith("責務:"));
      if (dutyLine) {
        return `### ${id}\n${dutyLine.trim()}`;
      }
      return `### ${id}\n(no 責務: line found)`;
    })
    .join("\n\n");
}
