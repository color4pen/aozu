/**
 * `plan` command handler.
 *
 * Generates a plan document (`design/plans/<slug>.md`) from the current set
 * of designed elements (the same frontier as `status`).
 *
 * The plan is a human-editable working document; aozu generates the initial
 * skeleton with one group and three annotation sections that help the author
 * decide how to split, order, and parallelise the work (ADR-0006, ADR-0018).
 *
 * Exit codes:
 *   0 = plan file created successfully
 *   1 = validation failure (loop disabled / slug collision / no designed elements)
 *   2 = input error (missing slug, bad slug format, design directory not found)
 */

import { join } from "path";
import { stat, mkdir } from "fs/promises";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest, isLayerEnabled, getEnabledPrefixes } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { readDesignState } from "../../state/reader.ts";
import { computeFrontier } from "../../plan/frontier.ts";
import { findOwningElement } from "../../graph/attribution.ts";
import { generatePlan, type PlanAnnotations } from "../../plan/generator.ts";
import type { Element } from "../../graph/index.ts";

// ---------------------------------------------------------------------------
// Slug validation (spec §4: [a-z0-9]+(-[a-z0-9]+)*)
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

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
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle the `plan` command.
 *
 * Usage: aozu plan <slug> [--dir <path>]
 */
export async function handlePlan(args: string[]): Promise<number> {
  // --help / -h
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu plan <slug> [--dir <path>]",
        "",
        "Generate a plan document from designed elements.",
        "",
        "Creates design/plans/<slug>.md with:",
        "  - A single initial group containing all designed elements",
        "  - Annotation sections for ordering and parallelism decisions",
        "",
        "Requires loop to be enabled in manifest (manifest enabled: ..., loop, ...).",
        "",
        "Arguments:",
        "  <slug>        Plan slug ([a-z0-9]+(-[a-z0-9]+)*)",
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

  // Parse --dir (consume flag and value first to leave positional args clean)
  const dirIdx = args.indexOf("--dir");
  const designDir = dirIdx >= 0 ? (args[dirIdx + 1] ?? "./design") : "./design";

  // Collect positional args (non-flag tokens)
  const positional = args.filter(
    (a, i) =>
      !a.startsWith("--") && !(i > 0 && args[i - 1] === "--dir") && a !== designDir
  );

  // slug is the first positional arg
  const slug = positional[0];
  if (!slug) {
    process.stderr.write("ERROR INPUT - missing slug argument\nUsage: aozu plan <slug> [--dir <path>]\n");
    return 2;
  }

  // Validate slug format
  if (!SLUG_RE.test(slug)) {
    process.stderr.write(
      `ERROR INPUT - invalid slug format: "${slug}"\nSlugs must match [a-z0-9]+(-[a-z0-9]+)* (e.g. "my-batch", "order-model")\n`
    );
    return 2;
  }

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

  // Stage gate: loop must be enabled (ADR-0010 — fail-closed, no graceful degradation)
  if (!isLayerEnabled("loop", manifest)) {
    process.stderr.write(
      [
        "ERROR - loop layer is not enabled in manifest.",
        "Add 'loop' to the enabled list in design/manifest.md:",
        "  enabled: static, domain, dynamic, loop",
        "Plan generation requires loop to be enabled.",
      ].join("\n") + "\n"
    );
    return 1;
  }

  // Stage gate: plan file must not already exist
  const planPath = join(designDir, "plans", `${slug}.md`);
  if (await Bun.file(planPath).exists()) {
    process.stderr.write(
      `ERROR - plan already exists: ${planPath}\nDelete or rename it before generating a new plan with this slug.\n`
    );
    return 1;
  }

  // Compute designed frontier
  const stateMap = await readDesignState(designDir);
  const enabledPrefixes = getEnabledPrefixes(manifest);
  const frontier = computeFrontier(graph, stateMap, enabledPrefixes, parsed.frontmatters);

  // Stage gate: at least one designed element required
  if (frontier.designed.length === 0) {
    process.stderr.write(
      "ERROR - no designed elements found.\nAll elements are either requested or implemented; nothing to plan.\n"
    );
    return 1;
  }

  // Build annotations
  const annotations = buildAnnotations(frontier.designed, frontier.requested, graph);

  // Generate plan document
  const planContent = generatePlan(slug, frontier.designed, annotations);

  // Write file
  await mkdir(join(designDir, "plans"), { recursive: true });
  await Bun.write(planPath, planContent);

  process.stderr.write(`plan generated: ${planPath}\n`);
  return 0;
}

// ---------------------------------------------------------------------------
// Annotation builder
// ---------------------------------------------------------------------------

/**
 * Build annotation materials from the reference graph and state.
 *
 * @param designed   Designed element IDs.
 * @param requested  Requested elements (from frontier).
 * @param graph      Reference graph.
 */
function buildAnnotations(
  designed: string[],
  requested: Array<{ id: string; request: string }>,
  graph: ReturnType<typeof buildGraph>
): PlanAnnotations {
  const designedSet = new Set(designed);
  const allElements: Element[] = [...graph.elements.values()];

  // (a) Reference edges between designed elements
  const referenceEdges: Array<{ from: string; to: string }> = [];
  const edgeSeen = new Set<string>();
  for (const ref of graph.references.all) {
    const owner = findOwningElement(allElements, ref.file, ref.line);
    if (!owner || !designedSet.has(owner.id)) continue;
    if (!designedSet.has(ref.targetId)) continue;
    const key = `${owner.id}→${ref.targetId}`;
    if (!edgeSeen.has(key)) {
      edgeSeen.add(key);
      referenceEdges.push({ from: owner.id, to: ref.targetId });
    }
  }

  // (b) Module grounding for each designed element
  const modGrounding = new Map<string, string[]>();
  for (const id of designed) {
    const el = graph.elements.get(id);
    if (!el) {
      modGrounding.set(id, []);
      continue;
    }
    const mods = new Set<string>();

    // Out-direction: refs from this element to mod elements
    const refsFromFile = graph.references.bySource.get(el.file) ?? [];
    for (const ref of refsFromFile) {
      const owner = findOwningElement(allElements, ref.file, ref.line);
      if (owner?.id !== id) continue;
      const target = graph.elements.get(ref.targetId);
      if (target?.prefix === "mod") mods.add(ref.targetId);
    }

    // In-direction: refs from mod elements to this element
    const refsToEl = graph.references.byTarget.get(id) ?? [];
    for (const ref of refsToEl) {
      const owner = findOwningElement(allElements, ref.file, ref.line);
      if (owner?.prefix === "mod") mods.add(owner.id);
    }

    modGrounding.set(id, [...mods]);
  }

  return {
    referenceEdges,
    modGrounding,
    requestedElements: requested,
  };
}
