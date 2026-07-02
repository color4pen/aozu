/**
 * Manifest interpretation for the check module.
 *
 * Parses the `enabled` list from manifest frontmatter and provides
 * layer / prefix helpers for graceful degradation.
 */

import type { ParseResult } from "../graph/index.ts";
import type { Manifest } from "../graph/types.ts";

// ---------------------------------------------------------------------------
// Type tables (declarative constants — ADR-0002: types are tool knowledge)
// ---------------------------------------------------------------------------

/**
 * Maps element prefix to its layer.
 *
 * `always` = evaluated regardless of enabled layers (adr).
 * `views`  = unsupported view types (C6 fail-closed).
 */
export const LAYER_MAP: Record<string, string> = {
  mod: "static",
  term: "domain",
  ent: "domain",
  inv: "domain",
  seq: "dynamic",
  top: "loop",
  plan: "loop",
  grp: "loop",
  adr: "always",
  // view prefixes
  uc: "views",
  scr: "views",
  api: "views",
  dat: "views",
  flow: "views",
  evt: "views",
  ext: "views",
  perm: "views",
  dpl: "views",
};

/**
 * Layer prerequisite relationships.
 * A layer listed here requires all layers in its array to be enabled.
 */
export const LAYER_PREREQUISITES: Record<string, string[]> = {
  domain: ["static"],
  dynamic: ["static"],
  loop: ["static"],
  // View type prerequisites (from spec §4 type table)
  "use-case": ["dynamic"],
  screen: ["use-case"],
  api: ["static"],
  data: ["domain"],
  dataflow: ["dynamic"],
  event: ["dynamic"],
  external: ["static"],
  permission: ["static"],
  deployment: ["static"],
};

/**
 * Maps view type `enabled` names to their element prefixes.
 * These names appear in the manifest's `enabled` list.
 */
export const VIEW_ENABLED_NAME_TO_PREFIX: Record<string, string> = {
  "use-case": "uc",
  screen: "scr",
  api: "api",
  data: "dat",
  dataflow: "flow",
  event: "evt",
  external: "ext",
  permission: "perm",
  deployment: "dpl",
};

/** Set of view type names that can appear in the `enabled` list. */
export const VIEW_TYPE_NAMES: Set<string> = new Set(
  Object.keys(VIEW_ENABLED_NAME_TO_PREFIX)
);

/** Set of layer names (non-view, non-always). */
export const LAYER_ENABLED_NAMES: Set<string> = new Set([
  "static",
  "domain",
  "dynamic",
  "loop",
]);

// ---------------------------------------------------------------------------
// Prefix → layer mapping for enabled prefix calculation
// ---------------------------------------------------------------------------

/**
 * Maps layer name to the set of prefixes that belong to it.
 * Used by getEnabledPrefixes.
 */
const LAYER_TO_PREFIXES: Record<string, string[]> = {
  static: ["mod"],
  domain: ["term", "ent", "inv"],
  dynamic: ["seq"],
  loop: ["top", "plan", "grp"],
  always: ["adr"],
};

// ---------------------------------------------------------------------------
// Manifest parsing
// ---------------------------------------------------------------------------

/**
 * Parse the manifest from ParseResult frontmatters.
 *
 * Identifies the manifest file by its path ending in `manifest.md`.
 * Returns a Manifest with formatVersion and enabled list.
 * If the manifest is not found, returns a Manifest with empty enabled list.
 */
export function parseManifest(
  frontmatters: ParseResult["frontmatters"],
  manifestPath: string
): Manifest {
  // Find frontmatter for the manifest file
  const fm = frontmatters.get(manifestPath);
  if (!fm) {
    return { formatVersion: "0", enabled: [] };
  }

  const formatVersion = typeof fm["format-version"] === "string"
    ? fm["format-version"]
    : "0";

  const enabledRaw = fm["enabled"];
  let enabled: string[] = [];
  if (Array.isArray(enabledRaw)) {
    enabled = enabledRaw.map((s) => s.trim()).filter((s) => s !== "");
  } else if (typeof enabledRaw === "string") {
    enabled = enabledRaw.split(",").map((s) => s.trim()).filter((s) => s !== "");
  }

  return { formatVersion, enabled };
}

// ---------------------------------------------------------------------------
// Layer / prefix helpers
// ---------------------------------------------------------------------------

/**
 * Returns the set of enabled layer names from the manifest.
 * Only layer names (static/domain/dynamic/loop) are included — not view types.
 */
export function getEnabledLayers(manifest: Manifest): Set<string> {
  const layers = new Set<string>();
  for (const name of manifest.enabled) {
    if (LAYER_ENABLED_NAMES.has(name)) {
      layers.add(name);
    }
  }
  return layers;
}

/**
 * Returns the set of element prefixes that are enabled.
 *
 * View type prefixes are NOT included — view types are unsupported (C6 fail-closed).
 * `adr` prefix is always included.
 */
export function getEnabledPrefixes(manifest: Manifest): Set<string> {
  const prefixes = new Set<string>();
  // Always include adr
  prefixes.add("adr");

  const layers = getEnabledLayers(manifest);
  for (const layer of layers) {
    const layerPrefixes = LAYER_TO_PREFIXES[layer] ?? [];
    for (const p of layerPrefixes) {
      prefixes.add(p);
    }
  }
  return prefixes;
}

/**
 * Returns true if the given layer is enabled in the manifest.
 */
export function isLayerEnabled(layer: string, manifest: Manifest): boolean {
  return getEnabledLayers(manifest).has(layer);
}
