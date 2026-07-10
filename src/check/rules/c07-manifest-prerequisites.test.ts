import { describe, expect, it } from "bun:test";
import { checkC7 } from "./c07-manifest-prerequisites.ts";
import type { Manifest } from "../../graph/types.ts";

const manifest = (enabled: string[]): Manifest => ({ formatVersion: "0", enabled });

describe("checkC7: manifest prerequisites", () => {
  it("valid combination static, domain, dynamic → no diagnostics", () => {
    expect(checkC7(manifest(["static", "domain", "dynamic"]))).toHaveLength(0);
  });

  it("static only → no diagnostics", () => {
    expect(checkC7(manifest(["static"]))).toHaveLength(0);
  });

  it("TC-016: loop without static → C7 diagnostic", () => {
    const diags = checkC7(manifest(["loop"]));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.code === "C7")).toBe(true);
    expect(diags.some((d) => d.message.includes("static"))).toBe(true);
  });

  it("TC-041: dynamic without static → C7 diagnostic", () => {
    const diags = checkC7(manifest(["dynamic"]));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.code).toBe("C7");
    expect(diags[0]!.message).toContain("static");
  });

  it("domain without static → C7 diagnostic", () => {
    const diags = checkC7(manifest(["domain"]));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.code).toBe("C7");
    expect(diags[0]!.message).toContain("static");
  });

  it("static + domain + loop → no diagnostics (loop needs static only)", () => {
    expect(checkC7(manifest(["static", "domain", "loop"]))).toHaveLength(0);
  });

  it("empty enabled → no diagnostics", () => {
    expect(checkC7(manifest([]))).toHaveLength(0);
  });

  it("static + dynamic + loop → no diagnostics", () => {
    expect(checkC7(manifest(["static", "dynamic", "loop"]))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// T-12: permission prerequisites (T-01 change verification)
// ---------------------------------------------------------------------------

describe("checkC7: permission prerequisite is domain (T-01)", () => {
  it("permission enabled with domain → no C7 diagnostic", () => {
    expect(checkC7(manifest(["static", "domain", "permission"]))).toHaveLength(0);
  });

  it("permission enabled without domain (static only) → C7 diagnostic", () => {
    const diags = checkC7(manifest(["static", "permission"]));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.code === "C7")).toBe(true);
    expect(diags.some((d) => d.message.includes("domain"))).toBe(true);
  });

  it("permission enabled without any prerequisite → C7 diagnostic", () => {
    const diags = checkC7(manifest(["permission"]));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.code === "C7")).toBe(true);
  });
});
