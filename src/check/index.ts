/**
 * Public API for the check module.
 */

export type { CheckDiagnostic } from "./types.ts";
export { runCheck } from "./checker.ts";
export {
  parseManifest,
  getEnabledLayers,
  getEnabledPrefixes,
  isLayerEnabled,
  LAYER_MAP,
  LAYER_PREREQUISITES,
  LAYER_ENABLED_NAMES,
  VIEW_TYPE_NAMES,
  VIEW_ENABLED_NAME_TO_PREFIX,
} from "./manifest.ts";
