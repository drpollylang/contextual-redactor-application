
// import React, { useEffect, useState, useCallback } from "react";
// import "./style/Sidebar.css";
// import { Spinner, SpinnerSize } from "@fluentui/react";
// import {
//   DefaultButton,
//   PrimaryButton,
//   Dialog,
//   DialogType,
//   DialogFooter,
//   IconButton,
//   ActionButton,
//   TooltipHost,
//   ITooltipHostStyles,
// } from "@fluentui/react";
// // import { DeleteRegular } from "@fluentui/react-icons";
// import { CommentedHighlight } from "./types";
// import { getHighlightColor } from "./helpers/color";



// /* =========================
//    Helpers
// ========================= */

// const normalizeText = (s: string | undefined | null) =>
//   (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

// const getDisplayLabel = (h: CommentedHighlight) => {
//   const t = h.content?.text?.trim();
//   if (t && t.length > 0) return t;
//   const pg = h.position?.boundingRect?.pageNumber;
//   return `(No text)${pg ? ` — Page ${pg}` : ""}`;
// };

// /* =======================
//     Style
// ========================== */


// const sidebarButtonStyles = {
//   compactPrimary: { root: { height: 28, padding: "0 8px" } },
//   compactAction: { root: { height: 28, padding: "0 6px", minWidth: 0 } },
//   compactIcon: { 
//     root: { height: 28, width: 28, padding: 0 },
//     rootHovered: { background: "rgba(0,0,0,0.04)" },
//     rootPressed: { background: "rgba(0,0,0,0.08)" },
//   },
//   dangerIcon: {
//     root: { color: "#a80000" },
//     rootHovered: { background: "rgba(168,0,0,0.08)" },
//     rootPressed: { background: "rgba(168,0,0,0.16)" },
//   },
// };

// /* =========================
//    Grouped Redactions
// ========================= */

// type Group = { key: string; label: string; items: CommentedHighlight[] };

// type GroupedRedactionsProps = {
//   all: CommentedHighlight[];
//   active: CommentedHighlight[];
//   onToggleGroup: (items: CommentedHighlight[], checked: boolean) => void;
//   toggleSingle: (highlight: CommentedHighlight, checked: boolean) => void;

//   onApplyAllGroup: (items: CommentedHighlight[]) => void;
//   onRemoveHighlight: (item: CommentedHighlight) => void;
//   onRemoveGroup: (items: CommentedHighlight[]) => void;
// };


// const GroupedRedactions: React.FC<GroupedRedactionsProps> = ({
//   all,
//   active,
//   onToggleGroup,
//   toggleSingle,
//   onApplyAllGroup,
//   onRemoveHighlight,
//   onRemoveGroup,
// }) => {
//   // const groups: Group[] = React.useMemo(() => {
//   //   const map = new Map<string, Group>();
//   //   for (const h of all) {
//   //     const raw = h.content?.text ?? "";
//   //     const key = normalizeText(raw) || "__no_text__";
//   //     const label = getDisplayLabel(h);
//   //     // const label = h.label ?? getDisplayLabel(h);

//   //     const existing = map.get(key);
//   //     if (existing) existing.items.push(h);
//   //     else map.set(key, { key, label, items: [h] });
//   //   }
//   //   return [...map.values()];
//   // }, [all]);
//   // Edit: group redaction checkboxes beneath category headers
//   type CategoryGroup = {
//     category: string | null;
//     items: CommentedHighlight[];
//   };

//   const categoryGroups = React.useMemo(() => {
//     const map = new Map<string, CategoryGroup>();

//     for (const h of all) {
//       const cat = h.metadata?.category ?? "Uncategorised";

//       if (!map.has(cat)) {
//         map.set(cat, { category: cat, items: [] });
//       }
//       map.get(cat)!.items.push(h);
//     }

//     return [...map.values()];
//   }, [all]);

//   const activeSet = React.useMemo(() => new Set(active.map((h) => h.id)), [active]);
//   const [expanded, setExpanded] = useState<Record<string, boolean>>({});

//   const toggleExpand = (key: string) =>
//     setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

//   /* Keyboard navigation */
//   const [focusedGroupIndex, setFocusedGroupIndex] = useState(0);

//   useEffect(() => {
//     if (groups.length === 0) {
//       setFocusedGroupIndex(0);
//       return;
//     }
//     if (focusedGroupIndex >= groups.length) {
//       setFocusedGroupIndex(groups.length - 1);
//     }
//   }, [groups, focusedGroupIndex]);

//   const handleKey = useCallback(
//     (e: KeyboardEvent) => {
//       if (groups.length === 0) return;
//       const key = e.key;
//       const group = groups[focusedGroupIndex];

//       if (key === "ArrowDown") {
//         e.preventDefault();
//         setFocusedGroupIndex((i) => Math.min(i + 1, groups.length - 1));
//       }
//       if (key === "ArrowUp") {
//         e.preventDefault();
//         setFocusedGroupIndex((i) => Math.max(i - 1, 0));
//       }
//       if (key === " " || key === "Enter") {
//         e.preventDefault();
//         const shouldCheck = group.items.some((it) => !activeSet.has(it.id));
//         onToggleGroup(group.items, shouldCheck);
//       }
//       if (e.ctrlKey && key.toLowerCase() === "o") {
//         e.preventDefault();
//         toggleExpand(group.key);
//       }
//       if (e.ctrlKey && key.toLowerCase() === "e") {
//         e.preventDefault();
//         const next: Record<string, boolean> = {};
//         for (const g of groups) next[g.key] = true;
//         setExpanded(next);
//       }
//       if (e.ctrlKey && key.toLowerCase() === "c") {
//         e.preventDefault();
//         const next: Record<string, boolean> = {};
//         for (const g of groups) next[g.key] = false;
//         setExpanded(next);
//       }
//     },
//     [groups, focusedGroupIndex, activeSet, onToggleGroup]
//   );

//   useEffect(() => {
//     window.addEventListener("keydown", handleKey);
//     return () => window.removeEventListener("keydown", handleKey);
//   }, [handleKey]);

//   // ── NEW: group-level delete confirmation dialog state ──
//   const [confirmGroupOpen, setConfirmGroupOpen] = useState(false);
//   const [pendingGroup, setPendingGroup] = useState<Group | null>(null);

//   const openConfirmGroup = (group: Group) => {
//     setPendingGroup(group);
//     setConfirmGroupOpen(true);
//   };
//   const closeConfirmGroup = () => {
//     setConfirmGroupOpen(false);
//     setPendingGroup(null);
//   };
//   const confirmDeleteGroup = () => {
//     if (pendingGroup) {
//       onRemoveGroup(pendingGroup.items);
//     }
//     closeConfirmGroup();
//   };

//   if (groups.length === 0) {
//     return <div style={{ opacity: 0.6 }}>No redactions yet.</div>;
//   }

//   return (
//     <div>
//       {groups.map((group, index) => {
//         const total = group.items.length;
//         const activeCount = group.items.filter((h) => activeSet.has(h.id)).length;

//         const isChecked = total > 0 && activeCount === total;
//         const isIndeterminate = activeCount > 0 && activeCount < total;

//         const focused = index === focusedGroupIndex;
//         const checkboxId = `group-checkbox-${group.key}`;

//         return (
//           <div
//             key={group.key}
//             style={{
//               borderRadius: 4,
//               padding: focused ? "4px" : 0,
//               background: focused ? "rgba(0, 120, 212, 0.15)" : "transparent",
//             }}
//           >
//             {/* Group header row */}
//             <div
//               className="sidebar-highlight-item"
//               style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}
//               title={group.label}
//             >
//               {/* Checkbox — not wrapped by label to avoid auto-toggle */}
//               <input
//                 id={checkboxId}
//                 type="checkbox"
//                 checked={isChecked}
//                 aria-checked={isIndeterminate ? "mixed" : isChecked}
//                 ref={(el) => {
//                   if (el) el.indeterminate = isIndeterminate;
//                 }}
//                 onClick={(e) => e.stopPropagation()} // not expand/collapse
//                 onChange={(e) => onToggleGroup(group.items, e.target.checked)}
//               />
//               {/* Optional minimal label to enlarge hit area */}
//               <label
//                 htmlFor={checkboxId}
//                 onClick={(e) => e.stopPropagation()}
//                 style={{ cursor: "pointer", userSelect: "none" }}
//                 aria-label={`Select/deselect all for ${group.label}`}
//               />

//               {/* Arrow button — expand/collapse only */}
//               <button
//                 type="button"
//                 onClick={(e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   toggleExpand(group.key);
//                 }}
//                 aria-expanded={!!expanded[group.key]}
//                 aria-controls={`group-panel-${group.key}`}
//                 className="sidebar-disclosure"
//                 style={{
//                   border: "none",
//                   background: "transparent",
//                   cursor: "pointer",
//                   padding: 0,
//                   width: 18,
//                 }}
//                 title={expanded[group.key] ? "Collapse group" : "Expand group"}
//               >
//                 {expanded[group.key] ? "▾" : "▸"}
//               </button>

//               {/* Text label — expand/collapse only */}
//               <span
//                 className="sidebar-highlight-text"
//                 onClick={(e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   toggleExpand(group.key);
//                 }}
//                 style={{ cursor: "pointer", userSelect: "none" }}
//               >
//                 {group.label}
//               </span>

//               {total > 1 && (
//                 <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 2 }}>
//                   ×{total}
//                 </span>
//               )}

//               <span style={{ flex: 1 }} />

//               {/* Apply all */}
//               {/* <button
//                 className="ApplyAllBtn"
//                 title="Apply this redaction to all instances of this text"
//                 onClick={(e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   onApplyAllGroup(group.items);
//                 }}
//                 style={{ marginRight: 8 }}
//               >
//                 Apply all
//               </button> */}
              
//               {/* Apply all — Fluent UI, compact */}
//               <ActionButton
//                 styles={sidebarButtonStyles.compactAction}
//                 iconProps={{ iconName: "CheckMark" }}
//                 title="Apply this redaction to all instances of this text"
//                 aria-label={`Apply all redactions for ${group.label}`}
//                 onClick={(e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   onApplyAllGroup(group.items);
//                 }}
//                 style={{ marginRight: 6 }}
//               >
//                 Apply To All
//               </ActionButton>

//               {/* Remove all (with Fluent dialog) */}
//               {/* <button
//                 className="RemoveLink"
//                 title="Remove all redactions in this group"
//                 aria-label="Remove all redactions in this group"
//                 onClick={(e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   openConfirmGroup(group);
//                 }}
//               >
//                 <DeleteRegular style={{ fontSize: 18 }} />
//               </button>
//             */}
            
//             <TooltipHost
//               content="Remove all redactions in this group"
//               styles={{ root: { display: "inline-flex" } } as ITooltipHostStyles}
//             >
//               <IconButton
//                 aria-label="Remove all redactions in this group"
//                 title="Remove all redactions in this group"
//                 styles={{ ...sidebarButtonStyles.compactIcon, ...sidebarButtonStyles.dangerIcon }}
//                 iconProps={{ iconName: "Delete" }}
//                 // If you prefer the modern Fluent 2 icon component rather than iconProps:
//                 // onRenderIcon={() => <DeleteRegular style={{ fontSize: 16 }} />}
//                 onClick={(e) => {
//                   e.preventDefault();
//                   e.stopPropagation();
//                   openConfirmGroup(group);
//                 }}
//               />
//             </TooltipHost>
//             </div> 

//             {/* Expanded items */}
//             {expanded[group.key] && (
//               <div id={`group-panel-${group.key}`} style={{ marginLeft: 28, marginTop: 2 }}>
//                 {group.items.map((item, i) => {
//                   const checked = activeSet.has(item.id);
//                   return (
//                     <label
//                       key={item.id}
//                       className="sidebar-highlight-item"
//                       style={{ padding: "2px 0", alignItems: "center", display: "flex", gap: 8 }}
//                       title={item.content?.text}
//                       onClick={(e) => e.stopPropagation()}
//                     >
//                       <input
//                         type="checkbox"
//                         checked={checked}
//                         onChange={(e) => toggleSingle(item, e.target.checked)}
//                       />

//                       <div
//                         className="sidebar-row__content"
//                         style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}
//                       >
//                         <span className="sidebar-row__title" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
//                           Redaction {i + 1} — Page {item.position.boundingRect.pageNumber}
//                         </span>
//                         {/* <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
//                           <span className="sidebar-row__title">
//                             Redaction {i + 1} — Page {item.position.boundingRect.pageNumber}
//                           </span>

//                           {item.metadata?.category && (
//                             <span
//                               style={{
//                                 padding: "2px 6px",
//                                 borderRadius: 10,
//                                 fontSize: 10,
//                                 background: getHighlightColor(item),
//                                 color: "white",
//                                 opacity: 0.9
//                               }}
//                             >
//                               {item.metadata.category}
//                             </span>
//                           )}
//                         </div> */}

//                         <span style={{ flex: 1 }} />

//                         {/* <button
//                           className="RemoveBtn"
//                           title="Remove this redaction"
//                           aria-label="Remove this redaction"
//                           onClick={(e) => {
//                             e.preventDefault();
//                             e.stopPropagation();
//                             onRemoveHighlight(item);
//                           }}
//                         >
//                           <DeleteRegular style={{ fontSize: 14 }} />
//                         </button> */}
                        
//                         <TooltipHost content="Remove this redaction">
//                           <IconButton
//                             aria-label="Remove this redaction"
//                             title="Remove this redaction"
//                             styles={{ ...sidebarButtonStyles.compactIcon, ...sidebarButtonStyles.dangerIcon }}
//                             iconProps={{ iconName: "Delete" }}
//                             // Or use the modern icon:
//                             // onRenderIcon={() => <DeleteRegular style={{ fontSize: 14 }} />}
//                             onClick={(e) => {
//                               e.preventDefault();
//                               e.stopPropagation();
//                               onRemoveHighlight(item);
//                             }}
//                           />
//                         </TooltipHost>

//                       </div>
//                     </label>
//                   );
//                 })}
//               </div>
//             )}
//           </div>
//         );
//       })}

//       {/* ── Group delete confirmation dialog ── */}
//       <Dialog
//         hidden={!confirmGroupOpen}
//         onDismiss={closeConfirmGroup}
//         dialogContentProps={{
//           type: DialogType.normal,
//           title: `Remove all redactions in this group?`,
//           closeButtonAriaLabel: "Close",
//           subText:
//             pendingGroup
//               ? `This will permanently remove ${pendingGroup.items.length} redaction(s) for “${pendingGroup.label}”.`
//               : "This will permanently remove all redactions in the selected group.",
//         }}
//         modalProps={{ isBlocking: true }}
//       >
//         <DialogFooter>
//           <PrimaryButton onClick={confirmDeleteGroup} text="Remove group" />
//           <DefaultButton onClick={closeConfirmGroup} text="Cancel" />
//         </DialogFooter>
//       </Dialog>
//     </div>
//   );
// };

// /* =========================
//    Main Sidebar Component
// ========================= */

// const Sidebar: React.FC<SidebarProps> = ({
//   uploadedPdfs,
//   currentPdfId,
//   setCurrentPdfId,
//   allHighlights,
//   currentHighlights,
//   toggleHighlightCheckbox,
//   handlePdfUpload,
//   removePdf,
//   onFindDuplicates,

//   onApplyAllGroup,
//   onRemoveHighlight,
//   onRemoveGroup,
//   onToggleGroup,

//   highlightFilters,
//   setHighlightFilters,

//   highlights,
//   resetHighlights,
//   resetEverything,
//   toggleDocument,
  
//   onStartRedaction,
//   isRedacting,
//   redactionStatus,

// }) => {
//   // All hooks must be inside the component body
//   const [sections, setSections] = useState({
//     documents: true,
//     filters: true,
//     highlights: true,
//   });

//     const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
//     const [duplicateGroups, setDuplicateGroups] = useState<
//       Array<Array<{ id: string; name: string }>>
//     >([]);

//     // Per-group canonical selection (keyed by group index)
//     const [selectedCanonical, setSelectedCanonical] = useState<Record<number, string>>({});

//     const chooseCanonical = (groupIndex: number, docId: string) => {
//       setSelectedCanonical((prev) => ({ ...prev, [groupIndex]: docId }));
//     };

//     const refreshDuplicateGroups = async () => {
//       const groups = await onFindDuplicates();
//       setDuplicateGroups(groups);

//       // Clean up selected canonical for groups that changed size or disappeared
//       setSelectedCanonical((prev) => {
//         const next: Record<number, string> = {};
//         groups.forEach((g, i) => {
//           const keep = prev[i] && g.some((d) => d.id === prev[i]) ? prev[i] : g[0]?.id;
//           if (keep) next[i] = keep;
//         });
//         return next;
//       });
//     };

//     const removeAllExceptCanonical = async (group: Array<{ id: string; name: string }>, groupIndex: number) => {
//       if (!group || group.length <= 1) return;

//       const keepId = selectedCanonical[groupIndex] ?? group[0].id;
//       const toRemove = group.filter((d) => d.id !== keepId);

//       // Remove sequentially (or Promise.all if you prefer)
//       for (const d of toRemove) {
//         await removePdf(d.id);
//       }

//       await refreshDuplicateGroups();
//     };

//     const removeOneFromGroup = async (docId: string) => {
//       await removePdf(docId);
//       await refreshDuplicateGroups();
//     };
//     // const removeAllExceptCanonical = (group: Array<{ id: string; name: string }>) => {
//     //   if (group.length <= 1) return;

//     //   const canonical = group[0]; // first element is canonical
//     //   const duplicates = group.slice(1);

//     //   duplicates.forEach(d => removePdf(d.id));
//     // };

//     // Delete single document dialog
//     const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
//     const [pendingDoc, setPendingDoc] =
//     useState<{ id: string; name: string } | null>(null);

//     const openDeleteDialog = (doc: { id: string; name: string }) => {
//     setPendingDoc(doc);
//     setConfirmDeleteOpen(true);
//     };

//     const closeDeleteDialog = () => {
//     setPendingDoc(null);
//     setConfirmDeleteOpen(false);
//     };

//     const confirmDeleteDocument = () => {
//     if (pendingDoc) {
//         removePdf(pendingDoc.id);
//     }
//     closeDeleteDialog();
//     };

//   // Fluent UI dialog state for the "Delete ALL & Clear History" confirmation
//   const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);

//   const toggleSection = (key: keyof typeof sections) =>
//     setSections((prev) => ({ ...prev, [key]: !prev[key] }));

//   return (
//     <div className="sidebar" style={{ width: "25vw", maxWidth: "500px" }}>
//       {/* Header */}
//       <div className="description" style={{ padding: "1rem" }}>
//         <h2 style={{ marginBottom: "1rem" }}>Somerset Council Redaction Tool</h2>
//         <p style={{ fontSize: "0.7rem" }}>
//           https://github.com/drpollylang/contextual-redactor-application
//         </p>
//       </div>

//       {/* Upload */}
//       <div
//         style={{
//           padding: ".5rem",
//           borderBottom: "1px solid #eee",
//           display: "flex",
//           justifyContent: "center",
//         }}
//       >
//         <DefaultButton
//           text="Upload PDF"
//           iconProps={{ iconName: "Upload" }}
//           onClick={() => document.getElementById("pdf-upload-input")?.click()}
//         />
//         <input
//           id="pdf-upload-input"
//           type="file"
//           accept="application/pdf"
//           style={{ display: "none" }}
//           onChange={(e) => {
//             const f = e.target.files?.[0];
//             if (f) handlePdfUpload(f);
//             e.currentTarget.value = "";
//           }}
//         />
//       </div>

//       {/* Documents */}
//       <div style={{ borderBottom: "1px solid #eee" }}>
//         <div onClick={() => toggleSection("documents")} className="sidebar-section-header">
//           Documents {sections.documents ? "▾" : "▸"}
//         </div>

//         {sections.documents && (
//           <div className="sidebar-section-content" style={{ maxHeight: "25vh" }}>
//             {uploadedPdfs.length === 0 ? (
//               <div style={{ opacity: 0.6 }}>No documents uploaded.</div>
//             ) : (
//               uploadedPdfs.map((doc) => {
//                 const active = doc.id === currentPdfId;
//                 return (
//                 //   <div
//                 //     key={doc.id}
//                 //     className={`sidebar-document${active ? " active" : ""}`}
//                 //     title={doc.name}
//                 //     onClick={() => setCurrentPdfId(doc.id)}
//                 //   >
//                 //     {doc.name}
//                 //   </div>
                
//                 <div
//                     key={doc.id}
//                     className={`sidebar-document${active ? " active" : ""}`}
//                     title={doc.name}
//                     style={{
//                     display: "flex",
//                     alignItems: "center",
//                     justifyContent: "space-between",
//                     }}
//                 >
//                     {/* Clicking name = open PDF */}
//                     <div
//                     style={{ flex: 1, cursor: "pointer" }}
//                     onClick={() => setCurrentPdfId(doc.id)}
//                     >
//                     {doc.name}
//                     </div>

//                     {/* Delete button */}
//                     <DefaultButton
//                     iconProps={{ iconName: "Delete" }}
//                     title="Remove this document"
//                     styles={{ root: { minWidth: 32, padding: 0 } }}
//                     onClick={(e) => {
//                         e.stopPropagation();
//                         openDeleteDialog(doc);
//                     }}
//                     />
//                 </div>
//                 );
//               })
//             )}
//             {/* <DefaultButton
//               text="Find Duplicate Documents"
//               iconProps={{ iconName: "Search" }}
//               style={{ marginTop: 8, width: "100%" }}
//               onClick={async () => {
//                 const groups = await onFindDuplicates();
//                 setDuplicateGroups(groups);
//                 setDuplicateDialogOpen(true);
//               }}
//             /> */}
//             {/* <DefaultButton
//               text="Find Duplicate Documents"
//               iconProps={{ iconName: "Search" }}
//               style={{ marginTop: 8, width: "100%" }}
//               onClick={async () => {
//                 const groups = await onFindDuplicates(); 
//                 setDuplicateGroups(groups);
//                 setDuplicateDialogOpen(true);
//               }}
//             /> */}
//             <DefaultButton
//               text="Find Duplicate Documents"
//               iconProps={{ iconName: "Search" }}
//               style={{ marginTop: 8, width: "100%" }}
//               onClick={async () => {
//                 await refreshDuplicateGroups();
//                 setDuplicateDialogOpen(true);
//               }}
//             />
//           </div>
//         )}
//       </div>

//       {/* AI Redaction trigger */}
//       {/* <div style={{ padding: ".5rem", borderBottom: "1px solid #eee", display: "flex", justifyContent: "center" }}>
//         <PrimaryButton
//           iconProps={{ iconName: "Sparkle" }}
//           text={isRedacting ? "Generating…" : "Generate AI Suggested Redactions"}
//           disabled={!currentPdfId || isRedacting}
//           onClick={() => onStartRedaction()}
//         />
//         {redactionStatus && (
//           <span style={{ marginLeft: 8, alignSelf: "center", fontSize: 12, opacity: 0.8 }}>
//             {redactionStatus}
//           </span>
//         )}
//       </div> */}

//       <div style={{ padding: ".5rem", borderBottom: "1px solid #eee", display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
//         <PrimaryButton
//           iconProps={!isRedacting ? { iconName: "Sparkle" } : undefined}
//           text={isRedacting ? "Generating…" : "Generate AI Suggested Redactions"}
//           disabled={!currentPdfId || isRedacting}
//           onClick={() => onStartRedaction()}
//         />
//         {isRedacting && (
//           <Spinner size={SpinnerSize.small} label={redactionStatus ?? "Starting…"} />
//         )}
//       </div>

//       {/* === FILTERS === */}
//       <div onClick={() => toggleSection("filters")} className="sidebar-section-header">
//           Filter Redactions {sections.filters ? "▾" : "▸"}
//         </div>
//         {sections.filters && (
//           <div className="sidebar-section-content" style={{ maxHeight: "25vh" }}>
//       {/* <div style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>
//         <h4 style={{ margin: "4px 0" }}>Filter Redactions</h4> */}

//         {/* Filter by source */}
//         <select
//           value={highlightFilters.source}
//           onChange={(e) =>
//             setHighlightFilters((f: CommentedHighlight) => ({ ...f, source: e.target.value }))
//           }
//           style={{ width: "100%", marginBottom: 8 }}
//         >
//           <option value="all">All Sources</option>
//           <option value="manual">Manual Only</option>
//           <option value="ai">AI Only</option>
//         </select>

//         {/* Filter by category */}
        
//         {/* <select
//           value={highlightFilters.category}
//           onChange={(e) =>
//             setHighlightFilters((f: CommentedHighlight) => ({ ...f, category: e.target.value }))
//           }
//           style={{ width: "100%", marginBottom: 8 }}
//         >
//           <option value="all">All Categories</option> */}

//           {/* Auto-generate unique categories from highlights */}
//           {/* {Array.from(
//             new Set(
//               (allHighlights[currentPdfId] ?? [])
//                 .map((h) => h.metadata?.category)
//                 .filter(Boolean)
//             )
//           ).map((cat) => (
//             <option key={cat} value={cat}>
//               {cat}
//             </option>
//           ))}
//         </select>   */}
//         {/* Filter by category */}
//         {/* <select
//           value={highlightFilters.category}
//           onChange={(e) =>
//             setHighlightFilters((f: typeof highlightFilters) => ({
//               ...f,
//               category: e.target.value
//             }))
//           }
//           style={{ width: "100%", marginBottom: 8 }}
//         >
//           <option value="all">All Categories</option>

//           {(
//             // Safely compute categories with correct TS narrowing
//             Array.from(
//               new Set(
//                 (currentPdfId ? allHighlights[currentPdfId] ?? [] : [])
//                   .map((h: CommentedHighlight) => h.category as string | undefined)
//                   .filter((cat): cat is string => Boolean(cat))
//               )
//             )
//           ).map((cat: string) => (
//             <option key={cat} value={cat}>
//               {cat}
//             </option>
//           ))}
//         </select> */}
//         {/* === MULTI-SELECT CATEGORY FILTER === */}
//         <div style={{ marginBottom: 12 }}>
//           <h4 style={{ margin: "4px 0" }}>Categories</h4>

//           <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
//             {(
//               Array.from(
//                 new Set(
//                   (currentPdfId ? allHighlights[currentPdfId] ?? [] : [])
//                     .map((h: CommentedHighlight) => h.metadata?.category as string | undefined)
//                     .filter((x): x is string => Boolean(x))
//                 )
//               )
//             ).map((cat: string) => {
//               const active = highlightFilters.categories.includes(cat);

//               return (
//                 <span
//                   key={cat}
//                   onClick={() =>
//                     setHighlightFilters((f: typeof highlightFilters) => {
//                       const selected = new Set(f.categories);
//                       if (active) selected.delete(cat);
//                       else selected.add(cat);
//                       return { ...f, categories: [...selected] };
//                     })
//                   }
//                   style={{
//                     padding: "4px 8px",
//                     borderRadius: 12,
//                     cursor: "pointer",
//                     fontSize: 12,
//                     background: active
//                       ? "rgba(60, 120, 200, 0.8)"   // selected chip colour
//                       : "rgba(220, 220, 220, 0.9)", // unselected
//                     color: active ? "white" : "#333",
//                     border: active ? "1px solid #1e3a8a" : "1px solid #ccc",
//                     userSelect: "none"
//                   }}
//                 >
//                   {cat}
//                 </span>
//               );
//             })}
//           </div>
//         </div>

//         {/* Free text filter */}
//         <input
//           type="text"
//           placeholder="Filter by text / label / comment"
//           value={highlightFilters.text}
//           onChange={(e) =>
//             setHighlightFilters((f: typeof highlightFilters) => ({ ...f, text: e.target.value }))
//           }
//           style={{ width: "100%" }}
//         />
//       </div>
//         )};

//       {/* Redactions */}
//       <div style={{ borderBottom: "1px solid #eee" }}>
//         <div onClick={() => toggleSection("highlights")} className="sidebar-section-header">
//           Redactions {sections.highlights ? "▾" : "▸"}
//         </div>

//         {/* {sections.highlights && (
//           <div className="sidebar-section-content" style={{ maxHeight: "35vh" }}>
//             {!currentPdfId ? (
//               <div style={{ opacity: 0.6 }}>Open a document to see redactions.</div>
//             ) : (
//               <GroupedRedactions
//                 // all={allHighlights[currentPdfId] ?? []}
//                 // active={currentHighlights}
//                 all={currentHighlights}        // filtered
//                 active={currentHighlights}     // filtered active list
//                 onToggleGroup={onToggleGroup}
//                 toggleSingle={toggleHighlightCheckbox}
//                 onApplyAllGroup={onApplyAllGroup}
//                 onRemoveHighlight={onRemoveHighlight}
//                 onRemoveGroup={onRemoveGroup}
//               />
//             )}
//           </div>
//         )} */}
        
//         {sections.highlights && (
//           <div className="sidebar-section-content" style={{ maxHeight: "35vh" }}>
//             {!currentPdfId ? (
//               <div style={{ opacity: 0.6 }}>Open a document to see redactions.</div>
//             ) : (
//               categoryGroups.map((catGroup) => {
//                 const cat = catGroup.category;
//                 const items = catGroup.items;
//                 const color = getHighlightColor({ source: "ai", metadata: { category: cat } } as any);

//                 return (
//                   <div key={cat} style={{ marginBottom: 12 }}>
//                     {/* CATEGORY HEADER */}
//                     <div
//                       onClick={() =>
//                         setExpandedCategories((prev) => ({
//                           ...prev,
//                           [cat]: !prev[cat],
//                         }))
//                       }
//                       style={{
//                         background: color,
//                         color: "white",
//                         padding: "6px 10px",
//                         borderRadius: 4,
//                         cursor: "pointer",
//                         fontWeight: 600,
//                         display: "flex",
//                         justifyContent: "space-between"
//                       }}
//                     >
//                       <span>{cat}</span>
//                       <span>{expandedCategories[cat] ? "▾" : "▸"}</span>
//                     </div>

//                     {/* INNER GROUPS */}
//                     {expandedCategories[cat] && (
//                       <div style={{ paddingLeft: 6 }}>
//                         <GroupedRedactions
//                           all={items}
//                           active={active.filter(h => h.metadata?.category === cat)}
//                           onToggleGroup={onToggleGroup}
//                           toggleSingle={toggleSingle}
//                           onApplyAllGroup={onApplyAllGroup}
//                           onRemoveHighlight={onRemoveHighlight}
//                           onRemoveGroup={onRemoveGroup}
//                         />
//                       </div>
//                     )}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         )}
//       </div>

//       {/* Reset (active only) */}
//       {currentHighlights.length > 0 && (
//         <div style={{ padding: ".5rem" }}>
//           <button onClick={resetHighlights} className="sidebar__reset">
//             Reset redactions
//           </button>
//         </div>
//       )}

//       {/* Delete ALL + Clear History (Fluent UI Dialog) */}
//       <div style={{ padding: ".5rem", marginTop: currentHighlights.length > 0 ? "-0.5rem" : 0 }}>
//         <button
//           onClick={() => setConfirmResetAllOpen(true)}
//           className="sidebar__clear"
//           style={{
//             // backgroundColor: "#b30000",
//             // color: "white",
//             // border: "1px solid #800000",
//             marginTop: "6px",
//           }}
//         >
//           Delete All Redactions & Clear History
//         </button>
//       </div>

//       {/*Fluent UI Dialog box for removing Documents */}
//       <Dialog
//       hidden={!confirmDeleteOpen}
//       onDismiss={closeDeleteDialog}
//       dialogContentProps={{
//           type: DialogType.normal,
//           title: `Delete this document?`,
//           subText: pendingDoc
//           ? `This will permanently delete "${pendingDoc.name}" and all associated redactions from the app.`
//           : "",
//       }}
//       modalProps={{ isBlocking: true }}
//       >
//       <DialogFooter>
//           <PrimaryButton onClick={confirmDeleteDocument} text="Delete document" />
//           <DefaultButton onClick={closeDeleteDialog} text="Cancel" />
//       </DialogFooter>
//       </Dialog>

//       {/* Fluent UI v8 Dialog for full reset */}
//       <Dialog
//         hidden={!confirmResetAllOpen}
//         onDismiss={() => setConfirmResetAllOpen(false)}
//         dialogContentProps={{
//           type: DialogType.normal,
//           title: "Delete All Redactions?",
//           closeButtonAriaLabel: "Close",
//           subText:
//             "This will permanently delete all redactions for this document and clear the entire undo/redo history. This action cannot be undone.",
//         }}
//         modalProps={{
//           isBlocking: true,
//         }}
//       >
//         <DialogFooter>
//           <PrimaryButton
//             onClick={() => {
//               resetEverything();
//               setConfirmResetAllOpen(false);
//             }}
//             text="Delete everything"
//           />
//           <DefaultButton onClick={() => setConfirmResetAllOpen(false)} text="Cancel" />
//         </DialogFooter>
//       </Dialog>

//       {/* Fluent UI v8 Dialog for document level de-duplication */}
//       <Dialog
//         hidden={!duplicateDialogOpen}
//         onDismiss={() => setDuplicateDialogOpen(false)}
//         dialogContentProps={{
//           type: DialogType.normal,
//           title: "Duplicate Documents Detected",
//           subText:
//             duplicateGroups.length === 0
//               ? "No duplicate documents were found."
//               : "These documents have identical file content:"
//         }}
//         modalProps={{ isBlocking: false }}
//       >
//         {duplicateGroups.map((group, idx) => (
//           <div key={idx} style={{ marginBottom: 16 }}>
//             <h4>Duplicate Set {idx + 1}</h4>

//             {group.map(doc => (
//               <div
//                 key={doc.id}
//                 style={{
//                   display: "flex",
//                   alignItems: "center",
//                   justifyContent: "space-between",
//                   padding: "4px 0"
//                 }}
//               >
//                 <span>{doc.name}</span>

//                 <DefaultButton
//                   text="Delete"
//                   iconProps={{ iconName: "Delete" }}
//                   styles={{ root: { padding: "0 8px", background: "#fde7e9" } }}
//                   onClick={() => removePdf(doc.id)}
//                 />
//               </div>
//             ))}

//             <hr style={{ marginTop: 8 }} />
//           </div>
//         ))}

//         <DialogFooter>
//           <PrimaryButton text="Close" onClick={() => setDuplicateDialogOpen(false)} />
//         </DialogFooter>
//       </Dialog>

//       <Dialog
//         hidden={!duplicateDialogOpen}
//         onDismiss={() => setDuplicateDialogOpen(false)}
//         dialogContentProps={{
//           type: DialogType.normal,
//           title: "Duplicate Documents",
//           subText:
//             duplicateGroups.length === 0
//               ? "No duplicates found."
//               : "Choose the canonical document in each set, or remove duplicates."
//         }}
//         modalProps={{ isBlocking: false }}
//       >
//         <div>
//           {duplicateGroups.length === 0 ? (
//             <div style={{ opacity: 0.7 }}>No duplicates detected.</div>
//           ) : (
//             duplicateGroups.map((group, i) => {
//               const canonicalId = selectedCanonical[i] ?? group[0].id;
//               return (
//                 <div key={i} style={{ marginBottom: 18 }}>
//                   <h4 style={{ marginBottom: 8 }}>Duplicate Set {i + 1}</h4>

//                   {group.map((doc) => {
//                     const isCanonical = doc.id === canonicalId;
//                     return (
//                       <label
//                         key={doc.id}
//                         style={{
//                           display: "flex",
//                           alignItems: "center",
//                           gap: 10,
//                           padding: "6px 8px",
//                           border: "1px solid #eee",
//                           borderRadius: 4,
//                           marginBottom: 6,
//                           background: isCanonical ? "#e6f4ff" : "transparent"
//                         }}
//                         onClick={(e) => e.stopPropagation()}
//                         title={doc.name}
//                       >
//                         <input
//                           type="radio"
//                           name={`canonical-${i}`}
//                           checked={isCanonical}
//                           onChange={() => chooseCanonical(i, doc.id)}
//                         />
//                         <span style={{ flex: 1 }}>
//                           {doc.name}
//                           {isCanonical && <span style={{ marginLeft: 6, opacity: 0.7 }}>(Canonical)</span>}
//                         </span>

//                         <DefaultButton
//                           text="Delete"
//                           iconProps={{ iconName: "Delete" }}
//                           styles={{ root: { minWidth: 80, padding: "0 8px", background: "#fde7e9" } }}
//                           onClick={async (e) => {
//                             e.preventDefault();
//                             e.stopPropagation();
//                             await removeOneFromGroup(doc.id);
//                           }}
//                         />
//                       </label>
//                     );
//                   })}

//                   {group.length > 1 && (
//                     <PrimaryButton
//                       text="Remove All Except Canonical"
//                       iconProps={{ iconName: "Delete" }}
//                       style={{ marginTop: 8 }}
//                       onClick={async () => {
//                         await removeAllExceptCanonical(group, i);
//                       }}
//                     />
//                   )}

//                   <hr style={{ marginTop: 12 }} />
//                 </div>
//               );
//             })
//           )}
//         </div>

//         <DialogFooter>
//           <PrimaryButton text="Close" onClick={() => setDuplicateDialogOpen(false)} />
//         </DialogFooter>
//       </Dialog>
//     </div>
//   );
// };

// export default Sidebar;

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
  // ITooltipHostStyles,
} from "@fluentui/react";

import { CommentedHighlight } from "./types";
import { getHighlightColor } from "./helpers/color";

// import { useNavigate } from "react-router-dom";

// /* =========================
//    Props
// ========================= */

interface SidebarProps {
  uploadedPdfs: Array<{ id: string; name: string; url: string }>;
  currentPdfId: string | null;
  setCurrentPdfId: (id: string) => void;

  allHighlights: Record<string, Array<CommentedHighlight>>;
  currentHighlights: Array<CommentedHighlight>;
  toggleHighlightCheckbox: (highlight: CommentedHighlight, checked: boolean) => void;

  highlightFilters: {
    source: string;
    categories: string[];
    text: string;
  };
  setHighlightFilters: (f: any) => void;

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

const getDisplayLabel = (h: CommentedHighlight): string => {
  const t = h.content?.text?.trim();
  if (t && t.length > 0) return t;
  const pg = h.position?.boundingRect?.pageNumber;
  return `(No text)${pg ? ` — Page ${pg}` : ""}`;
};

// const sidebarButtonStyles = {
//   compactPrimary: { root: { height: 28, padding: "0 8px" } },
//   compactAction: { root: { height: 28, padding: "0 6px", minWidth: 0 } },
//   compactIcon: {
//     root: { height: 28, width: 28, padding: 0 },
//     rootHovered: { background: "rgba(0,0,0,0.04)" },
//     rootPressed: { background: "rgba(0,0,0,0.08)" },
//   },
//   dangerIcon: {
//     root: { color: "#a80000" },
//     rootHovered: { background: "rgba(168,0,0,0.08)" },
//     rootPressed: { background: "rgba(168,0,0,0.16)" },
//   },
// };

/* ============================================================
   GroupedRedactions — Corrected Version (Text-Only Grouping)
   ------------------------------------------------------------
   • Receives ALL items for a single category via `all`
   • Receives ACTIVE items for that category via `active`
   • Performs TEXT grouping ONLY (no category logic)
   • Stable object identity → no deletion bugs
   • Checkbox toggles only activate/deactivate (does NOT delete)
   • Sidebar handles category grouping + header colours
============================================================ */

export interface GroupedRedactionsProps {
  all: CommentedHighlight[];                       // all items for this category
  active: CommentedHighlight[];                    // active (checked) items for this category
  onToggleGroup: (items: CommentedHighlight[], checked: boolean) => void;
  toggleSingle: (item: CommentedHighlight, checked: boolean) => void;
  onApplyAllGroup: (items: CommentedHighlight[]) => void;
  onRemoveHighlight: (item: CommentedHighlight) => void;
  onRemoveGroup: (items: CommentedHighlight[]) => void;
}

type TextGroup = {
  key: string;
  label: string;
  items: CommentedHighlight[];
};

export const GroupedRedactions: React.FC<GroupedRedactionsProps> = ({
  all,
  active,
  onToggleGroup,
  toggleSingle,
  onApplyAllGroup,
  onRemoveHighlight,
  onRemoveGroup,
}) => {

  /* ----------------------------------------------------------
     1) Text-only grouping (A2 robust: unique per category)
     ---------------------------------------------------------- */
  const textGroups: TextGroup[] = React.useMemo(() => {
    const map = new Map<string, TextGroup>();

    for (const h of all) {
      const raw = h.content?.text ?? "";
      const key = normalizeText(raw) || "__no_text__";
      const label = getDisplayLabel(h);

      if (!map.has(key)) {
        map.set(key, { key, label, items: [] });
      }
      map.get(key)!.items.push(h);
    }

    return [...map.values()];
  }, [all]);

  if (textGroups.length === 0) {
    return <div style={{ opacity: 0.6 }}>No redactions yet.</div>;
  }

  /* ----------------------------------------------------------
     2) Active state and group expansion
     ---------------------------------------------------------- */
  const activeSet = new Set(active.map((h) => h.id));

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  /* ----------------------------------------------------------
     3) Keyboard navigation (unchanged)
     ---------------------------------------------------------- */
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (focusedIndex >= textGroups.length) {
      setFocusedIndex(Math.max(0, textGroups.length - 1));
    }
  }, [focusedIndex, textGroups.length]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (textGroups.length === 0) return;

      const key = e.key;
      const group = textGroups[focusedIndex];

      if (key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((i) => Math.min(i + 1, textGroups.length - 1));
      }

      if (key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((i) => Math.max(i - 1, 0));
      }

      if (key === "Enter") {
        e.preventDefault();
        const shouldCheck = group.items.some((h) => !activeSet.has(h.id));
        onToggleGroup(group.items, shouldCheck);
      }

      if (e.ctrlKey && key.toLowerCase() === "o") {
        e.preventDefault();
        toggleExpand(group.key);
      }

      if (e.ctrlKey && key.toLowerCase() === "e") {
        e.preventDefault();
        const expandedAll: Record<string, boolean> = {};
        textGroups.forEach((g) => (expandedAll[g.key] = true));
        setExpanded(expandedAll);
      }

      if (e.ctrlKey && key.toLowerCase() === "c") {
        e.preventDefault();
        const collapsed: Record<string, boolean> = {};
        textGroups.forEach((g) => (collapsed[g.key] = false));
        setExpanded(collapsed);
      }
    },
    [focusedIndex, textGroups, activeSet, onToggleGroup]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  /* ----------------------------------------------------------
     4) Delete group confirmation dialog
     ---------------------------------------------------------- */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingGroup, setPendingGroup] = useState<TextGroup | null>(null);

  const openConfirm = (g: TextGroup) => {
    setPendingGroup(g);
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setPendingGroup(null);
  };

  const confirmDelete = () => {
    if (pendingGroup) {
      onRemoveGroup(pendingGroup.items);
    }
    closeConfirm();
  };

  /* ----------------------------------------------------------
     5) Render
     ---------------------------------------------------------- */

  return (
    <div>
      {textGroups.map((group, idx) => {
        const focused = idx === focusedIndex;

        const total = group.items.length;
        const activeCount = group.items.filter((h) => activeSet.has(h.id))
          .length;

        const isChecked = total > 0 && activeCount === total;
        const isIndeterminate = activeCount > 0 && activeCount < total;

        const checkboxId = `txtgrp-${group.key}`;

        return (
          <div
            key={group.key}
            style={{
              borderRadius: 4,
              padding: focused ? "4px" : 0,
              background: focused ? "rgba(0, 120, 212, 0.15)" : "transparent",
            }}
          >
            {/* ───────────────────────────────────────────────
                GROUP HEADER
               ─────────────────────────────────────────────── */}
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
              {/* Group checkbox */}
              <input
                id={checkboxId}
                type="checkbox"
                checked={isChecked}
                aria-checked={isIndeterminate ? "mixed" : isChecked}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onToggleGroup(group.items, e.target.checked)}
              />

              <label
                htmlFor={checkboxId}
                onClick={(e) => e.stopPropagation()}
                style={{ cursor: "pointer", userSelect: "none" }}
              />

              {/* Expand/collapse */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleExpand(group.key);
                }}
                className="sidebar-disclosure"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  width: 18,
                }}
                aria-expanded={!!expanded[group.key]}
              >
                {expanded[group.key] ? "▾" : "▸"}
              </button>

              {/* Text label */}
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
                <span style={{ fontSize: 11, opacity: 0.7 }}>×{total}</span>
              )}

              <span style={{ flex: 1 }} />

              {/* Apply to all */}
              <ActionButton
                iconProps={{ iconName: "CheckMark" }}
                styles={{ root: { height: 26, padding: "0 6px" } }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onApplyAllGroup(group.items);
                }}
              >
                Apply To All
              </ActionButton>

              {/* Remove whole group */}
              <TooltipHost content="Remove this group">
                <IconButton
                  iconProps={{ iconName: "Delete" }}
                  styles={{ root: { height: 26, width: 26 } }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openConfirm(group);
                  }}
                />
              </TooltipHost>
            </div>

            {/* ───────────────────────────────────────────────
                ITEMS
               ─────────────────────────────────────────────── */}
            {expanded[group.key] && (
              <div style={{ paddingLeft: 28, marginTop: 2 }}>
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          toggleSingle(item, e.target.checked)
                        }
                      />

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flex: 1,
                        }}
                      >
                        <span style={{ fontSize: 12 }}>
                          Redaction {i + 1} — Page{" "}
                          {item.position.boundingRect.pageNumber}
                        </span>

                        <TooltipHost content="Remove this redaction">
                          <IconButton
                            iconProps={{ iconName: "Delete" }}
                            styles={{ root: { height: 26, width: 26 } }}
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

      {/* ───────────────────────────────────────────────
          DELETE GROUP DIALOG
         ─────────────────────────────────────────────── */}
      <Dialog
        hidden={!confirmOpen}
        onDismiss={closeConfirm}
        dialogContentProps={{
          type: DialogType.normal,
          title: "Remove all redactions in this group?",
          subText: pendingGroup
            ? `This will permanently remove ${pendingGroup.items.length} redaction(s) for “${pendingGroup.label}”.`
            : undefined,
        }}
      >
        <DialogFooter>
          <PrimaryButton onClick={confirmDelete} text="Remove Group" />
          <DefaultButton onClick={closeConfirm} text="Cancel" />
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

  highlightFilters,
  setHighlightFilters,

  highlights,
  resetHighlights,
  resetEverything,
  toggleDocument,
  
  onStartRedaction,
  isRedacting,
  redactionStatus,
}) => {

  // const navigate = useNavigate();

  /* =========================
     LOCAL UI STATE
  ========================== */

  const [sections, setSections] = useState({
    documents: true,
    // filters: true,
    highlights: true,
  });

  /* Duplicate‑document dialog state */
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<
    Array<Array<{ id: string; name: string }>>
  >([]);

  const [selectedCanonical, setSelectedCanonical] = useState<
    Record<number, string>
  >({});

  const chooseCanonical = (groupIndex: number, docId: string) => {
    setSelectedCanonical((prev) => ({ ...prev, [groupIndex]: docId }));
  };

  const refreshDuplicateGroups = async () => {
    const groups = await onFindDuplicates();
    setDuplicateGroups(groups);

    // Preserve previously chosen canonicals
    setSelectedCanonical((prev) => {
      const next: Record<number, string> = {};
      groups.forEach((grp, i) => {
        const keep =
          prev[i] && grp.some((d) => d.id === prev[i]) ? prev[i] : grp[0]?.id;
        if (keep) next[i] = keep;
      });
      return next;
    });
  };

  const removeAllExceptCanonical = async (
    group: Array<{ id: string; name: string }>,
    groupIndex: number
  ) => {
    if (!group || group.length <= 1) return;

    const keepId = selectedCanonical[groupIndex] ?? group[0].id;
    const toRemove = group.filter((d) => d.id !== keepId);

    for (const d of toRemove) {
      await removePdf(d.id);
    }

    await refreshDuplicateGroups();
  };

  const removeOneFromGroup = async (docId: string) => {
    await removePdf(docId);
    await refreshDuplicateGroups();
  };

  /* Delete single document dialog */
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [pendingDoc, setPendingDoc] = useState<{ id: string; name: string } | null>(null);

  const openDeleteDialog = (doc: { id: string; name: string }) => {
    setPendingDoc(doc);
    setConfirmDeleteOpen(true);
  };

  const closeDeleteDialog = () => {
    setPendingDoc(null);
    setConfirmDeleteOpen(false);
  };

  const confirmDeleteDocument = () => {
    if (pendingDoc) removePdf(pendingDoc.id);
    closeDeleteDialog();
  };

  /* Delete ALL redactions + history dialog */
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);


  /* ============================================
     CATEGORY GROUPING (Sidebar‑level A2 grouping)
     ============================================ */

  const allForCurrent: CommentedHighlight[] =
    currentPdfId ? allHighlights[currentPdfId] ?? [] : [];

  const categoryGroups = React.useMemo(() => {
    const categoryMap = new Map<string, CommentedHighlight[]>();

    for (const h of allForCurrent) {
      // const cat = h.metadata?.category ?? "Uncategorised";
      const cat = h.category ?? "Uncategorised";
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(h);
    }

    // alphabetical sorting (user requirement)
    const sortedCategories = [...categoryMap.keys()].sort((a, b) =>
      a.localeCompare(b)
    );

    return sortedCategories.map((category) => ({
      category,
      items: categoryMap.get(category)!,
    }));
  }, [allForCurrent]);

  // track expanded state for category headers
  const [expandedCategories, setExpandedCategories] = useState<
    Record<string, boolean>
  >({});


  /* =========================
     Section Collapse Toggle
  ========================== */

  const toggleSection = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="sidebar" style={{ width: "25vw", maxWidth: "500px" }}>

      {/* Add some padding at top of sidebar to leave room for Home icon/nav*/}
      <div
        className="sidebar"
        style={{
          width: "25vw",
          maxWidth: "500px",
          paddingTop: "30px"  
        }}
      ></div>
      {/* Header */}
      {/* <div className="description" style={{ padding: "1rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Somerset Council Redaction Tool</h2>
        <p style={{ fontSize: "0.7rem" }}>
          https://github.com/drpollylang/contextual-redactor-application
        </p>
      </div> */}
    
    {/* // <div className="description" style={{
    //   padding: "1rem",
    //   display: "flex",
    //   alignItems: "center",
    //   gap: "8px"
    // }}> */}

      {/* Home button
      <DefaultButton
        text="Home"
        iconProps={{ iconName: "Home" }}
        onClick={() => navigate("/")}
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 5000
        }}
      /> */}

      {/* Info */}
       {/*
         <h2 style={{ margin: 0, fontSize: "1.2rem" }}>
           Somerset Council Redaction Tool
         </h2>
         <p style={{ fontSize: "0.65rem", margin: 0 }}>
           github.com/drpollylang/contextual-redactor-application
         </p>
       </div> */}

      {/* Upload */}
      {/* <div
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
      </div> */}

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

      {/* === FILTERS === */}
      {/* <div onClick={() => toggleSection("filters")} className="sidebar-section-header">
        Filter Redactions {sections.filters ? "▾" : "▸"}
      </div> */}

      {/* {sections.filters && (
        <div className="sidebar-section-content" style={{ maxHeight: "25vh" }}>
          <select
            value={highlightFilters.source}
            onChange={(e) =>
              setHighlightFilters((f: typeof highlightFilters) => ({
                ...f,
                source: e.target.value,
              }))
            }
            style={{ width: "100%", marginBottom: 8 }}
          >
            <option value="all">All Sources</option>
            <option value="manual">Manual Only</option>
            <option value="ai">AI Only</option>
          </select> */}

          {/* === MULTI-SELECT CATEGORY FILTER === */}
          {/* <div style={{ marginBottom: 12 }}>
            <h4 style={{ margin: "4px 0" }}>Categories</h4>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(
                Array.from(
                  new Set(
                    (currentPdfId ? allHighlights[currentPdfId] ?? [] : [])
                      .map((h: CommentedHighlight) => h.category as string | undefined)
                      .filter((x): x is string => Boolean(x))
                  )
                )
              ).map((cat: string) => {
                // const active = highlightFilters.categories.includes(cat);
                const allSelected = (highlightFilters.categories.length ?? 0) === 0;
                // const active = allSelected || highlightFilters.categories.includes(cat);
                const isActive = allSelected || highlightFilters.categories.includes(cat);

                return (
                  <span
                    key={cat}
                    onClick={() =>
                      setHighlightFilters((f: typeof highlightFilters) => {
                    //     const selected = new Set(f.categories);
                    //     if (active) selected.delete(cat);
                    //     else selected.add(cat);
                    //     return { ...f, categories: [...selected] };
                    //   })
                    // } 
                      const set = new Set(f.categories);
                        if (isActive && !allSelected) {
                          set.delete(cat);
                        } else {
                          set.add(cat);
                        }
                        return { ...f, categories: [...set] };
                      })
                    }
                    style={{
                      padding: "4px 8px",
                      borderRadius: 12,
                      cursor: "pointer",
                      fontSize: 12,
                      background: isActive
                        ? "rgba(60, 120, 200, 0.8)"       // selected chip colour
                        : "rgba(220, 220, 220, 0.9)",     // unselected chip
                      // color: active ? "white" : "#333",
                      // border: active ? "1px solid #1e3a8a" : "1px solid #ccc",
                      // userSelect: "none",
                      color: isActive ? "white" : "#333",
                      border: isActive ? "1px solid #1e3a8a" : "1px solid #ccc",
                      userSelect: "none",
                    }}
                  >
                    {cat}
                  </span>
                );
              })}
            </div>
          </div> */}

          {/* TEXT SEARCH FILTER */}
          {/* <input
            type="text"
            placeholder="Filter by text / label / comment"
            value={highlightFilters.text}
            onChange={(e) =>
              setHighlightFilters((f: typeof highlightFilters) => ({
                ...f,
                text: e.target.value,
              }))
            }
            style={{ width: "100%" }}
          />
        </div>
      )} */}

      {/* =========================
          Redactions Section
          ========================= */}
      <div style={{ borderBottom: "1px solid #eee" }}>
        <div
          onClick={() => toggleSection("highlights")}
          className="sidebar-section-header"
        >
          Redactions {sections.highlights ? "▾" : "▸"}
        </div>

        {/* {sections.highlights && (
          <div className="sidebar-section-content" style={{ maxHeight: "35vh" }}>
            {!currentPdfId ? (
              <div style={{ opacity: 0.6 }}>Open a document to see redactions.</div>
            ) : (
              categoryGroups.map(({ category, items }) => {
                // Colour for the category header
                const color = getHighlightColor({
                  source: "ai",
                  metadata: { category },
                } as any);

                // Filter active list (already filtered at App level)
                const activeInCategory = currentHighlights.filter(
                  (h) => h.category === category
                );

                return (
                  <div key={category} style={{ marginBottom: 12 }}>
                    {/* CATEGORY HEADER */}
                    {/* <div
                      onClick={() =>
                        setExpandedCategories((prev) => ({
                          ...prev,
                          [category]: !prev[category],
                        }))
                      }
                      style={{
                        background: color,
                        color: "white",
                        padding: "6px 10px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontWeight: 600,
                        display: "flex",
                        justifyContent: "space-between",
                        userSelect: "none",
                      }}
                    >
                      <span>{category}</span>
                      <span>{expandedCategories[category] ? "▾" : "▸"}</span>
                    </div> */}

                    {/* TEXT GROUPS + ITEMS */}
                    {/* {expandedCategories[category] && (
                      <div style={{ paddingLeft: 6 }}>
                        <GroupedRedactions
                          all={activeInCategory}                     // category's items (filtered by viewer)
                          active={activeInCategory}      // only those active for this category
                          onToggleGroup={onToggleGroup}
                          toggleSingle={toggleHighlightCheckbox}
                          onApplyAllGroup={onApplyAllGroup}
                          onRemoveHighlight={onRemoveHighlight}
                          onRemoveGroup={onRemoveGroup}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div> */}
      {sections.highlights && (
        <div className="sidebar-section-content" style={{ maxHeight: "35vh" }}>
          {!currentPdfId ? (
            <div style={{ opacity: 0.6 }}>Open a document to see redactions.</div>
          ) : (
            categoryGroups.map(({ category }) => {
              // ALL items for this category (unchecked + checked)
              const itemsInCategoryAll =
                (currentPdfId ? allHighlights[currentPdfId] ?? [] : []).filter(
                  (h: CommentedHighlight) => h.category === category
                );

              // ACTIVE (checked) items in this category (already filtered at App level)
              const activeInCategory = currentHighlights.filter(
                (h) => h.category === category
              );

              // Header colour: take the colour from a real item in the category
              const sample = itemsInCategoryAll[0] ?? activeInCategory[0] ?? null;
              const color = sample ? getHighlightColor(sample) : "#7e57c2"; // fallback

              return (
                <div key={category} style={{ marginBottom: 12 }}>
                  {/* CATEGORY HEADER */}
                  <div
                    onClick={() =>
                      setExpandedCategories((prev) => ({
                        ...prev,
                        [category]: !prev[category],
                      }))
                    }
                    style={{
                      background: color,
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontWeight: 600,
                      display: "flex",
                      justifyContent: "space-between",
                      userSelect: "none",
                    }}
                  >
                    <span>{category}</span>
                    <span>{expandedCategories[category] ? "▾" : "▸"}</span>
                  </div>

                  {/* TEXT GROUPS + ITEMS */}
                  {expandedCategories[category] && (
                    <div style={{ paddingLeft: 6 }}>
                      <GroupedRedactions
                        all={itemsInCategoryAll}            // ⬅ all items (master)
                        active={activeInCategory}           // ⬅ only checked items
                        onToggleGroup={onToggleGroup}
                        toggleSingle={toggleHighlightCheckbox}
                        onApplyAllGroup={onApplyAllGroup}
                        onRemoveHighlight={onRemoveHighlight}
                        onRemoveGroup={onRemoveGroup}
                      />
                    </div>
                  )}
                </div>
              );
            })
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