import type { CommentedHighlight } from "../types";

export function getHighlightColor(h: CommentedHighlight): string {
  if (h.source === "ai") {
    switch (h.metadata?.category) {
      case "Person": return "rgba(255, 99, 71, 0.35)";
      case "DateOfBirth": return "rgba(30, 144, 255, 0.35)";
      case "Address": return "rgba(255, 165, 0, 0.35)";
      case "School": return "rgba(60, 179, 113, 0.35)";
      default: return "rgba(128, 0, 128, 0.35)";
    }
  }
  return "rgba(255, 226, 143, 0.7)"; // manual
}