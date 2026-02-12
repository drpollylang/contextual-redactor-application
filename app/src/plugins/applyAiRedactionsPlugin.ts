// // ===============================
// // applyAiRedactionsPlugin.ts
// // Converts normalized AI rectangles → scaled viewport rectangles
// // Adds dedupe, batching, undo support, and merges into App.tsx state.
// // ===============================

// import { CommentedHighlight } from "../types";
// import { PdfHighlighterUtils } from "../react-pdf-highlighter-extended";

// // ----- Types your AI output uses -----
// export type NormalizedRect = {
//   x: number;     // 0..1
//   y: number;     // 0..1
//   width: number; // 0..1
//   height: number;// 0..1
// };

// export type AiRedaction = {
//   text: string;
//   pageNumber: number; // 1-based
//   rects: NormalizedRect[];
//   metadata?: any;
// };

// export type AiRedactionPayload = {
//   pdfId: string;
//   fileName: string;
//   allHighlights: AiRedaction[];
//   activeHighlights: string[];
//   savedAt: string;
// };

// // ----- Convert normalized → viewport-scaled -----
// export function normalizedToViewportRect(
//   norm: NormalizedRect,
//   pageNumber: number,
//   viewer: any
// ) {
//   const pageView = viewer.getPageView(pageNumber - 1);
//   if (!pageView) return null;

//   const viewport = pageView.viewport;

//   const x = norm.x * viewport.width;
//   const y = norm.y * viewport.height;
//   const w = norm.width * viewport.width;
//   const h = norm.height * viewport.height;

//   return {
//     x1: x,
//     y1: y,
//     x2: x + w,
//     y2: y + h,
//     width: viewport.width,
//     height: viewport.height,
//     pageNumber,
//   };
// }

// // Dedupe key (position-based)
// function posKey(pos: any) {
//   const b = pos?.boundingRect;
//   if (!b) return "";
//   const r = (n: number) => Math.round(n * 1000) / 1000; // reduce float noise
//   return [
//     b.pageNumber,
//     r(b.x1),
//     r(b.y1),
//     r(b.x2),
//     r(b.y2),
//     pos.usePdfCoordinates ? "pdf" : "vp",
//   ].join(":");
// }


// // ===============================================
// // MAIN PLUGIN
// // ===============================================

// type ApplyAiRedactionsArgs = {
//   payload: AiRedactionPayload;

//   currentPdfId: string | null;

//   // Provided by App.tsx:
//   viewer: PdfHighlighterUtils["getViewer"] | null;

//   // State setters from App.tsx:
//   setAllHighlights: React.Dispatch<
//     React.SetStateAction<Record<string, CommentedHighlight[]>>
//   >;
//   setDocHighlights: React.Dispatch<
//     React.SetStateAction<Record<string, CommentedHighlight[]>>
//   >;

//   // Undo helpers from App.tsx:
//   pushUndoState: () => void;
//   getSnapshot: () => any;
//   logHistory: (
//     action: string,
//     prev: any,
//     next: any,
//     note?: string
//   ) => void;

//   persist: (pdfId: string) => void;
// };


// export async function applyAiRedactionsPlugin({
//   payload,
//   currentPdfId,
//   viewer,
//   setAllHighlights,
//   setDocHighlights,
//   pushUndoState,
//   getSnapshot,
//   logHistory,
//   persist,
// }: ApplyAiRedactionsArgs) {
//   if (!currentPdfId) {
//     console.warn("[AI Plugin] No currentPdfId — aborting");
//     return;
//   }

//   if (!viewer) {
//     console.warn("[AI Plugin] No viewer — highlights may not render yet");
//     return;
//   }

//   const viewerObj = viewer();
//   if (!viewerObj) {
//     console.warn("[AI Plugin] Viewer not mounted yet");
//     return;
//   }

//   const newHighlights: CommentedHighlight[] = [];

//   for (const ai of payload.allHighlights) {
//     const { text, pageNumber, rects, metadata } = ai;

//     for (const normRect of rects) {
//       const scaled = normalizedToViewportRect(normRect, pageNumber, viewerObj);
//       if (!scaled) continue;

//       newHighlights.push({
//         id: String(Math.random()).slice(2),
//         comment: "",
//         content: { text },
//         position: {
//           boundingRect: scaled,
//           rects: [scaled],
//         },
//         metadata,
//       });
//     }
//   }

//   if (newHighlights.length === 0) {
//     console.warn("[AI Plugin] No highlights produced");
//     return;
//   }

//   // Deduping based on geometry
//   const uniqueMap = new Map<string, CommentedHighlight>();
//   for (const h of newHighlights) {
//     uniqueMap.set(posKey(h.position), h);
//   }
//   const unique = [...uniqueMap.values()];

//   // Merge into state
//   pushUndoState();
//   const prev = getSnapshot();

//   setAllHighlights((prevAll) => {
//     const existing = prevAll[currentPdfId] ?? [];

//     const existingKeys = new Set(existing.map((h) => posKey(h.position)));
//     const filtered = unique.filter((h) => !existingKeys.has(posKey(h.position)));

//     const nextAllArr = [...existing, ...filtered];

//     // Update doc highlights as well (active)
//     setDocHighlights((prevDoc) => ({
//       ...prevDoc,
//       [currentPdfId]: [...(prevDoc[currentPdfId] ?? []), ...filtered],
//     }));

//     // Log
//     const next = {
//       doc: { ...prev.doc, [currentPdfId]: [...(prev.doc[currentPdfId] ?? []), ...filtered] },
//       all: { ...prev.all, [currentPdfId]: nextAllArr },
//     };

//     logHistory(
//       "AI Plugin: Added redactions",
//       prev,
//       next,
//       `added=${filtered.length}`
//     );

//     // Persist
//     persist(currentPdfId);

//     return {
//       ...prevAll,
//       [currentPdfId]: nextAllArr,
//     };
//   });
// }

//-------------------------------------------------------------------------------

// ===============================
// applyAiRedactionsPlugin.ts
// Converts normalized AI rects → scaled viewport rects
// Compatible with your backend’s "position: { boundingRect, rects }" shape
// Includes dedupe, undo, history, and persistence.
// ===============================

// import { CommentedHighlight } from "../types";
// import { PdfHighlighterUtils } from "../react-pdf-highlighter-extended";
// // import { PDFDict } from "pdf-lib";

// // ----- Types for AI output -----
// export type NormalizedRect = {
//   x: number;        // 0..1
//   y: number;        // 0..1
//   width: number;    // 0..1
//   height: number;   // 0..1
// };

// export type AiPosition = {
//   boundingRect: {
//     x: number;
//     y: number;
//     width: number;
//     height: number;
//     pageNumber: number;  // 1-based
//   };
//   rects: NormalizedRect[];
// };

// export type AiRawHighlight = {
//   id?: string;
//   content: { text: string };
//   position: AiPosition;
//   metadata?: any;
// };

// export type AiRedactionPayload = {
//   pdfId: string;
//   fileName: string;
//   allHighlights: AiRawHighlight[];
//   activeHighlights: string[];
//   savedAt: string;
// };

// // ----- Convert normalized → viewport-scaled -----
// export function normalizedToViewportRect(
//   norm: NormalizedRect,
//   pageNumber: number,
//   viewerObj: any,
//   getViewportSize?: (pn: number) => { width: number; height: number } | null
// ) {
  
//   let width: number | undefined;
//   let height: number | undefined;

//   const pageView = viewerObj.getPageView(pageNumber - 1);

//   if (pageView?.viewport) {
//     width = pageView.viewport.width;
//     height = pageView.viewport.height;
//   } else if (getViewportSize) {
//     const dims = getViewportSize(pageNumber);
//     if (dims) {
//       width = dims.width;
//       height = dims.height;
//     }
//   }

//   if (!width || !height) return null;

//   // if (!pageView) return null;

//   const viewport = pageView.viewport;

//   const x = norm.x * viewport.width;
//   const y = norm.y * viewport.height;
//   const w = norm.width * viewport.width;
//   const h = norm.height * viewport.height;

//   return {
//     x1: x,
//     y1: y,
//     x2: x + w,
//     y2: y + h,
//     width: viewport.width,
//     height: viewport.height,
//     pageNumber
//   };
// }

// // Deduping based on geometry
// function posKey(pos: any) {
//   const b = pos?.boundingRect;
//   if (!b) return "";
//   const r = (n: number) => Math.round(n * 1000) / 1000;
//   return [
//     b.pageNumber,
//     r(b.x1),
//     r(b.y1),
//     r(b.x2),
//     r(b.y2),
//     pos.usePdfCoordinates ? "pdf" : "vp"
//   ].join(":");
// }

// // ===============================================
// // MAIN PLUGIN
// // ===============================================

// type ApplyAiRedactionsArgs = {
//   payload: AiRedactionPayload;

//   currentPdfId: string | null;
//   viewer: PdfHighlighterUtils["getViewer"] | null;

//   // State setters from App.tsx:
//   setAllHighlights: React.Dispatch<
//     React.SetStateAction<Record<string, CommentedHighlight[]>>
//   >;
//   setDocHighlights: React.Dispatch<
//     React.SetStateAction<Record<string, CommentedHighlight[]>>
//   >;

//   // Undo helpers:
//   pushUndoState: () => void;
//   getSnapshot: () => any;
//   logHistory: (
//     action: string,
//     prev: any,
//     next: any,
//     note?: string
//   ) => void;

//   persist: (pdfId: string) => void;

  
//   // NEW: fallback viewport getter
//   getViewportSize?: (pageNumber: number) => { width: number; height: number } | null;

// };


// export async function applyAiRedactionsPlugin({
//   payload,
//   currentPdfId,
//   viewer,
//   setAllHighlights,
//   setDocHighlights,
//   pushUndoState,
//   getSnapshot,
//   logHistory,
//   persist,
//   getViewportSize
// }: ApplyAiRedactionsArgs) {
//   console.log("[AI Plugin] START", payload);

//   if (!currentPdfId) {
//     console.warn("[AI Plugin] No currentPdfId — aborting");
//     return;
//   }

//   if (!viewer) {
//     console.warn("[AI Plugin] viewer function missing");
//     return;
//   }

//   const viewerObj = viewer();
//   if (!viewerObj) {
//     console.warn("[AI Plugin] Viewer not mounted yet");
//     return;
//   }

//   const aiHighlights = payload.allHighlights ?? [];
//   if (aiHighlights.length === 0) {
//     console.warn("[AI Plugin] Payload contains 0 AI highlights");
//     return;
//   }

//   const newHighlights: CommentedHighlight[] = [];

//   // Process each AI-highlight object (backend format)
//   for (const ai of aiHighlights) {
//     const text = ai.content?.text ?? "";
//     const metadata = ai.metadata ?? null;

//     if (!ai.position || !ai.position.boundingRect) {
//       console.warn("[AI Plugin] Missing position in AI highlight:", ai);
//       continue;
//     }

//     const { boundingRect, rects } = ai.position;
//     const pageNumber = boundingRect.pageNumber;

//     if (!Array.isArray(rects)) {
//       console.warn("[AI Plugin] rects is not an array:", rects);
//       continue;
//     }

//     // Each normalized rect → scaled viewport rect
//     for (const normRect of rects) {
//       const scaled = normalizedToViewportRect(normRect, pageNumber, viewerObj, getViewportSize);
//       if (!scaled) continue;

//       // const h: CommentedHighlight = {
//       //   id: ai.id ?? String(Math.random()).slice(2),
//       //   content: { text },
//       //   comment: "",
//       //   position: {
//       //     boundingRect: scaled,
//       //     rects: [scaled]
//       //   },
//       //   metadata
//       // };
//       // Extract reason (from "Identified as sensitive PII (Category).")
//       let reason = "AI";
//       let top_level_category = "";
//       if (metadata?.reasoning) {
//         const match = metadata.reasoning.match(/sensitive\s+([A-Za-z]+)/i);
//         if (match) reason = match[1]; // e.g. PII
//         if (metadata.reasoning.includes(" PII ")) {
//           top_level_category = "PII";
//         }
//       }

//       // TODO: create more discrete categories for contextual prompt instructions 
//       // e.g. Sensitive Information (Medical), Sensitive Information (Police), SI (Personal Relationships), 
//       // SI (Employment), SI (Financial), SI (Personal e.g. sexual orientation/gender) 
//       let full_category = "";
//       const category = metadata?.category ?? "Unknown";
//       if (top_level_category != "") {
//         full_category = `${top_level_category} (${category})`;
//       } else {
//         full_category = category;
//       }

//       const h: CommentedHighlight = {
//         id: ai.id ?? String(Math.random()).slice(2),
//         content: { text },
//         comment: metadata?.reasoning ?? "",
//         position: {
//           boundingRect: scaled,
//           rects: [scaled]
//         },
//         metadata,
//         source: "ai",
//         label: `AI generated: ${reason} – ${category}`,
//         category: full_category,
//         confidence: metadata.confidence
//       };

//       newHighlights.push(h);
//     }
//   }

//   console.log("[AI Plugin] Processed scaled highlights for ", currentPdfId, " : ", newHighlights);

//   if (newHighlights.length === 0) {
//     console.warn("[AI Plugin] After processing, 0 scaled highlights");
//     return;
//   }

//   console.log("[AI Plugin] Processed scaled highlights:", newHighlights.length);

//   // ----- Deduping -----
//   const uniqueMap = new Map<string, CommentedHighlight>();
//   for (const h of newHighlights) {
//     uniqueMap.set(posKey(h.position), h);
//   }
//   const unique = [...uniqueMap.values()];
//   console.log("[AI Plugin] Unique highlights:", unique.length);

//   // ----- Merge into state -----
//   pushUndoState();
//   const prevSnapshot = getSnapshot();

//   setAllHighlights(prevAll => {
//     const existing = prevAll[currentPdfId] ?? [];

//     const existingKeys = new Set(existing.map(h => posKey(h.position)));
//     const filtered = unique.filter(h => !existingKeys.has(posKey(h.position)));

//     console.log("[AI Plugin] New filtered highlights:", filtered.length);

//     const nextAllArr = [...existing, ...filtered];

//     // Active list update
//     setDocHighlights(prevDoc => ({
//       ...prevDoc,
//       [currentPdfId]: [...(prevDoc[currentPdfId] ?? []), ...filtered]
//     }));

//     const nextSnapshot = {
//       doc: {
//         ...prevSnapshot.doc,
//         [currentPdfId]: [...(prevSnapshot.doc[currentPdfId] ?? []), ...filtered]
//       },
//       all: {
//         ...prevSnapshot.all,
//         [currentPdfId]: nextAllArr
//       }
//     };

//     logHistory(
//       "AI Plugin: Added redactions",
//       prevSnapshot,
//       nextSnapshot,
//       `added=${filtered.length}`
//     );

//     // Persist highlights (Dexie + periodic Blob upload)
//     persist(currentPdfId);

//     return {
//       ...prevAll,
//       [currentPdfId]: nextAllArr
//     };
//   });

//   console.log("[AI Plugin] DONE merging.");
// }


//----------------------------------------------------------------------------
// ===============================
// applyAiRedactionsPlugin.ts (Patched)
// With fallback viewport scaling + retry queue
// ===============================

// ===============================
// applyAiRedactionsPlugin.ts (Patched)
// With fallback viewport scaling + retry queue
// ===============================

import { CommentedHighlight } from "../types";
import { PdfHighlighterUtils } from "../react-pdf-highlighter-extended";

export type NormalizedRect = {
  x: number; y: number; width: number; height: number; // 0..1 normalized
};

export type AiPosition = {
  boundingRect: { x: number; y: number; width: number; height: number; pageNumber: number };
  rects: NormalizedRect[];
};

export type AiRawHighlight = {
  id?: string;
  content: { text: string };
  position: AiPosition;
  metadata?: any;
};

export type AiRedactionPayload = {
  pdfId: string;
  fileName: string;
  allHighlights: AiRawHighlight[];
  activeHighlights: string[];
  savedAt: string;
};

/**
 * Scale normalized rect → viewport rect using:
 * 1. viewer.getPageView()
 * 2. fallback PDF.js page.getViewport()
 */
async function scaleNormalizedRect(
  norm: NormalizedRect,
  pageNumber: number,
  viewerObj: any,
  pdfDoc: any,       // pdfDocumentRef.current
  currentScale: number
) {
  // ===== 1) Try viewer pageView first
  const pageView = viewerObj?.getPageView?.(pageNumber - 1);
  const vp = pageView?.viewport;

  if (vp) {
    return {
      x1: norm.x * vp.width,
      y1: norm.y * vp.height,
      x2: (norm.x + norm.width) * vp.width,
      y2: (norm.y + norm.height) * vp.height,
      width: vp.width,
      height: vp.height,
      pageNumber
    };
  }

  // ===== 2) Fallback to PDF.js page.getViewport()
  if (pdfDoc) {
    try {
      const page = await pdfDoc.getPage(pageNumber);
      const fallbackVp = page.getViewport({ scale: currentScale });

      return {
        x1: norm.x * fallbackVp.width,
        y1: norm.y * fallbackVp.height,
        x2: (norm.x + norm.width) * fallbackVp.width,
        y2: (norm.y + norm.height) * fallbackVp.height,
        width: fallbackVp.width,
        height: fallbackVp.height,
        pageNumber
      };
    } catch (e) {
      console.warn("[AI Plugin] Fallback viewport failed:", e);
    }
  }

  // ===== Fail → scaleMissing queue will handle retry
  return null;
}

// Dedupe key
function posKey(pos: any) {
  const b = pos?.boundingRect;
  if (!b) return "";
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return [b.pageNumber, r(b.x1), r(b.y1), r(b.x2), r(b.y2), pos.usePdfCoordinates ? "pdf" : "vp"].join(":");
}

type ApplyAiRedactionsArgs = {
  payload: AiRedactionPayload;
  currentPdfId: string | null;
  viewer: PdfHighlighterUtils["getViewer"] | null;

  setAllHighlights: React.Dispatch<React.SetStateAction<Record<string, CommentedHighlight[]>>>;
  setDocHighlights: React.Dispatch<React.SetStateAction<Record<string, CommentedHighlight[]>>>;

  pushUndoState: () => void;
  getSnapshot: () => any;
  logHistory: (action: string, prev: any, next: any, note?: string) => void;
  persist: (pdfId: string) => void;

  // Add pdf.js doc + currentScale for fallback
  pdfDoc?: any;
  currentScale?: number;
};

/**
 * Main plugin with retry queue
 */
export async function applyAiRedactionsPlugin({
  payload,
  currentPdfId,
  viewer,
  setAllHighlights,
  setDocHighlights,
  pushUndoState,
  getSnapshot,
  logHistory,
  persist,
  pdfDoc,
  currentScale = 1.0,
}: ApplyAiRedactionsArgs) {

  console.log("[AI Plugin] START", payload);

  if (!currentPdfId) return console.warn("[AI Plugin] No currentPdfId — aborting");
  if (!viewer) return console.warn("[AI Plugin] viewer missing");

  const viewerObj = viewer();
  if (!viewerObj) return console.warn("[AI Plugin] Viewer not mounted");

  const aiHighlights = payload.allHighlights ?? [];
  if (aiHighlights.length === 0) {
    return console.warn("[AI Plugin] No AI highlights");
  }

  // Queue for highlights whose scaling fails
  const retryQueue: AiRawHighlight[] = [];

  async function processBatch(batch: AiRawHighlight[]) {
    const newHighlights: CommentedHighlight[] = [];

    for (const ai of batch) {
      const text = ai.content?.text ?? "";
      const metadata = ai.metadata ?? {};
      const pageNumber = ai.position.boundingRect.pageNumber;
      const rects = ai.position.rects;

      for (const norm of rects) {
        const scaled = await scaleNormalizedRect(
          norm,
          pageNumber,
          viewerObj,
          pdfDoc,
          currentScale
        );

        if (!scaled) {
          retryQueue.push(ai);
          continue;
        }

        newHighlights.push({
          id: ai.id ?? String(Math.random()).slice(2),
          content: { text },
          comment: metadata?.reasoning ?? "",
          position: { boundingRect: scaled, rects: [scaled] },
          metadata,
          source: "ai",
          label: `AI generated: ${metadata.category ?? "Unknown"}`,
          category: metadata.category ?? "Unknown",
          confidence: metadata.confidence
        });
      }
    }

    return newHighlights;
  }

  // Initial batch
  let scaledHighlights = await processBatch(aiHighlights);
  console.log("[AI Plugin] First-pass scaled count:", scaledHighlights.length);

  // === RETRY QUEUE ===
  if (retryQueue.length > 0) {
    console.warn("[AI Plugin] Retrying", retryQueue.length, "highlights in 250ms…");

    await new Promise(res => setTimeout(res, 250));

    const retryScaled = await processBatch(retryQueue);
    console.log("[AI Plugin] Retry scaled count:", retryScaled.length);

    scaledHighlights = [...scaledHighlights, ...retryScaled];
  }

  if (scaledHighlights.length === 0) {
    return console.warn("[AI Plugin] No scaled highlights after retry");
  }

  // ===== Deduping =====
  const unique = [...new Map(scaledHighlights.map(h => [posKey(h.position), h])).values()];
  console.log("[AI Plugin] Unique highlights:", unique.length);

  // ===== Merge =====
  pushUndoState();
  const prev = getSnapshot();

  setAllHighlights(prevAll => {
    const existing = prevAll[currentPdfId] ?? [];
    const existingKeys = new Set(existing.map(h => posKey(h.position)));
    const filtered = unique.filter(h => !existingKeys.has(posKey(h.position)));

    console.log("[AI Plugin] New filtered highlights:", filtered.length);

    const nextAllArr = [...existing, ...filtered];

    // Active list
    setDocHighlights(prevDoc => ({
      ...prevDoc,
      [currentPdfId]: [...(prevDoc[currentPdfId] ?? []), ...filtered]
    }));

    logHistory(
      "AI Plugin: Added redactions",
      prev,
      { doc: { ...prev.doc }, all: { ...prev.all } },
      `added=${filtered.length}`
    );

    persist(currentPdfId);

    return {
      ...prevAll,
      [currentPdfId]: nextAllArr
    };
  });

  console.log("[AI Plugin] DONE merging.");
}