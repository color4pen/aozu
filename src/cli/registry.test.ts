import { describe, it, expect } from "bun:test";
import { createRegistry, register, dispatch, helpText } from "./registry.ts";

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
