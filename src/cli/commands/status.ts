/**
 * `status` command handler.
 *
 * Displays design frontiers (ADR-0005):
 *   (a) open topics — design concerns waiting for resolution
 *   (b) designed elements — elements waiting to be put into a request
 *   (c) requested elements — elements waiting to be implemented
 *
 * When loop is disabled, shows a summary of elements, references, and check result.
 *
 * Exit codes:
 *   0 = success
 *   2 = input error (design directory not found)
 */

import { join } from "path";
import { stat } from "fs/promises";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest, isLayerEnabled, getEnabledPrefixes } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { runCheck } from "../../check/checker.ts";
import { readState } from "../../state/reader.ts";
import { writeDiagnostics } from "../format.ts";
import type { Graph, Manifest } from "../../graph/types.ts";
import type { StateMap } from "../../state/types.ts";
import type { ParseResult } from "../../parse/types.ts";

// ---------------------------------------------------------------------------
// Frontier types
// ---------------------------------------------------------------------------

export interface Frontier {
  /** open topics (top elements with status: open). */
  openTopics: Array<{ id: string; source?: string }>;
  /** Designed elements (no stateMap entry or state === "designed"), implementation prefixes only. */
  designed: string[];
  /** Requested elements (state === "requested"), with request slug. */
  requested: Array<{ id: string; request: string }>;
}

// ---------------------------------------------------------------------------
// Prefixes counted as "implementation" elements for the designed frontier
// ---------------------------------------------------------------------------

/**
 * Set of element prefixes that represent implementation units.
 * Loop meta-elements (top, plan, grp) and ADRs are excluded from the
 * "designed" frontier since they are planning/decision artifacts, not
 * implementation targets.
 */
const IMPLEMENTATION_PREFIXES = new Set(["mod", "term", "ent", "inv", "seq"]);

// ---------------------------------------------------------------------------
// Frontier computation (pure function)
// ---------------------------------------------------------------------------

/**
 * Compute the three design frontiers from graph, state, manifest, and frontmatters.
 *
 * @param graph        The element graph built from parseFiles.
 * @param stateMap     Contents of state.json (empty if file absent).
 * @param manifest     Parsed manifest (enabled layers).
 * @param frontmatters Frontmatter records keyed by file path (from parseFiles).
 */
export function computeFrontier(
  graph: Graph,
  stateMap: StateMap,
  manifest: Manifest,
  frontmatters: ParseResult["frontmatters"]
): Frontier {
  const enabledPrefixes = getEnabledPrefixes(manifest);

  // (a) Open topics: top elements whose frontmatter status === "open"
  const openTopics: Frontier["openTopics"] = [];
  for (const [id, el] of graph.elements) {
    if (el.prefix !== "top") continue;
    const fm = frontmatters.get(el.file);
    const status = typeof fm?.["status"] === "string" ? fm["status"] : undefined;
    if (status === "open") {
      const source = typeof fm?.["source"] === "string" ? fm["source"] : undefined;
      openTopics.push(source !== undefined ? { id, source } : { id });
    }
  }

  // (b) Designed: implementation elements not in stateMap or with state === "designed"
  const designed: string[] = [];
  for (const [id, el] of graph.elements) {
    if (!IMPLEMENTATION_PREFIXES.has(el.prefix)) continue;
    if (!enabledPrefixes.has(el.prefix)) continue;
    const entry = stateMap[id];
    const state = entry?.state ?? "designed";
    if (state === "designed") {
      designed.push(id);
    }
  }

  // (c) Requested: stateMap entries with state === "requested"
  const requested: Frontier["requested"] = [];
  for (const [id, entry] of Object.entries(stateMap)) {
    if (entry.state !== "requested") continue;
    // Only include IDs that exist in the graph
    if (!graph.elements.has(id)) continue;
    requested.push({ id, request: entry.request ?? "" });
  }

  return { openTopics, designed, requested };
}

// ---------------------------------------------------------------------------
// Formatters (stdout output)
// ---------------------------------------------------------------------------

/**
 * Format the three frontiers for stdout output.
 */
export function formatFrontier(frontier: Frontier): string {
  const lines: string[] = [];

  lines.push(`## Open Topics (${frontier.openTopics.length})`);
  if (frontier.openTopics.length === 0) {
    lines.push("  (none)");
  } else {
    for (const t of frontier.openTopics) {
      const src = t.source !== undefined ? ` (source: ${t.source})` : "";
      lines.push(`  - ${t.id}${src}`);
    }
  }

  lines.push("");
  lines.push(`## Designed (${frontier.designed.length})`);
  if (frontier.designed.length === 0) {
    lines.push("  (none)");
  } else {
    for (const id of frontier.designed) {
      lines.push(`  - ${id}`);
    }
  }

  lines.push("");
  lines.push(`## Requested (${frontier.requested.length})`);
  if (frontier.requested.length === 0) {
    lines.push("  (none)");
  } else {
    for (const r of frontier.requested) {
      lines.push(`  - ${r.id} (request: ${r.request})`);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Format a summary for loop-disabled mode.
 *
 * @param elementCount  Number of enabled elements in the graph.
 * @param refCount      Number of references in the graph.
 * @param checkOk       Whether `runCheck` returned no diagnostics.
 */
export function formatSummary(
  elementCount: number,
  refCount: number,
  checkOk: boolean
): string {
  const checkStr = checkOk ? "OK" : "FAIL";
  return [
    `Elements: ${elementCount}  References: ${refCount}  Check: ${checkStr}`,
    "(loop not enabled — topic/plan frontiers omitted)",
  ].join("\n") + "\n";
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
 * Handle the `status` command.
 *
 * Reads the design directory and displays frontier information.
 * When loop is enabled: shows 3 frontiers (open topics, designed, requested).
 * When loop is disabled: shows element/reference counts and check result.
 */
export async function handleStatus(args: string[]): Promise<number> {
  // --help
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu status [--dir <path>]",
        "",
        "Show design frontiers and summary.",
        "",
        "When loop is enabled (manifest has 'loop' in enabled):",
        "  - Open topics (top elements with status: open)",
        "  - Designed elements (not yet in a request)",
        "  - Requested elements (in a request, not yet implemented)",
        "",
        "When loop is disabled:",
        "  - Element and reference counts",
        "  - Check result (OK / FAIL)",
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

  // Build pipeline
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const manifest = parseManifest(parsed.frontmatters, manifestPath);
  const graph = buildGraph(parsed, manifestPath);

  if (isLayerEnabled("loop", manifest)) {
    // Loop enabled: show 3 frontiers
    const stateMap = await readState(join(designDir, "state.json"));
    const frontier = computeFrontier(graph, stateMap, manifest, parsed.frontmatters);
    process.stdout.write(formatFrontier(frontier));
  } else {
    // Loop disabled: show summary
    const enabledPrefixes = getEnabledPrefixes(manifest);
    const elementCount = [...graph.elements.values()].filter(
      (el) => enabledPrefixes.has(el.prefix)
    ).length;
    const refCount = graph.references.all.length;

    const diagnostics = runCheck(graph, manifest, []);
    writeDiagnostics(diagnostics);
    const checkOk = diagnostics.length === 0;

    process.stdout.write(formatSummary(elementCount, refCount, checkOk));
  }

  return 0;
}
