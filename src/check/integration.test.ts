/**
 * Integration test: design/ passes check with zero violations.
 *
 * Equivalent to `tools/check.sh design` — confirms aozu's self-description
 * is a valid closure under the C1–C11 rules.
 */

import { describe, expect, it } from "bun:test";
import { join } from "path";
import { readMarkdownFiles } from "../fs/reader.ts";
import { parseFiles } from "../parse/parser.ts";
import { buildGraph } from "../graph/builder.ts";
import { parseManifest, runCheck } from "./index.ts";
import type { ParseResult } from "../parse/types.ts";
import type { Manifest } from "../graph/types.ts";

const DESIGN_DIR = join(import.meta.dir, "../../design");
const MANIFEST_PATH = join(DESIGN_DIR, "manifest.md");

describe("check integration: design/ passes with zero violations (equivalent to tools/check.sh)", () => {
  it("design/ has zero check diagnostics", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed, MANIFEST_PATH);
    const manifest = parseManifest(parsed.frontmatters, MANIFEST_PATH);

    const diagnostics = runCheck(graph, manifest, []);

    // Report diagnostics for easier debugging if test fails
    if (diagnostics.length > 0) {
      const report = diagnostics
        .map((d) => `  ${d.level.toUpperCase()} ${d.code} ${d.elementId ?? "-"}: ${d.message} (${d.file}:${d.line})`)
        .join("\n");
      throw new Error(`design/ check found ${diagnostics.length} violation(s):\n${report}`);
    }

    expect(diagnostics).toHaveLength(0);
  });

  it("design/ manifest is correctly parsed (enabled: static, domain, dynamic)", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const parsed = parseFiles(files);
    const manifest = parseManifest(parsed.frontmatters, MANIFEST_PATH);

    expect(manifest.enabled).toContain("static");
    expect(manifest.enabled).toContain("domain");
    expect(manifest.enabled).toContain("dynamic");
    expect(manifest.enabled).not.toContain("loop");
  });
});

// ---------------------------------------------------------------------------
// T-09: act element + seq with act actor → check exit 0
// ---------------------------------------------------------------------------

describe("check integration: act elements with seq actors", () => {
  it("actors.md (act element) + seq with act actor → zero diagnostics", () => {
    // Build in-memory ParseResult:
    // - mod-workflow (static layer)
    // - act-approver (domain layer, in actors.md)
    // - seq-approval (dynamic layer, actors: mod-workflow + act-approver)
    // - manifest: enabled static, domain, dynamic
    const parsed: ParseResult = {
      elements: [
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "static/modules.md", line: 1 },
        { id: "act-approver", prefix: "act", displayName: "Approver", file: "domain/actors.md", line: 1 },
        { id: "seq-approval-flow", prefix: "seq", displayName: "Approval Flow", file: "dynamic/approval.md", line: 1 },
      ],
      references: [],
      dependencyEdges: [],
      diagnostics: [],
      frontmatters: new Map(),
      actorIds: [
        { id: "mod-workflow", file: "dynamic/approval.md", line: 5 },
        { id: "act-approver", file: "dynamic/approval.md", line: 6 },
      ],
      elementItems: [],
      implementations: [],
    };

    const graph = buildGraph(parsed);
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain", "dynamic"] };

    const diagnostics = runCheck(graph, manifest);
    expect(diagnostics).toHaveLength(0);
  });
});
