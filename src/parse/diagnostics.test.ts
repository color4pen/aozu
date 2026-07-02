/**
 * Diagnostics tests: verify that ID grammar violations and non-flat frontmatter
 * are reported with file + line positions, and that the correct design/ files
 * produce zero diagnostics.
 */

import { describe, expect, it } from "bun:test";
import { join } from "path";
import { readMarkdownFiles } from "../fs/reader.ts";
import { parseFiles } from "./parser.ts";

const DESIGN_DIR = join(import.meta.dir, "../../design");

describe("diagnostics — ID grammar violations", () => {
  it("reports diagnostic for ID with uppercase letters in heading", () => {
    const result = parseFiles([
      { path: "test.md", content: "## Foo {#Mod-Parse}\n" },
    ]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    const d = result.diagnostics[0]!;
    expect(d.severity).toBe("error");
    expect(d.file).toBe("test.md");
    expect(d.line).toBeGreaterThan(0);
    expect(d.message).toMatch(/[Ii]nvalid/i);
  });

  it("reports diagnostic for ID with invalid character (underscore)", () => {
    const result = parseFiles([
      { path: "test.md", content: "## Foo {#mod_parse}\n" },
    ]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.severity).toBe("error");
  });

  it("reports diagnostic for ID with invalid character (dot)", () => {
    const result = parseFiles([
      { path: "test.md", content: "## Foo {#mod.parse}\n" },
    ]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("includes file path in diagnostic", () => {
    const result = parseFiles([
      { path: "path/to/bad.md", content: "## Bad {#Mod-Parse}\n" },
    ]);
    expect(result.diagnostics[0]!.file).toBe("path/to/bad.md");
  });

  it("includes 1-based line number in diagnostic for heading violation", () => {
    const result = parseFiles([
      {
        path: "test.md",
        content: "# Title\n\n## Bad {#Mod-Parse}\n",
      },
    ]);
    expect(result.diagnostics[0]!.line).toBe(3);
  });
});

describe("diagnostics — non-flat frontmatter", () => {
  it("reports diagnostic for indented frontmatter line", () => {
    const result = parseFiles([
      {
        path: "test.md",
        content: "---\nkey:\n  nested: value\n---\n",
      },
    ]);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]!.severity).toBe("error");
    expect(result.diagnostics[0]!.file).toBe("test.md");
    expect(result.diagnostics[0]!.line).toBeGreaterThan(0);
  });
});

describe("diagnostics — design/ correctness", () => {
  it("produces zero diagnostics for the current design/ files", async () => {
    const files = await readMarkdownFiles(DESIGN_DIR);
    const result = parseFiles(files);
    if (result.diagnostics.length > 0) {
      console.error("Unexpected diagnostics:", result.diagnostics);
    }
    expect(result.diagnostics).toHaveLength(0);
  });
});
