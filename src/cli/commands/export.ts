/**
 * `export` command handler.
 *
 * Wires together: fs/reader → parse → graph → export/generator
 *
 * Subcommands:
 *   export rules           Output ruleset JSON to stdout
 *   export rules --out     Write ruleset JSON to file
 *   export rules --verify  Compare regenerated ruleset to committed file
 *
 * Exit codes:
 *   0 = success / match
 *   1 = 実装: lines missing (export failure) / ruleset divergence (--verify)
 *   2 = input error (design dir not found, --verify file not found)
 */

import { join } from "path";
import { stat } from "fs/promises";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { buildGraph } from "../../graph/builder.ts";
import { parseManifest, validateFormatVersion } from "../../check/manifest.ts";
import { writeDiagnostics } from "../format.ts";
import { generateRuleset } from "../../export/generator.ts";

/** Determine whether a path is an existing directory. */
async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

const USAGE = [
  "Usage: aozu export <subcommand> [options]",
  "",
  "Subcommands:",
  "  rules                Output the ruleset JSON (spec/format.md §11)",
  "",
  "Options (rules):",
  "  --dir <path>         Design directory (default: ./design)",
  "  --out <path>         Write output to file instead of stdout",
  "  --verify [<path>]    Compare regenerated ruleset to committed file",
  "                       (default path: <designDir>/rules.json)",
  "  -h, --help           Show this help",
  "",
  "Exit codes: 0 = success / 1 = 実装: missing or divergence / 2 = input error",
].join("\n");

/**
 * Handle the `export` command.
 *
 * @param args  Arguments after `export` (e.g., ["rules", "--out", "path"])
 */
export async function handleExport(args: string[]): Promise<number> {
  // --help at top level
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    process.stderr.write(USAGE + "\n");
    return 0;
  }

  const subcommand = args[0];

  if (subcommand !== "rules") {
    process.stderr.write(`aozu export: unknown subcommand '${subcommand}'\n`);
    process.stderr.write(USAGE + "\n");
    return 2;
  }

  // --- export rules ---

  // --help within subcommand
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(USAGE + "\n");
    return 0;
  }

  // Parse --dir
  const dirIdx = args.indexOf("--dir");
  const designDir = dirIdx >= 0 ? (args[dirIdx + 1] ?? "./design") : "./design";

  // Verify design directory exists
  if (!(await dirExists(designDir))) {
    process.stderr.write(`ERROR INPUT - design directory not found: ${designDir}\n`);
    return 2;
  }

  // Build graph pipeline
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");

  // Stage gate: format-version must be supported (C12). The exported ruleset is
  // the exit-gate baseline (ADR-0007), so it must never be generated from an
  // unknown-format corpus.
  const manifest = parseManifest(parsed.frontmatters, manifestPath);
  const fvDiag = validateFormatVersion(manifest, manifestPath);
  if (fvDiag) {
    writeDiagnostics([fvDiag]);
    return 1;
  }

  const graph = buildGraph(parsed, manifestPath);

  // Generate ruleset
  const { json, diagnostics } = generateRuleset(graph);

  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      process.stderr.write(`ERROR ${d.code} ${d.moduleId}: ${d.message}\n`);
    }
    return 1;
  }

  // At this point, json is guaranteed non-null (diagnostics is empty)
  const rulesetJson = json!;

  // --verify mode
  if (args.includes("--verify")) {
    const verifyIdx = args.indexOf("--verify");
    const nextArg = args[verifyIdx + 1];
    // Use explicit path if given and doesn't start with "--"
    const verifyPath =
      nextArg && !nextArg.startsWith("--")
        ? nextArg
        : join(designDir, "rules.json");

    const verifyFile = Bun.file(verifyPath);
    if (!(await verifyFile.exists())) {
      process.stderr.write(`ERROR INPUT - rules file not found: ${verifyPath}\n`);
      return 2;
    }

    const existing = await verifyFile.text();
    if (existing === rulesetJson) {
      return 0;
    }

    process.stderr.write(
      `ERROR: ruleset diverges from design documents (${verifyPath})\n`
    );
    return 1;
  }

  // Normal mode: write to --out <path> or stdout
  const outIdx = args.indexOf("--out");
  if (outIdx >= 0) {
    const outPath = args[outIdx + 1];
    if (!outPath) {
      process.stderr.write("ERROR INPUT - missing argument for --out\n");
      return 2;
    }
    await Bun.write(outPath, rulesetJson);
    return 0;
  }

  process.stdout.write(rulesetJson);
  return 0;
}
