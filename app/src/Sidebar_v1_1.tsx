
import React from "react";
// import type { Highlight } from "./react-pdf-highlighter-extended";
import "./style/Sidebar.css";
import { CommentedHighlight } from "./types";

// Fluent UI v8
import { DefaultButton } from "@fluentui/react";

interface SidebarProps {
  // New props
  uploadedPdfs: Array<{ id: string; name: string; url: string }>;
  currentPdfId: string | null;
  setCurrentPdfId: (id: string) => void;
  allHighlights: Record<string, Array<CommentedHighlight>>;
  currentHighlights: Array<CommentedHighlight>;
  toggleHighlightCheckbox: (
    highlight: CommentedHighlight,
    checked: boolean
  ) => void;
  handlePdfUpload: (file: File) => void;

  // Legacy props (still supported)
  highlights: Array<CommentedHighlight>;
  resetHighlights: () => void;
  toggleDocument: () => void;
}

// const updateHash = (highlight: Highlight) => {
//   document.location.hash = `highlight-${highlight.id}`;
// };

declare const APP_VERSION: string;

const Sidebar = ({
  uploadedPdfs,
  currentPdfId,
  setCurrentPdfId,
  allHighlights,
  currentHighlights,
  toggleHighlightCheckbox,
  handlePdfUpload,
  highlights, // unused now except for legacy display if needed
  resetHighlights,
  toggleDocument,
}: SidebarProps) => {
  // Sidebar collapse state
  const [sections, setSections] = React.useState({
    documents: true,
    highlights: true,
  });

  const toggleSection = (key: keyof typeof sections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="sidebar" style={{ width: "25vw", maxWidth: "500px" }}>
      {/* ===== Header / Description ===== */}
      <div className="description" style={{ padding: "1rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>
          react-pdf-highlighter-extended {APP_VERSION}
        </h2>

        <p style={{ fontSize: "0.7rem" }}>
          <a href="https://github.com/DanielArnould/react-pdf-highlighter-extended">
            Open in GitHub
          </a>
        </p>

        <p>
          <small>
            To create an area highlight hold ⌥ Option key (Alt), then click and
            drag.
          </small>
        </p>
      </div>

      {/* ===== Upload Button ===== */}
      <div style={{ padding: "0.5rem", borderBottom: "1px solid #eee" }}>
        <DefaultButton
          text="Upload PDF"
          iconProps={{ iconName: "Upload" }}
          onClick={() => document.getElementById("pdf-upload-input")?.click()}
        />

        <input
          id="pdf-upload-input"
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handlePdfUpload(file);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {/* ===== DOCUMENTS SECTION ===== */}
      <div style={{ borderBottom: "1px solid #eee" }}>
        <div
          onClick={() => toggleSection("documents")}
          style={{
            padding: "10px 12px",
            cursor: "pointer",
            fontWeight: 600,
            background: "#fafafa",
            borderBottom: "1px solid #eee",
          }}
        >
          Documents {sections.documents ? "▾" : "▸"}
        </div>

        {sections.documents && (
          <div style={{ padding: 12, maxHeight: "25vh", overflowY: "auto" }}>
            {uploadedPdfs.length === 0 ? (
              <div style={{ opacity: 0.6 }}>No documents uploaded.</div>
            ) : (
              uploadedPdfs.map((pdf) => {
                const isActive = pdf.id === currentPdfId;
                return (
                  <div
                    key={pdf.id}
                    onClick={() => setCurrentPdfId(pdf.id)}
                    style={{
                      cursor: "pointer",
                      padding: "8px 10px",
                      marginBottom: 6,
                      borderRadius: 4,
                      background: isActive
                        ? "rgba(0, 120, 212, 0.15)"
                        : "transparent",
                      border: isActive
                        ? "1px solid #0078d4"
                        : "1px solid #eee",
                    }}
                  >
                    {pdf.name}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      ===== HIGHLIGHTS SECTION =====
      <div style={{ borderBottom: "1px solid #eee" }}>
        <div
          onClick={() => toggleSection("highlights")}
          style={{
            padding: "10px 12px",
            cursor: "pointer",
            fontWeight: 600,
            background: "#fafafa",
          }}
        >
          Highlights {sections.highlights ? "▾" : "▸"}
        </div>

        {sections.highlights && (
          <div style={{ padding: 12, maxHeight: "35vh", overflowY: "auto" }}>
            {!currentPdfId ? (
              <div style={{ opacity: 0.6 }}>Open a document to see highlights.</div>
            ) : (
              (allHighlights[currentPdfId] ?? []).map((highlight) => {
                const isChecked =
                  currentHighlights.some((h) => h.id === highlight.id);

                return (
                  <label
                    key={highlight.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "4px 0",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        toggleHighlightCheckbox(highlight, e.target.checked)
                      }
                    />

                    <span style={{ fontSize: 13, overflow: "hidden" }}>
                      {highlight.comment || "(No comment)"}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ===== Legacy Buttons (if still wanted) ===== */}
      {highlights && highlights.length > 0 && (
        <div style={{ padding: "0.5rem" }}>
          <button onClick={resetHighlights} className="sidebar__reset">
            Reset highlights
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
