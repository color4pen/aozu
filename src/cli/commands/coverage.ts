/**
 * `coverage` command handler.
 *
 * Verifies that a request draft covers all elements in a plan group, then
 * transitions covered elements from "designed" to "requested" in state.json.
 *
 * Usage:
 *   aozu coverage --group <grp-id> --draft <path> --request <slug> [--dir <path>]
 *
 * Exit codes:
 *   0 = pass (transition written)
 *   1 = fail (coverage incomplete, state mismatch, or loop disabled)
 *   2 = input error (draft not found, group not found, slug grammar, design dir not found)
 */

import { join } from "path";
import { stat } from "fs/promises";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest, isLayerEnabled, validateFormatVersion } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { extractRequestCitations } from "../../parse/request-citations.ts";
import { readDesignState } from "../../state/reader.ts";
import { writeDesignState } from "../../state/writer.ts";
import { verifyCoverage } from "../../plan/coverage.ts";
import type { GroupGraph } from "../../plan/coverage.ts";
import type { StateMap } from "../../state/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Slug grammar: [a-z0-9]+(-[a-z0-9]+)* */
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

/** Check whether a file exists. */
async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Handle the `coverage` command.
 *
 * All output goes to stderr (spec/integration.md §5).
 * stdout is intentionally empty.
 */
export async function handleCoverage(args: string[]): Promise<number> {
  // --help
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu coverage --group <grp-id> --draft <path> --request <slug> [--dir <path>]",
        "",
        "Verify that a request draft covers all elements in a plan group, then",
        "transition the group elements from designed → requested in state.json.",
        "",
        "Options:",
        "  --group <grp-id>   Plan group ID to verify (required)",
        "  --draft <path>     Path to the request draft file (required)",
        "  --request <slug>   Request slug to record in state.json (required)",
        "  --dir <path>       Design directory (default: ./design)",
        "  -h, --help         Show this help",
        "",
        "Verification checks:",
        "  (a) Coverage    — all group elements are cited in the draft (code exclusions applied)",
        "  (b) Existence   — all group elements exist in the design graph",
        "  (c) State       — all group elements are in 'designed' state (ADR-0018-4)",
        "  (d) Cross-group — warns if cross-group references lack after: ordering constraints",
        "",
        "Exit codes:",
        "  0 = pass (transition to requested written)",
        "  1 = fail (coverage incomplete, state mismatch, or loop disabled)",
        "  2 = input error (draft not found, group not found, slug grammar, design dir not found)",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse --group
  const groupIdx = args.indexOf("--group");
  const grpId = groupIdx >= 0 ? args[groupIdx + 1] : undefined;
  if (!grpId) {
    process.stderr.write(
      "ERROR INPUT - missing --group argument\nUsage: aozu coverage --group <grp-id> --draft <path> --request <slug>\n"
    );
    return 2;
  }

  // Parse --draft
  const draftIdx = args.indexOf("--draft");
  const draftPath = draftIdx >= 0 ? args[draftIdx + 1] : undefined;
  if (!draftPath) {
    process.stderr.write(
      "ERROR INPUT - missing --draft argument\nUsage: aozu coverage --group <grp-id> --draft <path> --request <slug>\n"
    );
    return 2;
  }

  // Parse --request
  const requestIdx = args.indexOf("--request");
  const requestSlug = requestIdx >= 0 ? args[requestIdx + 1] : undefined;
  if (!requestSlug) {
    process.stderr.write(
      "ERROR INPUT - missing --request argument\nUsage: aozu coverage --group <grp-id> --draft <path> --request <slug>\n"
    );
    return 2;
  }

  // Parse --dir
  const dirIdx = args.indexOf("--dir");
  const designDir = dirIdx >= 0 ? (args[dirIdx + 1] ?? "./design") : "./design";

  // Validate slug grammar before touching the filesystem
  if (!SLUG_RE.test(requestSlug)) {
    process.stderr.write(
      `ERROR INPUT - invalid request slug "${requestSlug}": must match [a-z0-9]+(-[a-z0-9]+)*\n`
    );
    return 2;
  }

  // Design directory must exist
  if (!(await dirExists(designDir))) {
    process.stderr.write(`ERROR INPUT - design directory not found: ${designDir}\n`);
    return 2;
  }

  // Draft file must exist
  if (!(await fileExists(draftPath))) {
    process.stderr.write(`ERROR INPUT - draft file not found: ${draftPath}\n`);
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

  // Stage gate: loop must be enabled
  if (!isLayerEnabled("loop", manifest)) {
    process.stderr.write(
      [
        "ERROR - loop layer is not enabled in manifest.",
        "Add 'loop' to the enabled list in design/manifest.md:",
        "  enabled: static, domain, dynamic, loop",
        "coverage requires loop to be enabled.",
      ].join("\n") + "\n"
    );
    return 1;
  }

  // Find the group element
  const grpEl = graph.elements.get(grpId);
  if (!grpEl || grpEl.prefix !== "grp") {
    process.stderr.write(
      `ERROR INPUT - group not found: "${grpId}"\nCheck that the group exists in a plan file under ${join(designDir, "plans")}\n`
    );
    return 2;
  }

  // Collect elements belonging to the target group
  // (same pattern as prompt.ts: nearest preceding grp element in the same file)
  const allElements = [...graph.elements.values()];
  const groupElementItems = graph.elementItems.filter((item) => {
    let bestGrp: (typeof allElements)[0] | undefined;
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

  if (groupElementIds.length === 0) {
    process.stderr.write(
      `ERROR INPUT - group "${grpId}" has no elements defined in its elements: line\n`
    );
    return 2;
  }

  // Extract and classify references from the draft document (spec §6 + ADR-0024)
  const draftContent = await Bun.file(draftPath).text();
  const citations = extractRequestCitations(draftContent, draftPath);

  // R3: malformed dependency lines are a hard error (fail-closed)
  if (citations.malformedLines.length > 0) {
    for (const ml of citations.malformedLines) {
      process.stderr.write(
        `COVERAGE ERROR R3 - malformed dependency line: '${ml.text}' (${draftPath}:${ml.line})\n`
      );
    }
    return 1;
  }

  // Dependency refs are excluded from coverage (spec/integration.md §1)
  const draftRefs = new Set(citations.coverageRefs.map((r) => r.targetId));

  // Read current state
  const stateMap = await readDesignState(designDir);

  // Build GroupGraph: all groups and their elements, plus after: edges
  const groupGraph = buildGroupGraph(graph, allElements);

  // Run coverage verification
  const result = verifyCoverage(groupElementIds, draftRefs, graph, stateMap, groupGraph);

  // Emit warnings (always, regardless of pass/fail)
  for (const w of result.warnings) {
    process.stderr.write(`COVERAGE WARN ${w.code} ${w.elementId} ${w.message}\n`);
  }

  if (!result.pass) {
    // Emit errors and return 1 (no state.json write)
    for (const e of result.errors) {
      process.stderr.write(`COVERAGE ERROR ${e.code} ${e.elementId} ${e.message}\n`);
    }
    return 1;
  }

  // Pass: transition all group elements to requested
  const newStateMap: StateMap = { ...stateMap };
  for (const id of groupElementIds) {
    newStateMap[id] = { state: "requested", request: requestSlug };
  }

  await writeDesignState(designDir, newStateMap);
  process.stderr.write(
    `coverage: ${groupElementIds.length} element(s) transitioned to requested (request: ${requestSlug})\n`
  );

  return 0;
}

// ---------------------------------------------------------------------------
// GroupGraph construction
// ---------------------------------------------------------------------------

/**
 * Build a GroupGraph from the parsed design graph.
 *
 * groupElements: maps each grp element to its owned element IDs
 *   (by nearest-preceding-grp-in-same-file attribution).
 *
 * afterEdges: references in plan files where targetId.prefix === "grp"
 *   (per D6: "targetId の prefix が grp である参照 = after: 辺").
 */
function buildGroupGraph(
  graph: import("../../graph/types.ts").Graph,
  allElements: import("../../graph/types.ts").Graph["elements"] extends Map<string, infer V> ? V[] : never[]
): GroupGraph {
  // groupElements: grp-id → Set<element-id>
  const groupElements = new Map<string, Set<string>>();

  const grpElements = allElements.filter((el) => el.prefix === "grp");
  for (const grpEl of grpElements) {
    const ownedItems = graph.elementItems.filter((item) => {
      // Find the nearest preceding grp element in the same file (before item.line)
      let bestGrp: (typeof grpEl) | undefined;
      for (const el of allElements) {
        if (el.file !== item.file) continue;
        if (el.prefix !== "grp") continue;
        if (el.line > item.line) continue;
        if (!bestGrp || el.line > bestGrp.line) {
          bestGrp = el;
        }
      }
      return bestGrp?.id === grpEl.id;
    });

    if (ownedItems.length > 0) {
      groupElements.set(grpEl.id, new Set(ownedItems.map((item) => item.id)));
    }
  }

  // afterEdges: references with grp targetId in plan files
  // Identify plan files by looking for plan/grp elements
  const planFiles = new Set<string>();
  for (const el of allElements) {
    if (el.prefix === "plan" || el.prefix === "grp") {
      planFiles.add(el.file);
    }
  }

  const afterEdges = new Set<string>();
  for (const ref of graph.references.all) {
    if (!planFiles.has(ref.file)) continue;
    if (!ref.targetId.startsWith("grp-")) continue;

    // Find the nearest preceding grp element in the same file
    let owningGrp: (typeof allElements)[0] | undefined;
    for (const el of allElements) {
      if (el.file !== ref.file) continue;
      if (el.prefix !== "grp") continue;
      if (el.line > ref.line) continue;
      if (!owningGrp || el.line > owningGrp.line) {
        owningGrp = el;
      }
    }
    if (owningGrp) {
      afterEdges.add(`${owningGrp.id}->${ref.targetId}`);
    }
  }

  return { groupElements, afterEdges };
}
