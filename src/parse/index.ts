/**
 * Public API for the parse module.
 *
 * Re-exports all types and the main `parseFiles` function.
 */

export type {
  FileInput,
  Element,
  Reference,
  DependencyEdge,
  Diagnostic,
  ParseResult,
  ActorId,
  ElementItem,
} from "./types.ts";

export { parseFiles } from "./parser.ts";
export { validateId, extractPrefix, KNOWN_PREFIXES } from "./id.ts";
export { parseFrontmatter } from "./frontmatter.ts";
export { extractReferences, extractRefsFromLine, stripInlineCode } from "./references.ts";
export { extractRequestCitations } from "./request-citations.ts";
export type { RequestCitationResult } from "./request-citations.ts";
export { extractDeclarations } from "./declarations.ts";
export { extractStructuredLines } from "./structured-lines.ts";
