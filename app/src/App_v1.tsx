// // ------- v0->v1 Changed structure of page to have Document view in left side panel, pdf viewer is empty until user uploads a file -------
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
// import "./style/App.css";
// import { CommentedHighlight } from "./types";

// // Fluent UI (v8)
// import { DefaultButton } from "@fluentui/react";

// const getNextId = () => String(Math.random()).slice(2);
// const parseIdFromHash = () => document.location.hash.slice("#highlight-".length);
// const resetHash = () => {
//   document.location.hash = "";
// };

// type UploadedPdf = {
//   id: string;
//   name: string;
//   url: string; // Object URL created via URL.createObjectURL(file)
// };

// const App = () => {
//   // === Documents & Navigation ===
//   const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
//   const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);

//   const currentPdf = currentPdfId
//     ? uploadedPdfs.find((p) => p.id === currentPdfId) ?? null
//     : null;

//   // === Highlights are stored per-document ===
//   const [docHighlights, setDocHighlights] = useState<
//     Record<string, Array<CommentedHighlight>>
//   >({});

//   const currentHighlights = currentPdfId
//     ? docHighlights[currentPdfId] ?? []
//     : [];

//   // === UI & Tools ===
//   const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
//   const [pdfScaleValue, setPdfScaleValue] = useState<number | undefined>(
//     undefined,
//   );
//   const [highlightPen, setHighlightPen] = useState<boolean>(false);

//   // Refs for PdfHighlighter utilities
//   const highlighterUtilsRef = useRef<PdfHighlighterUtils>();

//   // === File Upload ===
//   const handlePdfUpload = (file: File) => {
//     const newPdf: UploadedPdf = {
//       id: getNextId(),
//       name: file.name,
//       url: URL.createObjectURL(file),
//     };

//     setUploadedPdfs((prev) => [...prev, newPdf]);
//     setCurrentPdfId(newPdf.id);
//     // Initialize highlight bucket if not present
//     setDocHighlights((prev) =>
//       prev[newPdf.id] ? prev : { ...prev, [newPdf.id]: [] },
//     );
//   };

//   // Cleanup: revoke object URLs on unmount
//   useEffect(() => {
//     return () => {
//       uploadedPdfs.forEach((p) => URL.revokeObjectURL(p.url));
//     };
//     // Intentionally not depending on uploadedPdfs to avoid revoking in-use URLs.
//     // Cleanup of replaced/removed docs could be added where removal occurs.
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // === Context Menu click-away ===
//   useEffect(() => {
//     const handleClick = () => {
//       if (contextMenu) {
//         setContextMenu(null);
//       }
//     };
//     document.addEventListener("click", handleClick);
//     return () => {
//       document.removeEventListener("click", handleClick);
//     };
//   }, [contextMenu]);

//   const handleContextMenu = (
//     event: MouseEvent<HTMLDivElement>,
//     highlight: ViewportHighlight<CommentedHighlight>,
//   ) => {
//     event.preventDefault();
//     setContextMenu({
//       xPos: event.clientX,
//       yPos: event.clientY,
//       deleteHighlight: () => deleteHighlight(highlight),
//       editComment: () => editComment(highlight),
//     });
//   };

//   // === Highlight Helpers (per current document) ===
//   const setCurrentDocHighlights = (
//     updater:
//       | Array<CommentedHighlight>
//       | ((
//           prev: Array<CommentedHighlight>,
//         ) => Array<CommentedHighlight>),
//   ) => {
//     if (!currentPdfId) return;
//     setDocHighlights((prev) => {
//       const prevArr = prev[currentPdfId] ?? [];
//       const nextArr =
//         typeof updater === "function"
//           ? (updater as (p: Array<CommentedHighlight>) => Array<CommentedHighlight>)(prevArr)
//           : updater;
//       return {
//         ...prev,
//         [currentPdfId]: nextArr,
//       };
//     });
//   };

//   const addHighlight = (highlight: GhostHighlight, comment: string) => {
//     if (!currentPdfId) return;
//     setCurrentDocHighlights([{ ...highlight, comment, id: getNextId() }, ...currentHighlights]);
//   };

//   const deleteHighlight = (highlight: ViewportHighlight | Highlight) => {
//     if (!currentPdfId) return;
//     setCurrentDocHighlights(currentHighlights.filter((h) => h.id !== highlight.id));
//   };

//   const editHighlight = (idToUpdate: string, edit: Partial<CommentedHighlight>) => {
//     if (!currentPdfId) return;
//     setCurrentDocHighlights(
//       currentHighlights.map((h) => (h.id === idToUpdate ? { ...h, ...edit } : h)),
//     );
//   };

//   const resetHighlights = () => {
//     if (!currentPdfId) return;
//     setCurrentDocHighlights([]);
//   };

//   const getHighlightById = (id: string) => {
//     return currentHighlights.find((h) => h.id === id);
//   };

//   // Open comment tip and update highlight with new user input
//   const editComment = (highlight: ViewportHighlight<CommentedHighlight>) => {
//     if (!highlighterUtilsRef.current) return;

//     const editCommentTip: Tip = {
//       position: highlight.position,
//       content: (
//         <CommentForm
//           placeHolder={highlight.comment}
//           onSubmit={(input) => {
//             editHighlight(highlight.id, { comment: input });
//             highlighterUtilsRef.current!.setTip(null);
//             highlighterUtilsRef.current!.toggleEditInProgress(false);
//           }}
//         />
//       ),
//     };

//     highlighterUtilsRef.current.setTip(editCommentTip);
//     highlighterUtilsRef.current.toggleEditInProgress(true);
//   };

//   // Scroll to highlight based on hash in the URL
//   const scrollToHighlightFromHash = () => {
//     const highlight = getHighlightById(parseIdFromHash());
//     if (highlight && highlighterUtilsRef.current) {
//       highlighterUtilsRef.current.scrollToHighlight(highlight);
//     }
//   };

//   // Hash listeners for autoscrolling to highlights
//   useEffect(() => {
//     window.addEventListener("hashchange", scrollToHighlightFromHash);
//     return () => {
//       window.removeEventListener("hashchange", scrollToHighlightFromHash);
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // === Navigation (Prev/Next like original toggle) ===
//   const goToIndex = (index: number) => {
//     if (uploadedPdfs.length === 0) return;
//     const clamped = ((index % uploadedPdfs.length) + uploadedPdfs.length) % uploadedPdfs.length;
//     const nextDoc = uploadedPdfs[clamped];
//     setCurrentPdfId(nextDoc.id);
//     // Ensure docHighlights bucket exists
//     setDocHighlights((prev) => ({ [nextDoc.id]: prev[nextDoc.id] ?? [], ...prev }));
//   };

//   const goPrev = () => {
//     if (!currentPdfId || uploadedPdfs.length === 0) return;
//     const currentIndex = uploadedPdfs.findIndex((p) => p.id === currentPdfId);
//     goToIndex(currentIndex - 1);
//   };

//   const goNext = () => {
//     if (!currentPdfId || uploadedPdfs.length === 0) return;
//     const currentIndex = uploadedPdfs.findIndex((p) => p.id === currentPdfId);
//     goToIndex(currentIndex + 1);
//   };

//   return (
//     <div className="App" style={{ display: "flex", height: "100vh" }}>
//       {/* === Left Pane: Upload + Navigation === */}
//       <div
//         style={{
//           width: "25vw",
//           maxWidth: 420,
//           minWidth: 260,
//           height: "100vh",
//           borderRight: "1px solid #e5e5e5",
//           display: "flex",
//           flexDirection: "column",
//         }}
//       >
//         <div style={{ padding: 12, borderBottom: "1px solid #eee" }}>
//           <DefaultButton
//             text="Upload PDF"
//             iconProps={{ iconName: "Upload" }}
//             onClick={() => document.getElementById("pdf-upload-input")?.click()}
//           />
//           <input
//             id="pdf-upload-input"
//             type="file"
//             accept="application/pdf"
//             style={{ display: "none" }}
//             onChange={(e) => {
//               const file = e.target.files?.[0];
//               if (file) handlePdfUpload(file);
//               // Allow re-uploading the same file name
//               e.currentTarget.value = "";
//             }}
//           />
//         </div>

//         {/* Navigation bar similar to toggle */}
//         <div
//           style={{
//             display: "flex",
//             gap: 8,
//             padding: "8px 12px",
//             alignItems: "center",
//             borderBottom: "1px solid #eee",
//           }}
//         >
//           <DefaultButton text="Previous" onClick={goPrev} disabled={!currentPdfId || uploadedPdfs.length <= 1} />
//           <DefaultButton text="Next" onClick={goNext} disabled={!currentPdfId || uploadedPdfs.length <= 1} />
//           <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
//             {uploadedPdfs.length > 0
//               ? `${uploadedPdfs.findIndex((p) => p.id === currentPdfId) + 1 || 0} / ${uploadedPdfs.length}`
//               : "No documents"}
//           </div>
//         </div>

//         {/* Documents list */}
//         <div style={{ padding: 12, overflowY: "auto" }}>
//           <div style={{ fontWeight: 600, marginBottom: 8 }}>Documents</div>
//           {uploadedPdfs.length === 0 ? (
//             <div style={{ opacity: 0.6, fontSize: 13 }}>
//               Upload one or more PDFs to get started.
//             </div>
//           ) : (
//             uploadedPdfs.map((pdf) => {
//               const isActive = pdf.id === currentPdfId;
//               return (
//                 <div
//                   key={pdf.id}
//                   onClick={() => setCurrentPdfId(pdf.id)}
//                   style={{
//                     cursor: "pointer",
//                     padding: "8px 10px",
//                     marginBottom: 6,
//                     borderRadius: 6,
//                     background: isActive ? "rgba(0, 120, 212, 0.1)" : "transparent",
//                     border: isActive ? "1px solid rgba(0, 120, 212, 0.3)" : "1px solid #eee",
//                     fontWeight: isActive ? 600 : 400,
//                   }}
//                   title={pdf.name}
//                 >
//                   <div
//                     style={{
//                       whiteSpace: "nowrap",
//                       overflow: "hidden",
//                       textOverflow: "ellipsis",
//                     }}
//                   >
//                     {pdf.name}
//                   </div>
//                 </div>
//               );
//             })
//           )}
//         </div>

//         {/* Optional: actions for highlights of current doc */}
//         <div style={{ marginTop: "auto", padding: 12, borderTop: "1px solid #eee" }}>
//           <DefaultButton
//             text="Clear Highlights (This Doc)"
//             onClick={resetHighlights}
//             disabled={!currentPdfId || currentHighlights.length === 0}
//           />
//         </div>
//       </div>

//       {/* === Right Pane: Toolbar + PDF Viewer (blank until upload) === */}
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
//               color: "#555",
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
//                 utilsRef={(_pdfHighlighterUtils) => {
//                   highlighterUtilsRef.current = _pdfHighlighterUtils;
//                 }}
//                 pdfScaleValue={pdfScaleValue}
//                 textSelectionColor={highlightPen ? "rgba(255, 226, 143, 1)" : undefined}
//                 onSelection={
//                   highlightPen
//                     ? (selection) => addHighlight(selection.makeGhostHighlight(), "")
//                     : undefined
//                 }
//                 selectionTip={
//                   highlightPen ? undefined : <ExpandableTip addHighlight={addHighlight} />
//                 }
//                 highlights={currentHighlights}
//                 style={{
//                   height: "calc(100% - 41px)",
//                 }}
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
