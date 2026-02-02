// // -----v1->v2 Side panel has collapsable sections for (i) Documents and (ii) Redactions with a checkbox list of redactions -----
// import React, { MouseEvent, useEffect, useRef, useState } from "react";

// import CommentForm from "./CommentForm";
// import ContextMenu, { ContextMenuProps } from "./ContextMenu";
// import ExpandableTip from "./ExpandableTip";
// import HighlightContainer from "./HighlightContainer";
// import Toolbar from "./Toolbar_v2";

// import {
//   GhostHighlight,
//   Highlight,
//   PdfHighlighter,
//   PdfHighlighterUtils,
//   PdfLoader,
//   Tip,
//   ViewportHighlight,
// } from "./react-pdf-highlighter-extended";

// import Sidebar from "./Sidebar_v2_0";

// import "./style/App.css";
// import { CommentedHighlight } from "./types";

// //
// // ========================
// //       Helpers
// // ========================
// //
// const getNextId = () => String(Math.random()).slice(2);

// const parseIdFromHash = () => {
//   return document.location.hash.slice("#highlight-".length);
// };

// const resetHash = () => {
//   document.location.hash = "";
// };

// //
// // ========================
// //        Types
// // ========================
// //
// type UploadedPdf = {
//   id: string;
//   name: string;
//   url: string; // Blob URL via URL.createObjectURL(file)
// };

// //
// // ========================
// //       Component
// // ========================
// //
// const App: React.FC = () => {
//   //
//   // ===== PDF Document List =====
//   //
//   const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
//   const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);

//   const currentPdf =
//     currentPdfId && uploadedPdfs.length > 0
//       ? uploadedPdfs.find((p) => p.id === currentPdfId) ?? null
//       : null;

//   //
//   // ===== Highlights (active per doc + master list per doc) =====
//   //
//   const [docHighlights, setDocHighlights] = useState<
//     Record<string, Array<CommentedHighlight>>
//   >({});
//   const [allHighlights, setAllHighlights] = useState<
//     Record<string, Array<CommentedHighlight>>
//   >({});

//   const currentHighlights =
//     currentPdfId && docHighlights[currentPdfId]
//       ? docHighlights[currentPdfId]
//       : [];

//   //
//   // ===== UI State =====
//   //
//   const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
//   const [pdfScaleValue, setPdfScaleValue] = useState<number | undefined>(
//     undefined
//   );
//   const [highlightPen, setHighlightPen] = useState<boolean>(false);

//   const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);

//   //
//   // ===== File Upload =====
//   //
//   const handlePdfUpload = (file: File) => {
//     const id = getNextId();

//     const newPdf: UploadedPdf = {
//       id,
//       name: file.name,
//       url: URL.createObjectURL(file),
//     };

//     setUploadedPdfs((prev) => [...prev, newPdf]);
//     setCurrentPdfId(newPdf.id);

//     // Initialize highlight buckets for the new document
//     setDocHighlights((prev) => ({ ...prev, [newPdf.id]: [] }));
//     setAllHighlights((prev) => ({ ...prev, [newPdf.id]: [] }));
//   };

//   //
//   // ===== Cleanup PDF Blob URLs on unmount =====
//   //
//   useEffect(() => {
//     return () => {
//       uploadedPdfs.forEach((p) => {
//         try {
//           URL.revokeObjectURL(p.url);
//         } catch {
//           // no-op
//         }
//       });
//     };
//     // We intentionally do not depend on uploadedPdfs here to avoid revoking in-use URLs
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   //
//   // ===== Close Context Menu on Global Click =====
//   //
//   useEffect(() => {
//     const onClick = () => {
//       if (contextMenu) setContextMenu(null);
//     };
//     document.addEventListener("click", onClick);
//     return () => document.removeEventListener("click", onClick);
//   }, [contextMenu]);

//   const handleContextMenu = (
//     event: MouseEvent<HTMLDivElement>,
//     highlight: ViewportHighlight<CommentedHighlight>
//   ) => {
//     event.preventDefault();

//     setContextMenu({
//       xPos: event.clientX,
//       yPos: event.clientY,
//       deleteHighlight: () => deleteHighlight(highlight),
//       editComment: () => editComment(highlight),
//     });
//   };

//   //
//   // ===== Per-document Highlight Helpers =====
//   //
//   const setCurrentDocHighlights = (
//     updater:
//       | Array<CommentedHighlight>
//       | ((prev: Array<CommentedHighlight>) => Array<CommentedHighlight>)
//   ) => {
//     if (!currentPdfId) return;

//     setDocHighlights((prev) => {
//       const existing = prev[currentPdfId] ?? [];
//       const next =
//         typeof updater === "function" ? (updater as any)(existing) : updater;
//       return { ...prev, [currentPdfId]: next };
//     });
//   };

//   //
//   // ===== Add / Delete / Edit Highlight =====
//   //
//   const addHighlight = (ghost: GhostHighlight, comment: string) => {
//     if (!currentPdfId) return;

//     const newHighlight: CommentedHighlight = {
//       ...ghost,
//       comment,
//       id: getNextId(),
//     };

//     // Add to master list of all highlights for this doc
//     setAllHighlights((prev) => ({
//       ...prev,
//       [currentPdfId]: [...(prev[currentPdfId] ?? []), newHighlight],
//     }));

//     // Also set it active immediately
//     setCurrentDocHighlights((prev) => [newHighlight, ...prev]);
//   };

//   const deleteHighlight = (highlight: ViewportHighlight | Highlight) => {
//     if (!currentPdfId) return;

//     setCurrentDocHighlights((prev) =>
//       prev.filter((h) => h.id !== highlight.id)
//     );
//   };

//   const editHighlight = (id: string, update: Partial<CommentedHighlight>) => {
//     if (!currentPdfId) return;

//     // Update active highlights (if present)
//     setCurrentDocHighlights((prev) =>
//       prev.map((h) => (h.id === id ? { ...h, ...update } : h))
//     );

//     // Update master list (so checkbox list stays in sync)
//     setAllHighlights((prev) => ({
//       ...prev,
//       [currentPdfId]: (prev[currentPdfId] ?? []).map((h) =>
//         h.id === id ? { ...h, ...update } : h
//       ),
//     }));
//   };

//   const resetHighlights = () => {
//     if (!currentPdfId) return;
//     setCurrentDocHighlights([]);
//   };

//   //
//   // ===== Checkbox toggle for showing/hiding highlights =====
//   //
//   const toggleHighlightCheckbox = (
//     highlight: CommentedHighlight,
//     checked: boolean
//   ) => {
//     if (!currentPdfId) return;

//     if (checked) {
//       // Add back if not present
//       if (!currentHighlights.some((h) => h.id === highlight.id)) {
//         setCurrentDocHighlights((prev) => [...prev, highlight]);
//       }
//     } else {
//       // Remove from active
//       setCurrentDocHighlights((prev) =>
//         prev.filter((h) => h.id !== highlight.id)
//       );
//     }
//   };

//   //
//   // ===== Edit Comment Tip =====
//   //
//   const editComment = (highlight: ViewportHighlight<CommentedHighlight>) => {
//     if (!highlighterUtilsRef.current) return;

//     const tip: Tip = {
//       position: highlight.position,
//       content: (
//         <CommentForm
//           placeHolder={highlight.comment}
//           onSubmit={(val) => {
//             editHighlight(highlight.id, { comment: val });
//             highlighterUtilsRef.current!.setTip(null);
//             highlighterUtilsRef.current!.toggleEditInProgress(false);
//           }}
//         />
//       ),
//     };

//     highlighterUtilsRef.current.setTip(tip);
//     highlighterUtilsRef.current.toggleEditInProgress(true);
//   };

//   //
//   // ===== Scroll to Highlight From URL Hash =====
//   //
//   const getHighlightById = (id: string) =>
//     currentHighlights.find((h) => h.id === id);

//   const scrollToHighlightFromHash = () => {
//     const highlight = getHighlightById(parseIdFromHash());
//     if (highlight && highlighterUtilsRef.current) {
//       highlighterUtilsRef.current.scrollToHighlight(highlight);
//     }
//   };

//   useEffect(() => {
//     window.addEventListener("hashchange", scrollToHighlightFromHash);
//     return () =>
//       window.removeEventListener("hashchange", scrollToHighlightFromHash);
//     // Re-run handler when active highlights change (ids may differ)
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [currentHighlights]);

//   //
//   // ========================
//   //         Render
//   // ========================
//   //
//   return (
//     <div className="App" style={{ display: "flex", height: "100vh" }}>
//       {/* ===== SIDEBAR ===== */}
//       <Sidebar
//         // New props for collapsible docs & highlights
//         uploadedPdfs={uploadedPdfs}
//         currentPdfId={currentPdfId}
//         setCurrentPdfId={setCurrentPdfId}
//         allHighlights={allHighlights}
//         currentHighlights={currentHighlights}
//         toggleHighlightCheckbox={toggleHighlightCheckbox}
//         handlePdfUpload={handlePdfUpload}
//         // Legacy props (kept to avoid breaking)
//         highlights={currentHighlights}
//         resetHighlights={resetHighlights}
//         toggleDocument={() => {}}
//       />

//       {/* ===== MAIN VIEWER ===== */}
//       <div
//         style={{
//           height: "100vh",
//           width: "75vw",
//           overflow: "hidden",
//           position: "relative",
//           flexGrow: 1,
//         }}
//       >
//         <Toolbar
//           setPdfScaleValue={(value) => setPdfScaleValue(value)}
//           toggleHighlightPen={() => setHighlightPen(!highlightPen)}
//         />

//         {!currentPdf ? (
//           <div
//             style={{
//               height: "calc(100% - 41px)",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               fontSize: 18,
//               opacity: 0.6,
//             }}
//           >
//             Upload a PDF to begin
//           </div>
//         ) : (
//           <PdfLoader document={currentPdf.url}>
//             {(pdfDocument) => (
//               <PdfHighlighter
//                 enableAreaSelection={(event) => event.altKey}
//                 pdfDocument={pdfDocument}
//                 onScrollAway={resetHash}
//                 utilsRef={(utils) => {
//                   highlighterUtilsRef.current = utils;
//                 }}
//                 pdfScaleValue={pdfScaleValue}
//                 textSelectionColor={
//                   highlightPen ? "rgba(255, 226, 143, 1)" : undefined
//                 }
//                 onSelection={
//                   highlightPen
//                     ? (selection) =>
//                         addHighlight(selection.makeGhostHighlight(), "")
//                     : undefined
//                 }
//                 selectionTip={
//                   highlightPen ? undefined : (
//                     <ExpandableTip addHighlight={addHighlight} />
//                   )
//                 }
//                 highlights={currentHighlights}
//                 style={{ height: "calc(100% - 41px)" }}
//               >
//                 <HighlightContainer
//                   editHighlight={editHighlight}
//                   onContextMenu={handleContextMenu}
//                 />
//               </PdfHighlighter>
//             )}
//           </PdfLoader>
//         )}
//       </div>

//       {contextMenu && <ContextMenu {...contextMenu} />}
//     </div>
//   );
// };

// export default App;
