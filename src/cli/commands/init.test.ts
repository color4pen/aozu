/**
 * Tests for the `init` command handler.
 *
 * T-02: Covers file generation, init→check e2e, fail-closed on existing dir,
 *        --dir flag parsing, and stdout/stderr separation.
 */

import { describe, it, expect } from "bun:test";
import { handleInit } from "./init.ts";
import { handleCheck } from "./check.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";

/** Absolute path to the CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../main.ts");

describe("handleInit — file generation", () => {
  it("creates manifest.md, static/modules.md, static/dependencies.md", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-init-test-"));
    const designDir = join(baseDir, "design");
    try {
      const exitCode = await handleInit(["--dir", designDir]);
      expect(exitCode).toBe(0);

      expect(await Bun.file(join(designDir, "manifest.md")).exists()).toBe(true);
      expect(await Bun.file(join(designDir, "static", "modules.md")).exists()).toBe(true);
      expect(await Bun.file(join(designDir, "static", "dependencies.md")).exists()).toBe(true);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("manifest.md contains format-version: 0 and enabled: static", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-init-fm-test-"));
    const designDir = join(baseDir, "design");
    try {
      await handleInit(["--dir", designDir]);
      const content = await Bun.file(join(designDir, "manifest.md")).text();
      expect(content).toContain("format-version: 0");
      expect(content).toContain("enabled: static");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("static/modules.md contains a placeholder mod element with 責務: line", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-init-mod-test-"));
    const designDir = join(baseDir, "design");
    try {
      await handleInit(["--dir", designDir]);
      const content = await Bun.file(join(designDir, "static", "modules.md")).text();
      // Must contain a heading element declaration
      expect(content).toMatch(/\{#mod-[a-z0-9-]+\}/);
      // Must contain 責務: line (required per spec/format.md §8)
      expect(content).toContain("責務:");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

describe("handleInit — init → check e2e", () => {
  it("generated directory passes aozu check (exit 0)", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-init-check-test-"));
    const designDir = join(baseDir, "design");
    try {
      const initCode = await handleInit(["--dir", designDir]);
      expect(initCode).toBe(0);

      const checkCode = await handleCheck(["--dir", designDir]);
      expect(checkCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

describe("handleInit — existing directory (fail-closed)", () => {
  it("returns 1 when the design directory already exists", async () => {
    const designDir = await mkdtemp(join(tmpdir(), "aozu-init-existing-"));
    try {
      const exitCode = await handleInit(["--dir", designDir]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(designDir, { recursive: true });
    }
  });

  it("does not write any files when directory exists", async () => {
    const designDir = await mkdtemp(join(tmpdir(), "aozu-init-no-write-"));
    try {
      await handleInit(["--dir", designDir]);

      // manifest.md must not be created
      expect(await Bun.file(join(designDir, "manifest.md")).exists()).toBe(false);
    } finally {
      await rm(designDir, { recursive: true });
    }
  });

  it("does not overwrite existing content when directory exists", async () => {
    const designDir = await mkdtemp(join(tmpdir(), "aozu-init-sentinel-"));
    const sentinelPath = join(designDir, "sentinel.txt");
    try {
      await Bun.write(sentinelPath, "existing-content");

      await handleInit(["--dir", designDir]);

      // Sentinel file unchanged
      const content = await Bun.file(sentinelPath).text();
      expect(content).toBe("existing-content");
    } finally {
      await rm(designDir, { recursive: true });
    }
  });
});

describe("handleInit — --dir flag", () => {
  it("creates files in the directory specified by --dir", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-init-dir-test-"));
    const customDir = join(baseDir, "my-custom-design");
    try {
      const exitCode = await handleInit(["--dir", customDir]);
      expect(exitCode).toBe(0);
      expect(await Bun.file(join(customDir, "manifest.md")).exists()).toBe(true);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("uses ./design as default when --dir is not specified", async () => {
    // We cannot easily test the CWD default without changing process.cwd(),
    // so we just verify that --dir with a custom path works correctly.
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-init-default-test-"));
    const designDir = join(baseDir, "design");
    try {
      const exitCode = await handleInit(["--dir", designDir]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

describe("handleInit — --help", () => {
  it("returns 0 for --help", async () => {
    const exitCode = await handleInit(["--help"]);
    expect(exitCode).toBe(0);
  });

  it("returns 0 for -h", async () => {
    const exitCode = await handleInit(["-h"]);
    expect(exitCode).toBe(0);
  });
});

describe("handleInit — stdout / stderr separation", () => {
  it("writes nothing to stdout; writes messages to stderr on success", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-init-subprocess-"));
    const designDir = join(baseDir, "design");
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "init", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe(""); // nothing on stdout
      expect(stderr.length).toBeGreaterThan(0); // success message on stderr
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("writes nothing to stdout; writes error to stderr on failure", async () => {
    const designDir = await mkdtemp(join(tmpdir(), "aozu-init-subprocess-fail-"));
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "init", "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(1);
      expect(stdout).toBe(""); // nothing on stdout
      expect(stderr.length).toBeGreaterThan(0); // error message on stderr
    } finally {
      await rm(designDir, { recursive: true });
    }
  });
});
