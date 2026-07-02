import { describe, expect, it } from "bun:test";
import { validateId, extractPrefix, KNOWN_PREFIXES } from "./id.ts";

describe("validateId", () => {
  it("accepts a simple valid ID", () => {
    expect(validateId("mod-parse").valid).toBe(true);
  });

  it("accepts a valid ID with multi-segment slug", () => {
    expect(validateId("seq-closure-check").valid).toBe(true);
  });

  it("accepts ent-order", () => {
    expect(validateId("ent-order").valid).toBe(true);
  });

  it("accepts all known prefixes with a simple slug", () => {
    for (const prefix of KNOWN_PREFIXES) {
      const result = validateId(`${prefix}-foo`);
      expect(result.valid, `prefix "${prefix}" should be valid`).toBe(true);
    }
  });

  it("rejects ID with uppercase letters", () => {
    const result = validateId("Mod-Parse");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects ID with underscore", () => {
    const result = validateId("mod_parse");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects ID with dot", () => {
    const result = validateId("mod.parse");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects ID with no prefix (no dash)", () => {
    const result = validateId("parse");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects ID with unknown prefix", () => {
    const result = validateId("xxx-foo");
    expect(result.valid).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it("rejects ID starting with dash", () => {
    const result = validateId("-foo");
    expect(result.valid).toBe(false);
  });

  it("rejects empty string", () => {
    const result = validateId("");
    expect(result.valid).toBe(false);
  });
});

describe("extractPrefix", () => {
  it("extracts prefix from valid ID", () => {
    expect(extractPrefix("mod-parse")).toBe("mod");
  });

  it("extracts prefix from multi-segment ID", () => {
    expect(extractPrefix("seq-closure-check")).toBe("seq");
  });

  it("returns whole string when no dash", () => {
    expect(extractPrefix("parse")).toBe("parse");
  });
});
