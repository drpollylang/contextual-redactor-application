
import React, { useState } from "react";
import { IconButton, Stack, IIconProps, IButtonStyles, TooltipHost } from "@fluentui/react";

import "./style/Toolbar.css";

interface ToolbarProps {
  setPdfScaleValue: (value: number) => void;
  toggleHighlightPen: () => void;
  // undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;      
  canRedo: boolean;
  // info button
  onShowInfo: () => void;
  // history timeline
  onToggleHistory: () => void;
}


const undoIcon: IIconProps = { iconName: "Undo" };
const redoIcon: IIconProps = { iconName: "Redo" };
const historyIcon: IIconProps = { iconName: "History" }; // alternative: "TimelineProgress"
const infoIcon: IIconProps = { iconName: "Info" };

// “dark toolbar glyph” styles (no white button background)
const iconBtnStyles: IButtonStyles = {
  root: {
    background: "transparent",
    color: "#cfd8e3",             // base icon/text on dark bg
    padding: 4,
    border: "none",
    minWidth: 28,
    height: 28,
  },
  rootHovered: {
    background: "rgba(255,255,255,0.08)", // subtle hover
    color: "#ffffff",
  },
  rootPressed: {
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
  },
  rootDisabled: {
    background: "transparent",
    color: "rgba(255,255,255,0.3)",       // disabled glyph
  },
  icon: {
    color: "inherit",
    fontSize: 16,                          // compact icon size to match previous
  },
  menuIcon: { color: "inherit" },
  flexContainer: { gap: 0 },
};


const Toolbar: React.FC<ToolbarProps> = 
({ setPdfScaleValue, toggleHighlightPen, undo, redo, canUndo, canRedo, onShowInfo, onToggleHistory }: ToolbarProps) => {
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

//   return (
//     <div
//       style={{
//         height: 41,
//         display: "flex",
//         alignItems: "center",
//         gap: 4,
//         padding: "0 8px",
//         borderBottom: "1px solid #eee",
//         background: "#fafafa",
//       }}
//     >

//     {/* <div className="Toolbar"> */}
//       <div className="ZoomControls">
//         <button title="Zoom in" onClick={zoomIn}>+</button>
//         <button title="Zoom out" onClick={zoomOut}>-</button>
//         {zoom ? `${(zoom * 100).toFixed(0)}%` : "Auto"}
//       </div>

//       <button
//         title="Toggle Redaction Tool"
//         className={`HighlightButton ${isHighlightPen ? "active" : ""}`}
//         onClick={() => {
//           toggleHighlightPen();
//           setIsHighlightPen(!isHighlightPen);
//         }}
//       >
//         Toggle Redactions
//       </button>

//       <Stack horizontal tokens={{ childrenGap: 4 }} verticalAlign="center">
//         <TooltipHost content="Undo (Ctrl+Z)">
//           <IconButton
//             iconProps={undoIcon}
//             ariaLabel="Undo"
//             onClick={undo}
//             disabled={!canUndo}
//           />
//         </TooltipHost>

//         <TooltipHost content="Redo (Ctrl+Shift+Z)">
//           <IconButton
//             iconProps={redoIcon}
//             ariaLabel="Redo"
//             onClick={redo}
//             disabled={!canRedo}
//           />
//         </TooltipHost>

//         <TooltipHost content="History timeline (Ctrl+Shift+H)">
//           <IconButton
//             iconProps={historyIcon}
//             ariaLabel="History"
//             onClick={onToggleHistory}
//           />
//         </TooltipHost>
//       </Stack>

//       <button
//         className="InfoButton"
//         title="Keyboard Shortcuts"
//         onClick={onShowInfo}
//       >
//         ⓘ
//       </button>
//     </div>

//       /* <div style={{ flexGrow: 1 }} />

//       <button
//         className="toolbar-undo-btn"
//         onClick={undo}
//         disabled={!canUndo}
//       >
//         Undo
//       </button>

//       <button
//         className="toolbar-redo-btn"
//         onClick={redo}
//         disabled={!canRedo}
//       >
//         Redo
//       </button>

//       <div style={{ flexGrow: 1 }} />

//       <button onClick={onToggleHistory} title="Open history timeline">
//         History
//       </button>

//       <div style={{ flexGrow: 1 }} />

//       <button
//         className="InfoButton"
//         title="Keyboard Shortcuts"
//         onClick={onShowInfo}
//       >
//         ⓘ
//       </button>
//     </div> 
//     */
//     // </div>
//   );
// };
    return (
    <div
      className="app-toolbar"
      style={{
        height: 41,
        display: "flex",
        alignItems: "center",
        gap: 12,                            // spacing like your first screenshot
        padding: "0 12px",
        borderBottom: "1px solid #2b2f36",
        background: "#2b2f36",              // dark surface
        color: "#e5e7eb",
      }}
    >
      {/* LEFT: your existing zoom/controls */}
      <div className="ZoomControls">
         <button title="Zoom in" onClick={zoomIn}>+</button>
         <button title="Zoom out" onClick={zoomOut}>-</button>
         {zoom ? `${(zoom * 100).toFixed(0)}%` : "Auto"}
       </div>
      {/* Example: + / - / Auto / Toggle Redactions (keep whatever you had) */}
      {/* <span style={{ fontWeight: 600, opacity: 0.85 }}>Auto</span> */}
      {/* <button
        onClick={toggleHighlightPen}
        style={{
          background: "transparent",
          color: "#c3b5fd",                // your purple text color
          border: "none",
          cursor: "pointer",
        }}
      >
        Toggle Redactions
      </button> */}
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
      {/* Spacer pushes icon strip to the right */}
      <div style={{ flex: 1 }} />

      {/* Right icon strip: Undo / Redo / History / Info */}
      <TooltipHost content="Undo (Ctrl+Z)">
        <IconButton
          styles={iconBtnStyles}
          iconProps={undoIcon}
          ariaLabel="Undo"
          onClick={undo}
          disabled={!canUndo}
        />
      </TooltipHost>

      <TooltipHost content="Redo (Ctrl+Shift+Z)">
        <IconButton
          styles={iconBtnStyles}
          iconProps={redoIcon}
          ariaLabel="Redo"
          onClick={redo}
          disabled={!canRedo}
        />
      </TooltipHost>

      <TooltipHost content="History timeline (Ctrl+Shift+H)">
        <IconButton
          styles={iconBtnStyles}
          iconProps={historyIcon}
          ariaLabel="History"
          onClick={onToggleHistory}
        />
      </TooltipHost>

      {/* Keep your info button on the far right */}
      <TooltipHost content="Info">
        <IconButton
          styles={iconBtnStyles}
          iconProps={infoIcon}
          ariaLabel="Info"
          onClick={onShowInfo}
        />
      </TooltipHost>
    </div>
  );
};


export default Toolbar;
