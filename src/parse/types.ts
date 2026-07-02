/** A file to be parsed: its path and raw content. */
export interface FileInput {
  path: string;
  content: string;
}

/**
 * A declared design element (identified by `{#id}` in a heading or `id:` in frontmatter).
 */
export interface Element {
  id: string;
  prefix: string;
  displayName: string;
  file: string;
  line: number;
}

/** An occurrence of `[[targetId]]` in non-code content. */
export interface Reference {
  targetId: string;
  file: string;
  line: number;
}

/** A permitted dependency edge `- [[from]] -> [[to]]`. */
export interface DependencyEdge {
  from: string;
  to: string;
  file: string;
  line: number;
}

/** A parse-time diagnostic (ID grammar violation, malformed frontmatter, etc.). */
export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  file: string;
  line: number;
}

/** Aggregated result of parsing one or more files. */
export interface ParseResult {
  elements: Element[];
  references: Reference[];
  dependencyEdges: DependencyEdge[];
  diagnostics: Diagnostic[];
  /** Frontmatter records keyed by file path. */
  frontmatters: Map<string, Record<string, string | string[]>>;
}
