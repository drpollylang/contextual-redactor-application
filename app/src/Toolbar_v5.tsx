
import React, { useState } from "react";

import "./style/Toolbar.css";

interface ToolbarProps {
  setPdfScaleValue: (value: number) => void;
  toggleHighlightPen: () => void;
  onShowInfo: () => void;
}

const Toolbar = ({ setPdfScaleValue, toggleHighlightPen, onShowInfo }: ToolbarProps) => {
  const [zoom, setZoom] = useState<number | null>(null);
  const [isHighlightPen, setIsHighlightPen] = useState<boolean>(false);

  const zoomIn = () => {
    if (zoom) {
      if (zoom < 4) {
        setPdfScaleValue(zoom + 0.1);
        setZoom(zoom + 0.1);
      }
    } else {
      setPdfScaleValue(1);
      setZoom(1);
    }
  };

  const zoomOut = () => {
    if (zoom) {
      if (zoom > 0.2) {
        setPdfScaleValue(zoom - 0.1);
        setZoom(zoom - 0.1);
      }
    } else {
      setPdfScaleValue(1);
      setZoom(1);
    }
  };

  return (
    <div className="Toolbar">
      <div className="ZoomControls">
        <button title="Zoom in" onClick={zoomIn}>+</button>
        <button title="Zoom out" onClick={zoomOut}>-</button>
        {zoom ? `${(zoom * 100).toFixed(0)}%` : "Auto"}
      </div>

      <button
        title="Toggle Redaction Tool"
        className={`HighlightButton ${isHighlightPen ? "active" : ""}`}
        onClick={() => {
          toggleHighlightPen();
          setIsHighlightPen(!isHighlightPen);
        }}
      >
        Toggle Redactions
      </button>

      {/* Spacer pushes info button to the right */}
      <div style={{ flexGrow: 1 }} />

      {/* Info button (ⓘ) */}
      <button
        className="InfoButton"
        title="Keyboard Shortcuts"
        onClick={onShowInfo}
      >
        ⓘ
      </button>
    </div>
  );
};

export default Toolbar;
