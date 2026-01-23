
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

/* =========================
   Component
   ========================= */
const App: React.FC = () => {
  /* ---- PDF & highlights state ---- */
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);

  
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

  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Gate all DB writes until initial restore completes
  const [isRestored, setIsRestored] = useState(false);

  // Debounced persistence timer
  const highlightWriteTimer = useRef<number | null>(null);

  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);

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
  useEffect(() => {
    (async () => {
      // Restore preferences
      const prefs = await db.preferences.get("preferences");
      if (prefs) {
        setCurrentPdfId(prefs.lastOpenedPdfId);
        setZoom(prefs.zoom);
        setHighlightPen(prefs.highlightPenEnabled);
      }

      // Restore PDFs
      const pdfs = await db.pdfs.toArray();

      // Revoke any prior URLs (if hot reloading)
      setUploadedPdfs((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });

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

      // Restore highlights maps
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

      setIsRestored(true); // signal: restores complete → allow writes
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
        userIdentity: null,
      });
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

    // setAllHighlights((prev) => ({
    //   ...prev,
    //   [currentPdfId]: [...(prev[currentPdfId] ?? []), h],
    // }));

    // setCurrentDocHighlights((prev) => [h, ...prev]);
    
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
  const deleteHighlight = (h: ViewportHighlight | Highlight) => {
    if (!currentPdfId) return;

    setCurrentDocHighlights((prev) => prev.filter((x) => x.id !== h.id));

    persistHighlightsToDB(currentPdfId);
  };

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

    // setCurrentDocHighlights([]);
    
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

    // if (checked) {
    //   setCurrentDocHighlights((prev) =>
    //     prev.some((h) => h.id === highlight.id) ? prev : [...prev, highlight]
    //   );
    // } else {
    //   setCurrentDocHighlights((prev) =>
    //     prev.filter((h) => h.id !== highlight.id)
    //   );
    // }
    
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

    // // Remove from active
    // setDocHighlights((prev) => {
    //   const arr = prev[currentPdfId] ?? [];
    //   return { ...prev, [currentPdfId]: arr.filter((x) => x.id !== id) };
    // });

    // // Remove from master list
    // setAllHighlights((prev) => {
    //   const arr = prev[currentPdfId] ?? [];
    //   return { ...prev, [currentPdfId]: arr.filter((x) => x.id !== id) };
    // });
    
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

  // ⬇️ Existing: bulk-activate all items in a text group (adds missing)
  const onApplyAllGroup = React.useCallback(
    (items: CommentedHighlight[]) => {
      if (!currentPdfId) return;

      pushUndoState();

    //   setCurrentDocHighlights((prev) => {
    //     const existing = new Set(prev.map((h) => h.id));
    //     const toAdd = items.filter((h) => !existing.has(h.id));
    //     if (toAdd.length === 0) return prev;
    //     return [...prev, ...toAdd]; // keep existing order; append missing
    //   });

    //   if (typeof (persistHighlightsToDB as any) === "function") {
    //     persistHighlightsToDB(currentPdfId);
    //   }
    // },
    // [currentPdfId]
    
    const prev = getSnapshot();

    const existing = new Set((docHighlights[currentPdfId] ?? []).map((h) => h.id));
    const toAdd = items.filter((h) => !existing.has(h.id));
    const nextDoc = {
      ...docHighlights,
      [currentPdfId]: [...(docHighlights[currentPdfId] ?? []), ...toAdd],
    };

    setDocHighlights(nextDoc);
    // allHighlights unchanged = same reference
    logHistory("Apply all (group)", prev, { doc: nextDoc, all: allHighlights });

    persistHighlightsToDB(currentPdfId);
  }, [currentPdfId, docHighlights, allHighlights]
);

  // Remove ALL highlights in a group (by id) from active + master + persist
  const onRemoveGroup = (items: CommentedHighlight[]) => {
  if (!currentPdfId) return;

  pushUndoState();

  const prev = getSnapshot();

  const ids = new Set(items.map(i => i.id));

  // // Remove from active highlights
  // setDocHighlights(prev => {
  //     const arr = prev[currentPdfId] ?? [];
  //     return { ...prev, [currentPdfId]: arr.filter(x => !ids.has(x.id)) };
  // });

  // // Remove from master list
  // setAllHighlights(prev => {
  //     const arr = prev[currentPdfId] ?? [];
  //     return { ...prev, [currentPdfId]: arr.filter(x => !ids.has(x.id)) };
  // });
  
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
  window.dumpDB = async () => {
    const pdfs = await db.pdfs.toArray();
    const prefs = await db.preferences.toArray();
    console.log({ pdfs, prefs });
  };

  window.flushDBNow = async () => {
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

  
  // ----- Undo/Redo UI state -----
  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;


  /* =========================
     Render
     ========================= */
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
        onApplyAllGroup={onApplyAllGroup}
        onRemoveHighlight={onRemoveHighlight}
        onRemoveGroup={onRemoveGroup} 
        highlights={currentHighlights}
        resetHighlights={resetHighlights}
        toggleDocument={() => {}}
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
        {/* Toolbar (includes ⓘ info button via onShowInfo) */}
        <Toolbar
          setPdfScaleValue={setZoom}
          toggleHighlightPen={() => setHighlightPen(!highlightPen)}
          undo={undo}
          redo={redo} 
          canUndo={canUndo}
          canRedo={canRedo}
          onShowInfo={() => setShowInfoModal(true)}
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
          <PdfLoader document={currentPdf.url}>
            {(pdfDocument) => (
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
            )}
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
