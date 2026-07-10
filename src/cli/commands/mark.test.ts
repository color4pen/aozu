/**
 * Integration tests for the `mark implemented` command handler (T-06).
 *
 * Verifies spec/integration.md §2 contract:
 *   - Normal transition
 *   - --pr field recording
 *   - Idempotent re-run (all already implemented → no-op, exit 0)
 *   - Unknown slug → exit 1
 *   - Mixed state (requested + implemented) → requested only transitions
 *   - Loop disabled → exit 1
 *   - Input errors → exit 2
 */

import { describe, it, expect } from "bun:test";
import { handleMark, handleMarkImplemented } from "./mark.ts";
import { join } from "path";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { tmpdir } from "os";
import { resolve } from "path";

/** Absolute path to the CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "../main.ts");

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal loop-enabled design directory with a pre-populated state.json.
 */
async function createFixture(options: {
  stateJson: Record<string, unknown>;
  loopEnabled?: boolean; // default: true
}): Promise<string> {
  const baseDir = await mkdtemp(join(tmpdir(), "aozu-mark-test-"));
  const designDir = join(baseDir, "design");

  await mkdir(join(designDir, "static"), { recursive: true });

  const loopEnabled = options.loopEnabled ?? true;
  const enabledLayers = loopEnabled ? "static, loop" : "static";

  await writeFile(
    join(designDir, "manifest.md"),
    [
      "---",
      "format-version: 0",
      `enabled: ${enabledLayers}`,
      "---",
      "",
      "# manifest",
    ].join("\n")
  );

  await writeFile(
    join(designDir, "static", "modules.md"),
    [
      "# モジュール",
      "",
      "## Alpha {#mod-alpha}",
      "責務: alpha",
      "実装: src/alpha/",
      "",
      "## Beta {#mod-beta}",
      "責務: beta",
      "実装: src/beta/",
    ].join("\n")
  );

  await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");

  await writeFile(
    join(designDir, "state.json"),
    JSON.stringify(options.stateJson, null, 2)
  );

  return designDir;
}

// ---------------------------------------------------------------------------
// T-06a: Normal transition
// ---------------------------------------------------------------------------

describe("mark implemented — normal transition", () => {
  it("transitions requested elements to implemented and exits 0", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "my-req" },
        "mod-beta": { state: "requested", request: "my-req" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "my-req",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      expect(state["mod-alpha"].state).toBe("implemented");
      expect(state["mod-beta"].state).toBe("implemented");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("records --pr number in state.json when provided", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "pr-req" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "pr-req",
        "--pr", "42",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      // Use toMatchObject to allow for the hash field added by the designed-reversion feature
      expect(state["mod-alpha"]).toMatchObject({
        state: "implemented",
        request: "pr-req",
        pr: 42,
      });
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("preserves existing elements not belonging to the request", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "my-req" },
        "mod-beta": { state: "implemented", request: "other-req", pr: 1 },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      await handleMarkImplemented([
        "--request", "my-req",
        "--dir", designDir,
      ]);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      // mod-beta should be unchanged
      expect(state["mod-beta"]).toEqual({ state: "implemented", request: "other-req", pr: 1 });
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-06b: Idempotent re-run
// ---------------------------------------------------------------------------

describe("mark implemented — idempotent re-run", () => {
  it("exits 0 when all matching elements are already implemented (no-op)", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "implemented", request: "done-req", pr: 10 },
        "mod-beta": { state: "implemented", request: "done-req", pr: 10 },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "done-req",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      // state.json should be unchanged
      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      expect(state["mod-alpha"].pr).toBe(10);
      expect(state["mod-beta"].pr).toBe(10);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-06c: Unknown slug → exit 1
// ---------------------------------------------------------------------------

describe("mark implemented — unknown slug", () => {
  it("exits 1 when no elements have the given request slug", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "other-slug" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "nonexistent-slug",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(1);

      // state.json must be unchanged
      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      expect(state["mod-alpha"].state).toBe("requested");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("exits 1 when state.json is empty", async () => {
    const designDir = await createFixture({ stateJson: {} });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "any-slug",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(1);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-06d: Mixed state — requested and implemented with same slug
// ---------------------------------------------------------------------------

describe("mark implemented — mixed state (requested + implemented)", () => {
  it("transitions only requested elements; implemented elements are unchanged", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "implemented", request: "my-req", pr: 5 },
        "mod-beta": { state: "requested", request: "my-req" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "my-req",
        "--dir", designDir,
      ]);

      // slug has matches → exit 0 (mod-beta transitions)
      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      // mod-alpha should be unchanged (already implemented)
      expect(state["mod-alpha"]).toEqual({ state: "implemented", request: "my-req", pr: 5 });
      // mod-beta should be transitioned
      expect(state["mod-beta"].state).toBe("implemented");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-06e: loop disabled → exit 1
// ---------------------------------------------------------------------------

describe("mark implemented — loop disabled", () => {
  it("exits 1 when loop is not enabled in manifest", async () => {
    const designDir = await createFixture({
      stateJson: { "mod-alpha": { state: "requested", request: "my-req" } },
      loopEnabled: false,
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "my-req",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(1);

      // state.json must be unchanged
      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      expect(state["mod-alpha"].state).toBe("requested");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-06f: Input errors → exit 2
// ---------------------------------------------------------------------------

describe("mark implemented — input errors", () => {
  it("exits 2 when --request argument is missing", async () => {
    const exitCode = await handleMarkImplemented(["--dir", "./design"]);
    expect(exitCode).toBe(2);
  });

  it("exits 2 when design directory does not exist", async () => {
    const exitCode = await handleMarkImplemented([
      "--request", "my-req",
      "--dir", "/nonexistent/design",
    ]);
    expect(exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// T-06g: handleMark subcommand dispatch
// ---------------------------------------------------------------------------

describe("handleMark — subcommand dispatch", () => {
  it("exits 2 when subcommand is missing", async () => {
    const exitCode = await handleMark([]);
    expect(exitCode).toBe(2);
  });

  it("exits 2 when subcommand is unknown", async () => {
    const exitCode = await handleMark(["unknown-subcmd"]);
    expect(exitCode).toBe(2);
  });

  it("returns 0 for --help", async () => {
    const exitCode = await handleMark(["--help"]);
    expect(exitCode).toBe(0);
  });

  it("dispatches to handleMarkImplemented for 'implemented' subcommand", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "dispatch-test" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      // handleMark with 'implemented' subcommand should work end-to-end
      const exitCode = await handleMark([
        "implemented",
        "--request", "dispatch-test",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      expect(state["mod-alpha"].state).toBe("implemented");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-06h: stdout is always empty
// ---------------------------------------------------------------------------

describe("mark implemented — stdout is empty", () => {
  it("produces no stdout output on success", async () => {
    const designDir = await createFixture({
      stateJson: { "mod-alpha": { state: "requested", request: "stdout-test" } },
    });
    const baseDir = join(designDir, "..");
    try {
      const proc = Bun.spawn(
        ["bun", MAIN_TS, "mark", "implemented",
          "--request", "stdout-test",
          "--dir", designDir],
        { stdout: "pipe", stderr: "pipe" }
      );
      const [stdout, , exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-01: format-version fence — mark implemented command
// ---------------------------------------------------------------------------

describe("mark implemented — format-version fence (C12)", () => {
  it("returns non-0 for unknown format-version in manifest", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "aozu-mark-fv-test-"));
    const designDir = join(baseDir, "design");

    await mkdir(join(designDir, "static"), { recursive: true });

    await writeFile(
      join(designDir, "manifest.md"),
      ["---", "format-version: 99", "enabled: static, loop", "---", "", "# manifest"].join("\n")
    );
    await writeFile(
      join(designDir, "static", "modules.md"),
      ["# Modules", "", "## App {#mod-app}", "責務: app.", "実装: src/"].join("\n")
    );
    await writeFile(join(designDir, "static", "dependencies.md"), "# 許可依存\n");
    await writeFile(
      join(designDir, "state.json"),
      JSON.stringify({ "mod-app": { state: "requested", request: "some-req" } }, null, 2)
    );

    try {
      const exitCode = await handleMarkImplemented(["--request", "some-req", "--dir", designDir]);
      expect(exitCode).not.toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-05: mark implemented — positional slug
// ---------------------------------------------------------------------------

describe("mark implemented — positional slug", () => {
  it("positional slug works as an alternative to --request", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "positional-req" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "positional-req",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      expect(state["mod-alpha"].state).toBe("implemented");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("positional slug and --request same value: works normally", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "same-slug" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "same-slug",
        "--request", "same-slug",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("positional slug and --request conflicting values: exit 2", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "req-a" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "req-a",
        "--request", "req-b",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(2);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("--request form still works (unchanged from before)", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "request-form-test" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "request-form-test",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      expect(state["mod-alpha"].state).toBe("implemented");
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});

// ---------------------------------------------------------------------------
// T-04: hash recording tests
// ---------------------------------------------------------------------------

describe("mark implemented — hash recording (T-04)", () => {
  it("records a 64-char hex hash in state.json after transition", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "hash-test" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "hash-test",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      const entry = state["mod-alpha"];
      expect(entry.state).toBe("implemented");
      expect(typeof entry.hash).toBe("string");
      expect(entry.hash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("field order is state, request, pr, hash", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "requested", request: "field-order-test" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      await handleMarkImplemented([
        "--request", "field-order-test",
        "--pr", "7",
        "--dir", designDir,
      ]);

      const content = await readFile(join(designDir, "state.json"), "utf-8");
      const line = content.split("\n").find(l => l.includes('"mod-alpha"'))!;
      const match = /^\s+"mod-alpha": (\{.+\})/.exec(line);
      expect(match).not.toBeNull();

      const parsed = JSON.parse(match![1]!);
      const keys = Object.keys(parsed);
      // hash comes after pr
      expect(keys.indexOf("state")).toBeLessThan(keys.indexOf("pr"));
      expect(keys.indexOf("pr")).toBeLessThan(keys.indexOf("hash"));
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("element not in graph (ID only in state.json) has no hash, transition continues", async () => {
    // ghost-elem exists in state.json but not in any design file
    const designDir = await createFixture({
      stateJson: {
        "ghost-elem": { state: "requested", request: "ghost-req" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const exitCode = await handleMarkImplemented([
        "--request", "ghost-req",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      const state = JSON.parse(await readFile(join(designDir, "state.json"), "utf-8"));
      const entry = state["ghost-elem"];
      expect(entry.state).toBe("implemented");
      // No hash because the element is not in the graph
      expect(entry.hash).toBeUndefined();
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });

  it("idempotent no-op does not change state.json (byte-identical)", async () => {
    const designDir = await createFixture({
      stateJson: {
        "mod-alpha": { state: "implemented", request: "noop-test", pr: 3, hash: "a".repeat(64) },
        "mod-beta": { state: "implemented", request: "noop-test" },
      },
    });
    const baseDir = join(designDir, "..");
    try {
      const before = await readFile(join(designDir, "state.json"), "utf-8");

      const exitCode = await handleMarkImplemented([
        "--request", "noop-test",
        "--dir", designDir,
      ]);

      expect(exitCode).toBe(0);

      const after = await readFile(join(designDir, "state.json"), "utf-8");
      expect(after).toBe(before); // byte-identical
    } finally {
      await rm(baseDir, { recursive: true });
    }
  });
});
