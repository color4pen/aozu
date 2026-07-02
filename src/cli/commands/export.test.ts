/**
 * Integration tests for the `export rules` command.
 */

import { describe, it, expect } from "bun:test";
import { handleExport } from "./export.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";

/** Absolute path to this repository's design directory. */
const DESIGN_DIR = resolve(import.meta.dir, "../../../design");

/** Absolute path to the CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../main.ts");

/** Create a minimal valid design fixture with 実装: lines on all mods. */
async function createValidDesignFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-export-test-"));
  await mkdir(join(dir, "static"), { recursive: true });

  await writeFile(
    join(dir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "modules.md"),
    [
      "# Modules",
      "",
      "## CLI {#mod-cli}",
      "責務: CLI.",
      "実装: src/cli/",
      "",
      "## Parser {#mod-parse}",
      "責務: parse.",
      "実装: src/parse/",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "dependencies.md"),
    [
      "# Dependencies",
      "",
      "- [[mod-cli]] -> [[mod-parse]]",
    ].join("\n")
  );

  return dir;
}

/** Create a design fixture where one mod is missing its 実装: line. */
async function createMissingImplFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-export-missing-impl-"));
  await mkdir(join(dir, "static"), { recursive: true });

  await writeFile(
    join(dir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      "enabled: static",
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(dir, "static", "modules.md"),
    [
      "# Modules",
      "",
      "## CLI {#mod-cli}",
      "責務: CLI.",
      "実装: src/cli/",
      "",
      "## Parser {#mod-parse}",
      "責務: parse.",
      // No 実装: line for mod-parse
    ].join("\n")
  );

  return dir;
}

describe("handleExport — subcommand routing", () => {
  it("returns 0 for empty args (usage display)", async () => {
    const exitCode = await handleExport([]);
    expect(exitCode).toBe(0);
  });

  it("returns 0 for --help", async () => {
    const exitCode = await handleExport(["--help"]);
    expect(exitCode).toBe(0);
  });

  it("returns 2 for unknown subcommand", async () => {
    const exitCode = await handleExport(["unknown"]);
    expect(exitCode).toBe(2);
  });

  it("returns 2 when design directory does not exist", async () => {
    const exitCode = await handleExport([
      "rules",
      "--dir",
      "/tmp/nonexistent-design-" + Date.now(),
    ]);
    expect(exitCode).toBe(2);
  });
});

describe("handleExport rules — normal mode", () => {
  it("returns 0 for this repository's own design directory", async () => {
    const exitCode = await handleExport(["rules", "--dir", DESIGN_DIR]);
    expect(exitCode).toBe(0);
  });

  it("returns 1 when a mod is missing 実装: line", async () => {
    const dir = await createMissingImplFixture();
    try {
      const exitCode = await handleExport(["rules", "--dir", dir]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

describe("handleExport rules — subprocess output validation", () => {
  it("stdout is valid JSON when run as subprocess", async () => {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "export", "rules", "--dir", DESIGN_DIR],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(0);
    // Should be parseable JSON
    const parsed = JSON.parse(stdout);
    expect(parsed).toBeDefined();
  });

  it("stdout JSON contains format-version, modules, paths, allowed", async () => {
    const proc = Bun.spawn(
      ["bun", MAIN_TS, "export", "rules", "--dir", DESIGN_DIR],
      { stdout: "pipe", stderr: "pipe" }
    );
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    expect(exitCode).toBe(0);
    const parsed = JSON.parse(stdout);
    expect(typeof parsed["format-version"]).toBe("number");
    expect(Array.isArray(parsed.modules)).toBe(true);
    expect(typeof parsed.paths).toBe("object");
    expect(Array.isArray(parsed.allowed)).toBe(true);
  });
});

describe("handleExport rules --verify", () => {
  it("returns 0 when committed rules.json matches regenerated ruleset", async () => {
    const dir = await createValidDesignFixture();
    try {
      // First generate the rules.json
      const genCode = await handleExport(["rules", "--dir", dir, "--out", join(dir, "rules.json")]);
      expect(genCode).toBe(0);

      // Now verify
      const exitCode = await handleExport([
        "rules",
        "--dir",
        dir,
        "--verify",
        join(dir, "rules.json"),
      ]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns 1 when rules.json diverges from current design", async () => {
    const dir = await createValidDesignFixture();
    try {
      // Write a stale rules.json with different content
      await writeFile(join(dir, "rules.json"), JSON.stringify({ stale: true }));

      const exitCode = await handleExport([
        "rules",
        "--dir",
        dir,
        "--verify",
        join(dir, "rules.json"),
      ]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns 2 when the rules.json file does not exist", async () => {
    const dir = await createValidDesignFixture();
    try {
      const exitCode = await handleExport([
        "rules",
        "--dir",
        dir,
        "--verify",
        join(dir, "nonexistent-rules.json"),
      ]);
      expect(exitCode).toBe(2);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("uses <designDir>/rules.json as default verify path", async () => {
    const dir = await createValidDesignFixture();
    try {
      // Generate rules.json to the default path
      const genCode = await handleExport(["rules", "--dir", dir, "--out", join(dir, "rules.json")]);
      expect(genCode).toBe(0);

      // Verify without explicit path → should find <dir>/rules.json
      const exitCode = await handleExport(["rules", "--dir", dir, "--verify"]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
