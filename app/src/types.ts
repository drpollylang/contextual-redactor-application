import { Highlight, Content, ScaledPosition } from "./react-pdf-highlighter-extended";

export interface CommentedHighlight extends Highlight {
  id: string;
  content: Content;
  comment?: string;
  position: ScaledPosition;
  metadata?: any;
  label: string;
  source: "manual" | "ai";
  category: string;
  confidence?: any
}
