// ===============================
// applyAiRedactionsPlugin.ts
// Converts normalized AI rectangles → scaled viewport rectangles
// Adds dedupe, batching, undo support, and merges into App.tsx state.
// ===============================

import { CommentedHighlight } from "../types";
import { PdfHighlighterUtils } from "../react-pdf-highlighter-extended";

// ----- Types your AI output uses -----
export type NormalizedRect = {
  x: number;     // 0..1
  y: number;     // 0..1
  width: number; // 0..1
  height: number;// 0..1
};

export type AiRedaction = {
  text: string;
  pageNumber: number; // 1-based
  rects: NormalizedRect[];
  metadata?: any;
};

export type AiRedactionPayload = {
  pdfId: string;
  fileName: string;
  allHighlights: AiRedaction[];
  activeHighlights: string[];
  savedAt: string;
};

// ----- Convert normalized → viewport-scaled -----
export function normalizedToViewportRect(
  norm: NormalizedRect,
  pageNumber: number,
  viewer: any
) {
  const pageView = viewer.getPageView(pageNumber - 1);
  if (!pageView) return null;

  const viewport = pageView.viewport;

  const x = norm.x * viewport.width;
  const y = norm.y * viewport.height;
  const w = norm.width * viewport.width;
  const h = norm.height * viewport.height;

  return {
    x1: x,
    y1: y,
    x2: x + w,
    y2: y + h,
    width: viewport.width,
    height: viewport.height,
    pageNumber,
  };
}

// Dedupe key (position-based)
function posKey(pos: any) {
  const b = pos?.boundingRect;
  if (!b) return "";
  const r = (n: number) => Math.round(n * 1000) / 1000; // reduce float noise
  return [
    b.pageNumber,
    r(b.x1),
    r(b.y1),
    r(b.x2),
    r(b.y2),
    pos.usePdfCoordinates ? "pdf" : "vp",
  ].join(":");
}


// ===============================================
// MAIN PLUGIN
// ===============================================

type ApplyAiRedactionsArgs = {
  payload: AiRedactionPayload;

  currentPdfId: string | null;

  // Provided by App.tsx:
  viewer: PdfHighlighterUtils["getViewer"] | null;

  // State setters from App.tsx:
  setAllHighlights: React.Dispatch<
    React.SetStateAction<Record<string, CommentedHighlight[]>>
  >;
  setDocHighlights: React.Dispatch<
    React.SetStateAction<Record<string, CommentedHighlight[]>>
  >;

  // Undo helpers from App.tsx:
  pushUndoState: () => void;
  getSnapshot: () => any;
  logHistory: (
    action: string,
    prev: any,
    next: any,
    note?: string
  ) => void;

  persist: (pdfId: string) => void;
};


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
}: ApplyAiRedactionsArgs) {
  if (!currentPdfId) {
    console.warn("[AI Plugin] No currentPdfId — aborting");
    return;
  }

  if (!viewer) {
    console.warn("[AI Plugin] No viewer — highlights may not render yet");
    return;
  }

  const viewerObj = viewer();
  if (!viewerObj) {
    console.warn("[AI Plugin] Viewer not mounted yet");
    return;
  }

  const newHighlights: CommentedHighlight[] = [];

  for (const ai of payload.allHighlights) {
    const { text, pageNumber, rects, metadata } = ai;

    for (const normRect of rects) {
      const scaled = normalizedToViewportRect(normRect, pageNumber, viewerObj);
      if (!scaled) continue;

      newHighlights.push({
        id: String(Math.random()).slice(2),
        comment: "",
        content: { text },
        position: {
          boundingRect: scaled,
          rects: [scaled],
        },
        metadata,
      });
    }
  }

  if (newHighlights.length === 0) {
    console.warn("[AI Plugin] No highlights produced");
    return;
  }

  // Deduping based on geometry
  const uniqueMap = new Map<string, CommentedHighlight>();
  for (const h of newHighlights) {
    uniqueMap.set(posKey(h.position), h);
  }
  const unique = [...uniqueMap.values()];

  // Merge into state
  pushUndoState();
  const prev = getSnapshot();

  setAllHighlights((prevAll) => {
    const existing = prevAll[currentPdfId] ?? [];

    const existingKeys = new Set(existing.map((h) => posKey(h.position)));
    const filtered = unique.filter((h) => !existingKeys.has(posKey(h.position)));

    const nextAllArr = [...existing, ...filtered];

    // Update doc highlights as well (active)
    setDocHighlights((prevDoc) => ({
      ...prevDoc,
      [currentPdfId]: [...(prevDoc[currentPdfId] ?? []), ...filtered],
    }));

    // Log
    const next = {
      doc: { ...prev.doc, [currentPdfId]: [...(prev.doc[currentPdfId] ?? []), ...filtered] },
      all: { ...prev.all, [currentPdfId]: nextAllArr },
    };

    logHistory(
      "AI Plugin: Added redactions",
      prev,
      next,
      `added=${filtered.length}`
    );

    // Persist
    persist(currentPdfId);

    return {
      ...prevAll,
      [currentPdfId]: nextAllArr,
    };
  });
}