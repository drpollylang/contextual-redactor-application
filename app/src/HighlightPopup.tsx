import React from "react";
import type { ViewportHighlight } from "./react-pdf-highlighter-extended";

import "./style/HighlightPopup.css";
import { CommentedHighlight } from "./types";

interface HighlightPopupProps {
  highlight: ViewportHighlight<CommentedHighlight>;
}

const HighlightPopup = ({ highlight }: HighlightPopupProps) => {
  return highlight.comment ? (
    <div className="Highlight__popup">{highlight.label + "\nComment: " + highlight.comment}</div>
  ) : (
    <div className="Highlight__popup">{highlight.label}</div>
  );
};

export default HighlightPopup;
