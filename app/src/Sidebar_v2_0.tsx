
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

  // Legacy props (kept for compatibility)
  highlights: Array<CommentedHighlight>;
  resetHighlights: () => void;
  toggleDocument: () => void;
}

// const updateHash = (highlight: Highlight) => {
//   document.location.hash = `highlight-${highlight.id}`;
// };

declare const APP_VERSION: string;

/* -------------------------------
   GroupedHighlights (inline)
---------------------------------*/

type GroupedHighlightsProps = {
  all: Array<CommentedHighlight>;
  active: Array<CommentedHighlight>;
  onToggle: (highlight: CommentedHighlight, checked: boolean) => void;
};

const normalizeText = (s: string | undefined | null) =>
  (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const getDisplayLabel = (h: CommentedHighlight) => {
  const text = h.content?.text?.trim();
  if (text && text.length > 0) return text;
  const page = h.position?.boundingRect?.pageNumber;
  return `(No text)${page ? ` — Page ${page}` : ""}`;
};

/**
 * Renders grouped highlights by their highlighted text (normalized).
 * Checkbox states:
 *  - checked       => all items in the group are active
 *  - indeterminate => some items in the group are active
 *  - unchecked     => none are active
 *
 * Uses a callback ref for indeterminate (no Hooks inside loops).
 */
const GroupedHighlights: React.FC<GroupedHighlightsProps> = ({
  all,
  active,
  onToggle,
}) => {
  // Group by normalized highlighted text (or sentinel for empty)
  const groups = React.useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; items: Array<CommentedHighlight> }
    >();

    for (const h of all) {
      const rawText = h.content?.text ?? "";
      const key = normalizeText(rawText) || `__no_text__`;
      const label = getDisplayLabel(h);

      const existing = map.get(key);
      if (existing) {
        existing.items.push(h);
      } else {
        map.set(key, { key, label, items: [h] });
      }
    }

    return Array.from(map.values());
  }, [all]);

  const activeSet = React.useMemo(() => new Set(active.map((h) => h.id)), [active]);

  if (groups.length === 0) {
    return <div style={{ opacity: 0.6 }}>No highlights yet.</div>;
  }

  return (
    <div>
      {groups.map((group) => {
        const total = group.items.length;
        const activeCount = group.items.reduce(
          (acc, h) => acc + (activeSet.has(h.id) ? 1 : 0),
          0
        );

        const isChecked = total > 0 && activeCount === total;
        const isIndeterminate = activeCount > 0 && activeCount < total;

        // Callback ref for indeterminate visual state
        const setCheckboxRef = (el: HTMLInputElement | null) => {
          if (el) {
            el.indeterminate = isIndeterminate;
          }
        };

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const checked = e.target.checked;
          // Bulk toggle: apply state to all items in the group
          for (const item of group.items) {
            onToggle(item, checked);
          }
        };

        return (
          <label
            key={group.key}
            className="sidebar-highlight-item"
            title={group.label}
          >
            <input
              ref={setCheckboxRef}
              type="checkbox"
              checked={isChecked}
              onChange={handleChange}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="sidebar-highlight-text">{group.label}</span>
              {total > 1 && (
                <span style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.2 }}>
                  ×{total}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
};

/* -------------------------------
            Sidebar
---------------------------------*/

const Sidebar: React.FC<SidebarProps> = ({
  uploadedPdfs,
  currentPdfId,
  setCurrentPdfId,
  allHighlights,
  currentHighlights,
  toggleHighlightCheckbox,
  handlePdfUpload,
  highlights, // legacy (currently unused except for reset button enable)
  resetHighlights,
  toggleDocument, // legacy (not used anymore)
}) => {
  // Collapsible sections
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
          <a href="https://github.com/drpollylang/contextual-redactor-application" target="_blank" rel="noreferrer">
            Click Here for Tutorial
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
            // allow re-upload of same file
            e.currentTarget.value = "";
          }}
        />
      </div>

      {/* ===== DOCUMENTS SECTION ===== */}
      <div style={{ borderBottom: "1px solid #eee" }}>
        <div
          onClick={() => toggleSection("documents")}
          className="sidebar-section-header"
        >
          Documents {sections.documents ? "▾" : "▸"}
        </div>

        {sections.documents && (
          <div className="sidebar-section-content" style={{ maxHeight: "25vh" }}>
            {uploadedPdfs.length === 0 ? (
              <div style={{ opacity: 0.6 }}>No documents uploaded.</div>
            ) : (
              uploadedPdfs.map((pdf) => {
                const isActive = pdf.id === currentPdfId;
                return (
                  <div
                    key={pdf.id}
                    onClick={() => setCurrentPdfId(pdf.id)}
                    className={`sidebar-document${isActive ? " active" : ""}`}
                    title={pdf.name}
                  >
                    {pdf.name}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ===== HIGHLIGHTS SECTION ===== */}
      <div style={{ borderBottom: "1px solid #eee" }}>
        <div
          onClick={() => toggleSection("highlights")}
          className="sidebar-section-header"
        >
          Highlights {sections.highlights ? "▾" : "▸"}
        </div>

        {sections.highlights && (
          <div className="sidebar-section-content" style={{ maxHeight: "35vh" }}>
            {!currentPdfId ? (
              <div style={{ opacity: 0.6 }}>Open a document to see highlights.</div>
            ) : (
              <GroupedHighlights
                all={allHighlights[currentPdfId] ?? []}
                active={currentHighlights}
                onToggle={(hl, checked) => toggleHighlightCheckbox(hl, checked)}
              />
            )}
          </div>
        )}
      </div>

      {/* ===== Legacy reset button (optional) ===== */}
      {currentHighlights && currentHighlights.length > 0 && (
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
