/**
 * Integration test: parse all `design/` documents and verify Graph construction.
 */

import { describe, expect, it } from "bun:test";
import { join } from "path";
import { readMarkdownFiles } from "../fs/reader.ts";
import { parseFiles } from "../parse/parser.ts";
import { buildGraph, resolveId } from "./builder.ts";

const DESIGN_DIR = join(import.meta.dir, "../../design");
const MANIFEST_PATH = join(DESIGN_DIR, "manifest.md");

describe("graph integration: design/", () => {
  it("ElementTable has exactly 26 entries", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed, MANIFEST_PATH);
    expect(graph.elements.size).toBe(26);
  });

  it("resolveId returns Element for 'mod-parse'", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed, MANIFEST_PATH);
    const el = resolveId(graph, "mod-parse");
    expect(el).toBeDefined();
    expect(el!.id).toBe("mod-parse");
    expect(el!.prefix).toBe("mod");
  });

  it("resolveId returns undefined for nonexistent ID", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed, MANIFEST_PATH);
    expect(resolveId(graph, "nonexistent")).toBeUndefined();
    expect(resolveId(graph, "mod-nonexistent")).toBeUndefined();
  });

  it("byTarget index contains references to mod-cli", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed, MANIFEST_PATH);
    const refs = graph.references.byTarget.get("mod-cli");
    expect(refs).toBeDefined();
    expect(refs!.length).toBeGreaterThan(0);
  });

  it("TC-027: actorIds are populated from seq documents", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const parsed = parseFiles(files);
    const graph = buildGraph(parsed, MANIFEST_PATH);
    // design/ has two seq documents (closure-check, rules-export)
    expect(graph.actorIds.length).toBeGreaterThan(0);
    // All actor IDs in design/ should have mod prefix
    for (const actor of graph.actorIds) {
      expect(actor.id.startsWith("mod-")).toBe(true);
    }
  });
});
