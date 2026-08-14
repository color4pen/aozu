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
// T-14: conformance fixture — spec §8 example (permission + domain enabled)
// ---------------------------------------------------------------------------

describe("check integration: spec §8 conformance fixture (T-14)", () => {
  it("permission + domain enabled fixture → zero diagnostics", () => {
    // Matches spec §8 example:
    // - manifest: enabled: static, domain, permission
    // - mod element (static)
    // - act elements: act-admin, act-manager, act-member, act-finance (domain)
    // - ent element: ent-deal (domain)
    // - perm element: perm-deal with list + create operations, target: ent-deal (views)
    const parsed: ParseResult = {
      elements: [
        // static
        { id: "mod-workflow", prefix: "mod", displayName: "Workflow", file: "static/modules.md", line: 1 },
        // domain — actors
        { id: "act-admin", prefix: "act", displayName: "Admin", file: "domain/actors.md", line: 1 },
        { id: "act-manager", prefix: "act", displayName: "Manager", file: "domain/actors.md", line: 5 },
        { id: "act-member", prefix: "act", displayName: "Member", file: "domain/actors.md", line: 9 },
        { id: "act-finance", prefix: "act", displayName: "Finance", file: "domain/actors.md", line: 13 },
        // domain — entity
        { id: "ent-deal", prefix: "ent", displayName: "Deal", file: "domain/model.md", line: 1 },
        // domain — operations (op elements, per ADR-0025)
        { id: "op-list-deals", prefix: "op", displayName: "List Deals", file: "domain/operations.md", line: 1 },
        { id: "op-create-deal", prefix: "op", displayName: "Create Deal", file: "domain/operations.md", line: 5 },
        // views — perm
        { id: "perm-deal", prefix: "perm", displayName: "Deal Permissions", file: "views/permission/deal.md", line: 1 },
      ],
      references: [
        // References from operation lines and target (対象: [[ent-deal]])
        { targetId: "ent-deal", file: "views/permission/deal.md", line: 2 },
        { targetId: "op-list-deals", file: "views/permission/deal.md", line: 4 },
        { targetId: "act-admin", file: "views/permission/deal.md", line: 4 },
        { targetId: "act-manager", file: "views/permission/deal.md", line: 4 },
        { targetId: "act-member", file: "views/permission/deal.md", line: 4 },
        { targetId: "act-finance", file: "views/permission/deal.md", line: 4 },
        { targetId: "op-create-deal", file: "views/permission/deal.md", line: 5 },
        { targetId: "act-admin", file: "views/permission/deal.md", line: 5 },
        { targetId: "act-manager", file: "views/permission/deal.md", line: 5 },
      ],
      dependencyEdges: [],
      diagnostics: [],
      frontmatters: new Map(),
      actorIds: [],
      elementItems: [],
      implementations: [
        { paths: ["src/workflow/"], file: "static/modules.md", line: 3 },
      ],
      permOperations: [
        {
          operation: "op-list-deals",
          actorIds: ["act-admin", "act-manager", "act-member", "act-finance"],
          file: "views/permission/deal.md",
          line: 4,
        },
        {
          operation: "op-create-deal",
          actorIds: ["act-admin", "act-manager"],
          file: "views/permission/deal.md",
          line: 5,
        },
      ],
      targetLines: [
        { targetIds: ["ent-deal"], file: "views/permission/deal.md", line: 2 },
      ],
      malformedPermOperations: [],
    };

    const graph = buildGraph(parsed);
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain", "permission"] };

    const diagnostics = runCheck(graph, manifest, []);

    if (diagnostics.length > 0) {
      const report = diagnostics
        .map((d) => `  ${d.level.toUpperCase()} ${d.code} ${d.elementId ?? "-"}: ${d.message}`)
        .join("\n");
      throw new Error(`Conformance fixture has ${diagnostics.length} violation(s):\n${report}`);
    }

    expect(diagnostics).toHaveLength(0);
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
      permOperations: [],
      targetLines: [],
      malformedPermOperations: [],
    };

    const graph = buildGraph(parsed);
    const manifest: Manifest = { formatVersion: "0", enabled: ["static", "domain", "dynamic"] };

    const diagnostics = runCheck(graph, manifest);
    expect(diagnostics).toHaveLength(0);
  });
});
