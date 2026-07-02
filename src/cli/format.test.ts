import { describe, it, expect } from "bun:test";
import { formatDiagnostic } from "./format.ts";
import type { CheckDiagnostic } from "../check/types.ts";

describe("formatDiagnostic", () => {
  it("formats a diagnostic with all fields present", () => {
    const d: CheckDiagnostic = {
      level: "error",
      code: "C3",
      elementId: "mod-parse",
      message: "Reference to unknown element",
      file: "design/static/modules.md",
      line: 42,
    };
    const result = formatDiagnostic(d);
    expect(result).toBe("ERROR C3 mod-parse Reference to unknown element (design/static/modules.md:42)");
  });

  it("uses '-' when elementId is null", () => {
    const d: CheckDiagnostic = {
      level: "error",
      code: "C7",
      elementId: null,
      message: "Missing prerequisite layer",
      file: "design/manifest.md",
      line: 5,
    };
    const result = formatDiagnostic(d);
    expect(result).toContain(" - ");
    expect(result).toStartWith("ERROR C7 - ");
  });

  it("converts level to uppercase", () => {
    const d: CheckDiagnostic = {
      level: "warning",
      code: "C11",
      elementId: "mod-cli",
      message: "Layer direction violation",
      file: "design/static/dependencies.md",
      line: 10,
    };
    const result = formatDiagnostic(d);
    expect(result).toStartWith("WARNING ");
  });

  it("includes file and line in parentheses", () => {
    const d: CheckDiagnostic = {
      level: "error",
      code: "C1",
      elementId: "bad-id!",
      message: "Invalid ID",
      file: "design/static/modules.md",
      line: 7,
    };
    const result = formatDiagnostic(d);
    expect(result).toContain("(design/static/modules.md:7)");
  });
});
