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

// ---------------------------------------------------------------------------
// T-04: Dependency-citation tests (ADR-0024)
// ---------------------------------------------------------------------------

describe("handleCheck --request — dependency citations (ADR-0024)", () => {
  // Acceptance criterion #1: implemented element in dependency line → exit 0
  it("AC#1: dependency citation of an implemented element → exit 0", async () => {
    const designDir = await createDesignFixture({
      "mod-cli": { state: "implemented", request: "prev", pr: 1 },
    });
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(
        tmpDir,
        "依存: [[mod-cli]]\n\nThis request adds new features.\n"
      );
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

  // Acceptance criterion #2: same ID in body → R2 for the body occurrence
  it("AC#2: same implemented ID in body (coverage ref) → R2 exit 1", async () => {
    const designDir = await createDesignFixture({
      "mod-cli": { state: "implemented", request: "prev", pr: 1 },
    });
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(
        tmpDir,
        [
          "依存: [[mod-cli]]",
          "",
          "This request also modifies [[mod-cli]] in the body.",
        ].join("\n")
      );
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

  // Acceptance criterion #3: unknown ID on dependency line → R1 exit 1
  it("AC#3: unresolved ID on dependency line → R1 exit 1", async () => {
    const designDir = await createDesignFixture();
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(
        tmpDir,
        "依存: [[mod-nonexistent]]\n\nBody text.\n"
      );
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

  // Acceptance criterion #4: malformed dependency line → R3 exit 1
  it("AC#4: malformed dependency line → R3 exit 1", async () => {
    const designDir = await createDesignFixture();
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(
        tmpDir,
        "依存: [[mod-cli]] と [[mod-parse]]\n\nBody text.\n"
      );
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

  // Acceptance criterion #5: --require-citation fails when only dependency refs exist
  it("AC#5: --require-citation fails when document has only dependency citations", async () => {
    const designDir = await createDesignFixture();
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(
        tmpDir,
        "依存: [[mod-parse]]\n\nNo coverage citations in the body.\n"
      );
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--require-citation",
        "--dir", designDir,
      ]);
      expect(exitCode).toBe(1);
    } finally {
      await rm(tmpDir, { recursive: true });
      await rm(designDir, { recursive: true });
    }
  });

  // Acceptance criterion #5 (positive): --require-citation passes when coverage refs exist
  it("AC#5-pos: --require-citation passes when coverage refs exist (even with dependency refs)", async () => {
    const designDir = await createDesignFixture();
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(
        tmpDir,
        "依存: [[mod-cli]]\n\nThis covers [[mod-parse]].\n"
      );
      const exitCode = await handleCheck([
        "--request", reqPath,
        "--require-citation",
        "--dir", designDir,
      ]);
      expect(exitCode).toBe(0);
    } finally {
      await rm(tmpDir, { recursive: true });
      await rm(designDir, { recursive: true });
    }
  });

  // Acceptance criterion #6: code fence with 依存: line → ignored
  it("AC#6: dependency line inside code fence is ignored", async () => {
    const designDir = await createDesignFixture({
      "mod-cli": { state: "implemented", request: "prev", pr: 1 },
    });
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const content = [
        "# Request",
        "",
        "```",
        "依存: [[mod-cli]]",
        "```",
        "",
        "No actual dependency declarations here.",
      ].join("\n");
      const reqPath = await writeRequestFile(tmpDir, content);
      // The fenced 依存: should be ignored; no citations → exit 0 (no --require-citation)
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

  // Multiple dependency IDs on one line — all should resolve
  it("multiple IDs on one dependency line all pass when resolved and not implemented", async () => {
    const designDir = await createDesignFixture();
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-req-tmp-"));
    try {
      const reqPath = await writeRequestFile(
        tmpDir,
        "依存: [[mod-cli]], [[mod-parse]]\n\nBody covers [[mod-parse]].\n"
      );
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
});

// ---------------------------------------------------------------------------
// T-06: R2 with effective state (hash drift)
// ---------------------------------------------------------------------------

/**
 * Create a design fixture with loop enabled and a single element that can be
 * in various states.  Returns designDir.
 */
async function createLoopDesignFixture(options: {
  elementBody: string;   // current body of mod-cli in the design file
  stateEntry?: Record<string, unknown>; // state.json entry for mod-cli
}): Promise<string> {
  const designDir = await mkdtemp(join(tmpdir(), "aozu-r2-test-"));
  await mkdir(join(designDir, "static"), { recursive: true });

  await writeFile(
    join(designDir, "manifest.md"),
    ["---", "format-version: 0", "enabled: static, loop", "---", "", "# manifest"].join("\n")
  );

  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール",
      "",
      "## CLI {#mod-cli}",
      options.elementBody,
    ].join("\n")
  );

  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  if (options.stateEntry) {
    await writeFile(
      join(designDir, "state.json"),
      JSON.stringify({ "mod-cli": options.stateEntry })
    );
  }

  return designDir;
}

describe("handleCheck --request — R2 with effective state (T-06)", () => {
  it("drifted implemented element passes R2 (exit 0)", async () => {
    // Compute the hash of the original body, then change the body to create drift
    const { buildGraph } = await import("../../graph/builder.ts");
    const { parseFiles } = await import("../../parse/parser.ts");
    const { computeElementHash } = await import("../../graph/body.ts");
    const { readMarkdownFiles } = await import("../../fs/reader.ts");

    // Step 1: create fixture with "original" body and record hash
    const designDir = await createLoopDesignFixture({ elementBody: "責務: CLI (original)" });
    const baseDir = designDir;
    try {
      // Compute hash from original content
      const files = await readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const graph = buildGraph(parsed, join(designDir, "manifest.md"));
      const recordedHash = computeElementHash("mod-cli", graph, files)!;

      // Step 2: write state.json with recorded hash
      await writeFile(
        join(designDir, "state.json"),
        JSON.stringify({ "mod-cli": { state: "implemented", request: "prev", hash: recordedHash } })
      );

      // Step 3: modify the body to create drift
      await writeFile(
        join(designDir, "static", "modules.md"),
        ["# モジュール", "", "## CLI {#mod-cli}", "責務: CLI (modified — drift)"].join("\n")
      );

      // Step 4: check --request should pass (drifted → effective state = designed)
      const tmpDir = await mkdtemp(join(tmpdir(), "aozu-r2-req-"));
      try {
        const reqPath = join(tmpDir, "req.md");
        await writeFile(reqPath, "This request concerns [[mod-cli]].");

        const exitCode = await handleCheck(["--request", reqPath, "--dir", designDir]);
        expect(exitCode).toBe(0); // R2 re-opened: drifted element is effectively designed
      } finally {
        await rm(tmpDir, { recursive: true });
      }
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("hash-less implemented element still blocks R2 (backward compat)", async () => {
    const designDir = await createLoopDesignFixture({
      elementBody: "責務: CLI",
      stateEntry: { state: "implemented", request: "prev" },  // no hash
    });
    const tmpDir = await mkdtemp(join(tmpdir(), "aozu-r2-nohash-"));
    try {
      const reqPath = join(tmpDir, "req.md");
      await writeFile(reqPath, "This request concerns [[mod-cli]].");

      const exitCode = await handleCheck(["--request", reqPath, "--dir", designDir]);
      expect(exitCode).toBe(1); // hash-less implemented = R2 error
    } finally {
      await rm(tmpDir, { recursive: true });
      await rm(designDir, { recursive: true });
    }
  });

  it("non-drifted implemented element (hash matches) still blocks R2", async () => {
    const { buildGraph } = await import("../../graph/builder.ts");
    const { parseFiles } = await import("../../parse/parser.ts");
    const { computeElementHash } = await import("../../graph/body.ts");
    const { readMarkdownFiles } = await import("../../fs/reader.ts");

    const designDir = await createLoopDesignFixture({ elementBody: "責務: CLI (stable)" });
    try {
      // Compute current hash (no drift)
      const files = await readMarkdownFiles(designDir);
      const parsed = parseFiles(files);
      const graph = buildGraph(parsed, join(designDir, "manifest.md"));
      const hash = computeElementHash("mod-cli", graph, files)!;

      await writeFile(
        join(designDir, "state.json"),
        JSON.stringify({ "mod-cli": { state: "implemented", request: "prev", hash } })
      );

      const tmpDir = await mkdtemp(join(tmpdir(), "aozu-r2-match-"));
      try {
        const reqPath = join(tmpDir, "req.md");
        await writeFile(reqPath, "This request concerns [[mod-cli]].");

        const exitCode = await handleCheck(["--request", reqPath, "--dir", designDir]);
        expect(exitCode).toBe(1); // matching hash = implemented → R2 error
      } finally {
        await rm(tmpDir, { recursive: true });
      }
    } finally {
      await rm(designDir, { recursive: true });
    }
  });
});
