
import React, { useEffect, useState, useCallback } from "react";
import "./style/Sidebar.css";
import { Spinner, SpinnerSize } from "@fluentui/react";
import {
  DefaultButton,
  PrimaryButton,
  Dialog,
  DialogType,
  DialogFooter,
  IconButton,
  ActionButton,
  TooltipHost,
  ITooltipHostStyles,
} from "@fluentui/react";
// import { DeleteRegular } from "@fluentui/react-icons";
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
  removePdf: (id: string) => void;

  onFindDuplicates: () => Promise<Array<Array<{ id: string; name: string }>>>;

  onApplyAllGroup: (items: CommentedHighlight[]) => void;
  onRemoveHighlight: (highlight: CommentedHighlight) => void;

  // Remove all items from a specific group
  onRemoveGroup: (items: CommentedHighlight[]) => void;

  // Bulk toggle provided by App (single atomic update)
  onToggleGroup: (items: CommentedHighlight[], checked: boolean) => void;

  // Resets active-only
  resetHighlights: () => void;

  // NEW: full reset (delete all + clear history/undo/redo)
  resetEverything: () => void;

  // Legacy/misc (not used for rendering lists anymore)
  highlights: Array<CommentedHighlight>;
  toggleDocument: () => void;

  // AI-generated redaction suggestions button
  onStartRedaction: () => Promise<void>;
  isRedacting: boolean;
  redactionStatus?: string | null;

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

/* =======================
    Style
========================== */


const sidebarButtonStyles = {
  compactPrimary: { root: { height: 28, padding: "0 8px" } },
  compactAction: { root: { height: 28, padding: "0 6px", minWidth: 0 } },
  compactIcon: { 
    root: { height: 28, width: 28, padding: 0 },
    rootHovered: { background: "rgba(0,0,0,0.04)" },
    rootPressed: { background: "rgba(0,0,0,0.08)" },
  },
  dangerIcon: {
    root: { color: "#a80000" },
    rootHovered: { background: "rgba(168,0,0,0.08)" },
    rootPressed: { background: "rgba(168,0,0,0.16)" },
  },
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

  // ── NEW: group-level delete confirmation dialog state ──
  const [confirmGroupOpen, setConfirmGroupOpen] = useState(false);
  const [pendingGroup, setPendingGroup] = useState<Group | null>(null);

  const openConfirmGroup = (group: Group) => {
    setPendingGroup(group);
    setConfirmGroupOpen(true);
  };
  const closeConfirmGroup = () => {
    setConfirmGroupOpen(false);
    setPendingGroup(null);
  };
  const confirmDeleteGroup = () => {
    if (pendingGroup) {
      onRemoveGroup(pendingGroup.items);
    }
    closeConfirmGroup();
  };

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
            {/* Group header row */}
            <div
              className="sidebar-highlight-item"
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}
              title={group.label}
            >
              {/* Checkbox — not wrapped by label to avoid auto-toggle */}
              <input
                id={checkboxId}
                type="checkbox"
                checked={isChecked}
                aria-checked={isIndeterminate ? "mixed" : isChecked}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onClick={(e) => e.stopPropagation()} // not expand/collapse
                onChange={(e) => onToggleGroup(group.items, e.target.checked)}
              />
              {/* Optional minimal label to enlarge hit area */}
              <label
                htmlFor={checkboxId}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: "pointer", userSelect: "none" }}
                aria-label={`Select/deselect all for ${group.label}`}
              />

              {/* Arrow button — expand/collapse only */}
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
                title={expanded[group.key] ? "Collapse group" : "Expand group"}
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
                <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 }}>
                  ×{total}
                </span>
              )}

              <span style={{ flex: 1 }} />

              {/* Apply all */}
              {/* <button
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
              </button> */}
              
              {/* Apply all — Fluent UI, compact */}
              <ActionButton
                styles={sidebarButtonStyles.compactAction}
                iconProps={{ iconName: "CheckMark" }}
                title="Apply this redaction to all instances of this text"
                aria-label={`Apply all redactions for ${group.label}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onApplyAllGroup(group.items);
                }}
                style={{ marginRight: 6 }}
              >
                Apply To All
              </ActionButton>

              {/* Remove all (with Fluent dialog) */}
              {/* <button
                className="RemoveLink"
                title="Remove all redactions in this group"
                aria-label="Remove all redactions in this group"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openConfirmGroup(group);
                }}
              >
                <DeleteRegular style={{ fontSize: 18 }} />
              </button>
            */}
            
            <TooltipHost
              content="Remove all redactions in this group"
              styles={{ root: { display: "inline-flex" } } as ITooltipHostStyles}
            >
              <IconButton
                aria-label="Remove all redactions in this group"
                title="Remove all redactions in this group"
                styles={{ ...sidebarButtonStyles.compactIcon, ...sidebarButtonStyles.dangerIcon }}
                iconProps={{ iconName: "Delete" }}
                // If you prefer the modern Fluent 2 icon component rather than iconProps:
                // onRenderIcon={() => <DeleteRegular style={{ fontSize: 16 }} />}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openConfirmGroup(group);
                }}
              />
            </TooltipHost>
            </div> 

            {/* Expanded items */}
            {expanded[group.key] && (
              <div id={`group-panel-${group.key}`} style={{ marginLeft: 28, marginTop: 2 }}>
                {group.items.map((item, i) => {
                  const checked = activeSet.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className="sidebar-highlight-item"
                      style={{ padding: "2px 0", alignItems: "center", display: "flex", gap: 8 }}
                      title={item.content?.text}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleSingle(item, e.target.checked)}
                      />

                      <div
                        className="sidebar-row__content"
                        style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}
                      >
                        <span className="sidebar-row__title" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                          Redaction {i + 1} — Page {item.position.boundingRect.pageNumber}
                        </span>

                        <span style={{ flex: 1 }} />

                        {/* <button
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
                        </button> */}
                        
                        <TooltipHost content="Remove this redaction">
                          <IconButton
                            aria-label="Remove this redaction"
                            title="Remove this redaction"
                            styles={{ ...sidebarButtonStyles.compactIcon, ...sidebarButtonStyles.dangerIcon }}
                            iconProps={{ iconName: "Delete" }}
                            // Or use the modern icon:
                            // onRenderIcon={() => <DeleteRegular style={{ fontSize: 14 }} />}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onRemoveHighlight(item);
                            }}
                          />
                        </TooltipHost>

                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Group delete confirmation dialog ── */}
      <Dialog
        hidden={!confirmGroupOpen}
        onDismiss={closeConfirmGroup}
        dialogContentProps={{
          type: DialogType.normal,
          title: `Remove all redactions in this group?`,
          closeButtonAriaLabel: "Close",
          subText:
            pendingGroup
              ? `This will permanently remove ${pendingGroup.items.length} redaction(s) for “${pendingGroup.label}”.`
              : "This will permanently remove all redactions in the selected group.",
        }}
        modalProps={{ isBlocking: true }}
      >
        <DialogFooter>
          <PrimaryButton onClick={confirmDeleteGroup} text="Remove group" />
          <DefaultButton onClick={closeConfirmGroup} text="Cancel" />
        </DialogFooter>
      </Dialog>
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
  removePdf,
  onFindDuplicates,

  onApplyAllGroup,
  onRemoveHighlight,
  onRemoveGroup,
  onToggleGroup,

  highlights,
  resetHighlights,
  resetEverything,
  toggleDocument,
  
  onStartRedaction,
  isRedacting,
  redactionStatus,

}) => {
  // All hooks must be inside the component body
  const [sections, setSections] = useState({
    documents: true,
    highlights: true,
  });

    const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
    const [duplicateGroups, setDuplicateGroups] = useState<
      Array<Array<{ id: string; name: string }>>
    >([]);

    // Per-group canonical selection (keyed by group index)
    const [selectedCanonical, setSelectedCanonical] = useState<Record<number, string>>({});

    const chooseCanonical = (groupIndex: number, docId: string) => {
      setSelectedCanonical((prev) => ({ ...prev, [groupIndex]: docId }));
    };

    const refreshDuplicateGroups = async () => {
      const groups = await onFindDuplicates();
      setDuplicateGroups(groups);

      // Clean up selected canonical for groups that changed size or disappeared
      setSelectedCanonical((prev) => {
        const next: Record<number, string> = {};
        groups.forEach((g, i) => {
          const keep = prev[i] && g.some((d) => d.id === prev[i]) ? prev[i] : g[0]?.id;
          if (keep) next[i] = keep;
        });
        return next;
      });
    };

    const removeAllExceptCanonical = async (group: Array<{ id: string; name: string }>, groupIndex: number) => {
      if (!group || group.length <= 1) return;

      const keepId = selectedCanonical[groupIndex] ?? group[0].id;
      const toRemove = group.filter((d) => d.id !== keepId);

      // Remove sequentially (or Promise.all if you prefer)
      for (const d of toRemove) {
        await removePdf(d.id);
      }

      await refreshDuplicateGroups();
    };

    const removeOneFromGroup = async (docId: string) => {
      await removePdf(docId);
      await refreshDuplicateGroups();
    };
    // const removeAllExceptCanonical = (group: Array<{ id: string; name: string }>) => {
    //   if (group.length <= 1) return;

    //   const canonical = group[0]; // first element is canonical
    //   const duplicates = group.slice(1);

    //   duplicates.forEach(d => removePdf(d.id));
    // };

    // Delete single document dialog
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [pendingDoc, setPendingDoc] =
    useState<{ id: string; name: string } | null>(null);

    const openDeleteDialog = (doc: { id: string; name: string }) => {
    setPendingDoc(doc);
    setConfirmDeleteOpen(true);
    };

    const closeDeleteDialog = () => {
    setPendingDoc(null);
    setConfirmDeleteOpen(false);
    };

    const confirmDeleteDocument = () => {
    if (pendingDoc) {
        removePdf(pendingDoc.id);
    }
    closeDeleteDialog();
    };

  // Fluent UI dialog state for the "Delete ALL & Clear History" confirmation
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

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
          onClick={() => document.getElementById("pdf-upload-input")?.click()}
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
        <div onClick={() => toggleSection("documents")} className="sidebar-section-header">
          Documents {sections.documents ? "▾" : "▸"}
        </div>

        {sections.documents && (
          <div className="sidebar-section-content" style={{ maxHeight: "25vh" }}>
            {uploadedPdfs.length === 0 ? (
              <div style={{ opacity: 0.6 }}>No documents uploaded.</div>
            ) : (
              uploadedPdfs.map((doc) => {
                const active = doc.id === currentPdfId;
                return (
                //   <div
                //     key={doc.id}
                //     className={`sidebar-document${active ? " active" : ""}`}
                //     title={doc.name}
                //     onClick={() => setCurrentPdfId(doc.id)}
                //   >
                //     {doc.name}
                //   </div>
                
                <div
                    key={doc.id}
                    className={`sidebar-document${active ? " active" : ""}`}
                    title={doc.name}
                    style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    }}
                >
                    {/* Clicking name = open PDF */}
                    <div
                    style={{ flex: 1, cursor: "pointer" }}
                    onClick={() => setCurrentPdfId(doc.id)}
                    >
                    {doc.name}
                    </div>

                    {/* Delete button */}
                    <DefaultButton
                    iconProps={{ iconName: "Delete" }}
                    title="Remove this document"
                    styles={{ root: { minWidth: 32, padding: 0 } }}
                    onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(doc);
                    }}
                    />
                </div>
                );
              })
            )}
            {/* <DefaultButton
              text="Find Duplicate Documents"
              iconProps={{ iconName: "Search" }}
              style={{ marginTop: 8, width: "100%" }}
              onClick={async () => {
                const groups = await onFindDuplicates();
                setDuplicateGroups(groups);
                setDuplicateDialogOpen(true);
              }}
            /> */}
            {/* <DefaultButton
              text="Find Duplicate Documents"
              iconProps={{ iconName: "Search" }}
              style={{ marginTop: 8, width: "100%" }}
              onClick={async () => {
                const groups = await onFindDuplicates(); 
                setDuplicateGroups(groups);
                setDuplicateDialogOpen(true);
              }}
            /> */}
            <DefaultButton
              text="Find Duplicate Documents"
              iconProps={{ iconName: "Search" }}
              style={{ marginTop: 8, width: "100%" }}
              onClick={async () => {
                await refreshDuplicateGroups();
                setDuplicateDialogOpen(true);
              }}
            />
          </div>
        )}
      </div>

      {/* AI Redaction trigger */}
      {/* <div style={{ padding: ".5rem", borderBottom: "1px solid #eee", display: "flex", justifyContent: "center" }}>
        <PrimaryButton
          iconProps={{ iconName: "Sparkle" }}
          text={isRedacting ? "Generating…" : "Generate AI Suggested Redactions"}
          disabled={!currentPdfId || isRedacting}
          onClick={() => onStartRedaction()}
        />
        {redactionStatus && (
          <span style={{ marginLeft: 8, alignSelf: "center", fontSize: 12, opacity: 0.8 }}>
            {redactionStatus}
          </span>
        )}
      </div> */}

      <div style={{ padding: ".5rem", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
        <PrimaryButton
          iconProps={!isRedacting ? { iconName: "Sparkle" } : undefined}
          text={isRedacting ? "Generating…" : "Generate AI Suggested Redactions"}
          disabled={!currentPdfId || isRedacting}
          onClick={() => onStartRedaction()}
        />
        {isRedacting && (
          <Spinner size={SpinnerSize.small} label={redactionStatus ?? "Starting…"} />
        )}
      </div>


      {/* Redactions */}
      <div style={{ borderBottom: "1px solid #eee" }}>
        <div onClick={() => toggleSection("highlights")} className="sidebar-section-header">
          Redactions {sections.highlights ? "▾" : "▸"}
        </div>

        {sections.highlights && (
          <div className="sidebar-section-content" style={{ maxHeight: "35vh" }}>
            {!currentPdfId ? (
              <div style={{ opacity: 0.6 }}>Open a document to see redactions.</div>
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

      {/* Reset (active only) */}
      {currentHighlights.length > 0 && (
        <div style={{ padding: ".5rem" }}>
          <button onClick={resetHighlights} className="sidebar__reset">
            Reset redactions
          </button>
        </div>
      )}

      {/* Delete ALL + Clear History (Fluent UI Dialog) */}
      <div style={{ padding: ".5rem", marginTop: currentHighlights.length > 0 ? "-0.5rem" : 0 }}>
        <button
          onClick={() => setConfirmResetAllOpen(true)}
          className="sidebar__clear"
          style={{
            // backgroundColor: "#b30000",
            // color: "white",
            // border: "1px solid #800000",
            marginTop: "6px",
          }}
        >
          Delete All Redactions & Clear History
        </button>
      </div>

      {/*Fluent UI Dialog box for removing Documents */}
      <Dialog
      hidden={!confirmDeleteOpen}
      onDismiss={closeDeleteDialog}
      dialogContentProps={{
          type: DialogType.normal,
          title: `Delete this document?`,
          subText: pendingDoc
          ? `This will permanently delete "${pendingDoc.name}" and all associated redactions from the app.`
          : "",
      }}
      modalProps={{ isBlocking: true }}
      >
      <DialogFooter>
          <PrimaryButton onClick={confirmDeleteDocument} text="Delete document" />
          <DefaultButton onClick={closeDeleteDialog} text="Cancel" />
      </DialogFooter>
      </Dialog>

      {/* Fluent UI v8 Dialog for full reset */}
      <Dialog
        hidden={!confirmResetAllOpen}
        onDismiss={() => setConfirmResetAllOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: "Delete All Redactions?",
          closeButtonAriaLabel: "Close",
          subText:
            "This will permanently delete all redactions for this document and clear the entire undo/redo history. This action cannot be undone.",
        }}
        modalProps={{
          isBlocking: true,
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
          <DefaultButton onClick={() => setConfirmResetAllOpen(false)} text="Cancel" />
        </DialogFooter>
      </Dialog>

      {/* Fluent UI v8 Dialog for document level de-duplication */}
      <Dialog
        hidden={!duplicateDialogOpen}
        onDismiss={() => setDuplicateDialogOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: "Duplicate Documents Detected",
          subText:
            duplicateGroups.length === 0
              ? "No duplicate documents were found."
              : "These documents have identical file content:"
        }}
        modalProps={{ isBlocking: false }}
      >
        {duplicateGroups.map((group, idx) => (
          <div key={idx} style={{ marginBottom: 16 }}>
            <h4>Duplicate Set {idx + 1}</h4>

            {group.map(doc => (
              <div
                key={doc.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "4px 0"
                }}
              >
                <span>{doc.name}</span>

                <DefaultButton
                  text="Delete"
                  iconProps={{ iconName: "Delete" }}
                  styles={{ root: { padding: "0 8px", background: "#fde7e9" } }}
                  onClick={() => removePdf(doc.id)}
                />
              </div>
            ))}

            <hr style={{ marginTop: 8 }} />
          </div>
        ))}

        <DialogFooter>
          <PrimaryButton text="Close" onClick={() => setDuplicateDialogOpen(false)} />
        </DialogFooter>
      </Dialog>

      <Dialog
        hidden={!duplicateDialogOpen}
        onDismiss={() => setDuplicateDialogOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: "Duplicate Documents",
          subText:
            duplicateGroups.length === 0
              ? "No duplicates found."
              : "Choose the canonical document in each set, or remove duplicates."
        }}
        modalProps={{ isBlocking: false }}
      >
        <div>
          {duplicateGroups.length === 0 ? (
            <div style={{ opacity: 0.7 }}>No duplicates detected.</div>
          ) : (
            duplicateGroups.map((group, i) => {
              const canonicalId = selectedCanonical[i] ?? group[0].id;
              return (
                <div key={i} style={{ marginBottom: 18 }}>
                  <h4 style={{ marginBottom: 8 }}>Duplicate Set {i + 1}</h4>

                  {group.map((doc) => {
                    const isCanonical = doc.id === canonicalId;
                    return (
                      <label
                        key={doc.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "6px 8px",
                          border: "1px solid #eee",
                          borderRadius: 4,
                          marginBottom: 6,
                          background: isCanonical ? "#e6f4ff" : "transparent"
                        }}
                        onClick={(e) => e.stopPropagation()}
                        title={doc.name}
                      >
                        <input
                          type="radio"
                          name={`canonical-${i}`}
                          checked={isCanonical}
                          onChange={() => chooseCanonical(i, doc.id)}
                        />
                        <span style={{ flex: 1 }}>
                          {doc.name}
                          {isCanonical && <span style={{ marginLeft: 6, opacity: 0.7 }}>(Canonical)</span>}
                        </span>

                        <DefaultButton
                          text="Delete"
                          iconProps={{ iconName: "Delete" }}
                          styles={{ root: { minWidth: 80, padding: "0 8px", background: "#fde7e9" } }}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await removeOneFromGroup(doc.id);
                          }}
                        />
                      </label>
                    );
                  })}

                  {group.length > 1 && (
                    <PrimaryButton
                      text="Remove All Except Canonical"
                      iconProps={{ iconName: "Delete" }}
                      style={{ marginTop: 8 }}
                      onClick={async () => {
                        await removeAllExceptCanonical(group, i);
                      }}
                    />
                  )}

                  <hr style={{ marginTop: 12 }} />
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <PrimaryButton text="Close" onClick={() => setDuplicateDialogOpen(false)} />
        </DialogFooter>
      </Dialog>
    </div>
  );
};

export default Sidebar;