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
  const category = (h as any).category;

  if (source === "ai") {
    switch (category) {
      case "PII (Person)":      return "rgba(255, 99, 71, 0.35)";   // Tomato
      case "PII (DateOfBirth)": return "rgba(30, 144, 255, 0.35)";  // DodgerBlue
      case "PII (Address)":     return "rgba(255, 165, 0, 0.35)";   // Orange
      case "PII (School)":      return "rgba(60, 179, 113, 0.35)";  // SeaGreen
      case "Sensitive Information (Health)":      return "rgba(26, 158, 241, 1)";  // Yellow
      case "Sensitive Information (Crime and Policing)":      return "rgba(242, 120, 234, 1)";  // Yellow
      case "Sensitive Information (Financial and Taxation)":      return "rgba(118, 248, 71, 1)";  // Yellow
      case "Sensitive Information (Abuse)":      return "rgba(248, 29, 29, 1)";  // Yellow
      case "Sensitive Information (Personal Info)":      return "rgba(183, 72, 248, 1)";  // Yellow
      case "Sensitive Information (Misc)":      return "rgba(242, 213, 120, 1)";  // Yellow
      case "Statements From Third Parties":      return "rgba(242, 213, 120, 1)";  // Yellow
      default:            return "rgba(128, 0, 128, 0.35)";   // Purple
    }
  }

  // Manual highlight default
  return "rgba(255, 226, 143, 0.7)";
}