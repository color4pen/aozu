/**
 * `check` command handler.
 *
 * Wires together: fs/reader → parse → graph → check → format
 *
 * Two modes:
 *   - Normal mode (no --request):  reads design directory, runs closure checks.
 *   - Request mode (--request):    validates [[id]] citations in a request document.
 *
 * Exit codes:
 *   0 = no violations / all citations valid
 *   1 = violations / invalid citations
 *   2 = input error (directory / file not found, missing manifest)
 */

import { join } from "path";
import { stat } from "fs/promises";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest, isLayerEnabled, validateFormatVersion } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { computeAllHashes, computeElementHash } from "../../graph/body.ts";
import { runCheck } from "../../check/checker.ts";
import { readState } from "../../state/reader.ts";
import { getEffectiveState } from "../../state/effective.ts";
import { extractRequestCitations } from "../../parse/request-citations.ts";
import { formatDiagnostic, writeDiagnostics } from "../format.ts";
import type { CheckDiagnostic } from "../../check/types.ts";
import type { FileInput } from "../../parse/types.ts";

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

/**
 * Build the graph pipeline from a design directory.
 * Returns null (and emits a diagnostic to stderr) if the directory does not exist.
 */
async function buildPipeline(designDir: string): Promise<
  | {
      graph: import("../../graph/types.ts").Graph;
      manifest: import("../../graph/types.ts").Manifest;
      files: FileInput[];
    }
  | null
> {
  if (!(await dirExists(designDir))) {
    process.stderr.write(`ERROR INPUT - design directory not found: ${designDir}\n`);
    return null;
  }

  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const manifest = parseManifest(parsed.frontmatters, manifestPath);
  const graph = buildGraph(parsed, manifestPath);
  return { graph, manifest, files };
}

/**
 * Handle `check --request <path>` mode.
 *
 * Validates that:
 *   (a) all [[id]] citations in the request document resolve to known elements
 *   (b) cited elements are in 'designed' or 'requested' state (not 'implemented')
 *
 * Optional: --require-citation rejects documents with zero citations.
 */
export async function handleCheckRequest(
  args: string[],
  designDir: string
): Promise<number> {
  // Parse --request <path>
  const reqIdx = args.indexOf("--request");
  const requestPath = reqIdx >= 0 ? args[reqIdx + 1] : undefined;
  if (!requestPath) {
    process.stderr.write("ERROR INPUT - missing argument for --request\n");
    return 2;
  }

  const requireCitation = args.includes("--require-citation");

  // Check request file exists
  if (!(await fileExists(requestPath))) {
    process.stderr.write(`ERROR INPUT - request file not found: ${requestPath}\n`);
    return 2;
  }

  // Build graph pipeline
  const pipeline = await buildPipeline(designDir);
  if (pipeline === null) return 2;
  const { graph, manifest, files } = pipeline;

  // Stage gate: format-version must be supported (C12)
  const manifestPath = join(designDir, "manifest.md");
  const fvDiag = validateFormatVersion(manifest, manifestPath);
  if (fvDiag) {
    writeDiagnostics([fvDiag]);
    return 1;
  }

  // Read state.json
  const stateMap = await readState(join(designDir, "state.json"));

  // Read and parse request document, classifying citations
  const content = await Bun.file(requestPath).text();
  const citations = extractRequestCitations(content, requestPath);

  const diagnostics: CheckDiagnostic[] = [];

  // R3: malformed dependency lines (fail-closed — cannot silently misclassify)
  for (const ml of citations.malformedLines) {
    diagnostics.push({
      level: "error",
      code: "R3",
      elementId: null,
      message: `malformed dependency line: '${ml.text}'`,
      file: requestPath,
      line: ml.line,
    });
  }

  // Deduplicate coverage refs by targetId
  const seenCoverage = new Set<string>();
  const uniqueCoverageIds: string[] = [];
  for (const ref of citations.coverageRefs) {
    if (!seenCoverage.has(ref.targetId)) {
      seenCoverage.add(ref.targetId);
      uniqueCoverageIds.push(ref.targetId);
    }
  }

  // R0: --require-citation counts only coverage refs (dependency refs do not satisfy it)
  if (requireCitation && uniqueCoverageIds.length === 0) {
    diagnostics.push({
      level: "error",
      code: "R0",
      elementId: null,
      message: "--require-citation: no [[id]] citations found in request document",
      file: requestPath,
      line: 1,
    });
  }

  // R1 (coverage refs): element must exist in the graph
  for (const id of uniqueCoverageIds) {
    if (!graph.elements.has(id)) {
      diagnostics.push({
        level: "error",
        code: "R1",
        elementId: id,
        message: `citation references unknown element '${id}'`,
        file: requestPath,
        line: 1,
      });
      continue;
    }

    // R2: coverage refs must not be effectively implemented.
    // Uses effective state so that drifted implemented elements (hash mismatch) pass R2.
    const entry = stateMap[id];
    if (entry === undefined) {
      // Absence of entry = designed → pass R2
    } else {
      // Compute effective state: for implemented+hash entries, check current body hash
      let effectiveState: "designed" | "requested" | "implemented";
      if (entry.state === "implemented" && entry.hash !== undefined) {
        const currentHash = computeElementHash(id, graph, files);
        effectiveState = getEffectiveState(entry, currentHash ?? undefined);
      } else {
        effectiveState = entry.state;
      }

      if (effectiveState === "implemented") {
        diagnostics.push({
          level: "error",
          code: "R2",
          elementId: id,
          message: `cited element '${id}' is already implemented; request must introduce design delta`,
          file: requestPath,
          line: 1,
        });
      }
    }
  }

  // R1 (dependency refs): element must exist in the graph; state is not checked
  // Skip IDs already validated as coverage refs to avoid duplicate R1 diagnostics
  for (const id of citations.dependencyIds) {
    if (seenCoverage.has(id)) continue; // already covered by coverage-ref R1 check
    if (!graph.elements.has(id)) {
      diagnostics.push({
        level: "error",
        code: "R1",
        elementId: id,
        message: `citation references unknown element '${id}'`,
        file: requestPath,
        line: 1,
      });
    }
    // No R2 check for dependency refs — state is intentionally not verified
  }

  writeDiagnostics(diagnostics);
  return diagnostics.some((d) => d.level === "error") ? 1 : 0;
}

/**
 * Handle the `check` command.
 *
 * Parses flags from `args`, then dispatches to normal mode or request mode.
 */
export async function handleCheck(args: string[]): Promise<number> {
  // --help
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu check [--dir <path>] [--request <path>] [--require-citation]",
        "",
        "Options:",
        "  --dir <path>          Design directory (default: ./design)",
        "  --request <path>      Validate citations in a request document",
        "  --require-citation    Fail when the request document has no [[id]] citations",
        "  -h, --help            Show this help",
        "",
        "Exit codes: 0 = no violations / 1 = violations / 2 = input error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse --dir
  const dirIdx = args.indexOf("--dir");
  const designDir = dirIdx >= 0 ? (args[dirIdx + 1] ?? "./design") : "./design";

  // Request mode?
  if (args.includes("--request")) {
    return handleCheckRequest(args, designDir);
  }

  // Normal mode: run closure checks on design directory
  if (!(await dirExists(designDir))) {
    process.stderr.write(`ERROR INPUT - design directory not found: ${designDir}\n`);
    return 2;
  }

  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const manifest = parseManifest(parsed.frontmatters, manifestPath);

  // Stage gate: format-version must be supported (C12)
  const fvDiag = validateFormatVersion(manifest, manifestPath);
  if (fvDiag) {
    writeDiagnostics([fvDiag]);
    return 1;
  }

  const graph = buildGraph(parsed, manifestPath);

  // Read state.json (may not exist — defaults to empty → all designed)
  const stateMap = await readState(join(designDir, "state.json"));
  const stateKeys = Object.keys(stateMap);

  const diagnostics = runCheck(graph, manifest, stateKeys);

  // S1: hash drift warnings (only when loop is enabled — designed-reversion mechanism)
  // S1 does not affect exit code; only error-level diagnostics cause exit 1.
  if (isLayerEnabled("loop", manifest)) {
    // Collect implemented entries that have a recorded hash
    const hashIds = stateKeys.filter(
      (id) => stateMap[id]!.state === "implemented" && stateMap[id]!.hash !== undefined
    );

    if (hashIds.length > 0) {
      const currentHashes = computeAllHashes(hashIds, graph, files);

      for (const id of hashIds) {
        const entry = stateMap[id]!;
        const currentHash = currentHashes.get(id);

        // If element is not resolvable from the graph (deleted residue), skip S1.
        // C8 will report the stale entry as an error separately.
        if (currentHash === undefined) continue;

        if (entry.hash !== currentHash) {
          const el = graph.elements.get(id);
          // Element must be in graph for S1 (we already checked currentHash !== undefined above,
          // which implies the element was found — computeAllHashes only returns entries for
          // elements found in the graph)
          if (!el) continue;

          diagnostics.push({
            level: "warning",
            code: "S1",
            elementId: id,
            message: "element body has drifted from implementation-time record",
            file: el.file,
            line: el.line,
          });
        }
      }
    }
  }

  writeDiagnostics(diagnostics);
  // Exit 1 only when there are error-level diagnostics (S1 warnings do not cause exit 1)
  return diagnostics.some((d) => d.level === "error") ? 1 : 0;
}
