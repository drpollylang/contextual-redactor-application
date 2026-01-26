
import React, { useEffect, useState, useCallback } from "react";
import "./style/Sidebar.css";
import { Dialog, DialogType, DialogFooter, PrimaryButton, DefaultButton } from "@fluentui/react";
import { DeleteRegular } from "@fluentui/react-icons";
import { CommentedHighlight } from "./types";

/* =========================
   Props
========================= */

interface SidebarProps {
  uploadedPdfs: Array<{ id: string; name: string; url: string }>;
  currentPdfId: string | null;
  setCurrentPdfId: (id: string) => void;

  allHighlights: Record<string, Array<CommentedHighlight>>;
  currentHighlights: Array<CommentedHighlight>;
  toggleHighlightCheckbox: (highlight: CommentedHighlight, checked: boolean) => void;

  handlePdfUpload: (file: File) => void;

  onApplyAllGroup: (items: CommentedHighlight[]) => void;
  onRemoveHighlight: (highlight: CommentedHighlight) => void;
  onRemoveGroup: (items: CommentedHighlight[]) => void;

  // App-level bulk toggle (single atomic state update)
  onToggleGroup: (items: CommentedHighlight[], checked: boolean) => void;

  highlights: Array<CommentedHighlight>;
  resetHighlights: () => void;
  toggleDocument: () => void;
  resetEverything: () => void;
}

/* =========================
   Helpers
========================= */

const normalizeText = (s: string | undefined | null) =>
  (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

const getDisplayLabel = (h: CommentedHighlight) => {
  const t = h.content?.text?.trim();
  if (t && t.length > 0) return t;
  const pg = h.position?.boundingRect?.pageNumber;
  return `(No text)${pg ? ` — Page ${pg}` : ""}`;
};

/* =========================
   Grouped Redactions
========================= */

type Group = { key: string; label: string; items: CommentedHighlight[] };

type GroupedRedactionsProps = {
  all: CommentedHighlight[];
  active: CommentedHighlight[];
  onToggleGroup: (items: CommentedHighlight[], checked: boolean) => void;
  toggleSingle: (highlight: CommentedHighlight, checked: boolean) => void;

  onApplyAllGroup: (items: CommentedHighlight[]) => void;
  onRemoveHighlight: (item: CommentedHighlight) => void;
  onRemoveGroup: (items: CommentedHighlight[]) => void;
};

const GroupedRedactions: React.FC<GroupedRedactionsProps> = ({
  all,
  active,
  onToggleGroup,
  toggleSingle,
  onApplyAllGroup,
  onRemoveHighlight,
  onRemoveGroup,
}) => {
  const groups: Group[] = React.useMemo(() => {
    const map = new Map<string, Group>();
    for (const h of all) {
      const raw = h.content?.text ?? "";
      const key = normalizeText(raw) || "__no_text__";
      const label = getDisplayLabel(h);

      const existing = map.get(key);
      if (existing) existing.items.push(h);
      else map.set(key, { key, label, items: [h] });
    }
    return [...map.values()];
  }, [all]);

  const activeSet = React.useMemo(() => new Set(active.map((h) => h.id)), [active]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  /* Keyboard navigation */
  const [focusedGroupIndex, setFocusedGroupIndex] = useState(0);

  useEffect(() => {
    if (groups.length === 0) {
      setFocusedGroupIndex(0);
      return;
    }
    if (focusedGroupIndex >= groups.length) {
      setFocusedGroupIndex(groups.length - 1);
    }
  }, [groups, focusedGroupIndex]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (groups.length === 0) return;
      const key = e.key;
      const group = groups[focusedGroupIndex];

      if (key === "ArrowDown") {
        e.preventDefault();
        setFocusedGroupIndex((i) => Math.min(i + 1, groups.length - 1));
      }
      if (key === "ArrowUp") {
        e.preventDefault();
        setFocusedGroupIndex((i) => Math.max(i - 1, 0));
      }
      if (key === " " || key === "Enter") {
        e.preventDefault();
        const shouldCheck = group.items.some((it) => !activeSet.has(it.id));
        onToggleGroup(group.items, shouldCheck);
      }
      if (key.toLowerCase() === "o") {
        e.preventDefault();
        toggleExpand(group.key);
      }
      if (key.toLowerCase() === "e") {
        e.preventDefault();
        const next: Record<string, boolean> = {};
        for (const g of groups) next[g.key] = true;
        setExpanded(next);
      }
      if (key.toLowerCase() === "c") {
        e.preventDefault();
        const next: Record<string, boolean> = {};
        for (const g of groups) next[g.key] = false;
        setExpanded(next);
      }
    },
    [groups, focusedGroupIndex, activeSet, onToggleGroup]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (groups.length === 0) {
    return <div style={{ opacity: 0.6 }}>No redactions yet.</div>;
  }

  return (
    <div>
      {groups.map((group, index) => {
        const total = group.items.length;
        const activeCount = group.items.filter((h) => activeSet.has(h.id)).length;

        const isChecked = total > 0 && activeCount === total;
        const isIndeterminate = activeCount > 0 && activeCount < total;

        const focused = index === focusedGroupIndex;

        const checkboxId = `group-checkbox-${group.key}`;

        return (
          <div
            key={group.key}
            style={{
              borderRadius: 4,
              padding: focused ? "4px" : 0,
              background: focused ? "rgba(0, 120, 212, 0.15)" : "transparent",
            }}
          >
            {/* ─────────────────────────────
                GROUP HEADER (checkbox + arrow + text)
               ───────────────────────────── */}
            <div
              className="sidebar-highlight-item"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
              }}
              title={group.label}
            >
              {/* Checkbox — NOT inside a label to avoid auto-toggle */}
              <input
                id={checkboxId}
                type="checkbox"
                checked={isChecked}
                aria-checked={isIndeterminate ? "mixed" : isChecked}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onClick={(e) => e.stopPropagation()} // Don’t expand/collapse
                onChange={(e) =>
                  onToggleGroup(group.items, e.target.checked)
                }
              />

              {/* Optional label to enlarge click area (kept minimal) */}
              <label
                htmlFor={checkboxId}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: "pointer", userSelect: "none" }}
                aria-label={`Select/deselect all for ${group.label}`}
              ></label>

              {/* Disclosure arrow button — expands only */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleExpand(group.key);
                }}
                aria-expanded={!!expanded[group.key]}
                aria-controls={`group-panel-${group.key}`}
                className="sidebar-disclosure"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  width: 18,
                }}
              >
                {expanded[group.key] ? "▾" : "▸"}
              </button>

              {/* Text label — expand/collapse only */}
              <span
                className="sidebar-highlight-text"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleExpand(group.key);
                }}
                style={{ cursor: "pointer", userSelect: "none" }}
              >
                {group.label}
              </span>

              {total > 1 && (
                <span style={{ fontSize: 11, opacity: 0.7 }}>
                  ×{total}
                </span>
              )}

              <span style={{ flex: 1 }} />

              {/* Apply all */}
              <button
                className="ApplyAllBtn"
                title="Apply this redaction to all instances of this text"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onApplyAllGroup(group.items);
                }}
                style={{ marginRight: 8 }}
              >
                Apply all
              </button>

              {/* Remove all */}
              <button
                className="RemoveLink"
                title="Remove all redactions in this group"
                aria-label="Remove all redactions in this group"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (
                    window.confirm(
                      "Remove all redactions in this group? This cannot be undone."
                    )
                  ) {
                    onRemoveGroup(group.items);
                  }
                }}
              >
                <DeleteRegular style={{ fontSize: 18 }} />
              </button>
            </div>

            {/* ─────────────────────────────
                EXPANDED ITEMS
               ───────────────────────────── */}
            {expanded[group.key] && (
              <div
                id={`group-panel-${group.key}`}
                style={{ marginLeft: 28, marginTop: 2 }}
              >
                {group.items.map((item, i) => {
                  const checked = activeSet.has(item.id);

                  return (
                    <label
                      key={item.id}
                      className="sidebar-highlight-item"
                      style={{
                        padding: "2px 0",
                        alignItems: "center",
                        display: "flex",
                        gap: 8,
                      }}
                      title={item.content?.text}
                      onClick={(e) => e.stopPropagation()} // clicking row shouldn't toggle group
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleSingle(item, e.target.checked)}
                      />

                      <div
                        className="sidebar-row__content"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <span
                          className="sidebar-row__title"
                          style={{ fontSize: 12, whiteSpace: "nowrap" }}
                        >
                          Redaction {i + 1} — Page{" "}
                          {item.position.boundingRect.pageNumber}
                        </span>

                        <span style={{ flex: 1 }} />

                        <button
                          className="RemoveBtn"
                          title="Remove this redaction"
                          aria-label="Remove this redaction"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRemoveHighlight(item);
                          }}
                        >
                          <DeleteRegular style={{ fontSize: 14 }} />
                        </button>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* =========================
   Main Sidebar Component
========================= */

const Sidebar: React.FC<SidebarProps> = ({
  uploadedPdfs,
  currentPdfId,
  setCurrentPdfId,
  allHighlights,
  currentHighlights,
  toggleHighlightCheckbox,
  handlePdfUpload,

  onApplyAllGroup,
  onRemoveHighlight,
  onRemoveGroup,
  onToggleGroup,

  highlights,
  resetHighlights,
  toggleDocument,
  resetEverything,
}) => {
  const [sections, setSections] = useState({
    documents: true,
    highlights: true,
  });

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  // Confirmation dialogue window for changes
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);

  return (
    <div className="sidebar" style={{ width: "25vw", maxWidth: "500px" }}>
      {/* Header */}
      <div className="description" style={{ padding: "1rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Somerset Council Redaction Tool</h2>
        <p style={{ fontSize: "0.7rem" }}>
          https://github.com/drpollylang/contextual-redactor-application
        </p>
      </div>

      {/* Upload */}
      <div
        style={{
          padding: ".5rem",
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <DefaultButton
          text="Upload PDF"
          iconProps={{ iconName: "Upload" }}
          onClick={() =>
            document.getElementById("pdf-upload-input")?.click()
          }
        />
        <input
          id="pdf-upload-input"
          type="file"
          accept="application/pdf"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePdfUpload(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {/* Documents */}
      <div style={{ borderBottom: "1px solid #eee" }}>
        <div
          onClick={() => toggleSection("documents")}
          className="sidebar-section-header"
        >
          Documents {sections.documents ? "▾" : "▸"}
        </div>

        {sections.documents && (
          <div
            className="sidebar-section-content"
            style={{ maxHeight: "25vh" }}
          >
            {uploadedPdfs.length === 0 ? (
              <div style={{ opacity: 0.6 }}>No documents uploaded.</div>
            ) : (
              uploadedPdfs.map((doc) => {
                const active = doc.id === currentPdfId;
                return (
                  <div
                    key={doc.id}
                    className={`sidebar-document${
                      active ? " active" : ""
                    }`}
                    title={doc.name}
                    onClick={() => setCurrentPdfId(doc.id)}
                  >
                    {doc.name}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Redactions */}
      <div style={{ borderBottom: "1px solid #eee" }}>
        <div
          onClick={() => toggleSection("highlights")}
          className="sidebar-section-header"
        >
          Redactions {sections.highlights ? "▾" : "▸"}
        </div>

        {sections.highlights && (
          <div
            className="sidebar-section-content"
            style={{ maxHeight: "35vh" }}
          >
            {!currentPdfId ? (
              <div style={{ opacity: 0.6 }}>
                Open a document to see redactions.
              </div>
            ) : (
              <GroupedRedactions
                all={allHighlights[currentPdfId] ?? []}
                active={currentHighlights}
                onToggleGroup={onToggleGroup}
                toggleSingle={toggleHighlightCheckbox}
                onApplyAllGroup={onApplyAllGroup}
                onRemoveHighlight={onRemoveHighlight}
                onRemoveGroup={onRemoveGroup}
              />
            )}
          </div>
        )}
      </div>

      {/* Reset */}
      {currentHighlights.length > 0 && (
        <div style={{ padding: ".5rem" }}>
          <button onClick={resetHighlights} className="sidebar__reset">
            Reset (Hide) Redactions
          </button>
        </div>
      )}

    <div style={{ padding: ".5rem", marginTop: "-0.5rem" }}>
    <button
        onClick={() => {
        // if (window.confirm("Delete ALL redactions and clear history?")) {
        //     resetEverything();
        // }
        <button
        onClick={() => setConfirmResetAllOpen(true)}
        className="sidebar__reset"
        style={{
            backgroundColor: "#b30000",
            color: "white",
            border: "1px solid #800000",
            marginTop: "6px"
        }}
        >
        Delete ALL redactions & Clear History
        </button>
        }}
        className="sidebar__clear"
        style={{
        // backgroundColor: "#b30000",
        // color: "white",
        // border: "1px solid #800000",
        marginTop: "6px"
        }}
    >
        Delete All Redactions & Clear History
    </button>
    </div>
        
    <Dialog
    hidden={!confirmResetAllOpen}
    onDismiss={() => setConfirmResetAllOpen(false)}
    dialogContentProps={{
        type: DialogType.normal,
        title: "Delete ALL redactions?",
        closeButtonAriaLabel: "Close",
        subText: "This will permanently delete ALL redactions for this document and clear the entire undo/redo history. This action cannot be undone."
    }}
    modalProps={{
        isBlocking: true
    }}
    >
    <DialogFooter>
        <PrimaryButton
        onClick={() => {
            resetEverything();
            setConfirmResetAllOpen(false);
        }}
        text="Delete everything"
        />
        <DefaultButton
        onClick={() => setConfirmResetAllOpen(false)}
        text="Cancel"
        />
    </DialogFooter>
    </Dialog>
    </div>
  );
};

export default Sidebar;
