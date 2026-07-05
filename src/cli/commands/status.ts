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
import { parseManifest, isLayerEnabled, getEnabledPrefixes, validateFormatVersion } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { runCheck } from "../../check/checker.ts";
import { readState } from "../../state/reader.ts";
import { extractReferences } from "../../parse/references.ts";
import { writeDiagnostics } from "../format.ts";
import {
  computeFrontier as computeFrontierImpl,
  type Frontier,
} from "../../plan/frontier.ts";
import type { Graph, Manifest } from "../../graph/types.ts";
import type { StateMap } from "../../state/types.ts";
import type { ParseResult } from "../../parse/types.ts";

// Re-export Frontier type so existing consumers can still import from status.ts
export type { Frontier };

// ---------------------------------------------------------------------------
// Addressed topics extraction (ADR-0018-3)
// ---------------------------------------------------------------------------

/**
 * Extract the set of top-* IDs that are addressed (cited in any ADR's
 * `topics:` frontmatter).
 *
 * Uses extractReferences on the raw frontmatter value string so that the
 * [[...]] grammar is handled by mod-parse (inv-single-reference-grammar).
 *
 * @param frontmatters Frontmatter records keyed by file path.
 * @param graph        Element graph (to identify ADR element files).
 */
export function extractAddressedTopics(
  frontmatters: ParseResult["frontmatters"],
  graph: Graph
): Set<string> {
  const addressed = new Set<string>();

  // Collect all file paths that belong to adr elements
  const adrFiles = new Set<string>();
  for (const el of graph.rawElements) {
    if (el.prefix === "adr") {
      adrFiles.add(el.file);
    }
  }

  // For each adr file, extract `topics:` frontmatter value and find top-* refs
  for (const [filePath, fm] of frontmatters) {
    if (!adrFiles.has(filePath)) continue;
    const topicsValue = fm["topics"];
    if (!topicsValue) continue;

    // topics can be string or string[] (comma-split list from frontmatter)
    const values = Array.isArray(topicsValue) ? topicsValue : [topicsValue];
    for (const val of values) {
      // Use extractReferences to parse [[top-*]] references from the value
      // (delegates [[...]] interpretation to mod-parse per inv-single-reference-grammar)
      const refs = extractReferences(val, "<synthetic>");
      for (const ref of refs) {
        if (ref.targetId.startsWith("top-")) {
          addressed.add(ref.targetId);
        }
      }
    }
  }

  return addressed;
}

// ---------------------------------------------------------------------------
// Frontier computation (backward-compatible wrapper)
// ---------------------------------------------------------------------------

/**
 * Compute the three design frontiers from graph, state, manifest, and frontmatters.
 *
 * This wrapper converts `manifest` → `enabledPrefixes` and computes
 * `addressedTopics` from the ADR frontmatters before delegating to
 * the implementation in src/plan/frontier.ts, keeping the caller API stable.
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
  const addressedTopics = extractAddressedTopics(frontmatters, graph);
  return computeFrontierImpl(graph, stateMap, enabledPrefixes, addressedTopics, frontmatters);
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

  // Stage gate: format-version must be supported (C12)
  const fvDiag = validateFormatVersion(manifest, manifestPath);
  if (fvDiag) {
    process.stderr.write(
      `ERROR CONFIG - unsupported format-version in ${manifestPath}.\n` +
      `${fvDiag.message}\n`
    );
    return 2;
  }

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
