import { describe, expect, it } from "bun:test";
import { checkC6 } from "./c06-view-links.ts";
import type { Manifest } from "../../graph/types.ts";

const manifest = (enabled: string[]): Manifest => ({ formatVersion: "0", enabled });

describe("checkC6: view type fail-closed", () => {
  it("no view types in enabled → no diagnostics", () => {
    expect(checkC6(manifest(["static", "domain", "dynamic"]))).toHaveLength(0);
  });

  it("'use-case' in enabled → C6 diagnostic", () => {
    const diags = checkC6(manifest(["static", "domain", "use-case"]));
    expect(diags).toHaveLength(1);
    expect(diags[0]!.code).toBe("C6");
    expect(diags[0]!.level).toBe("error");
    expect(diags[0]!.message).toContain("unsupported view type");
    expect(diags[0]!.message).toContain("use-case");
  });

  it("multiple view types → one C6 per view type", () => {
    const diags = checkC6(manifest(["static", "use-case", "screen"]));
    expect(diags).toHaveLength(2);
    const codes = diags.map((d) => d.code);
    expect(codes).toEqual(["C6", "C6"]);
    const messages = diags.map((d) => d.message);
    expect(messages.some((m) => m.includes("use-case"))).toBe(true);
    expect(messages.some((m) => m.includes("screen"))).toBe(true);
  });

  it("all supported view types trigger C6", () => {
    const viewTypes = ["use-case", "screen", "api", "data", "dataflow", "event", "external", "permission", "deployment"];
    for (const vt of viewTypes) {
      const diags = checkC6(manifest([vt]));
      expect(diags).toHaveLength(1);
      expect(diags[0]!.code).toBe("C6");
    }
  });

  it("empty enabled → no diagnostics", () => {
    expect(checkC6(manifest([]))).toHaveLength(0);
  });
});
