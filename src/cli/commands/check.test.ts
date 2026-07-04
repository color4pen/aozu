/**
 * Integration tests for the `check` command (normal mode).
 *
 * T-07: Tests that the normal mode (no --request flag) works correctly.
 */

import { describe, it, expect, spyOn } from "bun:test";
import { handleCheck } from "./check.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";

/** Absolute path to this repository's design directory. */
const DESIGN_DIR = resolve(import.meta.dir, "../../../design");

/** Absolute path to the CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../../main.ts");

/**
 * Create a minimal fixture design directory with an unsupported format-version.
 *
 * @param formatVersionValue  The value to write for format-version, or "missing" to omit the key.
 */
async function createBadFormatVersionFixture(formatVersionValue: string | "missing"): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-check-fv-test-"));
  await mkdir(join(dir, "static"), { recursive: true });

  const fvLine = formatVersionValue === "missing" ? "" : `\nformat-version: ${formatVersionValue}`;
  await writeFile(
    join(dir, "manifest.md"),
    [
      "---",
      `enabled: static${fvLine}`,
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
      "## App {#mod-app}",
      "責務: app.",
      "実装: src/",
    ].join("\n")
  );

  await writeFile(join(dir, "static", "dependencies.md"), "# 許可依存\n");

  return dir;
}

/** Create a minimal fixture design directory with a violation. */
async function createViolationFixture(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-check-test-"));
  await mkdir(join(dir, "static"), { recursive: true });

  // Minimal manifest
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

  // modules.md with an unresolved reference
  await writeFile(
    join(dir, "static", "modules.md"),
    [
      "# Modules",
      "",
      "## Parser {#mod-parse}",
      "責務: parser.",
      "",
      "## Graph {#mod-graph}",
      "責務: graph. Depends on [[mod-nonexistent]].",
    ].join("\n")
  );

  return dir;
}

describe("handleCheck — normal mode", () => {
  it("returns 0 for this repository's own design directory", async () => {
    const exitCode = await handleCheck(["--dir", DESIGN_DIR]);
    expect(exitCode).toBe(0);
  });

  it("returns 2 when design directory does not exist", async () => {
    const exitCode = await handleCheck(["--dir", "/tmp/nonexistent-" + Date.now()]);
    expect(exitCode).toBe(2);
  });

  it("returns 1 for a fixture containing a violation", async () => {
    const dir = await createViolationFixture();
    try {
      const exitCode = await handleCheck(["--dir", dir]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns 0 for --help", async () => {
    const exitCode = await handleCheck(["--help"]);
    expect(exitCode).toBe(0);
  });
});

describe("handleCheck — format-version fence (C12)", () => {
  it("returns 1 for manifest with format-version: 99 (unknown version)", async () => {
    const dir = await createBadFormatVersionFixture("99");
    try {
      const exitCode = await handleCheck(["--dir", dir]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns 1 for manifest with format-version key missing (file exists)", async () => {
    const dir = await createBadFormatVersionFixture("missing");
    try {
      const exitCode = await handleCheck(["--dir", dir]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("stderr contains 'C12' for unknown format-version", async () => {
    const dir = await createBadFormatVersionFixture("99");
    const stderrLines: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
      stderrLines.push(typeof s === "string" ? s : new TextDecoder().decode(s));
      return true;
    });
    try {
      const exitCode = await handleCheck(["--dir", dir]);
      spy.mockRestore();
      expect(exitCode).toBe(1);
      expect(stderrLines.join("")).toContain("C12");
    } finally {
      spy.mockRestore();
      await rm(dir, { recursive: true });
    }
  });

  it("stderr contains 'C12' for missing format-version key", async () => {
    const dir = await createBadFormatVersionFixture("missing");
    const stderrLines: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
      stderrLines.push(typeof s === "string" ? s : new TextDecoder().decode(s));
      return true;
    });
    try {
      const exitCode = await handleCheck(["--dir", dir]);
      spy.mockRestore();
      expect(exitCode).toBe(1);
      expect(stderrLines.join("")).toContain("C12");
    } finally {
      spy.mockRestore();
      await rm(dir, { recursive: true });
    }
  });
});

describe("handleCheck — stdout / stderr separation", () => {
  it("writes diagnostics to stderr and nothing to stdout", async () => {
    const dir = await createViolationFixture();
    try {
      // Run as a subprocess so we can capture stdout/stderr independently
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "check", "--dir", dir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toBe(""); // nothing on stdout
      expect(stderr.length).toBeGreaterThan(0); // diagnostics on stderr
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
