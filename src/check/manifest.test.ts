import { describe, expect, it } from "bun:test";
import {
  parseManifest,
  getEnabledLayers,
  getEnabledPrefixes,
  isLayerEnabled,
  VIEW_TYPE_NAMES,
  LAYER_ENABLED_NAMES,
  LAYER_MAP,
} from "./manifest.ts";
import type { ParseResult } from "../parse/types.ts";
import type { Manifest } from "../graph/types.ts";

function makeFrontmatters(path: string, record: Record<string, string | string[]>): ParseResult["frontmatters"] {
  const m = new Map<string, Record<string, string | string[]>>();
  m.set(path, record);
  return m;
}

describe("parseManifest", () => {
  it("parses enabled: static, domain, dynamic", () => {
    const frontmatters = makeFrontmatters("design/manifest.md", {
      "format-version": "0",
      enabled: ["static", "domain", "dynamic"],
    });
    const manifest = parseManifest(frontmatters, "design/manifest.md");
    expect(manifest.enabled).toContain("static");
    expect(manifest.enabled).toContain("domain");
    expect(manifest.enabled).toContain("dynamic");
    expect(manifest.enabled).not.toContain("loop");
  });

  it("parses enabled: static only", () => {
    const frontmatters = makeFrontmatters("design/manifest.md", {
      "format-version": "0",
      enabled: ["static"],
    });
    const manifest = parseManifest(frontmatters, "design/manifest.md");
    expect(manifest.enabled).toEqual(["static"]);
  });

  it("returns empty enabled when manifest not found", () => {
    const manifest = parseManifest(new Map(), "design/manifest.md");
    expect(manifest.enabled).toEqual([]);
  });

  it("parses comma-separated string value for enabled", () => {
    const frontmatters = makeFrontmatters("design/manifest.md", {
      "format-version": "0",
      enabled: "static, domain",
    });
    const manifest = parseManifest(frontmatters, "design/manifest.md");
    expect(manifest.enabled).toContain("static");
    expect(manifest.enabled).toContain("domain");
  });

  it("recognizes view type names in enabled", () => {
    const frontmatters = makeFrontmatters("design/manifest.md", {
      enabled: ["static", "domain", "use-case"],
    });
    const manifest = parseManifest(frontmatters, "design/manifest.md");
    expect(manifest.enabled).toContain("use-case");
  });
});

describe("getEnabledLayers", () => {
  const manifest = (enabled: string[]): Manifest => ({ formatVersion: "0", enabled });

  it("returns static, domain, dynamic for enabled: static, domain, dynamic", () => {
    const layers = getEnabledLayers(manifest(["static", "domain", "dynamic"]));
    expect(layers.has("static")).toBe(true);
    expect(layers.has("domain")).toBe(true);
    expect(layers.has("dynamic")).toBe(true);
    expect(layers.has("loop")).toBe(false);
  });

  it("returns only static for enabled: static", () => {
    const layers = getEnabledLayers(manifest(["static"]));
    expect(layers.has("static")).toBe(true);
    expect(layers.has("domain")).toBe(false);
    expect(layers.has("dynamic")).toBe(false);
    expect(layers.has("loop")).toBe(false);
  });

  it("ignores view type names", () => {
    const layers = getEnabledLayers(manifest(["static", "use-case"]));
    expect(layers.has("static")).toBe(true);
    expect(layers.size).toBe(1);
  });
});

describe("getEnabledPrefixes", () => {
  const manifest = (enabled: string[]): Manifest => ({ formatVersion: "0", enabled });

  it("static → {mod, adr}", () => {
    const prefixes = getEnabledPrefixes(manifest(["static"]));
    expect(prefixes.has("mod")).toBe(true);
    expect(prefixes.has("adr")).toBe(true);
    expect(prefixes.has("term")).toBe(false);
    expect(prefixes.has("seq")).toBe(false);
  });

  it("domain → includes term, ent, inv", () => {
    const prefixes = getEnabledPrefixes(manifest(["static", "domain"]));
    expect(prefixes.has("term")).toBe(true);
    expect(prefixes.has("ent")).toBe(true);
    expect(prefixes.has("inv")).toBe(true);
  });

  it("TC-015: domain enabled → getEnabledPrefixes includes act", () => {
    const prefixes = getEnabledPrefixes(manifest(["static", "domain"]));
    expect(prefixes.has("act")).toBe(true);
  });

  it("TC-016: domain disabled → getEnabledPrefixes excludes act", () => {
    const prefixes = getEnabledPrefixes(manifest(["static"]));
    expect(prefixes.has("act")).toBe(false);
  });

  it("TC-031: dynamic → includes seq (static, domain, dynamic covers all layer prefixes)", () => {
    const prefixes = getEnabledPrefixes(manifest(["static", "domain", "dynamic"]));
    expect(prefixes.has("mod")).toBe(true);
    expect(prefixes.has("term")).toBe(true);
    expect(prefixes.has("ent")).toBe(true);
    expect(prefixes.has("inv")).toBe(true);
    expect(prefixes.has("seq")).toBe(true);
    expect(prefixes.has("adr")).toBe(true);
  });

  it("loop → includes top, plan, grp", () => {
    const prefixes = getEnabledPrefixes(manifest(["static", "loop"]));
    expect(prefixes.has("top")).toBe(true);
    expect(prefixes.has("plan")).toBe(true);
    expect(prefixes.has("grp")).toBe(true);
  });

  it("TC-032: view type prefixes are NOT included even if view name is in enabled", () => {
    const prefixes = getEnabledPrefixes(manifest(["static", "use-case"]));
    // uc is the view prefix for use-case — should NOT be included
    expect(prefixes.has("uc")).toBe(false);
  });

  it("adr is always included", () => {
    const prefixes = getEnabledPrefixes(manifest([]));
    expect(prefixes.has("adr")).toBe(true);
  });
});

describe("isLayerEnabled", () => {
  const manifest = (enabled: string[]): Manifest => ({ formatVersion: "0", enabled });

  it("returns true for enabled layer", () => {
    expect(isLayerEnabled("static", manifest(["static", "domain"]))).toBe(true);
    expect(isLayerEnabled("domain", manifest(["static", "domain"]))).toBe(true);
  });

  it("returns false for disabled layer", () => {
    expect(isLayerEnabled("dynamic", manifest(["static"]))).toBe(false);
    expect(isLayerEnabled("loop", manifest(["static"]))).toBe(false);
  });
});

describe("LAYER_MAP", () => {
  it("TC-003: LAYER_MAP[\"act\"] === \"domain\"", () => {
    expect(LAYER_MAP["act"]).toBe("domain");
  });
});

describe("VIEW_TYPE_NAMES and LAYER_ENABLED_NAMES", () => {
  it("VIEW_TYPE_NAMES contains use-case, screen, api etc.", () => {
    expect(VIEW_TYPE_NAMES.has("use-case")).toBe(true);
    expect(VIEW_TYPE_NAMES.has("screen")).toBe(true);
    expect(VIEW_TYPE_NAMES.has("api")).toBe(true);
    expect(VIEW_TYPE_NAMES.has("static")).toBe(false);
  });

  it("LAYER_ENABLED_NAMES contains static, domain, dynamic, loop", () => {
    expect(LAYER_ENABLED_NAMES.has("static")).toBe(true);
    expect(LAYER_ENABLED_NAMES.has("domain")).toBe(true);
    expect(LAYER_ENABLED_NAMES.has("dynamic")).toBe(true);
    expect(LAYER_ENABLED_NAMES.has("loop")).toBe(true);
    expect(LAYER_ENABLED_NAMES.has("use-case")).toBe(false);
  });
});
