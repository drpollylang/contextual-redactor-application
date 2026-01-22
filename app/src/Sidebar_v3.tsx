
// import React, { useEffect, useState, useCallback } from "react";
// import type { Highlight } from "./react-pdf-highlighter-extended";
// import "./style/Sidebar.css";
// import { CommentedHighlight } from "./types";
// import { DefaultButton, IconButton } from "@fluentui/react";

// interface SidebarProps {
//   uploadedPdfs: Array<{ id: string; name: string; url: string }>;
//   currentPdfId: string | null;
//   setCurrentPdfId: (id: string) => void;
//   allHighlights: Record<string, Array<CommentedHighlight>>;
//   currentHighlights: Array<CommentedHighlight>;
//   toggleHighlightCheckbox: (
//     highlight: CommentedHighlight,
//     checked: boolean
//   ) => void;
//   handlePdfUpload: (file: File) => void;
//   onApplyAllGroup: (items: CommentedHighlight[], /*checked=*/) => void;

//   // Legacy
//   highlights: Array<CommentedHighlight>;
//   resetHighlights: () => void;
//   toggleDocument: () => void;
// }

// declare const APP_VERSION: string;

// // Normalize text to group redactions
// const normalizeText = (s: string | undefined | null) =>
//   (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

// // Label for each redaction group
// const getDisplayLabel = (h: CommentedHighlight) => {
//   const t = h.content?.text?.trim();
//   if (t && t.length > 0) return t;
//   const pg = h.position?.boundingRect?.pageNumber;
//   return `(No text)${pg ? ` — Page ${pg}` : ""}`;
// };

// /* ========================================================================
//    Grouped Redactions Component
//    ======================================================================== */

// interface Group {
//   key: string;
//   label: string;
//   items: CommentedHighlight[];
// }

// interface GroupedRedactionsProps {
//   all: CommentedHighlight[];
//   active: CommentedHighlight[];
//   onToggleGroup: (items: CommentedHighlight[], checked: boolean) => void;
//   toggleSingle: (highlight: CommentedHighlight, checked: boolean) => void;
//   onApplyAllGroup: (items: CommentedHighlight[]) => void;
// }

// const GroupedRedactions: React.FC<GroupedRedactionsProps> = ({
//   all,
//   active,
//   onToggleGroup,
//   toggleSingle,
// }) => {
//   const groups: Group[] = React.useMemo(() => {
//     const map = new Map<string, Group>();
//     for (const h of all) {
//       const raw = h.content?.text ?? "";
//       const key = normalizeText(raw) || "__no_text__";
//       const label = getDisplayLabel(h);

//       if (!map.has(key)) {
//         map.set(key, { key, label, items: [h] });
//       } else {
//         map.get(key)!.items.push(h);
//       }
//     }
//     return [...map.values()];
//   }, [all]);

//   const activeSet = React.useMemo(() => new Set(active.map((h) => h.id)), [active]);

//   // expanded groups
//   const [expanded, setExpanded] = useState<Record<string, boolean>>({});

//   const toggleExpand = (key: string) =>
//     setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

//   /* ---------------- Keyboard Navigation ---------------- */

//   const [focusedGroupIndex, setFocusedGroupIndex] = useState(0);

//   useEffect(() => {
//     if (groups.length === 0) return;
//     if (focusedGroupIndex >= groups.length)
//       setFocusedGroupIndex(groups.length - 1);
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
//         // Toggle entire group
//         onToggleGroup(
//           group.items,
//           group.items.some((item) => !activeSet.has(item.id))
//         );
//       }

//       if (key.toLowerCase() === "o") {
//         e.preventDefault();
//         toggleExpand(group.key);
//       }

//       // Expand/collapse all
//       if (key.toLowerCase() === "e") {
//         e.preventDefault();
//         const next = groups.reduce((acc, g) => ({ ...acc, [g.key]: true }), {});
//         setExpanded(next);
//       }
//       if (key.toLowerCase() === "c") {
//         e.preventDefault();
//         const next = groups.reduce((acc, g) => ({ ...acc, [g.key]: false }), {});
//         setExpanded(next);
//       }
//     },
//     [groups, activeSet, focusedGroupIndex, onToggleGroup]
//   );

//   useEffect(() => {
//     window.addEventListener("keydown", handleKey);
//     return () => window.removeEventListener("keydown", handleKey);
//   }, [handleKey]);

//   /* ---------------- Render ---------------- */

//   if (groups.length === 0)
//     return <div style={{ opacity: 0.6 }}>No redactions yet.</div>;

//   return (
//     <div>
//       {groups.map((group, index) => {
//         const total = group.items.length;
//         const activeCount = group.items.filter((h) => activeSet.has(h.id)).length;

//         const isChecked = activeCount === total && total > 0;
//         const isIndeterminate = activeCount > 0 && activeCount < total;

//         const setCheckboxRef = (el: HTMLInputElement | null) => {
//           if (el) el.indeterminate = isIndeterminate;
//         };

//         const focused = index === focusedGroupIndex;

//         return (
//           <div
//             key={group.key}
//             style={{
//               borderRadius: 4,
//               padding: focused ? "4px" : 0,
//               background: focused ? "rgba(0, 120, 212, 0.15)" : "transparent",
//             }}
//           >
//             {/* GROUP HEADER */}
//             <label className="sidebar-highlight-item" title={group.label}>
//               <input
//                 ref={setCheckboxRef}
//                 type="checkbox"
//                 checked={isChecked}
//                 onChange={(e) => onToggleGroup(group.items, e.target.checked)}
//               />

//               <div
//                 style={{ display: "flex", flexDirection: "column", cursor: "pointer" }}
//                 onClick={() => toggleExpand(group.key)}
//               >
//                 <span className="sidebar-highlight-text">
//                   {expanded[group.key] ? "▾ " : "▸ "}
//                   {group.label}
//                 </span>
//                 {total > 1 && (
//                   <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 16 }}>
//                     ×{total}
//                   </span>
//                 )}
                
//                 {/* In the group header area, near the label */}
//                 <button
//                 className="ApplyAllBtn"
//                 title="Apply to all instances of this text"
//                 onClick={(e) => {
//                     e.preventDefault();
//                     e.stopPropagation();
//                     onApplyAllGroup(group.items);
//                 }}
//                 >
//                 Apply all
//                 </button>

//               </div>
//             </label>

//             {/* EXPANDED INSTANCES */}
//             {expanded[group.key] && (
//               <div style={{ marginLeft: 28, marginTop: 2 }}>
//                 {group.items.map((item, i) => {
//                   const checked = activeSet.has(item.id);
//                   return (
//                     <label
//                       key={item.id}
//                       className="sidebar-highlight-item"
//                       style={{ padding: "2px 0" }}
//                     >
//                       <input
//                         type="checkbox"
//                         checked={checked}
//                         onChange={(e) => toggleSingle(item, e.target.checked)}
//                       />
//                       <span style={{ fontSize: 12 }}>
//                         Redaction {i + 1} — Page {item.position.boundingRect.pageNumber}
//                       </span>
//                     <button
//                     className="ApplyAllBtn"
//                     title="Apply this redaction to all other instances of this text"
//                     onClick={(e) => {
//                         e.preventDefault();
//                         e.stopPropagation();
//                         onApplyAllGroup(group.items);
//                     }}
//                     >
//                     Apply all
//                     </button>
//                     </label>
//                   );
//                 })}
//               </div>
//             )}
//           </div>
//         );
//       })}
//     </div>
//   );
// };

// /* ========================================================================
//    Info Popup Component (Modal)
//    ======================================================================== */

// const ShortcutInfoModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
//   <div
//     style={{
//       position: "fixed",
//       top: 0,
//       left: 0,
//       width: "100vw",
//       height: "100vh",
//       background: "rgba(0,0,0,0.35)",
//       display: "flex",
//       alignItems: "center",
//       justifyContent: "center",
//       zIndex: 9999,
//     }}
//     onClick={onClose}
//   >
//     <div
//       style={{
//         background: "#fff",
//         padding: "20px",
//         borderRadius: 8,
//         width: 380,
//         maxHeight: "80vh",
//         overflow: "auto",
//         boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
//       }}
//       onClick={(e) => e.stopPropagation()}
//     >
//       <h2 style={{ marginTop: 0 }}>Keyboard Shortcuts</h2>

//       <ul style={{ fontSize: 14, lineHeight: 1.6 }}>
//         <li><strong>↑ / ↓</strong> — Move between redaction groups</li>
//         <li><strong>Space / Enter</strong> — Toggle selected group</li>
//         <li><strong>O</strong> — Expand/collapse selected group</li>
//         <li><strong>E</strong> — Expand all groups</li>
//         <li><strong>C</strong> — Collapse all groups</li>
//       </ul>

//       <div style={{ textAlign: "right", marginTop: 12 }}>
//         <DefaultButton text="Close" onClick={onClose} />
//       </div>
//     </div>
//   </div>
// );

// /* ========================================================================
//    Sidebar Component
//    ======================================================================== */

// const Sidebar: React.FC<SidebarProps> = ({
//   uploadedPdfs,
//   currentPdfId,
//   setCurrentPdfId,
//   allHighlights,
//   currentHighlights,
//   toggleHighlightCheckbox,
//   handlePdfUpload,
//   onApplyAllGroup,  
//   highlights,
//   resetHighlights,
//   toggleDocument,
// }) => {
//   const [sections, setSections] = useState({
//     documents: true,
//     highlights: true,
//   });

//   const [showInfo, setShowInfo] = useState(false);

//   const toggleSection = (key: keyof typeof sections) => {
//     setSections((prev) => ({ ...prev, [key]: !prev[key] }));
//   };

//   // Bulk toggle for group
//   const onToggleGroup = useCallback(
//     (items: CommentedHighlight[], checked: boolean) => {
//       for (const h of items) toggleHighlightCheckbox(h, checked);
//     },
//     [toggleHighlightCheckbox]
//   );

//   return (
//     <div className="sidebar" style={{ width: "25vw", maxWidth: "500px" }}>
//       {/* HEADER */}
//       <div className="description" style={{ padding: "1rem", position: "relative" }}>
//         <h2 style={{ marginBottom: "1rem" }}>
//           react-pdf-highlighter-extended {APP_VERSION}
//         </h2>

//         {/* INFO BUTTON */}
//         {/* <IconButton
//           iconProps={{ iconName: "Info" }}
//           title="Keyboard shortcuts"
//           ariaLabel="Keyboard shortcuts"
//           onClick={() => setShowInfo(true)}
//           style={{
//             position: "absolute",
//             top: 16,
//             right: 16,
//           }}
//         /> */}

//         <p style={{ fontSize: "0.7rem" }}>
//           https://github.com/DanielArnould/react-pdf-highlighter-extended
//         </p>

//         <p>
//           <small>
//             To create a redaction, hold ⌥ Option (Alt), then click and drag.
//           </small>
//         </p>
//       </div>

//       {/* UPLOAD BUTTON */}
//       <div style={{ padding: ".5rem", borderBottom: "1px solid #eee" }}>
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

//       {/* DOCUMENTS SECTION */}
//       <div style={{ borderBottom: "1px solid #eee" }}>
//         <div
//           onClick={() => toggleSection("documents")}
//           className="sidebar-section-header"
//         >
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
//                   <div
//                     key={doc.id}
//                     className={`sidebar-document${active ? " active" : ""}`}
//                     onClick={() => setCurrentPdfId(doc.id)}
//                   >
//                     {doc.name}
//                   </div>
//                 );
//               })
//             )}
//           </div>
//         )}
//       </div>

//       {/* REDACTIONS SECTION */}
//       <div style={{ borderBottom: "1px solid #eee" }}>
//         <div
//           onClick={() => toggleSection("highlights")}
//           className="sidebar-section-header"
//         >
//           Redactions {sections.highlights ? "▾" : "▸"}
//         </div>

//         {sections.highlights && (
//           <div className="sidebar-section-content" style={{ maxHeight: "35vh" }}>
//             {!currentPdfId ? (
//               <div style={{ opacity: 0.6 }}>Open a document to see redactions.</div>
//             ) : (
//               <GroupedRedactions
//                 all={allHighlights[currentPdfId] ?? []}
//                 active={currentHighlights}
//                 onToggleGroup={onToggleGroup}
//                 toggleSingle={toggleHighlightCheckbox}
//                 onApplyAllGroup={onApplyAllGroup}
//               />
//             )}
//           </div>
//         )}
//       </div>

//       {/* RESET BUTTON */}
//       {currentHighlights.length > 0 && (
//         <div style={{ padding: ".5rem" }}>
//           <button onClick={resetHighlights} className="sidebar__reset">
//             Reset redactions
//           </button>
//         </div>
//       )}

//       {/* INFO POPUP */}
//       {showInfo && <ShortcutInfoModal onClose={() => setShowInfo(false)} />}
//     </div>
//   );
// };

// export default Sidebar;
