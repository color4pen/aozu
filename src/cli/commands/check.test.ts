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

// ---------------------------------------------------------------------------
// T-05: S1 warning diagnostics (hash drift)
// ---------------------------------------------------------------------------

/**
 * Create a loop-enabled fixture with one implemented element whose body hash is
 * recorded.  Returns the designDir path and baseDir for cleanup.
 */
async function createDriftFixture(options: {
  modifyBody?: boolean;    // whether to modify the body after recording hash
  addWhitespace?: boolean; // trailing space (whitespace-only change)
  loopEnabled?: boolean;   // default true
  ghostEntry?: boolean;    // add an implemented+hash entry for a non-existent element
} = {}): Promise<{ designDir: string; baseDir: string }> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-check-s1-"));
  const designDir = join(baseDir, "design");

  const loopEnabled = options.loopEnabled ?? true;
  const enabledLayers = loopEnabled ? "static, loop" : "static";

  await mkdir(join(designDir, "static"), { recursive: true });

  await writeFile(
    join(designDir, "manifest.md"),
    ["---", "format-version: 0", `enabled: ${enabledLayers}`, "---", "", "# manifest"].join("\n")
  );

  // modules.md with mod-alpha element
  const bodyOriginal = [
    "# モジュール",
    "",
    "## Alpha {#mod-alpha}",
    "責務: alpha の処理",
    "実装: src/alpha/",
  ].join("\n");

  await writeFile(join(designDir, "static", "modules.md"), bodyOriginal);
  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  // Compute hash of mod-alpha's range from the original content
  const { buildGraph } = await import("../../graph/builder.ts");
  const { parseFiles } = await import("../../parse/parser.ts");
  const { computeElementHash } = await import("../../graph/body.ts");
  const { readMarkdownFiles } = await import("../../fs/reader.ts");

  const files = await readMarkdownFiles(designDir);
  const parsed = parseFiles(files);
  const graph = buildGraph(parsed, join(designDir, "manifest.md"));
  const recordedHash = computeElementHash("mod-alpha", graph, files)!;

  // state.json with recorded hash (and optionally a ghost entry)
  const stateJson: Record<string, unknown> = {
    "mod-alpha": { state: "implemented", request: "prev-req", hash: recordedHash },
  };
  if (options.ghostEntry) {
    // Create a "ghost" entry: implemented+hash but no corresponding element in design
    stateJson["ent-ghost"] = { state: "implemented", request: "ghost-req", hash: "a".repeat(64) };
  }
  await writeFile(join(designDir, "state.json"), JSON.stringify(stateJson));

  // Optionally modify the body to trigger drift
  if (options.modifyBody) {
    const modified = bodyOriginal + "\n追加の説明文。";
    await writeFile(join(designDir, "static", "modules.md"), modified);
  } else if (options.addWhitespace) {
    // Add a trailing space to trigger drift without content change
    const modified = bodyOriginal.replace("実装: src/alpha/", "実装: src/alpha/ ");
    await writeFile(join(designDir, "static", "modules.md"), modified);
  }

  return { designDir, baseDir };
}

describe("handleCheck — S1 drift warnings (T-05)", () => {
  it("emits WARN S1 <id> when body changes, exit 0 (no errors)", async () => {
    const { designDir, baseDir } = await createDriftFixture({ modifyBody: true });
    const stderrLines: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
      stderrLines.push(typeof s === "string" ? s : new TextDecoder().decode(s));
      return true;
    });
    try {
      const exitCode = await handleCheck(["--dir", designDir]);
      spy.mockRestore();

      expect(exitCode).toBe(0); // S1 only → exit 0
      const output = stderrLines.join("");
      expect(output).toContain("WARNING S1 mod-alpha");
    } finally {
      spy.mockRestore();
      await rm(baseDir, { recursive: true });
    }
  });

  it("whitespace-only change also triggers S1 (no normalization)", async () => {
    const { designDir, baseDir } = await createDriftFixture({ addWhitespace: true });
    const stderrLines: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
      stderrLines.push(typeof s === "string" ? s : new TextDecoder().decode(s));
      return true;
    });
    try {
      const exitCode = await handleCheck(["--dir", designDir]);
      spy.mockRestore();

      expect(exitCode).toBe(0);
      expect(stderrLines.join("")).toContain("WARNING S1 mod-alpha");
    } finally {
      spy.mockRestore();
      await rm(baseDir, { recursive: true });
    }
  });

  it("no S1 when hash matches (body unchanged)", async () => {
    const { designDir, baseDir } = await createDriftFixture({ modifyBody: false });
    const stderrLines: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
      stderrLines.push(typeof s === "string" ? s : new TextDecoder().decode(s));
      return true;
    });
    try {
      const exitCode = await handleCheck(["--dir", designDir]);
      spy.mockRestore();

      expect(exitCode).toBe(0);
      expect(stderrLines.join("")).not.toContain("S1");
    } finally {
      spy.mockRestore();
      await rm(baseDir, { recursive: true });
    }
  });

  it("S1 is not emitted when loop is disabled", async () => {
    const { designDir, baseDir } = await createDriftFixture({ modifyBody: true, loopEnabled: false });
    const stderrLines: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
      stderrLines.push(typeof s === "string" ? s : new TextDecoder().decode(s));
      return true;
    });
    try {
      const exitCode = await handleCheck(["--dir", designDir]);
      spy.mockRestore();

      expect(exitCode).toBe(0);
      expect(stderrLines.join("")).not.toContain("S1");
    } finally {
      spy.mockRestore();
      await rm(baseDir, { recursive: true });
    }
  });

  it("implemented entry without hash does not trigger S1", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-check-s1-nohash-"));
    const designDir = join(baseDir, "design");
    await mkdir(join(designDir, "static"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 0", "enabled: static, loop", "---"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["# モジュール", "", "## CLI {#mod-cli}", "責務: CLI"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");
    // Entry without hash
    await writeFile(
      join(designDir, "state.json"),
      JSON.stringify({ "mod-cli": { state: "implemented", request: "r1" } })
    );

    const stderrLines: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
      stderrLines.push(typeof s === "string" ? s : new TextDecoder().decode(s));
      return true;
    });
    try {
      const exitCode = await handleCheck(["--dir", designDir]);
      spy.mockRestore();

      expect(exitCode).toBe(0);
      expect(stderrLines.join("")).not.toContain("S1");
    } finally {
      spy.mockRestore();
      await rm(baseDir, { recursive: true });
    }
  });

  it("graph-unresolvable entry with hash is skipped (no S1, no crash)", async () => {
    const { designDir, baseDir } = await createDriftFixture({ modifyBody: true, ghostEntry: true });
    const stderrLines: string[] = [];
    const spy = spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => {
      stderrLines.push(typeof s === "string" ? s : new TextDecoder().decode(s));
      return true;
    });
    try {
      // Should not crash even though ent-ghost has no corresponding element in the graph
      const exitCode = await handleCheck(["--dir", designDir]);
      spy.mockRestore();

      // C8 may report ent-ghost as an error (stale state key) but S1 must not fire for it
      const output = stderrLines.join("");
      expect(output).not.toContain("S1 ent-ghost");
    } finally {
      spy.mockRestore();
      await rm(baseDir, { recursive: true });
    }
  });
});
