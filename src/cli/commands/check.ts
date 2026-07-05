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
import { parseManifest, validateFormatVersion } from "../../check/manifest.ts";
import { buildGraph } from "../../graph/builder.ts";
import { runCheck } from "../../check/checker.ts";
import { readState } from "../../state/reader.ts";
import { extractReferences } from "../../parse/references.ts";
import { formatDiagnostic, writeDiagnostics } from "../format.ts";
import type { CheckDiagnostic } from "../../check/types.ts";

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
  | { graph: import("../../graph/types.ts").Graph; manifest: import("../../graph/types.ts").Manifest }
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
  return { graph, manifest };
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
  const { graph, manifest } = pipeline;

  // Stage gate: format-version must be supported (C12)
  const manifestPath = join(designDir, "manifest.md");
  const fvDiag = validateFormatVersion(manifest, manifestPath);
  if (fvDiag) {
    writeDiagnostics([fvDiag]);
    return 1;
  }

  // Read state.json
  const stateMap = await readState(join(designDir, "state.json"));

  // Read and parse request document
  const content = await Bun.file(requestPath).text();
  const allRefs = extractReferences(content, requestPath);

  // Deduplicate by targetId
  const seen = new Set<string>();
  const uniqueIds: string[] = [];
  for (const ref of allRefs) {
    if (!seen.has(ref.targetId)) {
      seen.add(ref.targetId);
      uniqueIds.push(ref.targetId);
    }
  }

  const diagnostics: CheckDiagnostic[] = [];

  // --require-citation: 0 citations is a failure
  if (requireCitation && uniqueIds.length === 0) {
    diagnostics.push({
      level: "error",
      code: "R0",
      elementId: null,
      message: "--require-citation: no [[id]] citations found in request document",
      file: requestPath,
      line: 1,
    });
  }

  // Validate each cited ID
  for (const id of uniqueIds) {
    // (a) element must exist in the graph
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

    // (b) element state must be 'designed' or 'requested' (not 'implemented')
    const entry = stateMap[id];
    const state = entry?.state ?? "designed"; // absence = designed
    if (state === "implemented") {
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

  writeDiagnostics(diagnostics);
  return diagnostics.length === 0 ? 0 : 1;
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
  writeDiagnostics(diagnostics);
  return diagnostics.length === 0 ? 0 : 1;
}
