import { describe, it, expect } from "bun:test";
import { createRegistry, register, dispatch, helpText } from "./registry.ts";
import { resolve } from "path";

/** Absolute path to CLI entry point for subprocess tests. */
const MAIN_TS = resolve(import.meta.dir, "main.ts");

describe("createRegistry", () => {
  it("returns an empty registry", () => {
    const r = createRegistry();
    expect(r.size).toBe(0);
  });
});

describe("register + dispatch", () => {
  it("dispatches to a registered handler and returns its exit code", async () => {
    const r = createRegistry();
    let called = false;
    let receivedArgs: string[] = [];
    register(r, "test", async (args) => {
      called = true;
      receivedArgs = args;
      return 0;
    }, "test command");
    const code = await dispatch(r, "test", ["--flag"]);
    expect(called).toBe(true);
    expect(receivedArgs).toEqual(["--flag"]);
    expect(code).toBe(0);
  });

  it("returns 2 for unknown commands", async () => {
    const r = createRegistry();
    const code = await dispatch(r, "nonexistent", []);
    expect(code).toBe(2);
  });
});

describe("helpText", () => {
  it("includes registered command names", () => {
    const r = createRegistry();
    register(r, "check", async () => 0, "run closure checks");
    register(r, "status", async () => 0, "show status");
    const text = helpText(r);
    expect(text).toContain("check");
    expect(text).toContain("status");
  });

  it("includes usage hint", () => {
    const r = createRegistry();
    register(r, "check", async () => 0, "run closure checks");
    const text = helpText(r);
    expect(text).toContain("aozu");
    expect(text).toContain("command");
  });
});

// ---------------------------------------------------------------------------
// TC-043: aozu --help lists plan and prompt (subprocess)
// ---------------------------------------------------------------------------

describe("aozu --help (TC-043)", () => {
  it("lists 'plan' and 'prompt' commands in --help output", async () => {
    const proc = Bun.spawn(["bun", MAIN_TS, "--help"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    // main.ts writes help to stderr and exits 0
    const stderr = await new Response(proc.stderr).text();
    expect(exitCode).toBe(0);
    expect(stderr).toContain("plan");
    expect(stderr).toContain("prompt");
  });
});
