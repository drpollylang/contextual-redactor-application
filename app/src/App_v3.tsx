
// import React, { MouseEvent, useEffect, useRef, useState } from "react";

// import CommentForm from "./CommentForm";
// import ContextMenu, { ContextMenuProps } from "./ContextMenu";
// import ExpandableTip from "./ExpandableTip";
// import HighlightContainer from "./HighlightContainer";
// // import Toolbar from "./Toolbar";

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

// import { DefaultButton } from "@fluentui/react";

// //
// // Utility helpers
// //
// const getNextId = () => String(Math.random()).slice(2);

// const parseIdFromHash = () =>
//   document.location.hash.slice("#highlight-".length);

// const resetHash = () => {
//   document.location.hash = "";
// };

// type UploadedPdf = {
//   id: string;
//   name: string;
//   url: string;
// };

// //
// // ========================
// //     App Component
// // ========================
// //
// const App: React.FC = () => {
//   //
//   // ===== PDF DOCUMENT STATE =====
//   //
//   const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
//   const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);

//   const currentPdf =
//     currentPdfId && uploadedPdfs.length > 0
//       ? uploadedPdfs.find((p) => p.id === currentPdfId) ?? null
//       : null;

//   //
//   // ===== HIGHLIGHTS / REDACTIONS =====
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
//   // ===== UI STATE =====
//   //
//   const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
//   const [pdfScaleValue] = useState<number | undefined>(
//     undefined
//   );
//   const [highlightPen] = useState<boolean>(false);

//   const [showInfoModal, setShowInfoModal] = useState(false);

//   const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);

//   //
//   // ===== HANDLE PDF UPLOAD =====
//   //
//   const handlePdfUpload = (file: File) => {
//     const id = getNextId();

//     const pdf: UploadedPdf = {
//       id,
//       name: file.name,
//       url: URL.createObjectURL(file),
//     };

//     setUploadedPdfs((prev) => [...prev, pdf]);
//     setCurrentPdfId(pdf.id);

//     // init highlight lists
//     setDocHighlights((prev) => ({ ...prev, [pdf.id]: [] }));
//     setAllHighlights((prev) => ({ ...prev, [pdf.id]: [] }));
//   };

//   //
//   // ===== CLEANUP ON UNMOUNT =====
//   //
//   useEffect(() => {
//     return () => {
//       uploadedPdfs.forEach((p) => URL.revokeObjectURL(p.url));
//     };
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   //
//   // ===== CONTEXT MENU CLICK-AWAY HANDLER =====
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
//   // ===== PER-DOCUMENT HIGHLIGHTS =====
//   //
//   const setCurrentDocHighlights = (
//     updater:
//       | Array<CommentedHighlight>
//       | ((prev: Array<CommentedHighlight>) => Array<CommentedHighlight>)
//   ) => {
//     if (!currentPdfId) return;

//     setDocHighlights((prev) => {
//       const prevArr = prev[currentPdfId] ?? [];
//       const nextArr =
//         typeof updater === "function" ? updater(prevArr) : updater;
//       return { ...prev, [currentPdfId]: nextArr };
//     });
//   };

//   //
//   // ===== ADD / REMOVE / EDIT REDACTION =====
//   //
//   const addHighlight = (ghost: GhostHighlight, comment: string) => {
//     if (!currentPdfId) return;

//     const newRedaction: CommentedHighlight = {
//       ...ghost,
//       comment,
//       id: getNextId(),
//     };

//     setAllHighlights((prev) => ({
//       ...prev,
//       [currentPdfId]: [...(prev[currentPdfId] ?? []), newRedaction],
//     }));

//     setCurrentDocHighlights((prev) => [newRedaction, ...prev]);
//   };

//   const deleteHighlight = (highlight: ViewportHighlight | Highlight) => {
//     if (!currentPdfId) return;

//     setCurrentDocHighlights((prev) =>
//       prev.filter((h) => h.id !== highlight.id)
//     );
//   };

//   const editHighlight = (id: string, update: Partial<CommentedHighlight>) => {
//     if (!currentPdfId) return;

//     setCurrentDocHighlights((prev) =>
//       prev.map((h) => (h.id === id ? { ...h, ...update } : h))
//     );

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
//   // ===== CHECKBOX TOGGLE (individual) =====
//   //
//   const toggleHighlightCheckbox = (
//     highlight: CommentedHighlight,
//     checked: boolean
//   ) => {
//     if (!currentPdfId) return;

//     if (checked) {
//       if (!currentHighlights.some((h) => h.id === highlight.id)) {
//         setCurrentDocHighlights((prev) => [...prev, highlight]);
//       }
//     } else {
//       setCurrentDocHighlights((prev) =>
//         prev.filter((h) => h.id !== highlight.id)
//       );
//     }
//   };

//   //
//   // ===== EDIT COMMENT POPUP =====
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
//   // ===== SCROLL TO REDACTION FROM HASH =====
//   //
//   const getHighlightById = (id: string) =>
//     currentHighlights.find((h) => h.id === id);

//   const scrollToHighlightFromHash = () => {
//     const target = getHighlightById(parseIdFromHash());
//     if (target && highlighterUtilsRef.current) {
//       highlighterUtilsRef.current.scrollToHighlight(target);
//     }
//   };

//   useEffect(() => {
//     window.addEventListener("hashchange", scrollToHighlightFromHash);
//     return () =>
//       window.removeEventListener("hashchange", scrollToHighlightFromHash);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [currentHighlights]);

//   //
//   // ========================
//   //        RENDER
//   // ========================
//   //
//   return (
//     <div className="App" style={{ display: "flex", height: "100vh" }}>
//       {/* SIDEBAR */}
//       <Sidebar
//         uploadedPdfs={uploadedPdfs}
//         currentPdfId={currentPdfId}
//         setCurrentPdfId={setCurrentPdfId}
//         allHighlights={allHighlights}
//         currentHighlights={currentHighlights}
//         toggleHighlightCheckbox={toggleHighlightCheckbox}
//         handlePdfUpload={handlePdfUpload}
//         highlights={currentHighlights}
//         resetHighlights={resetHighlights}
//         toggleDocument={() => {}}
//       />

//       {/* MAIN VIEW */}
//       <div
//         style={{
//           height: "100vh",
//           width: "75vw",
//           overflow: "hidden",
//           position: "relative",
//           flexGrow: 1,
//         }}
//       >

//         {/* TOOLBAR */}
//         {/* <Toolbar
//         setPdfScaleValue={setPdfScaleValue}
//         toggleHighlightPen={() => setHighlightPen(!highlightPen)}
//         onShowInfo={() => setShowInfoModal(true)}
//         /> */}

//         {/* ===== Toolbar + Info Button ===== */}
//         {/* <div
//           style={{
//             display: "flex",
//             justifyContent: "space-between",
//             alignItems: "center",
//             height: 41,
//             padding: "0 10px",
//             borderBottom: "1px solid #ddd",
//             background: "#fafafa",
//           }}
//         >
//           <Toolbar
//             setPdfScaleValue={setPdfScaleValue}
//             toggleHighlightPen={() => setHighlightPen(!highlightPen)}
//           />

//           <IconButton
//             iconProps={{ iconName: "Info" }}
//             title="Keyboard Shortcuts"
//             ariaLabel="Keyboard Shortcuts"
//             onClick={() => setShowInfoModal(true)}
//           />
//         </div> */}
        
//         {/* <div style={{ position: "relative" }}>
//         <Toolbar
//             setPdfScaleValue={setPdfScaleValue}
//             toggleHighlightPen={() => setHighlightPen(!highlightPen)}
//         /> */}

        
//         {/* 
//         ===== Toolbar + Info Button =====
//         <div
//         style={{
//             position: "relative",
//             height: 41,
//             borderBottom: "1px solid #ddd",
//             background: "#fafafa",
//         }}
//         >
//          */}    
//         {/* Toolbar needs right padding so its buttons don’t collide */}
//         {/* <div style={{ paddingRight: 48 }}>
//             <Toolbar
//             setPdfScaleValue={setPdfScaleValue}
//             toggleHighlightPen={() => setHighlightPen(!highlightPen)}
//             />
//         </div> */}

//         {/* Info button positioned top-right */}
//         {/* 
//         <IconButton
//         iconProps={{ iconName: "Info" }}
//         title="Keyboard Shortcuts"
//         ariaLabel="Keyboard Shortcuts"
//         onClick={() => setShowInfoModal(true)}
//         styles={{
//             root: {
//             background: "transparent",
//             color: "#ffffff", // white icon
//             },
//             rootHovered: {
//             background: "rgba(255,255,255,0.15)",
//             color: "#ffffff",
//             },
//             rootPressed: {
//             background: "rgba(255,255,255,0.25)",
//             color: "#ffffff",
//             },
//             icon: {
//             color: "#ffffff", // explicitly force icon color 
//             },
//         }}
//         style={{
//             position: "absolute",
//             right: 8,
//             top: 6,
//             zIndex: 10,
//         }}
//         />

//         </div> */}


//         {/* ===== PDF VIEWER ===== */}
//         {!currentPdf ? (
//           <div
//             style={{
//               height: "calc(100% - 41px)",
//               display: "flex",
//               alignItems: "center",
//               justifyContent: "center",
//               fontSize: 18,
//               opacity: 0.5,
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
//                     ? (sel) =>
//                         addHighlight(sel.makeGhostHighlight(), "")
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

//       {/* ===== Info Modal ===== */}
//       {showInfoModal && (
//         <div
//           style={{
//             position: "fixed",
//             top: 0,
//             left: 0,
//             width: "100vw",
//             height: "100vh",
//             background: "rgba(0,0,0,0.35)",
//             display: "flex",
//             justifyContent: "center",
//             alignItems: "center",
//             zIndex: 5000,
//           }}
//           onClick={() => setShowInfoModal(false)}
//         >
//           <div
//             style={{
//               background: "white",
//               padding: "24px 28px",
//               borderRadius: 8,
//               width: 380,
//               maxHeight: "80vh",
//               overflowY: "auto",
//               boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
//             }}
//             onClick={(e) => e.stopPropagation()}
//           >
//             <h2 style={{ marginTop: 0 }}>Keyboard Shortcuts</h2>
//             <ul style={{ fontSize: 15, lineHeight: 1.7 }}>
//               <li><strong>↑ / ↓</strong> — Move between redaction groups</li>
//               <li><strong>Space / Enter</strong> — Toggle selected group</li>
//               <li><strong>O</strong> — Expand/collapse selected group</li>
//               <li><strong>E</strong> — Expand all groups</li>
//               <li><strong>C</strong> — Collapse all groups</li>
//             </ul>

//             <div style={{ textAlign: "right", marginTop: 16 }}>
//               <DefaultButton text="Close" onClick={() => setShowInfoModal(false)} />
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default App;
