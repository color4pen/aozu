/**
 * `prompt` command handler.
 *
 * Currently supports one sub-command:
 *   prompt derive --group <grp-id> [--dir <path>]
 *
 * `prompt derive` writes nothing to the filesystem; it outputs the derive
 * instruction text to stdout (ADR-0008 — prompt verb semantics).
 *
 * Template and output-dir configuration is injected via manifest frontmatter
 * (ADR-0012 — consumer-agnostic derivation):
 *   request-template:    file path (relative to design dir) or shell command
 *   request-output-dir:  output directory path for the generated draft
 *
 * Exit codes:
 *   0 = instruction text written to stdout
 *   2 = input error or configuration error (missing config / plan not found /
 *       group not found / unresolved elements / loop disabled)
 */

import { join, resolve } from "path";
import { stat } from "fs/promises";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest, isLayerEnabled } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { findOwningElement } from "../../graph/attribution.ts";
import { extractAllBodies } from "../../graph/body.ts";
import { computeNeighborhood } from "../../graph/neighborhood.ts";
import { buildDeriveInstruction } from "../../prompt/derive.ts";
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
 *   - `derive`: generate a derive instruction for a plan group
 */
export async function handlePrompt(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu prompt <subcommand> [options]",
        "",
        "Sub-commands:",
        "  derive  Generate a derive instruction for a plan group",
        "",
        "Run 'aozu prompt derive --help' for details.",
        "",
        "Exit codes: 0 = success / 2 = input or configuration error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  const subcommand = args[0];
  if (!subcommand) {
    process.stderr.write(
      "ERROR INPUT - missing subcommand\nUsage: aozu prompt <subcommand> [options]\nAvailable: derive\n"
    );
    return 2;
  }

  if (subcommand === "derive") {
    return handleDerive(args.slice(1));
  }

  process.stderr.write(
    `ERROR INPUT - unknown subcommand: "${subcommand}"\nAvailable subcommands: derive\n`
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
        "Exit codes: 0 = success / 2 = input or configuration error",
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
  const graph = buildGraph(parsed, manifestPath);

  // --- Manifest frontmatter for config keys ---
  const manifestFm = parsed.frontmatters.get(manifestPath) ?? {};

  // Stage gate: loop must be enabled (derive without loop = configuration error = exit 2)
  if (!isLayerEnabled("loop", manifest)) {
    process.stderr.write(
      [
        "ERROR CONFIG - loop layer is not enabled in manifest.",
        "Add 'loop' to the enabled list in design/manifest.md:",
        "  enabled: static, domain, dynamic, loop",
        "prompt derive requires loop to be enabled.",
      ].join("\n") + "\n"
    );
    return 2;
  }

  // Stage gate: request-template must be present
  const requestTemplate = manifestFm["request-template"];
  if (!requestTemplate || (Array.isArray(requestTemplate) && requestTemplate.length === 0)) {
    process.stderr.write(
      [
        "ERROR CONFIG - missing 'request-template' in manifest frontmatter.",
        "Add to design/manifest.md frontmatter:",
        "  request-template: <file-path-or-command>",
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
        "  request-output-dir: <output-directory>",
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
