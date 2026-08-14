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

/** An actor ID entry from a seq document's `## 登場要素` section. */
export interface ActorId {
  id: string;
  file: string;
  line: number;
}

/** An element ID entry from a plan document's `elements:` line. */
export interface ElementItem {
  id: string;
  file: string;
  line: number;
}

/** An implementation path entry from a `実装:` line. */
export interface ImplementationEntry {
  /** Comma-split paths from the `実装:` line. */
  paths: string[];
  /** File the `実装:` line was found in. */
  file: string;
  /** 1-based line number of the `実装:` line. */
  line: number;
}

/** An operation line in a perm element: `- [[op-id]]: [[act-id]](, [[act-id]])*` */
export interface PermOperation {
  operation: string;
  actorIds: string[];
  file: string;
  line: number;
}

/**
 * A `対象:` line carrying one or more `[[id]]` references.
 * Used for both perm (single-ref enforced by C6) and op (multiple refs allowed).
 */
export interface TargetLine {
  targetIds: string[];
  file: string;
  line: number;
}

/** A malformed perm operation line: `- <token>: [[...]]` where token is not `[[op-id]]`. */
export interface MalformedPermOperation {
  file: string;
  line: number;
  text: string;
}

/** Aggregated result of parsing one or more files. */
export interface ParseResult {
  elements: Element[];
  references: Reference[];
  dependencyEdges: DependencyEdge[];
  diagnostics: Diagnostic[];
  /** Frontmatter records keyed by file path. */
  frontmatters: Map<string, Record<string, string | string[]>>;
  /** Actor IDs from seq `## 登場要素` sections. */
  actorIds: ActorId[];
  /** Element IDs from plan `elements:` lines. */
  elementItems: ElementItem[];
  /** Implementation path entries from `実装:` lines. */
  implementations: ImplementationEntry[];
  /** Operation lines from perm elements. */
  permOperations: PermOperation[];
  /** `対象:` lines (perm single-ref enforced by C6; op multiple-refs allowed). */
  targetLines: TargetLine[];
  /** Malformed perm operation lines (token is not `[[op-id]]`). Diagnostics emitted by C6. */
  malformedPermOperations: MalformedPermOperation[];
}
