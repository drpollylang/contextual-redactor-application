import { ViewportHighlight } from "../react-pdf-highlighter-extended";
import { CommentedHighlight } from "../types";

type AnyHighlight =
  | CommentedHighlight
  | ViewportHighlight<CommentedHighlight>;

// ---- utils

/** Many viewport highlight libs wrap your payload under `data` or `comment` etc.
 *  Adjust this accessor to your actual shape if needed.
 */
export function getData(h: AnyHighlight): CommentedHighlight {
  // If it already looks like your payload, return it
  if ((h as any).source && (h as any).id) return h as CommentedHighlight;
  // Common patterns:
  return ((h as any).data ??
          (h as any).payload ??
          (h as any).highlight ??
          (h as any)) as CommentedHighlight;
}

/** Resolve the "business" category once, using both fields. */
export function resolveCategory(h: AnyHighlight): string {
  const d = getData(h);
  return d.category ?? d.metadata?.category ?? "Uncategorized";
}

/** Resolve label for the checkbox row */
export function resolveLabel(h: AnyHighlight): string {
  const d = getData(h);
  return d.label || d.comment || "(Untitled)";
}

/** Resolve the id used for toggling/checking */
export function resolveId(h: AnyHighlight): string {
  const d = getData(h);
  return d.id;
}

export function buildPdfId(projectId: string, fileName: string) {
  return `${projectId}::${fileName}`;
}
