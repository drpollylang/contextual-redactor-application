
// npm run dev
// v4->v5 Apply To All buttons, persistent storage
import React, { MouseEvent, useEffect, useRef, useState, useMemo } from "react";

import CommentForm from "../CommentForm";
import ContextMenu, { ContextMenuProps } from "../ContextMenu";
import ExpandableTip from "../ExpandableTip";
import HighlightContainer from "../HighlightContainer";
import Toolbar from "../Toolbar";
import Sidebar from "../Sidebar";
import FiltersPage, { HighlightFilters as FiltersHighlightFilters } from "./FiltersPage";
// import SettingsPage, { HighlightFilters, STATIC_AI_RULES } from "./SettingsPage";
// import SettingsPage, { STATIC_AI_RULES } from "./SettingsPage";
import SettingsPage from "./SettingsPage";
import HistoryTimeline from "./HistoryTimeline";
import { applyAiRedactionsPlugin, AiRedactionPayload } from "../plugins/applyAiRedactionsPlugin";
import { runAiRedactionForProjectParallel } from "../helpers/aiRedactionHelpers";
import { buildPdfId } from "../helpers/utils"
import { removeDocument } from "../helpers/documentHelpers";
import { buildRedactedBlobFromPdfjsDoc, groupActiveRectsByPage } from "../lib/pdfRedactor";
import { saveFinalPdfToBlob } from "../lib/blobPersist";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import { DEFAULT_WORKER_SRC } from "../../../src/components/PdfLoader"; // exported above

import { useNavigate, useParams } from "react-router-dom";
// import { useParams } from "react-router-dom";

import {
  GhostHighlight,
  Highlight,
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  Tip,
  ViewportHighlight,
  ScaledPosition
} from "../react-pdf-highlighter-extended";

import "../style/App.css";
import { CommentedHighlight } from "../types";

import { db, fileToBase64, base64ToBlob } from "../storage";
import { DefaultButton, IconButton } from "@fluentui/react";

import { saveOriginalPdfToBlob, saveWorkingSnapshotToBlob } from "../lib/blobPersist";
import { listUserDocuments, getDownloadSas } from "../lib/apiClient";



interface ProjectWorkspaceProps {
  userId: string;
  
  aiRules: string[];
  setAiRules: React.Dispatch<React.SetStateAction<string[]>>;

  userInstructions: string;
  setUserInstructions: React.Dispatch<React.SetStateAction<string>>;

}


/* =========================
   Local helpers & types
   ========================= */

type UploadedPdf = { id: string; name: string; url: string };

const getNextId = () => String(Math.random()).slice(2);
const parseIdFromHash = () => document.location.hash.slice("#highlight-".length);
const resetHash = () => {
  document.location.hash = "";
};

/* Allow debug helpers on window */
declare global {
  interface Window {
    dumpDB?: () => Promise<void>;
    flushDBNow?: () => Promise<void>;
  }
}

// Fetch the blob via SAS and return a local object URL
async function fetchBlobUrl(container: string, blobPath: string, ttlMinutes = 10): Promise<string> {
  const { downloadUrl } = await getDownloadSas({ containerName: container, blobPath, ttlMinutes });
  const cleanUrl = downloadUrl.replace(/&amp;amp;/g, "&").replace(/&amp;/g, "&");
  const res = await fetch(cleanUrl);
  if (!res.ok) throw new Error(`Failed to fetch blob: ${res.status}`);
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// Fetch JSON from Blob and parse
async function fetchJson<T>(container: string, blobPath: string, ttlMinutes = 10): Promise<T | null> {
  const { downloadUrl } = await getDownloadSas({ containerName: container, blobPath, ttlMinutes });
  const cleanUrl = downloadUrl.replace(/&amp;amp;/g, "&").replace(/&amp;/g, "&");
  const res = await fetch(cleanUrl);
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// Load a PDF.js document from a URL (object URL or SAS URL)
export async function loadPdfDocumentFromUrl(url: string) {
  // Ensure workerSrc is set (idempotent)
  GlobalWorkerOptions.workerSrc = DEFAULT_WORKER_SRC;
  const task = getDocument({ url });
  return await task.promise;
}

// Utility to force a browser download
export function downloadBlob(blob: Blob, fileName: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 0);
}

// Normalize a redacted file name that won’t overwrite the original
export function redactedName(originalName: string) {
  const dot = originalName.lastIndexOf(".");
  if (dot > 0) {
    const base = originalName.slice(0, dot);
    const ext = originalName.slice(dot);
    return `${base}.redacted${ext}`;
  }
  return `${originalName}.redacted.pdf`;
}


/* =========================
   Component
   ========================= */

export default function ProjectWorkspace({ userId, aiRules, setAiRules, userInstructions, setUserInstructions }: ProjectWorkspaceProps) { 
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>(); // projectId is now dynamic for all uploads/snapshots/final PDFs

  if (!projectId) {
    return <div style={{ padding: 24 }}>No project selected.</div>;
  }

  /* ---- PDF & highlights state ---- */
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);

  // const [userId, setUserId] = useState<string>("anonymous");

  const [fabOpen, setFabOpen] = useState(false);

  // Settings page
  const [showSettings, setShowSettings] = useState(false);
  // const [userInstructions, setUserInstructions] = useState<string>("");
  // const [aiRules, setAiRules] = useState<string[]>(
  //   STATIC_AI_RULES.map(r => r.description) // ⬅ ALL selected by default
  // );

  // Filters Page
  const [showFilters, setShowFilters] = useState(false);

  // Undo/redo stacks
  const [undoStack, setUndoStack] = useState<
    Array<{ doc: Record<string, CommentedHighlight[]>; all: Record<string, CommentedHighlight[]> }>
  >([]);

  const [redoStack, setRedoStack] = useState<
    Array<{ doc: Record<string, CommentedHighlight[]>; all: Record<string, CommentedHighlight[]> }>
  >([]);

  const pushUndoState = () => {
    setUndoStack(prev => [
      ...prev,
      {
        doc: structuredClone(docHighlights),
        all: structuredClone(allHighlights)
      }
    ]);
    setRedoStack([]); // Clear redo history when new action happens
  };

  // Active highlights per document
  const [docHighlights, setDocHighlights] = useState<
    Record<string, CommentedHighlight[]>
  >({});

  // Master list per document (all created highlights)
  const [allHighlights, setAllHighlights] = useState<
    Record<string, CommentedHighlight[]>
  >({});


  // === Filter state ===
  const [highlightFilters, setHighlightFilters] = useState<FiltersHighlightFilters>({
    source: "all",      // "all" | "manual" | "ai"
    // category: "all",    // "all" | category string
    categories: [] as string[],
    text: "",
    confidence: 0.0,
  });

  const unfilteredHighlights =
    currentPdfId && docHighlights[currentPdfId]
      ? docHighlights[currentPdfId]
      : [];

  const filteredHighlights = useMemo(() => {
    let list = unfilteredHighlights;

    // Filter by source
    if (highlightFilters.source !== "all") {
      list = list.filter(h => h.source === highlightFilters.source);
    }

    // Filter by category
    if (highlightFilters.categories.length > 0) {
      list = list.filter(h =>
        highlightFilters.categories.includes(h.category)
      );
    }

    // Free text filter
    if (highlightFilters.text.trim()) {
      const q = highlightFilters.text.toLowerCase();
      list = list.filter(h =>
        (h.label?.toLowerCase()?.includes(q)) ||
        (h.comment?.toLowerCase()?.includes(q)) ||
        (h.metadata?.category?.toLowerCase()?.includes(q)) ||
        (h.content?.text?.toLowerCase()?.includes(q))
      );
    }

    // Confidence filter
    if (Number(highlightFilters.confidence) > 0) {
      const threshold = Number(highlightFilters.confidence);

      list = list.filter(h => {
        // Always show manual highlights
        if (h.source !== "ai") return true;

        // AI highlight without a confidence value → keep it
        if (h.metadata?.confidence == null || h.metadata?.confidence == undefined ) return true;
        const confidence_numeric = Number(h.metadata?.confidence);

        // AI highlight with numeric confidence → apply threshold
        return confidence_numeric >= threshold;
      });
    }

    return list;
  }, [unfilteredHighlights, highlightFilters]);

  const currentHighlights = filteredHighlights;

  const currentPdf =
    currentPdfId && uploadedPdfs.length > 0
      ? uploadedPdfs.find((p) => p.id === currentPdfId) ?? null
      : null;

  // ======== Search state ========
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<CommentedHighlight[]>([]);
  const [searchIndex, setSearchIndex] = useState<number>(-1);

  const norm = (s?: string | null) =>
    (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

  useEffect(() => {
    if (!currentPdfId || !searchQuery.trim()) {
      setSearchResults([]);
      setSearchIndex(-1);
      return;
    }

    const q = norm(searchQuery);
    const pool = allHighlights[currentPdfId] ?? [];

    // Match on highlight text or comment (you can remove comment if undesired)
    const results = pool.filter(h => {
      const text = norm(h.content?.text);
      const comment = norm(h.comment);
      return text.includes(q) || comment.includes(q);
    });

    setSearchResults(results);
    setSearchIndex(results.length > 0 ? 0 : -1);
  }, [searchQuery, currentPdfId, allHighlights]);

  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);

  const scrollToSearchIndex = (idx: number) => {
    if (!currentPdfId || idx < 0 || idx >= searchResults.length) return;
    const target = searchResults[idx];
    if (target && highlighterUtilsRef.current) {
      highlighterUtilsRef.current.scrollToHighlight(target);
    }
  };

  const searchNext = () => {
    if (searchResults.length === 0) return;
    setSearchIndex(prev => {
      const next = (prev + 1) % searchResults.length;
      // Scroll after state updates
      setTimeout(() => scrollToSearchIndex(next), 0);
      return next;
    });
  };

  const searchPrev = () => {
    if (searchResults.length === 0) return;
    setSearchIndex(prev => {
      const next = (prev - 1 + searchResults.length) % searchResults.length;
      setTimeout(() => scrollToSearchIndex(next), 0);
      return next;
    });
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSearchIndex(-1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // F3 / Shift+F3 for next/prev (like editors)
      if (e.key === "F3") {
        e.preventDefault();
        if (e.shiftKey) searchPrev();
        else searchNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchResults.length]);

  // === Automatically refresh highlights ====
  useEffect(() => {
    const refreshFlag = localStorage.getItem("aiRefreshProjectId");

    if (refreshFlag && refreshFlag === projectId) {
      console.log("[AI] Auto-refresh triggered for Workspace (Project ID match).");

      // Prevent double-refresh
      localStorage.removeItem("aiRefreshProjectId");

      // 🔥 Trigger your existing restore logic
      // (the same logic in your big useEffect that loads documents + highlights)
      reloadHighlights();
    }
  }, [projectId]);

  // === History (debug timeline) ===
  type Snapshot = {
    doc: Record<string, CommentedHighlight[]>;
    all: Record<string, CommentedHighlight[]>;
  };

  type HistoryEntry = {
    id: string;
    ts: number;            // timestamp
    action: string;        // action label
    prev: Snapshot;        // state before
    next: Snapshot;        // state after
    currentPdfId: string | null;
    counts: {
      prevActive: number;
      nextActive: number;
      prevAll: number;
      nextAll: number;
    };
    note?: string;
  };

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const deepCloneRecords = (
    r: Record<string, CommentedHighlight[]>
  ): Record<string, CommentedHighlight[]> =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [k, v.map((h) => ({ ...h }))])
    );

  const getSnapshot = (): Snapshot => ({
    doc: deepCloneRecords(docHighlights),
    all: deepCloneRecords(allHighlights),
  });

  const countForPdf = (
    r: Record<string, CommentedHighlight[]>,
    pdfId: string | null
  ) => (pdfId ? (r[pdfId]?.length ?? 0) : 0);

  const logHistory = (action: string, prev: Snapshot, next: Snapshot, note?: string) => {
    const entry: HistoryEntry = {
      id: String(Math.random()).slice(2),
      ts: Date.now(),
      action,
      prev,
      next,
      currentPdfId,
      counts: {
        prevActive: countForPdf(prev.doc, currentPdfId),
        nextActive: countForPdf(next.doc, currentPdfId),
        prevAll: countForPdf(prev.all, currentPdfId),
        nextAll: countForPdf(next.all, currentPdfId),
      },
      note,
    };

    // Append entry and move index to the end (debug timeline is linear)
    setHistory((prevList) => [...prevList, entry]);
    setHistoryIndex((idx) => idx + 1);
  };

  // Jump to a specific history snapshot (applies "next" snapshot of that entry)
  const jumpToHistory = (index: number) => {
    const entry = history[index];
    if (!entry) return;

    // Apply the snapshot
    setDocHighlights(entry.next.doc);
    setAllHighlights(entry.next.all);
    setHistoryIndex(index);

    if (currentPdfId) persistHighlightsToDB(currentPdfId);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      
      // Ignore while typing in inputs/contentEditable
      const isEditable = (el: EventTarget | null) => {
        if (!(el instanceof HTMLElement)) return false;
        const tag = el.tagName.toLowerCase();
        const editable = el.getAttribute("contenteditable");
        return tag === "input" || tag === "textarea" || editable === "" || editable === "true";
      };
      if (isEditable(e.target)) return;

      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + , => Settings
      if (mod && !e.shiftKey && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
        return;
      }

      // Ctrl/Cmd + Shift + F => Filters (avoid clashing with Ctrl/Cmd+F Find)
      if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowFilters(true);
        return;
      }

      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        setShowHistory((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---- Viewer / UI state ---- */
  const [zoom, setZoom] = useState<number | null>(null);
  const [highlightPen, setHighlightPen] = useState<boolean>(false);

  // 2) Stable toggle handler (flip once)
  // const handleToggleHighlightPen = React.useCallback(() => {
  //   setHighlightPen(v => !v);
  // }, []);

  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Gate all DB writes until initial restore completes
  const [isRestored, setIsRestored] = useState(false);

  // Debounced persistence timer
  const highlightWriteTimer = useRef<number | null>(null);

  // ----- Undo/redo functionality -----
  const undo = () => {
    if (undoStack.length === 0) return;

    const prevState = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));

    // Push current state to redo stack
    setRedoStack(r => [
      ...r,
      {
        doc: structuredClone(docHighlights),
        all: structuredClone(allHighlights),
      }
    ]);

    // Restore previous state
    setDocHighlights(prevState.doc);
    setAllHighlights(prevState.all);

    if (currentPdfId) persistHighlightsToDB(currentPdfId);
  };

  const redo = () => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setRedoStack(redoStack.slice(0, -1));

    // Push current to undo
    setUndoStack(u => [
      ...u,
      {
        doc: structuredClone(docHighlights),
        all: structuredClone(allHighlights),
      }
    ]);

    // Apply redo state
    setDocHighlights(nextState.doc);
    setAllHighlights(nextState.all);

    if (currentPdfId) persistHighlightsToDB(currentPdfId);
  };

  useEffect(() => {
    const isEditableTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      const contentEditable = el.getAttribute("contenteditable");
      return (
        tag === "input" ||
        tag === "textarea" ||
        contentEditable === "" ||
        contentEditable === "true"
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts while typing in inputs, textareas, or contentEditable
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (!mod) return;

      // ---- UNDO ----
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // ---- REDO (Shift+Z in most apps) ----
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // ---- Optional REDO fallback (Ctrl/Cmd + Y) ----
      if (key === "y") {
        e.preventDefault();
        redo();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  /* =========================
     Initial restore from DB
     ========================= */
  function ensurePosition(h: any): ScaledPosition {
    // Provide a harmless default 1×1 transparent rect on page 1
    return h.position ?? {
      pageNumber: 1,
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 1,
      width: 1,
      height: 1
    };
  }

  function normalizeHighlight(h: any): CommentedHighlight {
    return {
      id: h.id ?? String(Math.random()).slice(2),
      content: h.content ?? { text: "" },
      comment: h.comment ?? "",
      metadata: h.metadata ?? null,
      position: ensurePosition(h),
      label: h.label ?? "",
      source: h.source ?? "manual",
      category: h.category ?? "Sensitive Information (Misc)"
    };
  }

  // App.tsx — replace the Dexie restore effect with this Blob-first restore:
  // useEffect(() => {
  //   (async () => {
  //     try {
  //       // 1) Restore preferences (zoom, highlightPen, lastOpenedPdfId, userIdentity)
  //       const prefs = await db.preferences.get("preferences");
  //       if (prefs) {
  //         setZoom(prefs.zoom);
  //         setHighlightPen(prefs.highlightPenEnabled);
  //         // setUserId(prefs.userIdentity ?? "anonymous");
  //       } else {
  //         // setUserId("anonymous");
  //       }

  //       const effectiveUserId = prefs?.userIdentity ?? "anonymous";

  //       // 2) List user documents from Blob Storage
  //       const docs = (await listUserDocuments(effectiveUserId));

  //       // 🔽 Keep only current project
  //       const docsForProject = docs.filter(d => d.projectId === projectId);

  //       // 3) Build viewer state from working/original + highlights JSON
  //       const uploaded: UploadedPdf[] = [];
  //       const highlightsMap: Record<string, CommentedHighlight[]> = {};
  //       const activeMap: Record<string, CommentedHighlight[]> = {};

  //       for (const d of docsForProject) {
  //         // const projectId = d.projectId;
  //         const fileName = d.fileName;

  //         // Prefer working PDF; else original
  //         let pdfUrl: string | null = null;
  //         if (d.workingPath) {
  //           pdfUrl = await fetchBlobUrl("files", d.workingPath);
  //         } else if (d.originalPath) {
  //           pdfUrl = await fetchBlobUrl("files", d.originalPath);
  //         }

  //         if (!pdfUrl) {
  //           console.warn("[RESTORE] No PDF blob found for project:", projectId);
  //           continue;
  //         }

  //         // Highlights JSON, if present
  //         type HighlightsPayload = {
  //           pdfId: string;
  //           fileName: string;
  //           allHighlights: CommentedHighlight[];
  //           activeHighlights: string[];
  //           savedAt?: string;
  //         };

  //         let all: CommentedHighlight[] = [];
  //         let activeIds: string[] = [];
      
  //         if (d.highlightsPath) {
  //           const payload = await fetchJson<HighlightsPayload>("files", d.highlightsPath);
  //           if (payload) {
  //             // all = payload.allHighlights ?? [];
  //             all = (payload.allHighlights ?? []).map(normalizeHighlight);
  //             activeIds = payload.activeHighlights ?? [];
  //           }
  //         }

  //         const pdfId = buildPdfId(projectId!, fileName);

  //         // highlightsMap[projectId] = all;
  //         // activeMap[projectId] = all.filter(h => activeIds.includes(h.id));
  //         highlightsMap[pdfId] = all;
  //         activeMap[pdfId] = all.filter(h => activeIds.includes(h.id));
  //         console.log("Highlight keys:", Object.keys(highlightsMap));
  //         console.log("Active keys:", Object.keys(activeMap));

  //         uploaded.push({
  //           id: pdfId,
  //           name: fileName,
  //           url: pdfUrl
  //         });

  //         // OPTIONAL: Write Dexie as a cache (but we won't read from it on startup)
  //         await db.pdfs.put({
  //           id: pdfId,
  //           name: fileName,
  //           originalBase64: null,            // we are not reading Dexie as source of truth
  //           workingBase64: null,
  //           finalBase64: null,
  //           allHighlights: all,
  //           activeHighlights: activeIds,
  //         });
  //       }

  //       // 4) Apply to React state
  //       setUploadedPdfs(prev => {
  //         // Revoke previous object URLs (hot reload)
  //         prev.forEach(p => URL.revokeObjectURL(p.url));
  //         return uploaded;
  //       });
  //       setAllHighlights(highlightsMap);
  //       setDocHighlights(activeMap);

  //       // Choose current document: prefer lastOpenedPdfId, else first available
  //       const lastId = prefs?.lastOpenedPdfId ?? null;
  //       const hasLast = lastId && uploaded.some(p => p.id === lastId);
  //       setCurrentPdfId(hasLast ? lastId : (uploaded[0]?.id ?? null));

  //       setIsRestored(true);
  //       console.log("[RESTORE] Blob-first restore complete:", { count: uploaded.length });
  //     } catch (e) {
  //       console.error("[RESTORE] Blob-first restore failed:", e);

  //       // Fallback: If Blob restore fails, optionally fall back to Dexie for offline usage
  //       const pdfs = await db.pdfs.toArray();
  //       const restored: UploadedPdf[] = (pdfs as any[]).map((p: any) => {
  //         const w64 = p.workingBase64 ?? p.originalBase64;
  //         const blob = w64
  //           ? base64ToBlob(w64)
  //           : new Blob([], { type: "application/pdf" });
  //         return {
  //           id: p.id as string,
  //           name: p.name as string,
  //           url: URL.createObjectURL(blob),
  //         };
  //       });

  //       setUploadedPdfs(restored);

  //       const highlightsMap: Record<string, CommentedHighlight[]> = {};
  //       const activeMap: Record<string, CommentedHighlight[]> = {};
  //       for (const p of pdfs as any[]) {
  //         const all: CommentedHighlight[] = p.allHighlights ?? [];
  //         const actIds: string[] = p.activeHighlights ?? [];
  //         highlightsMap[p.id] = all;
  //         activeMap[p.id] = all.filter((h) => actIds.includes(h.id));
  //       }

  //       setAllHighlights(highlightsMap);
  //       setDocHighlights(activeMap);
  //       setIsRestored(true);
  //     }
  //   })();
  // }, []);

  // ===== Pending AI merge queue (pdfId -> payload) =====
  const [pendingAiByPdfId, setPendingAiByPdfId] = useState<Record<string, AiRedactionPayload>>({});

  // Convert backend AI payload (suggestions) -> plugin payload (AiRedactionPayload)
  // function toPluginPayloadFromAiSuggestions(
  //   aiPayload: any,
  //   pdfId: string,
  //   fileName: string
  // ): AiRedactionPayload {
  //   // aiPayload.suggestions elements are assumed shape:
  //   // { id?, content:{text}, position:{ boundingRect{pageNumber}, rects:[{x1,y1,x2,y2} or {x,y,width,height}] }, metadata? }
  //   const items = (aiPayload?.suggestions ?? []).map((s: any) => {
  //     const pageNum = s?.position?.boundingRect?.pageNumber ?? 1;

  //     // Normalize rects: plugin expects rects[] = { x, y, width, height } (normalized 0..1)
  //     const rects = (s?.position?.rects ?? []).map((r: any) => {
  //       if (typeof r.x === "number" && typeof r.width === "number") {
  //         // already x,y,width,height (normalized)
  //         return { x: r.x, y: r.y, width: r.width, height: r.height };
  //       }
  //       // convert from x1,y1,x2,y2 normalized form if that's what backend returns
  //       const x1 = r?.x1 ?? 0, y1 = r?.y1 ?? 0;
  //       const x2 = r?.x2 ?? x1, y2 = r?.y2 ?? y1;
  //       return { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1) };
  //     });

  //     return {
  //       id: s?.id,
  //       content: { text: s?.content?.text ?? "" },
  //       position: {
  //         boundingRect: { x: 0, y: 0, width: 1, height: 1, pageNumber: pageNum }, // only pageNumber is used by plugin
  //         rects
  //       },
  //       metadata: s?.metadata ?? null
  //     };
  //   });

  //   // The plugin uses: payload.allHighlights array (normalized) + ignores activeHighlights here
  //   return {
  //     pdfId,
  //     fileName,
  //     allHighlights: items,
  //     activeHighlights: [],
  //     savedAt: new Date().toISOString()
  //   };
  // }
  // ===== Add near other refs/state =====
  // const [viewportByPage, setViewportByPage] = useState<Record<number, { width: number; height: number }>>({});
  // async function waitForPdfDocumentReady(pdfRef: any, maxAttempts = 40, delay = 100) {
  //   for (let i = 0; i < maxAttempts; i++) {
  //     const pdf = pdfRef.current;
  //     if (pdf && typeof pdf.numPages === "number" && pdf.numPages > 0) {
  //       return pdf;
  //     }
  //     await new Promise(res => setTimeout(res, delay));
  //   }
  //   console.warn("[AI Plugin] pdfDocumentRef never became ready.");
  //   return null;
  // }
  
  const [viewportByPage, setViewportByPage] = useState<Record<number, { width: number; height: number }>>({});

  // Precompute viewport sizes for all pages when pdfDocumentRef is set
  useEffect(() => {
    (async () => {
      const pdf = pdfDocumentRef.current;
      if (!pdf) return;
      console.log(viewportByPage)

      // Try to read the viewer's real scale; fall back to your zoom state or 1.0
      const viewerObj = highlighterUtilsRef.current?.getViewer?.();
      const currentScale =
        (viewerObj && (viewerObj._currentScale || viewerObj.currentScale)) ||
        (zoom ?? 1.0);

      const entries: Array<[number, { width: number; height: number }]> = [];
      for (let pn = 1; pn <= pdf.numPages; pn++) {
        const page = await pdf.getPage(pn);
        const vp = page.getViewport({ scale: currentScale });
        entries.push([pn, { width: vp.width, height: vp.height }]);
      }
      setViewportByPage(Object.fromEntries(entries));
      console.log("[Viewport] Precomputed viewport dims for pages:", Object.keys(Object.fromEntries(entries)));
    })();
    // Recompute when the document changes or zoom changes
  }, [currentPdfId, zoom]);


  function toPluginPayloadFromAiSuggestions(
    aiPayload: any,
    pdfId: string,
    fileName: string
  ): AiRedactionPayload {
    console.log("[AI merge] Raw AI payload (keys):", Object.keys(aiPayload));

    const items = (aiPayload?.allHighlights ?? []).map((s: any) => {
      // const pageNum = s?.position?.boundingRect?.pageNumber ?? 1;

      // Rects are normalized x,y,width,height already
      const rects = (s?.position?.rects ?? []).map((r: any) => ({
        x: Number(r.x) || 0,
        y: Number(r.y) || 0,
        width: Number(r.width) || 0,
        height: Number(r.height) || 0
      }));

      // const b = s.position.boundingRect;

      // const boundingRect = {
      //   x: Number(b.x),
      //   y: Number(b.y),
      //   width: Number(b.width),
      //   height: Number(b.height),
      //   pageNumber: s.pageNumber
      // };

      const item = {
        id: s?.id,
        content: { text: s?.content?.text ?? "" },
        position: {
          boundingRect: s.position.boundingRect,
          rects,
        },
        metadata: s?.metadata ?? null
      };

      return item;
    });

    const payload: AiRedactionPayload = {
      pdfId,
      fileName,
      allHighlights: items,
      activeHighlights: [],
      savedAt: new Date().toISOString()
    };

    console.log("[AI merge] Plugin-compatible payload size:", payload.allHighlights.length);
    return payload;
  }

  useEffect(() => {
    console.log("[AI merge] pending map keys:", Object.keys(pendingAiByPdfId));
  }, [pendingAiByPdfId]);

  const reloadHighlights = async () => {
    let cancelled = false;

    try {
      // 0) Clear state
      setUploadedPdfs([]);
      setAllHighlights({});
      setDocHighlights({});
      setIsRestored(false);

      // 1) Preferences
      const prefs = await db.preferences.get("preferences");
      if (!cancelled && prefs) {
        setZoom(prefs.zoom);
        setHighlightPen(prefs.highlightPenEnabled);
      }
      // const effectiveUserId = prefs?.userIdentity ?? "anonymous";
      const effectiveUserId = userId;

      // 2) List docs
      const docs = await listUserDocuments(effectiveUserId);
      if (cancelled) return;
      const docsForProject = docs.filter(d => d.projectId === projectId);

      // 3) Fetch PDFs + highlights
      const uploaded: UploadedPdf[] = [];
      const highlightsMap: Record<string, CommentedHighlight[]> = {};
      const activeMap: Record<string, CommentedHighlight[]> = {};

      for (const d of docsForProject) {
        const fileName = d.fileName;

        console.log(
          "[DEBUG] Comparing projectId",
          JSON.stringify(d.projectId),
          "===",
          JSON.stringify(projectId),
          d.projectId === projectId
        );

        // working > original
        let pdfUrl = null;
        if (d.workingPath) {
          pdfUrl = await fetchBlobUrl("files", d.workingPath);
        } else if (d.originalPath) {
          pdfUrl = await fetchBlobUrl("files", d.originalPath);
        }
        if (!pdfUrl) continue;

        // highlights
        type HighlightsPayload = {
          pdfId: string;
          fileName: string;
          allHighlights: CommentedHighlight[];
          activeHighlights: string[];
        };

        let all: CommentedHighlight[] = [];
        let activeIds: string[] = [];

        if (d.highlightsPath) {
          const p = await fetchJson<HighlightsPayload>("files", d.highlightsPath);
          if (p) {
            all = (p.allHighlights ?? []).map(normalizeHighlight);
            activeIds = p.activeHighlights ?? [];
          }
        }

        const pdfId = buildPdfId(projectId!, fileName);

        // ---- Queue AI suggestions for this PDF (if any)
        try {
          const baseName = fileName.replace(/\.pdf$/i, "");
          const aiPath = `${effectiveUserId}/${projectId}/ai_redactions/${baseName}.json`;
          console.log("[AI merge] Fetching AI file:", aiPath);
          const aiPayload = await fetchJson<any>("files", aiPath);
          if (aiPayload && Array.isArray(aiPayload.allHighlights) && aiPayload.allHighlights.length > 0) {
            const payloadForPlugin = toPluginPayloadFromAiSuggestions(aiPayload, pdfId, fileName);
            setPendingAiByPdfId(prev => ({
              ...prev,
              [pdfId]: payloadForPlugin
            }));
            console.log("[AI merge] Queued pending AI for", pdfId, "count:", aiPayload.allHighlights.length);
          }
          else {
            console.log("[AI merge] No allHighlights found in:", aiPath);
          }
        } catch (e) {
          console.warn("[AI merge] No ai_redactions or fetch failed for", fileName, e);
        }
        console.log("Pending AI payloads after restore:", pendingAiByPdfId);

        // In-memory viewer state
        highlightsMap[pdfId] = all;
        activeMap[pdfId] = all.filter(h => activeIds.includes(h.id));
        console.log("Highlight map before merge:", highlightsMap[pdfId]);

        uploaded.push({ id: pdfId, name: fileName, url: pdfUrl });

        await db.pdfs.put({
          id: pdfId,
          name: fileName,
          originalBase64: null,
          workingBase64: null,
          finalBase64: null,
          allHighlights: all,
          activeHighlights: activeIds,
        });
      }

      // 4) Apply to state
      setUploadedPdfs(prev => {
        prev.forEach(p => URL.revokeObjectURL(p.url));
        return uploaded;
      });
      setAllHighlights(highlightsMap);
      setDocHighlights(activeMap);

      // 5) Select current PDF
      const lastId = prefs?.lastOpenedPdfId ?? null;
      const hasLast = !!lastId && uploaded.some(p => p.id === lastId);
      setCurrentPdfId(hasLast ? lastId : uploaded[0]?.id ?? null);

      setIsRestored(true);
    } catch (e) {
      console.error("[RESTORE] reloadHighlights failed", e);

      // Fallback branch (Dexie)
      const pdfs = await db.pdfs.toArray();
      const restored: UploadedPdf[] = (pdfs as any[]).map(p => {
        const w64 = p.workingBase64 ?? p.originalBase64;
        const blob = w64 ? base64ToBlob(w64) : new Blob([], { type: "application/pdf" });
        return { id: p.id, name: p.name, url: URL.createObjectURL(blob) };
      });

      setUploadedPdfs(restored);

      const highlightsMap: Record<string, CommentedHighlight[]> = {};
      const activeMap: Record<string, CommentedHighlight[]> = {};
      for (const p of pdfs as any[]) {
        const all = p.allHighlights ?? [];
        const act = p.activeHighlights ?? [];
        highlightsMap[p.id] = all;
        activeMap[p.id] = all.filter((h: CommentedHighlight) => act.includes(h.id));
      }

      setAllHighlights(highlightsMap);
      setDocHighlights(activeMap);
      setIsRestored(true);
    }
  };

  useEffect(() => {
    reloadHighlights();
  }, [projectId]);

  useEffect(() => {
    const flag = localStorage.getItem("aiRefreshProjectId");
    if (flag === projectId) {
      localStorage.removeItem("aiRefreshProjectId");
      reloadHighlights();
    }
  }, [projectId]);

  function isNormalizedRect(b: any) {
    // heuristics: normalized rects have x,y,width,height in [0,1] and no x1/y1
    return (
      b &&
      typeof b.x === "number" &&
      typeof b.y === "number" &&
      typeof b.width === "number" &&
      typeof b.height === "number" &&
      b.x >= 0 && b.x <= 1 &&
      b.y >= 0 && b.y <= 1 &&
      b.width <= 1.0001 &&
      b.height <= 1.0001 &&
      b.pageNumber >= 1
    );
  }

  async function upgradeNormalizedToViewportForDoc(pdfId: string) {
    const utils = highlighterUtilsRef.current;
    const viewerObj = utils?.getViewer?.();
    if (!viewerObj) return;

    const all = allHighlights[pdfId] ?? [];
    let changed = false;

    const upgraded = all.map(h => {
      const br = (h as any)?.position?.boundingRect;
      if (!isNormalizedRect(br)) return h;

      const pageView = viewerObj.getPageView((br.pageNumber ?? 1) - 1);
      if (!pageView) return h;

      const vpW = pageView.viewport.width;
      const vpH = pageView.viewport.height;

      const x1 = br.x * vpW;
      const y1 = br.y * vpH;
      const x2 = x1 + br.width * vpW;
      const y2 = y1 + br.height * vpH;

      const scaledBR = { x1, y1, x2, y2, width: vpW, height: vpH, pageNumber: br.pageNumber ?? 1 };
      changed = true;

      return {
        ...h,
        position: {
          ...h.position,
          boundingRect: scaledBR,
          rects: [{ ...scaledBR }]
        }
      };
    });

    if (changed) {
      console.log("[UPGRADE] Converted normalized → viewport for", pdfId, "(count:", upgraded.length, ")");
      setAllHighlights(prev => ({ ...prev, [pdfId]: upgraded }));

      // Update actives to preserve selection
      const actives = (docHighlights[pdfId] ?? []).map(a => a.id);
      const newActiveList = upgraded.filter(u => actives.includes(u.id));
      setDocHighlights(prev => ({ ...prev, [pdfId]: newActiveList }));

      // Persist to Dexie and Blob
      persistHighlightsToDB(pdfId);
      await saveWorkingSnapshotToBlob(userId, projectId!, pdfId);
    }
  }

  useEffect(() => {
    (async () => {
      if (!isRestored || !currentPdfId) return;
      // try upgrading any normalized entries already in working/*.json
      await upgradeNormalizedToViewportForDoc(currentPdfId);
    })();
  }, [isRestored, currentPdfId]);

  // Apply pending AI suggestions as soon as the viewer is available for the current doc.
  // This uses your plugin to scale to viewport, dedupe, merge into all+doc, and persist.
  // useEffect(() => {
  //   (async () => {
  //     if (!isRestored || !currentPdfId) return;

  //     const utils = highlighterUtilsRef.current;
  //     const viewer = utils?.getViewer?.bind(utils);
  //     if (!viewer) return;

  //     const payload = pendingAiByPdfId[currentPdfId];
  //     console.log("[AI merge] Checking for pending AI payload for", currentPdfId, !!payload ? "FOUND": "NONE");
  //     if (!payload) return;

  //     try {
        
  //       // Merge into React state (with undo/history) using your plugin:
  //       await applyAiRedactionsPlugin({
  //         payload,
  //         currentPdfId,
  //         viewer,
  //         setAllHighlights,
  //         setDocHighlights,
  //         pushUndoState,
  //         getSnapshot,
  //         logHistory,
  //         persist: persistHighlightsToDB,
  //         pdfDoc: pdfDocumentRef.current,
  //         currentScale: zoom ?? 1.0,   // your viewer scale
  //         // getViewportSize: (pn) => viewportByPage[pn] ?? null,
  //       });

  //       // Persist merged working snapshot to Blob immediately (no need to wait for 30s timer)
  //       await saveWorkingSnapshotToBlob(userId, projectId!, currentPdfId);

  //       // Clear queue for this pdfId so we don't re-apply
  //       setPendingAiByPdfId(prev => {
  //         const cp = { ...prev };
  //         delete cp[currentPdfId!];
  //         return cp;
  //       });

  //       // Optional: toast/log
  //       console.log("[AI merge] Applied pending AI and saved working snapshot for", currentPdfId);
  //     } catch (e) {
  //       console.error("[AI merge] Failed to apply pending AI:", e);
  //     }
  //   })();
  // }, [isRestored, currentPdfId, pendingAiByPdfId, userId, projectId]);

  // useEffect(() => {
  //   (async () => {
  //     if (!isRestored || !currentPdfId) return;

  //     const utils = highlighterUtilsRef.current;
  //     const viewerFn = utils?.getViewer?.bind(utils);
  //     if (!viewerFn) return;

  //     // wait for viewer
  //     let viewerObj = null;
  //     for (let i = 0; i < 40; i++) {
  //       viewerObj = viewerFn();
  //       if (viewerObj) break;
  //       await new Promise(res => setTimeout(res, 100));
  //     }
  //     if (!viewerObj) {
  //       console.warn("[AI merge] Viewer never ready");
  //       return;
  //     }

  //     // wait for PDF document
  //     const pdfDoc = await waitForPdfDocumentReady(pdfDocumentRef);
  //     if (!pdfDoc) {
  //       console.warn("[AI merge] pdfDocumentRef never ready");
  //       return;
  //     }

  //     const payload = pendingAiByPdfId[currentPdfId];
  //     if (!payload) return;

  //     try {
  //       await applyAiRedactionsPlugin({
  //         payload,
  //         currentPdfId,
  //         viewer: viewerFn,
  //         setAllHighlights,
  //         setDocHighlights,
  //         pushUndoState,
  //         getSnapshot,
  //         logHistory,
  //         persist: persistHighlightsToDB,
  //         pdfDoc,
  //         currentScale: zoom ?? 1.0,
  //       });

  //       await saveWorkingSnapshotToBlob(userId, projectId!, currentPdfId);

  //       setPendingAiByPdfId(prev => {
  //         const cp = { ...prev };
  //         delete cp[currentPdfId];
  //         return cp;
  //       });

  //     } catch (err) {
  //       console.error("[AI merge] Failed during plugin application", err);
  //     }
  //   })();
  // }, [isRestored, currentPdfId, pendingAiByPdfId, userId, projectId]);

  useEffect(() => {
    (async () => {
      if (!isRestored || !currentPdfId) return;

      // Wait for PDF.js doc to actually load (not null, not stale)
      for (let i = 0; i < 40; i++) {
        const pdf = pdfDocumentRef.current;
        if (pdf && typeof pdf.numPages === "number" && pdf.numPages > 0) {
          break;
        }
        await new Promise(res => setTimeout(res, 150));
      }

      const pdfDoc = pdfDocumentRef.current;
      if (!pdfDoc || !pdfDoc.numPages) {
        console.warn("[AI merge] pdfDocumentRef still not ready");
        return;
      }

      // Now wait for viewer
      const viewerFn = highlighterUtilsRef.current?.getViewer?.bind(highlighterUtilsRef.current);
      if (!viewerFn) return;

      let viewerObj = null;
      for (let i = 0; i < 40; i++) {
        viewerObj = viewerFn();
        if (viewerObj) break;
        await new Promise(res => setTimeout(res, 100));
      }
      if (!viewerObj) {
        console.warn("[AI merge] Viewer never ready");
        return;
      }

      // Now we can safely apply pending AI
      const payload = pendingAiByPdfId[currentPdfId];
      if (!payload) return;

      console.log("[AI merge] APPLY for", currentPdfId);

      await applyAiRedactionsPlugin({
        payload,
        currentPdfId,
        viewer: viewerFn,
        setAllHighlights,
        setDocHighlights,
        pushUndoState,
        getSnapshot,
        logHistory,
        persist: persistHighlightsToDB,
        pdfDoc,                  // fallback scaling OK now
        currentScale: zoom ?? 1,
      });

      await saveWorkingSnapshotToBlob(userId, projectId!, currentPdfId);

      setPendingAiByPdfId(prev => {
        const cp = { ...prev };
        delete cp[currentPdfId];
        return cp;
      });
    })();
  }, [isRestored, currentPdfId, pendingAiByPdfId]);

  // useEffect(() => {
  //   let cancelled = false;

  //   (async () => {
  //     try {
  //       // 0) Clear in-memory state so we never leak between projects
  //       setUploadedPdfs([]);
  //       setAllHighlights({});
  //       setDocHighlights({});
  //       setIsRestored(false);

  //       // 1) Restore preferences (zoom, pen)
  //       const prefs = await db.preferences.get("preferences");
  //       if (!cancelled) {
  //         if (prefs) {
  //           setZoom(prefs.zoom);
  //           setHighlightPen(prefs.highlightPenEnabled);
  //         }
  //       }

  //       const effectiveUserId = prefs?.userIdentity ?? "anonymous";

  //       // 2) List documents (keep only current project)
  //       //    If you added the ?projectId= filter on backend, you can call it instead.
  //       const docs = await listUserDocuments(effectiveUserId);
  //       if (cancelled) return;

  //       const docsForProject = docs.filter((d) => d.projectId === projectId);

  //       // 3) Build viewer state from working/original + highlights JSON
  //       const uploaded: UploadedPdf[] = [];
  //       const highlightsMap: Record<string, CommentedHighlight[]> = {};
  //       const activeMap: Record<string, CommentedHighlight[]> = {};

  //       type HighlightsPayload = {
  //         pdfId: string;
  //         fileName: string;
  //         allHighlights: CommentedHighlight[];
  //         activeHighlights: string[];
  //         savedAt?: string;
  //       };

  //       for (const d of docsForProject) {
  //         const docProjectId = d.projectId; // 🔒 avoid shadowing outer projectId
  //         const fileName = d.fileName;

  //         // 3a) Prefer working PDF; else original
  //         let pdfUrl: string | null = null;
  //         if (d.workingPath) {
  //           pdfUrl = await fetchBlobUrl("files", d.workingPath);
  //         } else if (d.originalPath) {
  //           pdfUrl = await fetchBlobUrl("files", d.originalPath);
  //         }

  //         if (!pdfUrl) {
  //           console.warn("[RESTORE] No PDF blob found for file:", { docProjectId, fileName });
  //           continue;
  //         }

  //         // 3b) Load highlights (if present) and normalize
  //         let all: CommentedHighlight[] = [];
  //         let activeIds: string[] = [];

  //         if (d.highlightsPath) {
  //           const payload = await fetchJson<HighlightsPayload>("files", d.highlightsPath);

  //           // Optional guard: make sure the highlights belong to this file
  //           const highlightsFileName = d.highlightsPath.split("/").pop() ?? "";
  //           const baseFromHighlights = highlightsFileName.replace(/\.highlights\.json$/i, "");
  //           if (payload && baseFromHighlights === `${fileName}`) {
  //             all = (payload.allHighlights ?? []).map(normalizeHighlight);
  //             activeIds = payload.activeHighlights ?? [];
  //           } else if (payload) {
  //             // If mismatched (e.g., earlier backend bug), skip to avoid cross-file contamination
  //             console.warn("[RESTORE] Highlights filename mismatch — skipping", {
  //               fileName,
  //               highlightsFileName,
  //             });
  //           }
  //         }

  //         // 3c) Build stable per-document id
  //         const pdfId = buildPdfId(docProjectId, fileName);

  //         // 3d) Populate maps using pdfId (NEVER projectId)
  //         highlightsMap[pdfId] = all;
  //         activeMap[pdfId] = all.filter((h) => activeIds.includes(h.id));

  //         // 3e) Add to uploaded list
  //         uploaded.push({ id: pdfId, name: fileName, url: pdfUrl });

  //         // 3f) Optional Dexie cache (used by snapshot uploader)
  //         await db.pdfs.put({
  //           id: pdfId,
  //           name: fileName,
  //           originalBase64: null,
  //           workingBase64: null,
  //           finalBase64: null,
  //           allHighlights: all,
  //           activeHighlights: activeIds,
  //         });
  //       }

  //       // ---- DEBUG: log BEFORE state is applied (so you can see the planned keys)
  //       console.log("[RESTORE] BEFORE setState → uploaded ids:", uploaded.map((u) => u.id));
  //       console.log("[RESTORE] BEFORE setState → allHighlights keys:", Object.keys(highlightsMap));
  //       console.log("[RESTORE] BEFORE setState → docHighlights keys:", Object.keys(activeMap));

  //       if (cancelled) return;

  //       // 4) Apply to React state in one go
  //       setUploadedPdfs((prev) => {
  //         // Revoke prior object URLs (hot reload cleanup)
  //         prev.forEach((p) => URL.revokeObjectURL(p.url));
  //         return uploaded;
  //       });
  //       setAllHighlights(highlightsMap);
  //       setDocHighlights(activeMap);

  //       // 5) Select current document (prefer lastOpenedPdfId only if it exists in this project)
  //       const lastId = prefs?.lastOpenedPdfId ?? null;
  //       const hasLast = !!lastId && uploaded.some((p) => p.id === lastId);
  //       setCurrentPdfId(hasLast ? lastId : uploaded[0]?.id ?? null);

  //       setIsRestored(true);
  //       console.log("[RESTORE] DONE:", { count: uploaded.length });
  //     } catch (e) {
  //       console.error("[RESTORE] Blob-first restore failed:", e);

  //       // Fallback to Dexie for offline usage (unchanged)
  //       const pdfs = await db.pdfs.toArray();
  //       const restored: UploadedPdf[] = (pdfs as any[]).map((p: any) => {
  //         const w64 = p.workingBase64 ?? p.originalBase64;
  //         const blob = w64 ? base64ToBlob(w64) : new Blob([], { type: "application/pdf" });
  //         return { id: p.id as string, name: p.name as string, url: URL.createObjectURL(blob) };
  //       });

  //       setUploadedPdfs(restored);

  //       const highlightsMap: Record<string, CommentedHighlight[]> = {};
  //       const activeMap: Record<string, CommentedHighlight[]> = {};
  //       for (const p of pdfs as any[]) {
  //         const all: CommentedHighlight[] = p.allHighlights ?? [];
  //         const actIds: string[] = p.activeHighlights ?? [];
  //         highlightsMap[p.id] = all;
  //         activeMap[p.id] = all.filter((h) => actIds.includes(h.id));
  //       }

  //       setAllHighlights(highlightsMap);
  //       setDocHighlights(activeMap);
  //       setIsRestored(true);
  //     }
  //   })();

  //   return () => {
  //     cancelled = true;
  //   };
  // }, [projectId]); // ⬅ ensure we re-restore when /project/:projectId changes


  /* =========================
     Persist preferences
     ========================= */
  // TODO: restore from Blob/Cosmos DB
  useEffect(() => {
    if (!isRestored) return;
    db.preferences.put({
      id: "preferences",
      lastOpenedPdfId: currentPdfId,
      sidebar: { documents: true, highlights: true }, // (optional) wire up if Sidebar lifts state
      zoom,
      highlightPenEnabled: highlightPen,
      uiMode: "dark",
      userIdentity: null,
      rules: aiRules,                       
      highlightFilters: highlightFilters              
    });
  }, [currentPdfId, zoom, highlightPen, isRestored]);

  /* =========================
     PDF upload handler
     ========================= */
  const handlePdfUpload = async (file: File) => {
    // const id = getNextId();
    const id = buildPdfId(projectId!, file.name);
    const base64 = await fileToBase64(file);

    // Ensure DB row exists BEFORE any highlight writes can occur
    await db.pdfs.put({
      id,
      name: file.name,
      originalBase64: base64,
      workingBase64: base64,
      finalBase64: null,
      allHighlights: [],
      activeHighlights: [],
    });

    // In-memory URL for viewer
    setUploadedPdfs((prev) => [
      ...prev,
      { id, name: file.name, url: URL.createObjectURL(file) },
    ]);

    // Initialize local maps
    setDocHighlights((prev) => ({ ...prev, [id]: [] }));
    setAllHighlights((prev) => ({ ...prev, [id]: [] }));
    setCurrentPdfId(id);

    // Persist preferences
    if (isRestored) {
      await db.preferences.put({
        id: "preferences",
        lastOpenedPdfId: id,
        sidebar: { documents: true, highlights: true },
        zoom,
        highlightPenEnabled: highlightPen,
        uiMode: "dark",
        userIdentity: userId ?? null,
        rules: aiRules ?? null,
        highlightFilters: highlightFilters ?? null
      });
    }

    // upload original pdf to Blob Storage
    // const projectId = "DevTesting"; // This is for dev ONLY - TODO: change at later date to reflect actual project.
    // const projectId: string = projectId!; // projectId is now dynamic for all uploads/snapshots/final PDFs
    try {
        await saveOriginalPdfToBlob(userId, projectId, file);
        console.log("[BLOB] original uploaded:", { userId, projectId: projectId, fileName: file.name });
      } catch (e) {
        console.error("[BLOB] failed to upload original:", e);
      }
  };

  // Compute available categories for the current doc
    const availableCategories: string[] = useMemo(() => {
      if (!currentPdfId) return [];
      const items = allHighlights[currentPdfId] ?? [];
      return Array.from(
        new Set(
          items
            .map(h => h.category as string | undefined)
            .filter((x): x is string => Boolean(x))
        )
      ).sort((a, b) => a.localeCompare(b));
    }, [currentPdfId, allHighlights]);

  /* =========================
     Debounced highlight writer
     ========================= */
  const persistHighlightsToDB = (pdfId: string) => {
    if (!isRestored || !pdfId) return;

    // Clear pending run
    if (highlightWriteTimer.current) {
      window.clearTimeout(highlightWriteTimer.current);
      highlightWriteTimer.current = null;
    }

    // Debounce to coalesce rapid changes
    highlightWriteTimer.current = window.setTimeout(async () => {
      const all = allHighlights[pdfId] ?? [];
      const active = (docHighlights[pdfId] ?? []).map((h) => h.id);

      await db.pdfs.update(pdfId, {
        allHighlights: all,
        activeHighlights: active,
      });
    }, 250);
  };

  // Persist when either allHighlights or active (docHighlights) change
  useEffect(() => {
    if (!isRestored || !currentPdfId) return;
    persistHighlightsToDB(currentPdfId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHighlights, docHighlights, currentPdfId, isRestored]);

  /* =========================
     Safety-net flush on close
     ========================= */
  useEffect(() => {
    const flush = async () => {
      if (!isRestored || !currentPdfId) return;
      await db.pdfs.update(currentPdfId, {
        allHighlights: allHighlights[currentPdfId] ?? [],
        activeHighlights: (docHighlights[currentPdfId] ?? []).map(
          (h) => h.id
        ),
      });
    };

    const onBeforeUnload = () => {
      void flush();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        void flush();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isRestored, currentPdfId, allHighlights, docHighlights]);

  /* =========================
     Context menu handling
     ========================= */
  useEffect(() => {
    const click = () => contextMenu && setContextMenu(null);
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, [contextMenu]);

  const handleContextMenu = (
    event: MouseEvent<HTMLDivElement>,
    highlight: ViewportHighlight<CommentedHighlight>
  ) => {
    event.preventDefault();
    setContextMenu({
      xPos: event.clientX,
      yPos: event.clientY,
      // IMPORTANT: remove fully (active + all + DB)
      deleteHighlight: () => onRemoveHighlight(highlight),
      editComment: () => editComment(highlight),
    });
  };

  /* =========================
     Highlight management
     ========================= */
  const setCurrentDocHighlights = (
    updater:
      | CommentedHighlight[]
      | ((prev: CommentedHighlight[]) => CommentedHighlight[])
  ) => {
    if (!currentPdfId) return;

    setDocHighlights((prev) => {
      const oldArr = prev[currentPdfId] ?? [];
      const next =
        typeof updater === "function" ? (updater as any)(oldArr) : updater;
      return { ...prev, [currentPdfId]: next };
    });
  };

  const addHighlight = (ghost: GhostHighlight, comment: string) => {
    if (!currentPdfId) return;

    pushUndoState();
    const prev = getSnapshot(); // before
    
    // Build manual label: "<userId> added <local date/time>: <optional comment>"
      const timestamp = new Date().toLocaleString();
      const label = `${userId} added ${timestamp}`;
      const category = "Sensitive Information (Misc)"

      const h: CommentedHighlight = {
        id: getNextId(),
        content: ghost.content,                 // from GhostHighlight
        comment: comment || "",
        position: ghost.position as any,        // ScaledPosition-compatible
        metadata: undefined,
        source: "manual",
        label: label,
        category: category
      };

    const nextAll = {
      ...allHighlights,
      [currentPdfId]: [...(allHighlights[currentPdfId] ?? []), h],
    };
    const nextDoc = {
      ...docHighlights,
      [currentPdfId]: [h, ...(docHighlights[currentPdfId] ?? [])],
    };

    setAllHighlights(nextAll);
    setDocHighlights(nextDoc);

    logHistory("Add highlight (manual)", prev, { doc: nextDoc, all: nextAll });

    persistHighlightsToDB(currentPdfId);
  };

  // Legacy: keeps only ACTIVE list in sync, not the master list
  // const deleteHighlight = (h: ViewportHighlight | Highlight) => {
  //   if (!currentPdfId) return;

  //   setCurrentDocHighlights((prev) => prev.filter((x) => x.id !== h.id));

  //   persistHighlightsToDB(currentPdfId);
  // };

  const editHighlight = (id: string, update: Partial<CommentedHighlight>) => {
    if (!currentPdfId) return;

    setCurrentDocHighlights((prev) =>
      prev.map((h) => (h.id === id ? { ...h, ...update } : h))
    );

    setAllHighlights((prev) => ({
      ...prev,
      [currentPdfId]: prev[currentPdfId].map((h) =>
        h.id === id ? { ...h, ...update } : h
      ),
    }));

    persistHighlightsToDB(currentPdfId);
  };

  const resetHighlights = () => {
    if (!currentPdfId) return;

    pushUndoState();

    const prev = getSnapshot();
    const nextDoc = { ...docHighlights, [currentPdfId]: [] };
    setDocHighlights(nextDoc);
    logHistory("Reset highlights", prev, { doc: nextDoc, all: allHighlights });

    persistHighlightsToDB(currentPdfId);
  };

  const toggleHighlightCheckbox = (
    highlight: CommentedHighlight,
    checked: boolean
  ) => {
    if (!currentPdfId) return;

    pushUndoState();

    const prev = getSnapshot();

    let nextDocArr = docHighlights[currentPdfId] ?? [];
    if (checked) {
      if (!nextDocArr.some((h) => h.id === highlight.id)) {
        nextDocArr = [...nextDocArr, highlight];
      }
    } else {
      nextDocArr = nextDocArr.filter((h) => h.id !== highlight.id);
    }

    const nextDoc = { ...docHighlights, [currentPdfId]: nextDocArr };
    setDocHighlights(nextDoc);

    logHistory(`Toggle highlight (${checked ? "check" : "uncheck"})`, prev, { doc: nextDoc, all: allHighlights }, `id=${highlight.id}`);

    persistHighlightsToDB(currentPdfId);
  };

  // ⬇️ NEW: single, stable handler for "Remove" (fully removes)
  const onRemoveHighlight = (
    h: ViewportHighlight | Highlight | CommentedHighlight
  ) => {
    if (!currentPdfId) return;

    pushUndoState();

    const id = (h as any).id as string;

    const prev = getSnapshot();

    const nextDoc = {
      ...docHighlights,
      [currentPdfId]: (docHighlights[currentPdfId] ?? []).filter((x) => x.id !== id),
    };
    const nextAll = {
      ...allHighlights,
      [currentPdfId]: (allHighlights[currentPdfId] ?? []).filter((x) => x.id !== id),
    };

    setDocHighlights(nextDoc);
    setAllHighlights(nextAll);

    logHistory("Remove highlight", prev, { doc: nextDoc, all: nextAll }, `id=${id}`);

    persistHighlightsToDB(currentPdfId);
  };

  // Remove ALL highlights in a group (by id) from active + master + persist
  const onRemoveGroup = (items: CommentedHighlight[]) => {
    if (!currentPdfId) return;

    pushUndoState();

    const prev = getSnapshot();

    const ids = new Set(items.map(i => i.id));

    const nextDoc = {
      ...docHighlights,
      [currentPdfId]: (docHighlights[currentPdfId] ?? []).filter((x) => !ids.has(x.id)),
    };
    const nextAll = {
      ...allHighlights,
      [currentPdfId]: (allHighlights[currentPdfId] ?? []).filter((x) => !ids.has(x.id)),
    };

    setDocHighlights(nextDoc);
    setAllHighlights(nextAll);

    logHistory("Remove all (group)", prev, { doc: nextDoc, all: nextAll }, `count=${ids.size}`);

    // Persist
    persistHighlightsToDB(currentPdfId);
  };

  /* =========================
     Edit comment tip
     ========================= */
  const editComment = (highlight: ViewportHighlight<CommentedHighlight>) => {
    if (!highlighterUtilsRef.current) return;

    const tip: Tip = {
      position: highlight.position,
      content: (
        <CommentForm
          placeHolder={highlight.comment}
          onSubmit={(val) => {
            editHighlight(highlight.id, { 
              comment: val,
              label: `${userId} added ${new Date().toLocaleString()}: ${val}` 
            });
            highlighterUtilsRef.current!.setTip(null);
            highlighterUtilsRef.current!.toggleEditInProgress(false);
          }}
        />
      ),
    };

    highlighterUtilsRef.current.setTip(tip);
    highlighterUtilsRef.current.toggleEditInProgress(true);
  };

  /* =========================
     Hash → scroll to highlight
     ========================= */
  const scrollToHighlightFromHash = () => {
    const target = currentHighlights.find((x) => x.id === parseIdFromHash());
    if (target && highlighterUtilsRef.current) {
      highlighterUtilsRef.current.scrollToHighlight(target);
    }
  };

  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash);
    return () =>
      window.removeEventListener("hashchange", scrollToHighlightFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHighlights]);

  /* =========================
     DEV: Inspect what's in Dexie
     ========================= */
  (window as any).dumpDB = async () => {
    const pdfs = await db.pdfs.toArray();
    const prefs = await db.preferences.toArray();
    console.log({ pdfs, prefs });
  };

  (window as any).flushDBNow = async () => {
    if (!currentPdfId) {
      console.warn("No currentPdfId");
      return;
    }
    await db.pdfs.update(currentPdfId, {
      allHighlights: allHighlights[currentPdfId] ?? [],
      activeHighlights: (docHighlights[currentPdfId] ?? []).map((h) => h.id),
    });
    console.log("[flushDBNow] done");
  };

  /* ====================================================
    Periodic working file snapshot saves to Blob storage
    ===================================================== */
  const lastUploadedSigRef = useRef<string>("");

  const computeWorkingSignature = (pdfId: string): string => {
    const all = allHighlights[pdfId] ?? [];
    const active = (docHighlights[pdfId] ?? []).map(h => h.id);
    // Keep small signature; avoid full JSON dumps on large docs
    return JSON.stringify({
      countAll: all.length,
      countActive: active.length,
      // Optionally include IDs of last few highlights to catch local changes
      tailActive: active.slice(-5),
      tailAll: all.slice(-5).map(h => h.id),
    });
  };

  useEffect(() => {
    if (!isRestored || !currentPdfId) return;

    // const projectId = currentPdfId;
    // const projectId = "DevTesting"; // This is for dev ONLY - TODO: change at later date to reflect actual project.
    // const projectId = projectId!;
    const INTERVAL_MS = 30_000; // every 30 seconds; adjust as needed

    const tick = async () => {
      try {
        const sig = computeWorkingSignature(currentPdfId);
        if (sig !== lastUploadedSigRef.current) {
          await saveWorkingSnapshotToBlob(userId, projectId, currentPdfId);
          lastUploadedSigRef.current = sig;
          console.log("[BLOB] working snapshot uploaded to " + `${userId}/${projectId}/working/${currentPdfId}` + " (changed).");
        } else {
          // optional: skip upload when no changes
          // console.log("[BLOB] no changes; skipping upload");
        }
      } catch (e) {
        console.error("[BLOB] failed to upload working snapshot:", e);
      }
    };

    // Run once soon after switch
    const initial = setTimeout(tick, 2_000);
    // Then periodic
    const interval = setInterval(tick, INTERVAL_MS);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [isRestored, currentPdfId, userId, allHighlights, docHighlights]);

  // ----- Undo/Redo UI state -----
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // Search counters for toolbar
  const searchTotal = searchResults.length;
  const searchPos = searchIndex >= 0 ? searchIndex + 1 : 0;

  /* =========================================================
     📚 NEW — PDF.js extraction for Apply To All
     ========================================================= */

  // Keep a reference to the loaded pdf.js document and cache of page text
  const pdfDocumentRef = useRef<any | null>(null);

  /**
   * Cache of text content per page (PDF.js). Keyed by 1-based pageNumber.
   */
  type CachedPageText = {
    pageNumber: number;
    items: Array<{
      str: string;
      transform: number[];
      width: number;
      height: number;
      fontName?: string;
    }>;
    styles?: Record<string, { ascent?: number; descent?: number; fallbackName?: string }>;
  };
  const pageTextCacheRef = useRef<Map<number, CachedPageText>>(new Map());

  // Clear per-document cache on document switch
  useEffect(() => {
    pageTextCacheRef.current.clear();
  }, [currentPdfId]);
  
  /**
   * Robust rectangle from a PDF.js text item.
   * Uses the text matrix vertical scale (d) for height instead of item.height,
   * and converts the (top-left, bottom-right) from PDF space into viewport space.
   */
  const rectFromTextItem = (
    viewport: any,
    item: { transform: number[]; width: number; height: number; fontName?: string },
    // optional fine-tune in viewport pixels if a tiny nudge is needed
    fudgePx: number = 0
  ) => {
    // const [a, b, c, d, e, f] = item.transform;
    const d = item.transform[3];
    const e = item.transform[4];
    const f = item.transform[5];

    // Baseline in PDF user space
    const baselineX = e;
    const baselineY = f;

    // Use vertical scale from text matrix for height; item.height is not always reliable
    // const fontBoxHeight = Math.abs(d); // positive height magnitude

    // In PDF space (Y up), top is baseline - d
    const topPdfY = baselineY - d;
    const bottomPdfY = baselineY;

    // Convert rect [(x1,y1)->(x2,y2)] from PDF space to viewport space
    const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
      baselineX,           topPdfY,           // top-left in PDF space
      baselineX + item.width, bottomPdfY      // bottom-right in PDF space
    ]);

    let left = Math.min(vx1, vx2);
    let top = Math.min(vy1, vy2);
    let width = Math.abs(vx2 - vx1);
    let height = Math.abs(vy2 - vy1);

    // Optional: tiny upward nudge if your theme/opacity makes it look a hair low.
    if (fudgePx !== 0) {
      top -= fudgePx;
    }

    return { left, top, width, height };
  };

  /**
   * Load & cache PDF.js text items for a page.
   */

  const getPageTextCached = async (pageNumber: number): Promise<CachedPageText | null> => {
    const pdf = pdfDocumentRef.current;
    if (!pdf) return null;

    const cached = pageTextCacheRef.current.get(pageNumber);
    if (cached) return cached;

    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items.map((it: any) => ({
      str: it.str,
      transform: it.transform,
      width: it.width,
      height: it.height,
      fontName: it.fontName, // <-- keep fontName to look up ascent
    }));

    const packed: CachedPageText = { pageNumber, items, styles: textContent.styles };
    pageTextCacheRef.current.set(pageNumber, packed);
    return packed;
  };

  /**
   * Find occurrences of `needle` across all pages using PDF.js text content.
   * Returns ScaledPosition-ready occurrences for direct use when creating highlights.
   * NOTE: per text-item granularity — good for most PDFs. Span-aware matching can be added later.
   */
  
  // Bulk toggle a whole group ON/OFF in a single state update
  const onToggleGroup = React.useCallback(
    (items: CommentedHighlight[], checked: boolean) => {
      if (!currentPdfId) return;

      pushUndoState();
      const prev = getSnapshot();

      const ids = new Set(items.map(i => i.id));
      const prevActive = docHighlights[currentPdfId] ?? [];

      let nextActive: CommentedHighlight[];
      if (checked) {
        // Add any missing items (preserve existing order, append new ones)
        const existing = new Set(prevActive.map(h => h.id));
        const toAdd = items.filter(h => !existing.has(h.id));
        nextActive = [...prevActive, ...toAdd];
      } else {
        // Remove all items in the group
        nextActive = prevActive.filter(h => !ids.has(h.id));
      }

      const nextDoc = { ...docHighlights, [currentPdfId]: nextActive };
      setDocHighlights(nextDoc);

      logHistory(
        `Group toggle (${checked ? "check all" : "uncheck all"})`,
        prev,
        { doc: nextDoc, all: allHighlights },
        `count=${items.length}`
      );

      persistHighlightsToDB(currentPdfId);
    },
    [currentPdfId, docHighlights, allHighlights]
  );

  /* Delete all redactions/clear undo redo/clear history/clear persistence */
  const resetEverything = React.useCallback(() => {
    if (!currentPdfId) return;

    pushUndoState();  // optional — or remove if you *don’t* want this action undoable

    const prev = getSnapshot();

    // Clear all highlights for this PDF
    const nextDoc = { ...docHighlights, [currentPdfId]: [] };
    const nextAll = { ...allHighlights, [currentPdfId]: [] };

    setDocHighlights(nextDoc);
    setAllHighlights(nextAll);

    // Clear history + undo/redo
    setUndoStack([]);
    setRedoStack([]);
    setHistory([]);
    setHistoryIndex(-1);

    logHistory(
      "Full reset (delete all redactions + clear history)",
      prev,
      { doc: nextDoc, all: nextAll },
      "Everything cleared"
    );

    persistHighlightsToDB(currentPdfId);
  }, [
    currentPdfId,
    docHighlights,
    allHighlights,
    pushUndoState,
    getSnapshot,
    persistHighlightsToDB
  ]);

  /**
   * Iterate text nodes under an element in document order.
   */
  const getTextNodesIn = (el: Node): Text[] => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);
    return nodes;
  };

  /**
   * Map a global character offset (within el.textContent) to a {node, offset}.
   * Returns null if the offset falls outside all nodes (very rare).
   */
  const resolveNodeOffset = (
    rootEl: HTMLElement,
    globalOffset: number
  ): { node: Text; offset: number } | null => {
    const nodes = getTextNodesIn(rootEl);
    let acc = 0;
    for (const node of nodes) {
      const len = node.nodeValue?.length ?? 0;
      if (globalOffset <= acc + len) {
        return { node, offset: globalOffset - acc };
      }
      acc += len;
    }
    return null;
  };

  /**
   * ASCII-friendly word char check. For broader Unicode word boundaries, you can
   * switch to /\p{L}|\p{N}|_/u with the 'u' flag, but browser support varies.
   */
  const isWordChar = (ch: string) => /[A-Za-z0-9_]/.test(ch);

  const isWholeWordAt = (text: string, start: number, len: number) => {
    const prev = start - 1;
    const next = start + len;
    const leftOk = prev < 0 || !isWordChar(text[prev]);
    const rightOk = next >= text.length || !isWordChar(text[next]);
    return leftOk && rightOk;
  };

  
  // Round to improve equivalence for nearly-identical float positions
  const round3 = (n: number) => Math.round(n * 1000) / 1000;

  const posKey = (p: any) => {
    // p is ScaledPosition
    const b = p?.boundingRect;
    if (!b) return "";
    return [
      b.pageNumber,
      round3(b.x1),
      round3(b.y1),
      round3(b.x2),
      round3(b.y2),
      // if you ever use usePdfCoordinates, include it in the key:
      p.usePdfCoordinates ? "pdf" : "vp"
    ].join(":");
  };


  /**
   * DOM-first search: prefer the PDF.js text layer spans (textDivs) for perfect
   * visual alignment, fallback to getTextContent() if textDivs aren't ready.
   * Returns scaled positions directly (compatible with your ScaledPosition).
   */
  const findOccurrencesUsingPdfjs = async (needle: string) => {
    const viewer = highlighterUtilsRef.current?.getViewer?.();
    const pdf = pdfDocumentRef.current;
    if (!viewer || !pdf) return [];

    const q = needle.trim();
    if (!q) return [];

    const qLower = q.toLowerCase();
    const numPages = pdf.numPages as number;

    type Found = {
      position: {
        boundingRect: any;
        rects: any[];
      };
      content: { text: string };
    };

    const results: Found[] = [];

    // helper to convert viewport rect → scaled using your viewer’s viewport
    const toScaled = (vpRect: { left: number; top: number; width: number; height: number; pageNumber: number }) => {
      const pageNumber = vpRect.pageNumber;
      const pageViewport = viewer.getPageView(pageNumber - 1).viewport;
      const scaled = {
        x1: vpRect.left,
        y1: vpRect.top,
        x2: vpRect.left + vpRect.width,
        y2: vpRect.top + vpRect.height,
        width: pageViewport.width,
        height: pageViewport.height,
        pageNumber
      };
      return scaled;
    };

    for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
      const pageView = viewer.getPageView(pageNumber - 1);
      const pageViewport = pageView?.viewport;

      // ---- 1) Try DOM-based textDivs first (precise substring rectangles)
      const textLayer: any = (pageView as any)?.textLayer;
      let usedDom = false;

      if (textLayer) {
        const textDivs: HTMLElement[] =
          (textLayer.textDivs as HTMLElement[]) ||
          Array.from((textLayer.div as HTMLElement)?.querySelectorAll("span") ?? []);

        if (textDivs && textDivs.length > 0) {
          usedDom = true;

          for (const div of textDivs) {
            // IMPORTANT: do not trim; indices must match DOM text nodes
            const fullText = div.textContent ?? "";
            if (!fullText) continue;

            const lower = fullText.toLowerCase();
            const target = qLower; // from outer scope
            let from = 0;

            while (from <= lower.length - target.length) {
              const idx = lower.indexOf(target, from);
              if (idx === -1) break;

              // OPTIONAL: require whole-word boundaries
              const requireWholeWord = false; // set true if you ONLY want whole words
              if (!requireWholeWord || isWholeWordAt(fullText, idx, target.length)) {
                // Map global (div-level) offsets to actual (node, offset)
                const startLoc = resolveNodeOffset(div, idx);
                const endLoc = resolveNodeOffset(div, idx + target.length);
                if (startLoc && endLoc) {
                  const range = document.createRange();
                  range.setStart(startLoc.node, startLoc.offset);
                  range.setEnd(endLoc.node, endLoc.offset);

                  // Measure substring box relative to page
                  const rect = range.getBoundingClientRect();
                  const pageDiv = pageView.div as HTMLElement;
                  const pageBox = pageDiv.getBoundingClientRect();

                  const vpRect = {
                    left: rect.left - pageBox.left,
                    top: rect.top - pageBox.top,
                    width: rect.width,
                    height: rect.height,
                    pageNumber
                  };

                  // Convert to scaled using your viewer's viewport
                  const pageViewport = pageView.viewport;
                  const scaled = {
                    x1: vpRect.left,
                    y1: vpRect.top,
                    x2: vpRect.left + vpRect.width,
                    y2: vpRect.top + vpRect.height,
                    width: pageViewport.width,
                    height: pageViewport.height,
                    pageNumber
                  };

                  results.push({
                    position: {
                      boundingRect: scaled,
                      rects: [scaled]
                    },
                    content: { text: fullText.substr(idx, target.length) }
                  });
                }
              }

              from = idx + target.length; // continue after this match
            }
          }
        }
      }

      // ---- 2) Fallback: matrix-based extraction if DOM layer not ready
      if (!usedDom) {
        // Use cached textContent items
        const pageData = await getPageTextCached(pageNumber);
        if (!pageData) continue;

        for (const item of pageData.items) {
          const text = (item.str ?? "").trim();
          if (!text) continue;

          if (text.toLowerCase().includes(qLower)) {
            const rect = rectFromTextItem(pageViewport, item);
            const vp = {
              boundingRect: { ...rect, pageNumber },
              rects: [{ ...rect, pageNumber }],
            };
            results.push({
              position: {
                boundingRect: toScaled(vp.boundingRect),
                rects: vp.rects.map(toScaled),
              },
              content: { text },
            });
          }
        }
      }
    }

    return results;
  };

  /**
   * Apply-to-all via PDF.js: find all occurrences of `text`, create highlights for missing ones,
   * and add them to both master list and active list.
   */
  const applyToAllOccurrences = React.useCallback(
    async (text: string) => {
      if (!currentPdfId) return;

      const clean = text.trim();
      if (!clean) return;

      const occurrences = await findOccurrencesUsingPdfjs(clean);
      if (!occurrences || occurrences.length === 0) return;

      pushUndoState();
      const prev = getSnapshot();

      const existingPos = new Set(
        (allHighlights[currentPdfId] ?? [])
          .filter(h => (h.content?.text ?? "").trim().toLowerCase() === clean.toLowerCase())
          .map(h => posKey(h.position))
      );

      // Also dedupe within this run
      const seenNew = new Set<string>();

      const newItems: CommentedHighlight[] = [];
      for (const o of occurrences) {
        const key = posKey(o.position);
        if (!key) continue;
        if (existingPos.has(key)) continue; // already in master list
        if (seenNew.has(key)) continue;     // duplicate within this run
        seenNew.add(key);

        newItems.push({
          id: getNextId(),
          comment: "",
          content: { text: clean },
          position: o.position as any,
          label: `${userId} applied ${new Date().toLocaleString()}`,
          source: 'manual',
          category: "Sensitive Information (Misc)"
        });
      }

      if (newItems.length === 0) return;

      // Update master + active
      const nextAll = {
        ...allHighlights,
        [currentPdfId]: [...(allHighlights[currentPdfId] ?? []), ...newItems],
      };
      const nextDoc = {
        ...docHighlights,
        [currentPdfId]: [...(docHighlights[currentPdfId] ?? []), ...newItems],
      };

      setAllHighlights(nextAll);
      setDocHighlights(nextDoc);

      logHistory(
        "Apply To All (PDF.js search)",
        prev,
        { doc: nextDoc, all: nextAll },
        `added=${newItems.length}`
      );

      persistHighlightsToDB(currentPdfId);
    },
    [currentPdfId, allHighlights, docHighlights]
  );

  // ⬇️ Existing: bulk-activate or apply all for a group -> now forwards to full document search
  const onApplyAllGroup = React.useCallback(
    (items: CommentedHighlight[]) => {
      if (!items || items.length === 0) return;
      const sample = items[0];
      const text = sample.content?.text ?? "";
      if (!text.trim()) return;
      void applyToAllOccurrences(text);
    },
    [applyToAllOccurrences]
  );

  
  // const removePdf = async (id: string) => {
  //   // remove from IndexedDB
  //   await db.pdfs.delete(id);

  //   // remove from IndexedDB

  //   // remove from state
  //   setUploadedPdfs((prev) => prev.filter((p) => p.id !== id));

  //   // clear selection if needed
  //   if (currentPdfId === id) {
  //     setCurrentPdfId(null);
  //   }
  // };
  
  async function handleDeleteDoc(fileName: string) {
    await removeDocument(userId, projectId!, fileName);

    // update Workspace UI
    setUploadedPdfs(prev => prev.filter(p => p.name !== fileName));
  }

  /* Document de-duplication to pass to Sidebar */
  const findDuplicateDocuments = async () => {
    const pdfs = await db.pdfs.toArray();

    const map = new Map<string, Array<{ id: string; name: string }>>();

    for (const p of pdfs) {
      const key = p.originalBase64 ?? ""; // ensure string key
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ id: p.id, name: p.name });
    }

    // Only groups with more than one doc
    const groups = Array.from(map.values()).filter((g) => g.length > 1);

    // Sort by id (earliest uploaded first) — just a default ordering
    for (const g of groups) {
      g.sort((a, b) => a.id.localeCompare(b.id));
    }

    return groups; // Array<Array<{ id, name }>>
  };

  /* ================================================================
     Initiate backend AI pipeline - generate AI redaction suggestions
     ================================================================= */
  const [isRedacting, setIsRedacting] = useState(false);
  const [lastRedactionStatus, setLastRedactionStatus] = useState<string | null>(null);

  // Optional: capture the last Durable instanceId for debugging/telemetry
  // const [lastInstanceId, setLastInstanceId] = useState<string | null>(null);

  // Helper to build the source blob path for the current document
  // const getSourceBlobPath = () => {
  //   if (!currentPdfId) return null;
  //   // const projectId = "DevTesting"; // (dev) TODO: wire real project
  //   // const projectId = projectId!;
  //   const fileName = uploadedPdfs.find(p => p.id === currentPdfId)?.name;
  //   if (!fileName) return null;
  //   // Your storage convention during dev:
  //   return `files/${userId}/${projectId}/original/${fileName}`;
  // };

  const startRedactionFromSidebar = async () => {
    if (!currentPdfId) {
      alert("Open a PDF first.");
      return;
    }

    const fileName = uploadedPdfs.find(p => p.id === currentPdfId)?.name;
    if (!fileName) {
      alert("Could not determine file name for current PDF.");
      return;
    }
    // const projectId = projectId!;

    setIsRedacting(true);
    setLastRedactionStatus("Starting AI…");

    const abort = new AbortController();
    const { signal } = abort;
    // const startTs = Date.now(); // optional

    try {
      await runAiRedactionForProjectParallel({
        userId,
        projectId,
        fileNames: [fileName],           // SINGLE DOCUMENT MODE
        aiRules,
        userInstructions,
        concurrency: 1,                  // force single
        signal,

        onDocStatus: (name, status) => {
          console.log(`[AI] ${name}: ${status}`);
          setLastRedactionStatus(status);
        },

        onDocComplete: async (name, output) => {
          console.log("[AI] Completed:", { name, output });

          const viewerObj = highlighterUtilsRef.current?.getViewer?.();
          if (!viewerObj) {
            console.warn("[AI] Viewer not ready — retrying");
            setTimeout(() => startRedactionFromSidebar(), 500);
            return;
          }

          await applyAiRedactionsPlugin({
            payload: output,
            currentPdfId,
            viewer: () => viewerObj,

            setAllHighlights,
            setDocHighlights,

            pushUndoState,
            getSnapshot,
            logHistory,
            persist: persistHighlightsToDB
          });

          console.log("[AI] Applied plugin");
        },

        onDocError: (name) => {
          console.error("[AI] FAILED:", name);
          setLastRedactionStatus("Failed");
          alert("AI redaction failed for " + name);
        },

        onBatchProgress: (done, total) => {
          setLastRedactionStatus(`Progress: ${done} / ${total}`);
        }
      });

    } catch (err: Error | any) {
      if (signal.aborted) {
        console.warn("[AI] aborted");
        setLastRedactionStatus("Cancelled");
      } else {
        console.error("[AI] error:", err);
        setLastRedactionStatus("Error");
        alert("AI redaction start failed: " + (err.message || err));
      }
    }

    setIsRedacting(false);
  };

  // const startRedactionFromSidebar = async () => {
  //   if (!currentPdfId) {
  //     alert("Open a PDF first.");
  //     return;
  //   }

  //   const blobPath = getSourceBlobPath();
  //   if (!blobPath) {
  //     alert("Could not determine blob path for current PDF.");
  //     return;
  //   }

  //   try {
  //     setIsRedacting(true);
  //     setLastRedactionStatus("Submitting");

  //     console.log("[AI]: Sending HTTP request to backend API: blobPath " + blobPath + ", rules: " + aiRules + ", userInstructions: " + userInstructions)

  //     // Kick off orchestration via SWA API proxy
  //     const res = await fetch("/api/start-redaction", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       // body: JSON.stringify({ blobName: blobPath })
  //       body: JSON.stringify({
  //         blobName: blobPath,
  //         rules: aiRules,
  //         userInstructions: userInstructions     
  //       })
  //     });
  //     if (!res.ok) {
  //       throw new Error(await res.text());
  //     }

  //     const data = await res.json();
  //     setLastInstanceId(data?.id ?? null);
  //     setLastRedactionStatus("Running");
  //     console.log("[AI] Durable instance ID:", lastInstanceId);

  //     // Durable provides absolute status URL
  //     const statusUrl: string = new URL(data.statusQueryGetUri).toString();

  //     // Poll until terminal state
  //     const pollIntervalMs = 2000;
  //     const ctrl = new AbortController();

  //     const pollOnce = async () => {
  //       const resp = await fetch(statusUrl, { signal: ctrl.signal });
  //       if (!resp.ok) {
  //         console.warn("[AI] Status poll failed:", resp.status);
  //         return;
  //       }
  //       const status = await resp.json();
  //       const state = status.runtimeStatus as string;
  //       setLastRedactionStatus(state);

  //       if (state === "Completed" || state === "Failed" || state === "Terminated") {
  //         ctrl.abort(); // stop polling
  //         setIsRedacting(false);

  //         if (state === "Completed") {
  //           console.log("[AI] Orchestration COMPLETED. Payload:", status.output);

  //           const viewerObj = highlighterUtilsRef.current?.getViewer?.();
  //           console.log("[AI] viewerObj:", viewerObj);

  //           if (!viewerObj) {
  //             console.warn("[AI] Viewer not ready — retrying in 500ms");
  //             setTimeout(() => startRedactionFromSidebar(), 500);
  //             return;
  //           }

  //           console.log("[AI] Calling plugin...");
            
  //           await applyAiRedactionsPlugin({
  //             payload: status.output,
  //             currentPdfId,
  //             viewer: () => viewerObj,
  //             setAllHighlights,
  //             setDocHighlights,
  //             pushUndoState,
  //             getSnapshot,
  //             logHistory,
  //             persist: persistHighlightsToDB
  //           });
  //           console.log("[AI] Plugin DONE.");
  //         }
  //       }
  //     };

  //     // Simple interval loop
  //     const timer = window.setInterval(() => {
  //       // Ignore if already stopped
  //       if (ctrl.signal.aborted) {
  //         clearInterval(timer);
  //         return;
  //       }
  //       pollOnce().catch(err => {
  //         console.warn("[AI] Poll error:", err);
  //       });
  //     }, pollIntervalMs);

  //     // Kick the first poll immediately
  //     pollOnce().catch(() => {});
  //   } catch (err) {
  //     console.error("[AI] Start redaction failed:", err);
  //     setIsRedacting(false);
  //     setLastRedactionStatus("Error");
  //     alert(`Redaction start failed: ${(err as Error)?.message ?? err}`);
  //   }
  // };

  /* ------------------------------------
     Redact and export pdfs (current/all)
     ----------------------------------- */
  // Redact and export current pdf
  async function redactAndExportCurrentPdf() {
    if (!currentPdfId) return;

    const current = uploadedPdfs.find(p => p.id === currentPdfId);
    if (!current) return;

    // Active highlights for the current doc (checkbox-selected)
    const active = docHighlights[currentPdfId] ?? [];
    const activeByPage = groupActiveRectsByPage(active as any);

    // Use the loaded PDF.js document when available (fast path)
    let pdfDoc = pdfDocumentRef.current;
    if (!pdfDoc) {
      // Fallback: load the URL for this PDF
      pdfDoc = await loadPdfDocumentFromUrl(current.url);
    }

    // Build a rasterized redacted PDF
    const finalBlob = await buildRedactedBlobFromPdfjsDoc(pdfDoc, activeByPage, 2.0);

    // Upload to Blob Storage: /final/<fileName>
    // const projectId = "DevTesting"; // TODO: replace with real project ID when available
    // const projectId = projectId!;
    await saveFinalPdfToBlob(userId, projectId!, finalBlob, current.name);

    // Download locally (avoid overwriting original)
    downloadBlob(finalBlob, redactedName(current.name));
  }

  // Redact and export all open pdfs
  async function redactAndExportAllPdfs() {
    // Process sequentially to avoid memory spikes on big docs
    for (const pdf of uploadedPdfs) {
      const active = (docHighlights[pdf.id] ?? []);
      const activeByPage = groupActiveRectsByPage(active as any);

      // If it's the current doc, reuse the already-open pdfDocumentRef
      let pdfDoc = (pdf.id === currentPdfId ? pdfDocumentRef.current : null);
      if (!pdfDoc) {
        pdfDoc = await loadPdfDocumentFromUrl(pdf.url);
      }

      const finalBlob = await buildRedactedBlobFromPdfjsDoc(pdfDoc, activeByPage, 2.0);

      // const projectId = "DevTesting"; // TODO: real project when ready
      // const projectId = projectId!;
      await saveFinalPdfToBlob(userId, projectId!, finalBlob, pdf.name);

      downloadBlob(finalBlob, redactedName(pdf.name));
    }
  }


  /* ==================================
     DEBUG PROJECT PDF/HIGHLIGHT UPLOAD
     ================================== */
  console.log("uploadedPdfs:", uploadedPdfs);
  console.log("allHighlights keys:", Object.keys(allHighlights));
  console.log("docHighlights keys:", Object.keys(docHighlights));
  console.log("currentPdfId:", currentPdfId);
  


  /* =========================
     INFO MODAL & History UI
     ========================= */

  // ----- Render -----
  return (
    <div className="App" style={{ display: "flex", height: "100vh" }}>
      {/* HOME BUTTON */}
      {/* <DefaultButton
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
      {/* HOME BUTTON (Fluent IconButton) */}
      <IconButton
        iconProps={{ iconName: "Home" }}
        title="Home"
        ariaLabel="Go back to home"
        onClick={() => navigate("/")}
        styles={{
          root: {
            position: "fixed",
            top: 14,
            left: 14,
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "white",
            boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            zIndex: 5000,
          },
          icon: { fontSize: 18 }
        }}
      />

      {/* SIDEBAR */}
      <Sidebar
        uploadedPdfs={uploadedPdfs}
        currentPdfId={currentPdfId}
        setCurrentPdfId={setCurrentPdfId}
        allHighlights={allHighlights}
        currentHighlights={currentHighlights}
        setHighlightFilters={setHighlightFilters}
        highlightFilters={highlightFilters}
        toggleHighlightCheckbox={toggleHighlightCheckbox}
        handlePdfUpload={handlePdfUpload}
        removePdf={handleDeleteDoc}
        onFindDuplicates={findDuplicateDocuments} 
        onApplyAllGroup={onApplyAllGroup}
        onRemoveHighlight={onRemoveHighlight}
        onRemoveGroup={onRemoveGroup}
        highlights={currentHighlights}
        resetHighlights={resetHighlights}
        toggleDocument={() => {}}
        onToggleGroup={onToggleGroup}
        resetEverything={resetEverything}
        onStartRedaction={startRedactionFromSidebar}
        isRedacting={isRedacting}
        redactionStatus={lastRedactionStatus}
      />

      {/* MAIN VIEW */}
      <div
        style={{
          height: "100vh",
          width: "75vw",
          overflow: "hidden",
          position: "relative",
          flexGrow: 1,
        }}
      >

      {/* UPLOAD FAB */}
      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 88, // 56px + spacing above the download FAB
          zIndex: 4000
        }}
      >
        <button
          onClick={() => document.getElementById("floating-upload-input")?.click()}
          title="Upload PDF(s)"
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "white",
            color: "#0078d4",
            border: "2px solid #0078d4",
            fontSize: 24,
            cursor: "pointer",
            boxShadow: "0 6px 12px rgba(0,0,0,0.25)"
          }}
        >
          ⬆
        </button>

        <input
          id="floating-upload-input"
          type="file"
          accept="application/pdf"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(file => handlePdfUpload(file));
            e.target.value = "";
          }}
        />
      </div>

      {/* Floating Action Button + Menu - generate final redactions + download pdfs */}
      <div style={{ position: "absolute", right: 16, bottom: 16, zIndex: 4000 }}>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setFabOpen((v) => !v)}
            title="Export redacted"
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              border: "none",
              background: "#0078d4", // Fluent primary
              color: "white",
              boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
              cursor: "pointer",
              fontSize: 24,
              lineHeight: "56px",
            }}
          >
            ⬇︎
          </button>

          {fabOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                bottom: 64,
                background: "white",
                borderRadius: 8,
                boxShadow: "0 8px 18px rgba(0,0,0,0.25)",
                padding: 8,
                minWidth: 260,
              }}
            >
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#333",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onClick={async () => {
                  setFabOpen(false);
                  try {
                    await redactAndExportCurrentPdf();
                  } catch (e) {
                    console.error(e);
                    alert("Failed to export current redacted PDF. See console.");
                  }
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span>🗂️</span> Download final redacted version of current PDF
              </div>

              <div style={{ height: 6 }} />

              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#333",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onClick={async () => {
                  setFabOpen(false);
                  try {
                    await redactAndExportAllPdfs();
                  } catch (e) {
                    console.error(e);
                    alert("Failed to export ALL redacted PDFs. See console.");
                  }
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span>📦</span> Download final redacted versions of all PDFs
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Toolbar (includes ⓘ info button via onShowInfo) */}
        <Toolbar
          setPdfScaleValue={setZoom}
          toggleHighlightPen={() => setHighlightPen(!highlightPen)}
          undo={undo}
          redo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onShowInfo={() => setShowInfoModal(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowFilters={() => setShowFilters(true)} 
          searchQuery={searchQuery}
          onChangeSearch={setSearchQuery}
          onSearchNext={searchNext}
          onSearchPrev={searchPrev}
          onClearSearch={clearSearch}
          searchPos={searchPos}
          searchTotal={searchTotal}
          onToggleHistory={() => setShowHistory((v) => !v)}
        />

        {!currentPdf ? (
          <div
            style={{
              height: "calc(100% - 41px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              opacity: 0.6,
            }}
          >
            Upload a PDF to begin
          </div>
        ) : (
          <PdfLoader key={currentPdfId} document={currentPdf.url}>
            {(pdfDocument) => {
              // 🔗 Capture pdf.js document for PDF.js search & extraction
              pdfDocumentRef.current = pdfDocument;

              return (
                <PdfHighlighter
                  key={currentPdfId}
                  enableAreaSelection={(event) => event.altKey}
                  pdfDocument={pdfDocument}
                  onScrollAway={resetHash}
                  utilsRef={(utils) => {
                    highlighterUtilsRef.current = utils;
                  }}
                  pdfScaleValue={zoom ?? undefined}
                  textSelectionColor={
                    highlightPen ? "rgba(255, 226, 143, 1)" : undefined
                  }
                  onSelection={
                    highlightPen
                      ? (sel) => addHighlight(sel.makeGhostHighlight(), "")
                      : undefined
                  }
                  selectionTip={
                    highlightPen ? undefined : (
                      <ExpandableTip addHighlight={addHighlight} />
                    )
                  }
                  highlights={currentHighlights}
                  style={{ height: "calc(100% - 41px)" }}
                >
                  <HighlightContainer
                    editHighlight={editHighlight}
                    onContextMenu={handleContextMenu}
                  />
                </PdfHighlighter>
              );
            }}
          </PdfLoader>
        )}
      </div>

      {contextMenu && <ContextMenu {...contextMenu} />}

      {/* INFO MODAL */}
      {showInfoModal && (
        <div
          onClick={() => setShowInfoModal(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 5000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              padding: "24px 28px",
              borderRadius: 8,
              width: 380,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Keyboard Shortcuts</h2>
            <ul style={{ fontSize: 15, lineHeight: 1.7 }}>
              <li>
                <strong>↑ / ↓</strong> — Move between redaction groups
              </li>
              <li>
                <strong>Enter</strong> — Toggle selected group
              </li>
              <li>
                <strong>Ctrl + O</strong> — Expand/collapse selected group
              </li>
              <li>
                <strong>Ctrl + E</strong> — Expand all groups
              </li>
              <li>
                <strong>Ctrl + C</strong> — Collapse all groups
              </li>
              <li>
                <strong>Ctrl+Z / ⌘Z</strong> - Undo
              </li>
              <li>
                <strong>Ctrl+Shift+Z / ⌘⇧Z</strong> - Redo
              </li>
              <li>
                <strong>Ctrl + Shft + h</strong> — View history timeline
              </li>
              <li>
                <strong>Ctrl + Shft + f</strong> — Open Filters
              </li>
              <li>
                <strong>Ctrl + ,</strong> — Open Settings
              </li>
            </ul>
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <DefaultButton
                text="Close"
                onClick={() => setShowInfoModal(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div
          onClick={() => setShowSettings(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 5000
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              padding: "24px 28px",
              borderRadius: 8,
              width: 640,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Settings</h2>

            <SettingsPage
              rules={aiRules}
              setRules={setAiRules}
              userInstructions={userInstructions}
              setUserInstructions={setUserInstructions}
              // highlightFilters={highlightFilters}
              // setHighlightFilters={setHighlightFilters}
              availableCategories={availableCategories}
            />

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <DefaultButton text="Close" onClick={() => setShowSettings(false)} />
            </div>
          </div>
        </div>
      )}

      {/* FILTERS MODAL */}
      {showFilters && (
        <div
          onClick={() => setShowFilters(false)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 5000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              padding: "24px 28px",
              borderRadius: 8,
              width: 680,
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Filters</h2>

            <FiltersPage
              highlightFilters={highlightFilters}
              setHighlightFilters={setHighlightFilters}
              availableCategories={availableCategories}
            />

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <DefaultButton text="Close" onClick={() => setShowFilters(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Show History Modal) */}
      {showHistory && (
        <HistoryTimeline
          entries={history}
          currentIndex={historyIndex}
          onJump={jumpToHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};

// export default App;