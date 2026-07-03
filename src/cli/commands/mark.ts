/**
 * `mark` command handler.
 *
 * Supports the sub-command:
 *   mark implemented --request <slug> [--pr <number>] [--dir <path>]
 *
 * Transitions requested elements to implemented state.
 * Strictly conforms to spec/integration.md §2.
 *
 * Exit codes:
 *   0 = transition complete (no-op included)
 *   1 = unknown slug or loop disabled
 *   2 = input error (missing slug, design dir not found, unknown subcommand)
 */

import { join } from "path";
import { stat } from "fs/promises";
import { readMarkdownFiles } from "../../fs/reader.ts";
import { parseFiles } from "../../parse/parser.ts";
import { parseManifest, isLayerEnabled } from "../../check/manifest.ts";
import { readDesignState } from "../../state/reader.ts";
import { writeDesignState } from "../../state/writer.ts";
import type { StateMap } from "../../state/types.ts";

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
 * Handle the `mark` command.
 *
 * Dispatches to sub-command handlers:
 *   - `implemented`: transition requested elements to implemented
 */
export async function handleMark(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu mark <subcommand> [options]",
        "",
        "Sub-commands:",
        "  implemented  Transition requested elements to implemented state",
        "",
        "Run 'aozu mark implemented --help' for details.",
        "",
        "Exit codes: 0 = success / 1 = unknown slug or loop disabled / 2 = input error",
      ].join("\n") + "\n"
    );
    return 0;
  }

  const subcommand = args[0];
  if (!subcommand) {
    process.stderr.write(
      "ERROR INPUT - missing subcommand\nUsage: aozu mark <subcommand> [options]\nAvailable: implemented\n"
    );
    return 2;
  }

  if (subcommand === "implemented") {
    return handleMarkImplemented(args.slice(1));
  }

  process.stderr.write(
    `ERROR INPUT - unknown subcommand: "${subcommand}"\nAvailable subcommands: implemented\n`
  );
  return 2;
}

// ---------------------------------------------------------------------------
// `mark implemented` handler
// ---------------------------------------------------------------------------

/**
 * Handle `mark implemented --request <slug> [--pr <number>] [--dir <path>]`.
 *
 * Contract (spec/integration.md §2):
 *   - Collects all state.json entries where request === slug (any state)
 *   - 0 matches → exit 1 (unknown slug)
 *   - All matches already implemented → no-op, exit 0 (idempotent)
 *   - Transitions requested → implemented (--pr recorded if provided)
 *   - No partial application: all transitions or none (atomic write)
 *   - Writes nothing to stdout
 */
export async function handleMarkImplemented(args: string[]): Promise<number> {
  if (args.includes("--help") || args.includes("-h")) {
    process.stderr.write(
      [
        "Usage: aozu mark implemented --request <slug> [--pr <number>] [--dir <path>]",
        "",
        "Transition all requested elements with the given request slug to implemented.",
        "",
        "Options:",
        "  --request <slug>   Request slug to match (required)",
        "  --pr <number>      PR number to record in state.json (optional)",
        "  --dir <path>       Design directory (default: ./design)",
        "  -h, --help         Show this help",
        "",
        "Exit codes:",
        "  0 = transition complete (or no-op if all already implemented)",
        "  1 = unknown slug (no matching request found) or loop disabled",
        "  2 = input error (missing slug, design dir not found)",
      ].join("\n") + "\n"
    );
    return 0;
  }

  // Parse --request
  const requestIdx = args.indexOf("--request");
  const slug = requestIdx >= 0 ? args[requestIdx + 1] : undefined;
  if (!slug) {
    process.stderr.write(
      "ERROR INPUT - missing --request argument\nUsage: aozu mark implemented --request <slug>\n"
    );
    return 2;
  }

  // Parse --pr (optional)
  const prIdx = args.indexOf("--pr");
  let prNumber: number | undefined;
  if (prIdx >= 0) {
    const prStr = args[prIdx + 1];
    if (prStr !== undefined) {
      const n = Number(prStr);
      if (!Number.isNaN(n) && Number.isFinite(n)) {
        prNumber = Math.trunc(n);
      }
    }
  }

  // Parse --dir
  const dirIdx = args.indexOf("--dir");
  const designDir = dirIdx >= 0 ? (args[dirIdx + 1] ?? "./design") : "./design";

  // Design directory must exist
  if (!(await dirExists(designDir))) {
    process.stderr.write(`ERROR INPUT - design directory not found: ${designDir}\n`);
    return 2;
  }

  // Build pipeline (minimal: only need manifest for loop check)
  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const manifestPath = join(designDir, "manifest.md");
  const manifest = parseManifest(parsed.frontmatters, manifestPath);

  // Stage gate: loop must be enabled
  if (!isLayerEnabled("loop", manifest)) {
    process.stderr.write(
      [
        "ERROR - loop layer is not enabled in manifest.",
        "Add 'loop' to the enabled list in design/manifest.md:",
        "  enabled: static, domain, dynamic, loop",
        "mark implemented requires loop to be enabled.",
      ].join("\n") + "\n"
    );
    return 1;
  }

  // Read current state
  const stateMap = await readDesignState(designDir);

  // Collect all entries where request === slug (state-independent)
  const matchingIds = Object.keys(stateMap).filter(
    (id) => stateMap[id]!.request === slug
  );

  // 0 matches → unknown slug → exit 1
  if (matchingIds.length === 0) {
    process.stderr.write(`MARK ERROR - unknown slug "${slug}": no elements found with this request\n`);
    return 1;
  }

  // Check if all matching entries are already implemented (idempotent no-op)
  const requestedIds = matchingIds.filter(
    (id) => stateMap[id]!.state === "requested"
  );

  if (requestedIds.length === 0) {
    // All already implemented → no-op, exit 0
    process.stderr.write(
      `mark implemented: all ${matchingIds.length} element(s) with request "${slug}" are already implemented — no-op\n`
    );
    return 0;
  }

  // Build new stateMap: transition requested → implemented (atomic copy)
  const newStateMap: StateMap = { ...stateMap };
  for (const id of requestedIds) {
    const entry = newStateMap[id]!;
    newStateMap[id] = {
      state: "implemented",
      request: entry.request ?? slug,
      ...(prNumber !== undefined ? { pr: prNumber } : {}),
    };
  }

  // Write all transitions atomically (full map written at once)
  await writeDesignState(designDir, newStateMap);
  process.stderr.write(
    `mark implemented: ${requestedIds.length} element(s) transitioned to implemented` +
    (prNumber !== undefined ? ` (pr: ${prNumber})` : "") +
    `\n`
  );

  return 0;
}
