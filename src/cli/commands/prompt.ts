/**
 * `prompt` command handler.
 *
 * Supports sub-commands:
 *   prompt derive    --group <grp-id>  [--dir <path>]
 *   prompt session   --topic <top-id>  [--dir <path>]
 *   prompt propagate --adr   <adr-id>  [--dir <path>]
 *   prompt review             [--dir <path>]
 *
 * All verbs write nothing to the filesystem; they output instruction text to
 * stdout (ADR-0008 — prompt verb semantics).
 *
 * `prompt derive` configuration is injected via manifest frontmatter
 * (ADR-0012 — consumer-agnostic derivation):
 *   request-template:    file path (relative to design dir) or shell command
 *   request-output-dir:  output directory path for the generated draft
 *
 * Exit codes:
 *   0 = instruction text written to stdout
 *   1 = stage-gate failure (loop disabled — ADR-0010, only for derive/session)
 *   2 = input error or configuration error (missing design dir / element not found /
 *       missing required argument)
 */

import { join, resolve } from "path";
import { stat } from "fs/promises";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest, isLayerEnabled, validateFormatVersion } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { findOwningElement } from "../../graph/attribution.ts";
import { extractAllBodies, extractElementBody } from "../../graph/body.ts";
import { computeNeighborhood } from "../../graph/neighborhood.ts";
import { buildDeriveInstruction } from "../../prompt/derive.ts";
import {
  buildSessionInstruction,
  SESSION_MAX_HOPS,
  SESSION_GUIDANCE,
} from "../../prompt/session.ts";
import {
  SCOPE_MAX_HOPS,
  FORMAT_RULES_SUMMARY,
  collectTermsAndInvariants,
  collectStaticModulesSummary,
} from "../../prompt/shared.ts";
import { buildPropagateInstruction, PROPAGATE_GUIDANCE } from "../../prompt/propagate.ts";
import { buildReviewInstruction, REVIEW_GUIDANCE } from "../../prompt/review.ts";
import { extractReferences } from "../../parse/references.ts";
import type { Element } from "../../graph/index.ts";

// ---------------------------------------------------------------------------
// Helpers
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

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Handle the `prompt` command.
 *
 * Dispatches to sub-command handlers:
 *   - `derive`:  generate a derive instruction for a plan group
 *   - `session`: start a design session for a topic
 */
export async function handlePrompt(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu prompt <subcommand> [options]",
        "",
        "Sub-commands:",
        "  derive     Generate a derive instruction for a plan group",
        "  session    Start a design session for a topic",
        "  propagate  Reflect an ADR decision across all design layers",
        "  review     Review the design corpus for contradictions",
        "",
        "Run 'aozu prompt <subcommand> --help' for details.",
        "",
        "Exit codes: 0 = success / 1 = loop disabled (derive/session only) / 2 = input or configuration error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  const subcommand = args[0];
  if (!subcommand) {
    process.stderr.write(
      "ERROR INPUT - missing subcommand\nUsage: aozu prompt <subcommand> [options]\nAvailable: derive, session, propagate, review\n"
    );
    return 2;
  }

  if (subcommand === "derive") {
    return handleDerive(args.slice(1));
  }

  if (subcommand === "session") {
    return handleSession(args.slice(1));
  }

  if (subcommand === "propagate") {
    return handlePropagate(args.slice(1));
  }

  if (subcommand === "review") {
    return handleReview(args.slice(1));
  }

  process.stderr.write(
    `ERROR INPUT - unknown subcommand: "${subcommand}"\nAvailable subcommands: derive, session, propagate, review\n`
  );
  return 2;
}

// ---------------------------------------------------------------------------
// `prompt derive` handler
// ---------------------------------------------------------------------------

/**
 * Handle `prompt derive --group <grp-id> [--dir <path>]`.
 *
 * Reads the design directory, finds the group in a plan file, collects
 * bodies and neighborhoods, then writes the instruction to stdout.
 * Never writes to the filesystem.
 */
export async function handleDerive(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu prompt derive --group <grp-id> [--dir <path>]",
        "",
        "Generate a request draft instruction for a plan group.",
        "",
        "Outputs instruction text to stdout (no files are written).",
        "Requires manifest frontmatter:",
        "  request-template:    file path or shell command that produces the template",
        "  request-output-dir:  output directory path for the draft",
        "",
        "Options:",
        "  --group <grp-id>  Plan group ID (required)",
        "  --dir <path>      Design directory (default: ./design)",
        "  -h, --help        Show this help",
        "",
        "Exit codes: 0 = success / 1 = loop disabled / 2 = input or configuration error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse --group
  const groupIdx = args.indexOf("--group");
  const grpId = groupIdx >= 0 ? args[groupIdx + 1] : undefined;
  if (!grpId) {
    process.stderr.write(
      "ERROR INPUT - missing --group argument\nUsage: aozu prompt derive --group <grp-id> [--dir <path>]\n"
    );
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

  // Build pipeline
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const manifest = parseManifest(parsed.frontmatters, manifestPath);

  // Stage gate: format-version must be supported (C12)
  const fvDiagDerive = validateFormatVersion(manifest, manifestPath);
  if (fvDiagDerive) {
    process.stderr.write(
      `ERROR CONFIG - unsupported format-version in ${manifestPath}.\n` +
      `${fvDiagDerive.message}\n`
    );
    return 2;
  }

  const graph = buildGraph(parsed, manifestPath);

  // --- Manifest frontmatter for config keys ---
  const manifestFm = parsed.frontmatters.get(manifestPath) ?? {};

  // Stage gate: loop must be enabled (ADR-0010 — explicit error, exit 1 like `plan`)
  if (!isLayerEnabled("loop", manifest)) {
    process.stderr.write(
      [
        "ERROR - loop layer is not enabled in manifest.",
        "Add 'loop' to the enabled list in design/manifest.md:",
        "  enabled: static, domain, dynamic, loop",
        "prompt derive requires loop to be enabled.",
      ].join("\n") + "\n"
    );
    return 1;
  }

  // Stage gate: request-template must be present
  const requestTemplate = manifestFm["request-template"];
  if (!requestTemplate || (Array.isArray(requestTemplate) && requestTemplate.length === 0)) {
    process.stderr.write(
      [
        "ERROR CONFIG - missing 'request-template' in manifest frontmatter.",
        "Add to design/manifest.md frontmatter:",
        "  request-template: path/to/request-template.md",
        "Value can be a file path (relative to design dir) or a shell command whose stdout is used.",
      ].join("\n") + "\n"
    );
    return 2;
  }

  // Stage gate: request-output-dir must be present
  const requestOutputDir = manifestFm["request-output-dir"];
  if (!requestOutputDir || (Array.isArray(requestOutputDir) && requestOutputDir.length === 0)) {
    process.stderr.write(
      [
        "ERROR CONFIG - missing 'request-output-dir' in manifest frontmatter.",
        "Add to design/manifest.md frontmatter:",
        "  request-output-dir: path/to/output/",
      ].join("\n") + "\n"
    );
    return 2;
  }

  const templateValue = Array.isArray(requestTemplate) ? requestTemplate.join(",") : requestTemplate;
  const outputDir = Array.isArray(requestOutputDir) ? requestOutputDir.join(",") : requestOutputDir;

  // Find the group element
  const grpEl = graph.elements.get(grpId);
  if (!grpEl || grpEl.prefix !== "grp") {
    // Check if there are any plan elements at all
    const hasPlan = [...graph.elements.values()].some((el) => el.prefix === "plan");
    if (!hasPlan) {
      process.stderr.write(
        `ERROR CONFIG - no plan files found in ${join(designDir, "plans")}\nCreate a plan first with: aozu plan <slug>\n`
      );
    } else {
      process.stderr.write(
        `ERROR CONFIG - group not found: "${grpId}"\nCheck that the group exists in a plan file under ${join(designDir, "plans")}\n`
      );
    }
    return 2;
  }

  // Find the elements in this group
  const allElements: Element[] = [...graph.elements.values()];
  const groupElementItems = graph.elementItems.filter((item) => {
    // Find which grp element "owns" this item (nearest preceding grp heading in the same file)
    let bestGrp: Element | undefined;
    for (const el of allElements) {
      if (el.file !== item.file) continue;
      if (el.prefix !== "grp") continue;
      if (el.line > item.line) continue;
      if (!bestGrp || el.line > bestGrp.line) {
        bestGrp = el;
      }
    }
    return bestGrp?.id === grpId;
  });

  const groupElementIds = groupElementItems.map((item) => item.id);

  // Validate: all group element IDs must resolve in the graph
  const unresolved = groupElementIds.filter((id) => !graph.elements.has(id));
  if (unresolved.length > 0) {
    process.stderr.write(
      `ERROR CONFIG - unresolved element IDs in group "${grpId}": ${unresolved.join(", ")}\n` +
        "These element IDs exist in the plan's elements: line but have no matching design element.\n"
    );
    return 2;
  }

  // Get template content
  const templateContent = await resolveTemplate(templateValue, designDir);
  if (templateContent === null) {
    return 2;
  }

  // Extract target element bodies
  const elementBodies = extractAllBodies(groupElementIds, graph, files);

  // Compute 2-hop neighborhood
  const neighborIds = computeNeighborhood(groupElementIds, graph, 2);
  const neighborBodies = extractAllBodies([...neighborIds], graph, files);

  // Collect term/inv bodies
  const termInvIds = [...graph.elements.keys()].filter(
    (id) => graph.elements.get(id)?.prefix === "term" || graph.elements.get(id)?.prefix === "inv"
  );
  const termInvBodies = extractAllBodies(termInvIds, graph, files);
  const termsAndInvariants = [...termInvBodies.entries()]
    .map(([id, body]) => `### ${id}\n${body}`)
    .join("\n\n");

  // Build instruction text
  const instruction = buildDeriveInstruction({
    groupId: grpId,
    groupElements: groupElementIds,
    elementBodies,
    neighborBodies,
    termsAndInvariants,
    templateContent,
    outputDir,
  });

  // Write to stdout (no file I/O)
  process.stdout.write(instruction);
  return 0;
}

// ---------------------------------------------------------------------------
// `prompt session` handler
// ---------------------------------------------------------------------------

/**
 * Handle `prompt session --topic <top-id> [--dir <path>]`.
 *
 * Reads the design directory, finds the topic, collects the injection scope
 * (topic body, seed + 2-hop neighborhood bodies, inv/term full, static mod
 * condensed, manifest enabled list, format rules summary, session guidance),
 * then writes the instruction to stdout. Never writes to the filesystem.
 *
 * Injection scope rules (docs/open-questions.md §8 initial implementation):
 *   - seed = topic body's [[id]] citations, filtered to existing elements
 *   - neighborhood = in/out SESSION_MAX_HOPS hops from seeds
 *   - inv/term: always full (all elements in the graph)
 *   - mod: condensed — heading + 責務: line only
 *   - manifest enabled list, format rules summary, session guidance: always injected
 *
 * Exit codes: 0 = success / 1 = loop disabled / 2 = input or design error
 */
export async function handleSession(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu prompt session --topic <top-id> [--dir <path>]",
        "",
        "Start a design session for a topic.",
        "",
        "Outputs an instruction text to stdout with the full injection scope:",
        "  - Topic body",
        "  - Seed elements (topic [[id]] citations) + 2-hop neighborhood, body in full",
        "  - inv / term: always full",
        "  - static mod: heading + 責務: line (condensed)",
        "  - manifest enabled list, format rules summary, session guidance",
        "",
        "No files are written. No design dir mutations.",
        "",
        "Options:",
        "  --topic <top-id>  Topic element ID (required)",
        "  --dir <path>      Design directory (default: ./design)",
        "  -h, --help        Show this help",
        "",
        "Exit codes: 0 = success / 1 = loop disabled / 2 = input or design error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse --topic
  const topicIdx = args.indexOf("--topic");
  const topicId = topicIdx >= 0 ? args[topicIdx + 1] : undefined;
  if (!topicId) {
    process.stderr.write(
      "ERROR INPUT - missing --topic argument\nUsage: aozu prompt session --topic <top-id> [--dir <path>]\n"
    );
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

  // Build pipeline
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const manifest = parseManifest(parsed.frontmatters, manifestPath);

  // Stage gate: format-version must be supported (C12)
  const fvDiagSession = validateFormatVersion(manifest, manifestPath);
  if (fvDiagSession) {
    process.stderr.write(
      `ERROR CONFIG - unsupported format-version in ${manifestPath}.\n` +
      `${fvDiagSession.message}\n`
    );
    return 2;
  }

  const graph = buildGraph(parsed, manifestPath);

  // Stage gate: loop must be enabled
  if (!isLayerEnabled("loop", manifest)) {
    process.stderr.write(
      [
        "ERROR - loop layer is not enabled in manifest.",
        "Add 'loop' to the enabled list in design/manifest.md:",
        "  enabled: static, domain, dynamic, loop",
        "prompt session requires loop to be enabled.",
      ].join("\n") + "\n"
    );
    return 1;
  }

  // Find and validate the topic element
  const topicEl = graph.elements.get(topicId);
  if (!topicEl || topicEl.prefix !== "top") {
    process.stderr.write(
      `ERROR INPUT - topic not found: "${topicId}"\n` +
        `Check that a topic with this ID exists in ${join(designDir, "topics")}\n`
    );
    return 2;
  }

  // Extract topic body (content after frontmatter)
  const topicBody = extractElementBody(topicId, graph, files) ?? "";

  // Extract seed IDs from [[id]] citations in the topic body
  const topicFile = topicEl.file;
  const rawRefs = extractReferences(topicBody, topicFile);
  const seedIdSet = new Set<string>();
  for (const ref of rawRefs) {
    // Only include IDs that exist in the graph
    if (graph.elements.has(ref.targetId)) {
      seedIdSet.add(ref.targetId);
    }
  }
  const seedIds = [...seedIdSet].sort();

  // Extract seed bodies
  const seedBodies = extractAllBodies(seedIds, graph, files);

  // Compute 2-hop neighborhood (excludes seeds themselves)
  const neighborIdSet = computeNeighborhood(seedIds, graph, SESSION_MAX_HOPS);
  const sortedNeighborIds = [...neighborIdSet].sort();

  // Extract neighbor bodies
  const neighborBodies = extractAllBodies(sortedNeighborIds, graph, files);

  // Collect term/inv full content and static mod condensed summary (shared helpers)
  const termsAndInvariants = collectTermsAndInvariants(graph, files);
  const staticModulesSummary = collectStaticModulesSummary(graph, files);

  // Build the session instruction
  const instruction = buildSessionInstruction({
    topicId,
    topicBody,
    seedBodies,
    neighborBodies,
    termsAndInvariants,
    staticModulesSummary,
    enabledLayers: manifest.enabled,
    formatRulesSummary: FORMAT_RULES_SUMMARY,
    sessionGuidance: SESSION_GUIDANCE,
  });

  // Write to stdout (no file I/O)
  process.stdout.write(instruction);
  return 0;
}

// ---------------------------------------------------------------------------
// `prompt propagate` handler
// ---------------------------------------------------------------------------

/**
 * Handle `prompt propagate --adr <adr-id> [--dir <path>]`.
 *
 * Reads the design directory, finds the specified ADR element, extracts its body
 * and [[id]] citations as seeds, computes the 2-hop neighborhood from seeds,
 * assembles the always-full context frame (inv/term full, static mod condensed,
 * manifest enabled list, format rules summary, propagation guidance), then writes
 * the instruction to stdout. Never writes to the filesystem.
 *
 * No loop gate: ADR is an always-layer type (C11). propagate succeeds regardless
 * of whether `loop` is in the manifest enabled list.
 *
 * Exit codes: 0 = success / 2 = input or design error
 */
export async function handlePropagate(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu prompt propagate --adr <adr-id> [--dir <path>]",
        "",
        "Output a propagation instruction for an ADR decision.",
        "",
        "Outputs instruction text to stdout (no files are written).",
        "Injection scope (ADR-0019 rules, ADR-based):",
        "  - ADR body (id + topics frontmatter)",
        "  - Seed elements ([[id]] citations in ADR body) + 2-hop neighborhood, body in full",
        "  - inv / term: always full",
        "  - static mod: heading + 責務: line (condensed)",
        "  - manifest enabled list, format rules summary, propagation guidance",
        "",
        "No loop gate: ADR is an always-layer type (C11).",
        "No files are written. No design dir mutations.",
        "",
        "Options:",
        "  --adr <adr-id>  ADR element ID (required)",
        "  --dir <path>    Design directory (default: ./design)",
        "  -h, --help      Show this help",
        "",
        "Exit codes: 0 = success / 2 = input or design error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse --adr
  const adrIdx = args.indexOf("--adr");
  const adrId = adrIdx >= 0 ? args[adrIdx + 1] : undefined;
  if (!adrId) {
    process.stderr.write(
      "ERROR INPUT - missing --adr argument\nUsage: aozu prompt propagate --adr <adr-id> [--dir <path>]\n"
    );
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

  // Build pipeline (no loop gate — ADR is always-layer)
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const manifest = parseManifest(parsed.frontmatters, manifestPath);

  // Stage gate: format-version must be supported (C12)
  const fvDiagPropagate = validateFormatVersion(manifest, manifestPath);
  if (fvDiagPropagate) {
    process.stderr.write(
      `ERROR CONFIG - unsupported format-version in ${manifestPath}.\n` +
      `${fvDiagPropagate.message}\n`
    );
    return 2;
  }

  const graph = buildGraph(parsed, manifestPath);

  // Find and validate the ADR element
  const adrEl = graph.elements.get(adrId);
  if (!adrEl || adrEl.prefix !== "adr") {
    process.stderr.write(
      `ERROR INPUT - ADR not found or not an adr-prefix element: "${adrId}"\n` +
        `Check that an ADR with this ID exists in ${join(designDir, "adr")}\n`
    );
    return 2;
  }

  // Extract ADR body (content after frontmatter)
  const adrBody = extractElementBody(adrId, graph, files) ?? "";

  // Extract seed IDs from [[id]] citations in the ADR body
  const adrFile = adrEl.file;
  const rawRefs = extractReferences(adrBody, adrFile);
  const seedIdSet = new Set<string>();
  for (const ref of rawRefs) {
    if (graph.elements.has(ref.targetId)) {
      seedIdSet.add(ref.targetId);
    }
  }
  const seedIds = [...seedIdSet].sort();

  // Extract seed bodies
  const seedBodies = extractAllBodies(seedIds, graph, files);

  // Compute 2-hop neighborhood (excludes seeds themselves)
  const neighborIdSet = computeNeighborhood(seedIds, graph, SCOPE_MAX_HOPS);
  const sortedNeighborIds = [...neighborIdSet].sort();

  // Extract neighbor bodies
  const neighborBodies = extractAllBodies(sortedNeighborIds, graph, files);

  // Collect term/inv full content and static mod condensed summary (shared helpers)
  const termsAndInvariants = collectTermsAndInvariants(graph, files);
  const staticModulesSummary = collectStaticModulesSummary(graph, files);

  // Build the propagate instruction
  const instruction = buildPropagateInstruction({
    adrId,
    adrBody,
    seedBodies,
    neighborBodies,
    termsAndInvariants,
    staticModulesSummary,
    enabledLayers: manifest.enabled,
    formatRulesSummary: FORMAT_RULES_SUMMARY,
    propagateGuidance: PROPAGATE_GUIDANCE,
  });

  // Write to stdout (no file I/O)
  process.stdout.write(instruction);
  return 0;
}

// ---------------------------------------------------------------------------
// `prompt review` handler
// ---------------------------------------------------------------------------

/**
 * Handle `prompt review [--dir <path>]`.
 *
 * Reads the design directory, extracts all element bodies in ID lexicographic
 * order, and outputs a review instruction to stdout. Never writes to the
 * filesystem.
 *
 * No loop gate: review targets the whole corpus, not a loop-layer element.
 *
 * Exit codes: 0 = success / 2 = input error
 */
export async function handleReview(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu prompt review [--dir <path>]",
        "",
        "Output a review instruction for the full design corpus.",
        "",
        "Outputs instruction text to stdout (no files are written).",
        "Injection scope (full corpus, ID lexicographic order):",
        "  - All element bodies",
        "  - Format rules summary",
        "  - Findings format guidance (1 line per finding; check's C1-C11 excluded)",
        "",
        "No loop gate: review targets the whole corpus.",
        "No files are written. No design dir mutations.",
        "",
        "Options:",
        "  --dir <path>  Design directory (default: ./design)",
        "  -h, --help    Show this help",
        "",
        "Exit codes: 0 = success / 2 = input error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse --dir
  const dirIdx = args.indexOf("--dir");
  const designDir = dirIdx >= 0 ? (args[dirIdx + 1] ?? "./design") : "./design";

  // Design directory must exist
  if (!(await dirExists(designDir))) {
    process.stderr.write(`ERROR INPUT - design directory not found: ${designDir}\n`);
    return 2;
  }

  // Build pipeline (no loop gate, no manifest check needed for layer enablement)
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const graph = buildGraph(parsed, manifestPath);

  // Collect all element bodies in ID lexicographic order
  const allIds = [...graph.elements.keys()].sort();
  const allBodies = extractAllBodies(allIds, graph, files);

  // Build the review instruction
  const instruction = buildReviewInstruction({
    allBodies,
    formatRulesSummary: FORMAT_RULES_SUMMARY,
    reviewGuidance: REVIEW_GUIDANCE,
  });

  // Write to stdout (no file I/O)
  process.stdout.write(instruction);
  return 0;
}

// ---------------------------------------------------------------------------
// Template resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the request-template value to a string.
 *
 * If the value is a path to an existing file (relative to designDir), read it.
 * Otherwise, execute it as a shell command and capture stdout.
 *
 * @returns Template content string, or null on error (error already written to stderr).
 */
async function resolveTemplate(value: string, designDir: string): Promise<string | null> {
  const candidatePath = resolve(designDir, value);
  const fileExists = await Bun.file(candidatePath).exists();

  if (fileExists) {
    return Bun.file(candidatePath).text();
  }

  // Execute as shell command
  try {
    const proc = Bun.spawn(["sh", "-c", value], {
      stdout: "pipe",
      stderr: "inherit",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      process.stderr.write(
        `ERROR CONFIG - request-template command failed (exit ${exitCode}): ${value}\n`
      );
      return null;
    }
    return new Response(proc.stdout).text();
  } catch (err) {
    process.stderr.write(
      `ERROR CONFIG - failed to execute request-template command: ${value}\n${err}\n`
    );
    return null;
  }
}
