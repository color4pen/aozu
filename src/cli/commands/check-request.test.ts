/**
 * Integration tests for `check --request` mode.
 *
 * T-08: Validates citation checking in request documents.
 */

import { describe, it, expect } from "bun:test";
import { handleCheck } from "./check.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";

/** Absolute path to this repository's design directory. */
const DESIGN_DIR = resolve(import.meta.dir, "../../../design");

/** Write a temporary request file containing the given content and return its path. */
async function writeRequestFile(dir: string, content: string): Promise<string> {
  const path = join(dir, "request.md");
  await writeFile(path, content);
  return path;
}

/** Create a minimal valid design fixture (static layer only). */
async function createDesignFixture(extraState?: Record<string, unknown>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "aozu-req-test-"));
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
      "",
      "## Parser {#mod-parse}",
      "責務: parse.",
    ].join("\n")
  );

  if (extraState) {
    await writeFile(join(dir, "state.json"), JSON.stringify(extraState));
  }

  return dir;
}

describe("handleCheck --request mode", () => {
  it("returns 0 when citing a real element", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(tmpDir, "This request adds [[mod-parse]] support.");
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--dir", DESIGN_DIR,
      ]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it("returns 1 when citing a non-existent element", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(tmpDir, "Uses [[mod-nonexistent]] somewhere.");
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--dir", DESIGN_DIR,
      ]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it("returns 1 with --require-citation when the document has no citations", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(tmpDir, "A request with no element references.");
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--require-citation",
        "--dir", DESIGN_DIR,
      ]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it("returns 0 without --require-citation when the document has no citations", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(tmpDir, "A request with no element references.");
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--dir", DESIGN_DIR,
      ]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it("returns 2 when the request file does not exist", async () => {
    const exitCode = await handleCheck([
      "--request", "/tmp/nonexistent-req-" + Date.now() + ".md",
      "--dir", DESIGN_DIR,
    ]);
    expect(exitCode).toBe(2);
  });

  it("returns 2 when the design directory does not exist", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(tmpDir, "Uses [[mod-parse]].");
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--dir", "/tmp/nonexistent-design-" + Date.now(),
      ]);
      expect(exitCode).toBe(2);
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });

  it("TC-023: returns 1 when citing an implemented element", async () => {
    const designDir = await createDesignFixture({
      "mod-cli": { state: "implemented", request: "prev", pr: 1 },
    });
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(tmpDir, "This request concerns [[mod-cli]].");
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--dir", designDir,
      ]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(tmpDir, { recursive: true });
      await rm(designDir, { recursive: true });
    }
  });

  it("returns 0 when citing a requested element (state=requested)", async () => {
    const designDir = await createDesignFixture({
      "mod-parse": { state: "requested", request: "some" },
    });
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(tmpDir, "Updates [[mod-parse]] behavior.");
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--dir", designDir,
      ]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(tmpDir, { recursive: true });
      await rm(designDir, { recursive: true });
    }
  });

  it("ignores citations inside code fences", async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const content = [
        "A request document.",
        "",
        "```",
        "[[mod-nonexistent]] should be ignored",
        "```",
        "",
        "No real citations here.",
      ].join("\n");
      const reqPath = await writeRequestFile(tmpDir, content);
      // No real citations → exit 0 (no --require-citation)
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--dir", DESIGN_DIR,
      ]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(tmpDir, { recursive: true });
    }
  });
});
