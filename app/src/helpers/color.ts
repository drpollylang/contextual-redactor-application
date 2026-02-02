// import type { CommentedHighlight } from "../types";

// export function getHighlightColor(h: CommentedHighlight): string {
//   if (h.source === "ai") {
//     switch (h.metadata?.category) {
//       case "Person": return "rgba(255, 99, 71, 0.35)";
//       case "DateOfBirth": return "rgba(30, 144, 255, 0.35)";
//       case "Address": return "rgba(255, 165, 0, 0.35)";
//       case "School": return "rgba(60, 179, 113, 0.35)";
//       default: return "rgba(128, 0, 128, 0.35)";
//     }
//   }
//   return "rgba(255, 226, 143, 0.7)"; // manual
// }

// src/helpers/color.ts
import type { CommentedHighlight } from "../types";
import type { ViewportHighlight } from "../react-pdf-highlighter-extended";

/**
 * Accept either the stored (Scaled) highlight or the drawn (Viewport) highlight.
 * We only read `source` and `metadata?.category`, which exist in both.
 */
type AnyHighlight =
  | CommentedHighlight
  | ViewportHighlight<CommentedHighlight>;

export function getHighlightColor(h: AnyHighlight): string {
  // "ai" vs "manual" lives on the data object for both shapes
  const source = (h as any).source ?? "manual";
  const category = (h as any).metadata?.category;

  if (source === "ai") {
    switch (category) {
      case "Person":      return "rgba(255, 99, 71, 0.35)";   // Tomato
      case "DateOfBirth": return "rgba(30, 144, 255, 0.35)";  // DodgerBlue
      case "Address":     return "rgba(255, 165, 0, 0.35)";   // Orange
      case "School":      return "rgba(60, 179, 113, 0.35)";  // SeaGreen
      default:            return "rgba(128, 0, 128, 0.35)";   // Purple
    }
  }

  // Manual highlight default
  return "rgba(255, 226, 143, 0.7)";
}