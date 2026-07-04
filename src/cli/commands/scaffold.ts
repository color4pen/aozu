/**
 * `scaffold` command handler.
 *
 * Generates a new design document file from a template for document element types
 * (topic / plan / seq / adr). Heading element types (mod / term / ent / inv)
 * are added by editing the appropriate file directly.
 *
 * Exit codes:
 *   0 = success
 *   1 = validation failure (ID grammar, ID collision, type disabled, heading element)
 *   2 = input error (missing args, design dir not found, unknown type)
 */

import { mkdir } from "fs/promises";
import { join } from "path";
import { stat } from "fs/promises";
import { validateId, extractPrefix, KNOWN_PREFIXES } from "../../parse/id.ts";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest, isLayerEnabled, getEnabledLayers, validateFormatVersion } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import type { Manifest } from "../../graph/types.ts";

// ---------------------------------------------------------------------------
// Type mappings (ADR-0009: types are tool knowledge, not config)
// ---------------------------------------------------------------------------

/** Maps document element type names to their ID prefixes. */
export const DOCUMENT_TYPE_PREFIX: Record<string, string> = {
  topic: "top",
  plan: "plan",
  seq: "seq",
  adr: "adr",
};

/** Maps document element type names to their directory paths (relative to design dir). */
export const DOCUMENT_TYPE_DIR: Record<string, string> = {
  topic: "topics",
  plan: "plans",
  seq: "dynamic",
  adr: "adr",
};

/**
 * Maps heading element type names to the file where they should be added.
 * Heading elements cannot be scaffolded — the user edits the file directly.
 */
export const HEADING_ELEMENT_TARGET: Record<string, string> = {
  mod: "static/modules.md",
  term: "domain/glossary.md",
  ent: "domain/model.md",
  inv: "domain/invariants.md",
};

// ---------------------------------------------------------------------------
// Templates (embedded — no runtime file references; ADR-0009 zero-dep)
// ---------------------------------------------------------------------------

/**
 * Template for a topic document (spec/format.md §8 topics/<slug>.md — top).
 *
 * `source` is optional external reference.
 * `addressed` status is NOT stored in frontmatter — it is computed from ADR
 * `topics:` citations (ADR-0018-3). The template therefore contains no
 * `status:` field.
 */
export function topicTemplate(id: string): string {
  return `---
id: ${id}
---
（症状・動機を記述する。意図を書いてよいが提案であって決定ではない）
`;
}

/**
 * Template for a plan document (spec/format.md §8 plans/<slug>.md — plan).
 *
 * status: open | derived
 * Contains group placeholder with required elements: line.
 */
export function planTemplate(id: string): string {
  const grpSlug = id.slice("plan-".length); // e.g. plan-checkout-rework → checkout-rework
  const grpId = `grp-${grpSlug}`;
  return `---
id: ${id}
status: open
---
## （グループ名） {#${grpId}}
- elements: （[[mod-xxx]] などを列挙する）
- parallel: no
`;
}

/**
 * Template for a seq document (spec/format.md §8 dynamic/<slug>.md — seq).
 *
 * Includes required 登場要素 section with at least one mod reference placeholder.
 */
export function seqTemplate(id: string): string {
  return `---
id: ${id}
---
# （タイトルを記入）

## 登場要素
- （[[mod-xxx]] など mod 要素を列挙する）

## 流れ
（自由記述。Mermaid は挿絵であり検証対象外）
`;
}

/**
 * Template for an ADR document (spec/format.md §8 adr/NNNN-<slug>.md — adr).
 *
 * When loop is enabled, includes a topics: line (user fills in [[top-xxx]]).
 */
export function adrTemplate(id: string, hasLoop: boolean): string {
  const topicsLine = hasLoop ? "\ntopics: （[[top-xxx]] を記入する）" : "";
  return `---
id: ${id}${topicsLine}
---
# （タイトルを記入）

## Context

（背景・課題を記述する）

## Decision

（決定内容を記述する）

## Consequences

（結果・影響を記述する）
`;
}

// ---------------------------------------------------------------------------
// Type validity helper
// ---------------------------------------------------------------------------

/**
 * Returns true if the given document element type is enabled in the manifest.
 *
 * - topic / plan: require `loop` layer
 * - seq: requires `dynamic` layer
 * - adr: always enabled
 */
export function isTypeEnabled(typeName: string, manifest: Manifest): boolean {
  switch (typeName) {
    case "topic":
    case "plan":
      return isLayerEnabled("loop", manifest);
    case "seq":
      return isLayerEnabled("dynamic", manifest);
    case "adr":
      return true;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/** Check whether a path exists as a directory. */
async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Handle the `scaffold` command.
 *
 * Validates type, ID grammar, enabled status, and ID uniqueness before
 * generating the template file.
 *
 * Validation order (D5):
 *   1. Heading element type → guide to target file, return 1
 *   2. Unknown type → return 2
 *   3. ID grammar → return 1
 *   4. ID prefix matches type → return 1
 *   5. Manifest: type enabled → return 1
 *   6. Graph: ID collision → return 1
 */
export async function handleScaffold(args: string[]): Promise<number> {
  // --help
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu scaffold <type> <id> [--dir <path>]",
        "",
        "Create a new design document file from a template.",
        "",
        "Document element types (each gets its own file):",
        "  topic   topics/<slug>.md     (requires loop in enabled)",
        "  plan    plans/<slug>.md      (requires loop in enabled)",
        "  seq     dynamic/<slug>.md    (requires dynamic in enabled)",
        "  adr     adr/<slug>.md        (always available)",
        "",
        "Heading element types must be added by editing the file directly:",
        "  mod   → static/modules.md",
        "  term  → domain/glossary.md",
        "  ent   → domain/model.md",
        "  inv   → domain/invariants.md",
        "",
        "Options:",
        "  --dir <path>  Design directory (default: ./design)",
        "  -h, --help    Show this help",
        "",
        "Exit codes: 0 = success / 1 = validation failure / 2 = input error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse positional arguments (type and id), skipping flag pairs (--flag value)
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith("--")) {
      i++; // skip the value that follows a flag
    } else {
      positionals.push(a);
    }
  }
  const typeName = positionals[0];
  let id = positionals[1];
  if (!typeName) {
    process.stderr.write("ERROR INPUT - usage: aozu scaffold <type> <id> [--dir <path>]\n");
    return 2;
  }
  if (!id) {
    process.stderr.write("ERROR INPUT - usage: aozu scaffold <type> <id> [--dir <path>]\n");
    return 2;
  }

  // Parse --dir
  const dirIdx = args.indexOf("--dir");
  const designDir = dirIdx >= 0 ? (args[dirIdx + 1] ?? "./design") : "./design";

  // Design directory must exist
  if (!(await dirExists(designDir))) {
    process.stderr.write(`ERROR INPUT - design directory not found: ${designDir}\n`);
    return 2;
  }

  // --- D5 validation ---

  // 1. Heading element type check
  const headingTarget = HEADING_ELEMENT_TARGET[typeName];
  if (headingTarget !== undefined) {
    process.stderr.write(`ERROR: '${typeName}' is a heading element type.\n`);
    process.stderr.write(`Add it by editing: ${join(designDir, headingTarget)}\n`);
    process.stderr.write(`Format: ## Name {#${typeName}-<slug>}\n`);
    return 1;
  }

  // 2. Document element type check
  const typePrefix = DOCUMENT_TYPE_PREFIX[typeName];
  if (typePrefix === undefined) {
    process.stderr.write(`ERROR INPUT - unknown type '${typeName}'\n`);
    process.stderr.write(`Document element types: topic, plan, seq, adr\n`);
    process.stderr.write(`Heading element types (edit file directly): mod, term, ent, inv\n`);
    return 2;
  }

  // 2b. Prefix auto-completion (D3): for document types, auto-complete bare slugs
  if (!id.startsWith(typePrefix + "-")) {
    const extractedPrefixRaw = extractPrefix(id);
    if (KNOWN_PREFIXES.has(extractedPrefixRaw) && extractedPrefixRaw !== typePrefix) {
      // Known prefix that conflicts with the type → error (fail-closed, not silent typo correction)
      process.stderr.write(
        `ERROR INPUT - ID '${id}' has prefix '${extractedPrefixRaw}', which conflicts with type '${typeName}' (expected prefix: '${typePrefix}')\n`
      );
      return 2;
    }
    // Bare slug or unknown leading segment → auto-complete with type prefix
    id = typePrefix + "-" + id;
  }

  // 3. ID grammar validation
  const validation = validateId(id);
  if (!validation.valid) {
    process.stderr.write(`ERROR: invalid ID '${id}': ${validation.reason}\n`);
    return 1;
  }

  // 4. ID prefix must match type prefix (always true after auto-completion, kept for safety)
  const extractedPrefix = extractPrefix(id);
  if (extractedPrefix !== typePrefix) {
    process.stderr.write(
      `ERROR: ID '${id}' has prefix '${extractedPrefix}', expected '${typePrefix}' for type '${typeName}'\n`
    );
    return 1;
  }

  // 5. Manifest: type must be enabled
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const manifest = parseManifest(parsed.frontmatters, manifestPath);

  // Stage gate: format-version must be supported (C12)
  const fvDiag = validateFormatVersion(manifest, manifestPath);
  if (fvDiag) {
    process.stderr.write(
      `ERROR CONFIG - unsupported format-version in ${manifestPath}.\n` +
      `${fvDiag.message}\n`
    );
    return 2;
  }

  if (!isTypeEnabled(typeName, manifest)) {
    const requiredLayer = typeName === "seq" ? "dynamic" : "loop";
    process.stderr.write(`ERROR: type '${typeName}' requires '${requiredLayer}' layer to be enabled\n`);
    process.stderr.write(`Add '${requiredLayer}' to enabled: in ${manifestPath}\n`);
    return 1;
  }

  // 6. Graph: ID collision check
  const graph = buildGraph(parsed, manifestPath);
  if (graph.elements.has(id)) {
    process.stderr.write(`ERROR: ID '${id}' already exists in the design\n`);
    return 1;
  }

  // --- File generation ---

  const typeDir = DOCUMENT_TYPE_DIR[typeName]!;
  const idSlug = id.slice(typePrefix.length + 1); // everything after "{prefix}-"
  const targetDir = join(designDir, typeDir);

  // Ensure target directory exists (always safe to mkdir -p)
  await mkdir(targetDir, { recursive: true });

  const filePath = join(targetDir, `${idSlug}.md`);

  // Double-check: file must not already exist
  if (await Bun.file(filePath).exists()) {
    process.stderr.write(`ERROR: file already exists: ${filePath}\n`);
    return 1;
  }

  // Generate and write template content
  const hasLoop = isLayerEnabled("loop", manifest);
  let content: string;
  switch (typeName) {
    case "topic":
      content = topicTemplate(id);
      break;
    case "plan":
      content = planTemplate(id);
      break;
    case "seq":
      content = seqTemplate(id);
      break;
    case "adr":
      content = adrTemplate(id, hasLoop);
      break;
    default:
      content = "";
  }

  await Bun.write(filePath, content);
  process.stderr.write(`Created: ${filePath}\n`);

  return 0;
}
