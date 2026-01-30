
// npm run dev
// v4->v5 Apply To All buttons, persistent storage
import React, { MouseEvent, useEffect, useRef, useState } from "react";

import CommentForm from "./CommentForm";
import ContextMenu, { ContextMenuProps } from "./ContextMenu";
import ExpandableTip from "./ExpandableTip";
import HighlightContainer from "./HighlightContainer";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";
import HistoryTimeline from "./HistoryTimeline";

import {
  GhostHighlight,
  Highlight,
  PdfHighlighter,
  PdfHighlighterUtils,
  PdfLoader,
  Tip,
  ViewportHighlight,
} from "./react-pdf-highlighter-extended";

import "./style/App.css";
import { CommentedHighlight } from "./types";

import { db, fileToBase64, base64ToBlob } from "./storage";
import { DefaultButton } from "@fluentui/react";

// import BlobUploader from "./components/BlobUploader";
// import { getDownloadUrl } from "./lib/blobDownload";
import { saveOriginalPdfToBlob, saveWorkingSnapshotToBlob } from "./lib/blobPersist";
import { listUserDocuments, getDownloadSas } from "./lib/apiClient";

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


/* =========================
   Component
   ========================= */
const App: React.FC = () => {
  /* ---- PDF & highlights state ---- */
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string>("anonymous");

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

  const currentHighlights =
    currentPdfId && docHighlights[currentPdfId]
      ? docHighlights[currentPdfId]
      : [];

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
  // useEffect(() => {
  //   (async () => {
  //     // Restore preferences
  //     const prefs = await db.preferences.get("preferences");
  //     if (prefs) {
  //       setCurrentPdfId(prefs.lastOpenedPdfId);
  //       setZoom(prefs.zoom);
  //       setHighlightPen(prefs.highlightPenEnabled);
  //     }

  //     // Resetore userId
  //     if (prefs) {
  //       setUserId(prefs.userIdentity ?? "anonymous"); // or inject real identity from auth
  //     }

  //     // Restore PDFs
  //     const pdfs = await db.pdfs.toArray();

  //     // Revoke any prior URLs (if hot reloading)
  //     setUploadedPdfs((prev) => {
  //       prev.forEach((p) => URL.revokeObjectURL(p.url));
  //       return [];
  //     });

  //     const restored: UploadedPdf[] = (pdfs as any[]).map((p: any) => {
  //       const w64 = p.workingBase64 ?? p.originalBase64;
  //       const blob = w64
  //         ? base64ToBlob(w64)
  //         : new Blob([], { type: "application/pdf" });
  //       return {
  //         id: p.id as string,
  //         name: p.name as string,
  //         url: URL.createObjectURL(blob),
  //       };
  //     });

  //     setUploadedPdfs(restored);

  //     // Restore highlights maps
  //     const highlightsMap: Record<string, CommentedHighlight[]> = {};
  //     const activeMap: Record<string, CommentedHighlight[]> = {};

  //     for (const p of pdfs as any[]) {
  //       const all: CommentedHighlight[] = p.allHighlights ?? [];
  //       const actIds: string[] = p.activeHighlights ?? [];
  //       highlightsMap[p.id] = all;
  //       activeMap[p.id] = all.filter((h) => actIds.includes(h.id));
  //     }

  //     setAllHighlights(highlightsMap);
  //     setDocHighlights(activeMap);

  //     setIsRestored(true); // signal: restores complete → allow writes
  //   })();
  // }, []);

  // App.tsx — replace the Dexie restore effect with this Blob-first restore:
  useEffect(() => {
    (async () => {
      try {
        // 1) Restore preferences (zoom, highlightPen, lastOpenedPdfId, userIdentity)
        const prefs = await db.preferences.get("preferences");
        if (prefs) {
          setZoom(prefs.zoom);
          setHighlightPen(prefs.highlightPenEnabled);
          setUserId(prefs.userIdentity ?? "anonymous");
        } else {
          setUserId("anonymous");
        }

        const effectiveUserId = prefs?.userIdentity ?? "anonymous";

        // 2) List user documents from Blob Storage
        const docs = await listUserDocuments(effectiveUserId);

        // 3) Build viewer state from working/original + highlights JSON
        const uploaded: UploadedPdf[] = [];
        const highlightsMap: Record<string, CommentedHighlight[]> = {};
        const activeMap: Record<string, CommentedHighlight[]> = {};

        for (const d of docs) {
          const projectId = d.projectId;
          const fileName = d.fileName;

          // Prefer working PDF; else original
          let pdfUrl: string | null = null;
          if (d.workingPath) {
            pdfUrl = await fetchBlobUrl("files", d.workingPath);
          } else if (d.originalPath) {
            pdfUrl = await fetchBlobUrl("files", d.originalPath);
          }

          if (!pdfUrl) {
            console.warn("[RESTORE] No PDF blob found for project:", projectId);
            continue;
          }

          // Highlights JSON, if present
          type HighlightsPayload = {
            pdfId: string;
            fileName: string;
            allHighlights: CommentedHighlight[];
            activeHighlights: string[];
            savedAt?: string;
          };

          let all: CommentedHighlight[] = [];
          let activeIds: string[] = [];

          if (d.highlightsPath) {
            const payload = await fetchJson<HighlightsPayload>("files", d.highlightsPath);
            if (payload) {
              all = payload.allHighlights ?? [];
              activeIds = payload.activeHighlights ?? [];
            }
          }

          highlightsMap[projectId] = all;
          activeMap[projectId] = all.filter(h => activeIds.includes(h.id));

          uploaded.push({
            id: projectId,
            name: fileName,
            url: pdfUrl
          });

          // OPTIONAL: Write Dexie as a cache (but we won't read from it on startup)
          await db.pdfs.put({
            id: projectId,
            name: fileName,
            originalBase64: null,            // we are not reading Dexie as source of truth
            workingBase64: null,
            finalBase64: null,
            allHighlights: all,
            activeHighlights: activeIds,
          });
        }

        // 4) Apply to React state
        setUploadedPdfs(prev => {
          // Revoke previous object URLs (hot reload)
          prev.forEach(p => URL.revokeObjectURL(p.url));
          return uploaded;
        });
        setAllHighlights(highlightsMap);
        setDocHighlights(activeMap);

        // Choose current document: prefer lastOpenedPdfId, else first available
        const lastId = prefs?.lastOpenedPdfId ?? null;
        const hasLast = lastId && uploaded.some(p => p.id === lastId);
        setCurrentPdfId(hasLast ? lastId : (uploaded[0]?.id ?? null));

        setIsRestored(true);
        console.log("[RESTORE] Blob-first restore complete:", { count: uploaded.length });
      } catch (e) {
        console.error("[RESTORE] Blob-first restore failed:", e);

        // Fallback: If Blob restore fails, optionally fall back to Dexie for offline usage
        const pdfs = await db.pdfs.toArray();
        const restored: UploadedPdf[] = (pdfs as any[]).map((p: any) => {
          const w64 = p.workingBase64 ?? p.originalBase64;
          const blob = w64
            ? base64ToBlob(w64)
            : new Blob([], { type: "application/pdf" });
          return {
            id: p.id as string,
            name: p.name as string,
            url: URL.createObjectURL(blob),
          };
        });

        setUploadedPdfs(restored);

        const highlightsMap: Record<string, CommentedHighlight[]> = {};
        const activeMap: Record<string, CommentedHighlight[]> = {};
        for (const p of pdfs as any[]) {
          const all: CommentedHighlight[] = p.allHighlights ?? [];
          const actIds: string[] = p.activeHighlights ?? [];
          highlightsMap[p.id] = all;
          activeMap[p.id] = all.filter((h) => actIds.includes(h.id));
        }

        setAllHighlights(highlightsMap);
        setDocHighlights(activeMap);
        setIsRestored(true);
      }
    })();
  }, []);


  /* =========================
     Persist preferences
     ========================= */
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
    });
  }, [currentPdfId, zoom, highlightPen, isRestored]);

  /* =========================
     PDF upload handler
     ========================= */
  const handlePdfUpload = async (file: File) => {
    const id = getNextId();
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
      });
    }

    // upload original pdf to Blob Storage
    const projectId = "DevTesting"; // This is for dev ONLY - TODO: change at later date to reflect actual project.
    try {
        await saveOriginalPdfToBlob(userId, projectId, file);
        console.log("[BLOB] original uploaded:", { userId, projectId: projectId, fileName: file.name });
      } catch (e) {
        console.error("[BLOB] failed to upload original:", e);
      }
  };

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

    const h: CommentedHighlight = { ...ghost, comment, id: getNextId() };

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

    logHistory("Add highlight", prev, { doc: nextDoc, all: nextAll });

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
            editHighlight(highlight.id, { comment: val });
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
    const projectId = "DevTesting"; // This is for dev ONLY - TODO: change at later date to reflect actual project.
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
  // type CachedPageText = {
  //   pageNumber: number;
  //   items: Array<{
  //     str: string;
  //     transform: number[];
  //     width: number;
  //     height: number;
  //   }>;
  // };
    
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
   * Local version of viewportToScaled (aligns with your ../lib/coordinates.ts)
   */
  // const viewportToScaledLocal = (
  //   rect: { left: number; top: number; width: number; height: number; pageNumber: number },
  //   viewport: { width: number; height: number }
  // ) => {
  //   return {
  //     x1: rect.left,
  //     y1: rect.top,
  //     x2: rect.left + rect.width,
  //     y2: rect.top + rect.height,
  //     width: viewport.width,
  //     height: viewport.height,
  //     pageNumber: rect.pageNumber,
  //   };
  // };

  /**
   * Convert a ViewportPosition to ScaledPosition using the PDF.js viewer's viewport.
   */
  // const viewportPositionToScaledLocal = (
  //   vp: { boundingRect: any; rects: any[] },
  //   viewer: any
  // ) => {
  //   const pageNumber = vp.boundingRect.pageNumber;
  //   const viewport = viewer.getPageView(pageNumber - 1).viewport;
  //   const scale = (obj: any) => viewportToScaledLocal(obj, viewport);
  //   return {
  //     boundingRect: scale(vp.boundingRect),
  //     rects: (vp.rects || []).map(scale),
  //   };
  // };

  /**
   * Convert a PDF.js text item → viewport rectangle using the viewer's viewport.
   * Works for horizontal text. For rotated text, PDF.js transform still maps correctly.
   */
  // const rectFromTextItem = (
  //   viewport: any,
  //   item: { transform: number[]; width: number; height: number }
  // ) => {
  //   const [a, b, c, d, e, f] = item.transform;
  //   const x = e;
  //   const yTop = f;
  //   const w = item.width;
  //   const h = item.height;

  //   // PDF rect: (x, yTop - h) -> (x + w, yTop)
  //   const [vx1, vy1] = viewport.convertToViewportPoint(x, yTop - h);
  //   const [vx2, vy2] = viewport.convertToViewportPoint(x + w, yTop);

  //   const left = Math.min(vx1, vx2);
  //   const top = Math.min(vy1, vy2);
  //   const width = Math.abs(vx2 - vx1);
  //   const height = Math.abs(vy2 - vy1);

  //   return { left, top, width, height };
  // };
  
  /**
   * More precise rectangle using font ascent from textContent.styles (when available).
   * Falls back to convertToViewportRectangle approach if ascent is unavailable.
   */
  // const rectFromTextItem = (
  //   viewport: any,
  //   item: { transform: number[]; width: number; height: number; fontName?: string },
  //   styles?: Record<string, { ascent?: number; descent?: number }>
  // ) => {
  //   const [a, b, c, d, e, f] = item.transform;
  //   const x = e;
  //   const baselineY = f;
  //   const w = item.width;
  //   const h = item.height;

  //   // If we have ascent, compute visual top from baseline:
  //   const ascent = (item.fontName && styles?.[item.fontName]?.ascent != null)
  //     ? styles![item.fontName]!.ascent!
  //     : undefined;

  //   if (typeof ascent === "number" && isFinite(ascent)) {
  //     // glyphTop in PDF space: baseline - ascent * fontSize
  //     const topPdfY = baselineY - (h * ascent);
  //     const bottomPdfY = topPdfY - h; // full em box below top; renders well for most fonts

  //     const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
  //       x,          topPdfY,
  //       x + w,      bottomPdfY
  //     ]);

  //     const left = Math.min(vx1, vx2);
  //     const top = Math.min(vy1, vy2);
  //     const width = Math.abs(vx2 - vx1);
  //     const height = Math.abs(vy2 - vy1);

  //     return { left, top, width, height };
  //   }

  //   // Fallback to rectangle based on (baseline, height)
  //   const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
  //     x,        baselineY,
  //     x + w,    baselineY - h
  //   ]);

  //   const left = Math.min(vx1, vx2);
  //   const top = Math.min(vy1, vy2);
  //   const width = Math.abs(vx2 - vx1);
  //   const height = Math.abs(vy2 - vy1);

  //   return { left, top, width, height };
  // };
  
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
  // const getPageTextCached = async (pageNumber: number): Promise<CachedPageText | null> => {
  //   const pdf = pdfDocumentRef.current;
  //   if (!pdf) return null;

  //   const cached = pageTextCacheRef.current.get(pageNumber);
  //   if (cached) return cached;

  //   const page = await pdf.getPage(pageNumber);
  //   const textContent = await page.getTextContent();
  //   const items = textContent.items.map((it: any) => ({
  //     str: it.str,
  //     transform: it.transform,
  //     width: it.width,
  //     height: it.height,
  //   }));

  //   const packed: CachedPageText = { pageNumber, items };
  //   pageTextCacheRef.current.set(pageNumber, packed);
  //   return packed;
  // };

  /**
   * Compute viewport-relative rect (left/top/width/height) for a DOM element
   * inside the PDF.js page view. We measure relative to the page's canvas layer.
   */
  // const rectFromTextDiv = (textDiv: HTMLElement, pageView: any) => {
  //   const pageDiv = pageView.div as HTMLElement; // page container (positioned)
  //   const pageBox = pageDiv.getBoundingClientRect();
  //   const divBox = textDiv.getBoundingClientRect();

  //   const left = divBox.left - pageBox.left;
  //   const top = divBox.top - pageBox.top;
  //   const width = divBox.width;
  //   const height = divBox.height;

  //   return { left, top, width, height };
  // };

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
  // const findOccurrencesUsingPdfjs = async (needle: string) => {
  //   const viewer = highlighterUtilsRef.current?.getViewer?.();
  //   const pdf = pdfDocumentRef.current;
  //   if (!viewer || !pdf) return [];

  //   const q = needle.trim();
  //   if (!q) return [];

  //   const qLower = q.toLowerCase();

  //   const numPages = pdf.numPages as number;
  //   const results: Array<{
  //     position: {
  //       boundingRect: any;
  //       rects: any[];
  //     };
  //     content: { text: string };
  //   }> = [];

  //   for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
  //     const pageData = await getPageTextCached(pageNumber);
  //     if (!pageData) continue;

  //     const { items } = pageData;
  //     const pageViewport = viewer.getPageView(pageNumber - 1).viewport;

  //     for (const item of items) {
  //       const text = (item.str ?? "").trim();
  //       if (!text) continue;

  //       if (text.toLowerCase().includes(qLower)) {
  //         // const rect = rectFromTextItem(pageViewport, item);
  //         const rect = rectFromTextItemWithAscent(pageViewport, item, pageData.styles, 0.9);
  //         const vp = {
  //           boundingRect: { ...rect, pageNumber },
  //           rects: [{ ...rect, pageNumber }],
  //         };
  //         const scaled = viewportPositionToScaledLocal(vp, viewer);

  //         results.push({
  //           position: scaled,
  //           content: { text },
  //         });
  //       }
  //     }
  //   }

  //   return results;
  // };
  
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

      // ---- 1) Try DOM-based textDivs first
      // pdf.js >=3 exposes text layer API; property names can vary by version:
      // - pageView.textLayer?.textDivs (v3/v4)
      // - pageView.textLayer?.div?.querySelectorAll('span')
      // const textLayer: any = (pageView as any)?.textLayer;
      // let usedDom = false;

      // // if (textLayer) {
      // //   const textDivs: HTMLElement[] =
      // //     (textLayer.textDivs as HTMLElement[]) ||
      // //     Array.from((textLayer.div as HTMLElement)?.querySelectorAll("span") ?? []);

      // //   if (textDivs && textDivs.length > 0) {
      // //     usedDom = true;
      // //     for (const div of textDivs) {
      // //       const text = (div.textContent ?? "").trim();
      // //       if (!text) continue;
      // //       if (text.toLowerCase().includes(qLower)) {
      // //         const rect = rectFromTextDiv(div, pageView); // viewport pixels
      // //         const vp = {
      // //           boundingRect: { ...rect, pageNumber },
      // //           rects: [{ ...rect, pageNumber }],
      // //         };
      // //         results.push({
      // //           position: {
      // //             boundingRect: toScaled(vp.boundingRect),
      // //             rects: vp.rects.map(toScaled),
      // //           },
      // //           content: { text },
      // //         });
      // //       }
      // //     }
      // //   }
      // // }
      
      // if (textLayer) {
      //   const textDivs: HTMLElement[] =
      //     (textLayer.textDivs as HTMLElement[]) ||
      //     Array.from((textLayer.div as HTMLElement)?.querySelectorAll("span") ?? []);

      //   if (textDivs && textDivs.length > 0) {
      //     usedDom = true;

      //     for (const div of textDivs) {
      //       const fullText = (div.textContent ?? "").trim();
      //       if (!fullText) continue;

      //       const lower = fullText.toLowerCase();
      //       let idx = 0;

      //       // Find all occurrences inside this div
      //       while ((idx = lower.indexOf(qLower, idx)) !== -1) {
      //         // --- Measure substring width ---
      //         const range = document.createRange();
      //         range.setStart(div.firstChild!, idx);
      //         range.setEnd(div.firstChild!, idx + q.length);

      //         const rect = range.getBoundingClientRect();

      //         // Locate page top-left to make rect relative to page
      //         const pageDiv = pageView.div as HTMLElement;
      //         const pageBox = pageDiv.getBoundingClientRect();

      //         const vpRect = {
      //           left: rect.left - pageBox.left,
      //           top: rect.top - pageBox.top,
      //           width: rect.width,
      //           height: rect.height,
      //           pageNumber
      //         };

      //         // Convert to scaled
      //         const scaledBounding = toScaled(vpRect);

      //         results.push({
      //           position: {
      //             boundingRect: scaledBounding,
      //             rects: [scaledBounding]
      //           },
      //           content: { text: fullText.substr(idx, q.length) }
      //         });

      //         idx += q.length; // continue searching further occurrences in same div
      //       }
      //     }
      //   }
      // }

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

  
  // type TextStyles = Record<string, { ascent?: number; descent?: number; fallbackName?: string }>;

  // const rectFromTextItemWithAscent = (
  //   viewport: any,
  //   item: { transform: number[]; width: number; height: number; fontName?: string },
  //   styles?: TextStyles,
  //   fudgePx: number = 0
  // ) => {
  //   const [a, b, c, d, e, f] = item.transform;
  //   const baselineX = e;
  //   const baselineY = f;
  //   const w = item.width;

  //   const ascent = item.fontName && styles?.[item.fontName]?.ascent;

  //   if (typeof ascent === "number" && isFinite(ascent)) {
  //     const topPdfY = baselineY - (Math.abs(d) * ascent);
  //     const bottomPdfY = topPdfY + Math.abs(d);

  //     const [vx1, vy1, vx2, vy2] = viewport.convertToViewportRectangle([
  //       baselineX,         topPdfY,
  //       baselineX + w,     bottomPdfY
  //     ]);

  //     let left = Math.min(vx1, vx2);
  //     let top = Math.min(vy1, vy2);
  //     const width = Math.abs(vx2 - vx1);
  //     const height = Math.abs(vy2 - vy1);
  //     if (fudgePx) top -= fudgePx;

  //     return { left, top, width, height };
  //   }

  //   // Fallback to matrix-based version if no ascent
  //   return rectFromTextItem(viewport, item, fudgePx);
  // };


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

      // Consider an existing occurrence the "same" if position (geometry) matches.
      // const existingPos = new Set(
      //   (allHighlights[currentPdfId] ?? [])
      //     .filter(h => (h.content?.text ?? "").trim().toLowerCase() === clean.toLowerCase())
      //     .map(h => JSON.stringify(h.position))
      // );

      // const newItems: CommentedHighlight[] = occurrences
      //   .filter(o => !existingPos.has(JSON.stringify(o.position)))
      //   .map(o => ({
      //     id: getNextId(),
      //     comment: "",
      //     content: { text: clean },
      //     position: o.position as any, // ScaledPosition-compatible
      //   }));
      
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

  
  const removePdf = async (id: string) => {
    // remove from IndexedDB
    await db.pdfs.delete(id);

    // remove from state
    setUploadedPdfs((prev) => prev.filter((p) => p.id !== id));

    // clear selection if needed
    if (currentPdfId === id) {
      setCurrentPdfId(null);
    }
  };

  /* Document de-duplication to pass to Sidebar */
  // v0
  // const findDuplicateDocuments = async () => {
  //   const pdfs = await db.pdfs.toArray();

  //   const map = new Map<string, Array<{ id: string; name: string }>>();

  //   for (const p of pdfs) {
  //     if (!p.originalBase64) continue; // skip nulls entirely
  //     const key = p.originalBase64; // binary-identical content
  //     if (!map.has(key)) map.set(key, []);
  //     map.get(key)!.push({ id: p.id, name: p.name });
  //   }

  //   return Array.from(map.values()).filter(group => group.length > 1);
  // };

  // v1
  // const findDuplicateDocuments = async () => {
  //   const pdfs = await db.pdfs.toArray();

  //   const map = new Map<string, Array<{ id: string; name: string }>>();

  //   for (const p of pdfs) {
  //     const key = p.originalBase64 ?? ""; // ensure string
  //     if (!map.has(key)) map.set(key, []);
  //     map.get(key)!.push({ id: p.id, name: p.name });
  //   }

  //   // Keep only groups with >1
  //   const groups = Array.from(map.values()).filter(g => g.length > 1);

  //   // Sort each group by ID → canonical = first uploaded
  //   for (const g of groups) {
  //     g.sort((a, b) => a.id.localeCompare(b.id));
  //   }

  //   return groups;
  // };

  // v2
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

  // ===============================
  // DEV TEST: Call Durable Function API (redactor-backend-func) - initiate ai pipeline to generate redactions
  // ===============================
  const testStartRedaction = async () => {
    if (!currentPdfId) {
      alert("No PDF loaded!");
      return;
    }

    // For now, hardcode the blob path you want to test
    // Later you'll compute it from your document metadata.
    const blobPath =
      "files/anonymous/DevTesting/original/Telefonica Redaction Email Example 3 Disability.pdf";

    console.log("[AI] Starting redaction for:", blobPath);

    // 1) Trigger orchestration
    const res = await fetch("/api/start_redaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobName: blobPath }),
    });

    if (!res.ok) {
      console.error("[AI] Failed to start:", await res.text());
      return;
    }

    const data = await res.json();
    console.log("[AI] Start response:", data);

    const statusUrl = data.statusQueryGetUri;
    if (!statusUrl) {
      console.error("[AI] No statusQueryGetUri in response.");
      return;
    }

    // 2) Poll for completion
    const poll = setInterval(async () => {
      const s = await fetch(statusUrl);
      const status = await s.json();
      console.log("[AI] Poll status:", status.runtimeStatus);

      if (
        status.runtimeStatus === "Completed" ||
        status.runtimeStatus === "Failed" ||
        status.runtimeStatus === "Terminated"
      ) {
        clearInterval(poll);
        console.log("[AI] Final status:", status);
      }
    }, 2000);
  };

  /* =========================
     INFO MODAL & History UI
     ========================= */

  // ----- Render -----
  return (
    <div className="App" style={{ display: "flex", height: "100vh" }}>
      {/* SIDEBAR */}
      <Sidebar
        uploadedPdfs={uploadedPdfs}
        currentPdfId={currentPdfId}
        setCurrentPdfId={setCurrentPdfId}
        allHighlights={allHighlights}
        currentHighlights={currentHighlights}
        toggleHighlightCheckbox={toggleHighlightCheckbox}
        handlePdfUpload={handlePdfUpload}
        removePdf={removePdf}
        onFindDuplicates={findDuplicateDocuments} 
        onApplyAllGroup={onApplyAllGroup}
        onRemoveHighlight={onRemoveHighlight}
        onRemoveGroup={onRemoveGroup}
        highlights={currentHighlights}
        resetHighlights={resetHighlights}
        toggleDocument={() => {}}
        onToggleGroup={onToggleGroup}
        resetEverything={resetEverything}
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
        
      {/* TEMP TEST BUTTON */}
        <div style={{ padding: 8 }}>
          <DefaultButton
            text="TEST: Generate AI Suggested Redactions"
            onClick={testStartRedaction}
          />
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
          searchQuery={searchQuery}
          onChangeSearch={setSearchQuery}
          onSearchNext={searchNext}
          onSearchPrev={searchPrev}
          onClearSearch={clearSearch}
          searchPos={searchPos}
          searchTotal={searchTotal}
          onToggleHistory={() => setShowHistory((v) => !v)}
        />

        
        {/* DEV TESTING: Add a small block to test Blob storage upload/download */}
        {/* <div style={{ padding: 8, borderBottom: "1px solid #ddd", display: "flex", gap: 12 }}>
          <BlobUploader
            container="files"
            blobPathPrefix={
              currentPdfId
                ? `user123/${currentPdfId}/working` // example per current PDF
                : "user123/anonymous/working"
            }
            onUploaded={(blobPath) => {
              console.log("[uploaded blobPath]", blobPath);
              // Optional: show a toast or attach blobPath to the current document’s record in Dexie
            }}
          />
          <button
            onClick={async () => {
              if (!currentPdfId) return;
              const blobPath = `user123/${currentPdfId}/working/testdoc_0.pdf`; // change to an existing blob
              const url = await getDownloadUrl("files", blobPath, 5);
              window.open(url, "_blank");
            }}
          >
            Download test blob
          </button>
        </div> */}


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
          <PdfLoader document={currentPdf.url}>
            {(pdfDocument) => {
              // 🔗 Capture pdf.js document for PDF.js search & extraction
              pdfDocumentRef.current = pdfDocument;

              return (
                <PdfHighlighter
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
                <strong>Space / Enter</strong> — Toggle selected group
              </li>
              <li>
                <strong>O</strong> — Expand/collapse selected group
              </li>
              <li>
                <strong>E</strong> — Expand all groups
              </li>
              <li>
                <strong>C</strong> — Collapse all groups
              </li>
              <li>
                <strong>Ctrl+Z / ⌘Z</strong> - Undo
              </li>
              <li>
                <strong>trl+Shift+Z / ⌘⇧Z</strong> - Redo
              </li>
              <li>
                <strong>Ctrl + Shft + h</strong> — View history timeline
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

export default App;