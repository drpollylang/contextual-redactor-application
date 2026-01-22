// npm run dev
import React, { MouseEvent, useEffect, useRef, useState } from "react";

import CommentForm from "./CommentForm";
import ContextMenu, { ContextMenuProps } from "./ContextMenu";
import ExpandableTip from "./ExpandableTip";
import HighlightContainer from "./HighlightContainer";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar";

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
const resetHash = () => { document.location.hash = ""; };

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

    // Bulk-activate all items in a text group (only adds ones not already active)
    // const applyAllRedactionsForGroup = (items: CommentedHighlight[]) => {
    // if (!currentPdfId) return;

    // setCurrentDocHighlights((prev) => {
    //     const existing = new Set(prev.map((h) => h.id));
    //     const toAdd = items.filter((h) => !existing.has(h.id));
    //     if (toAdd.length === 0) return prev;
    //     return [...prev, ...toAdd]; // preserve order, append new
    // });

    // // if you have the debounced DB writer from the last step, call it:
    // if (typeof persistHighlightsToDB === "function") {
    //     persistHighlightsToDB(currentPdfId);
    // }
    // };
    
    


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

  
    // Bulk-activate all items in a text group (only adds missing ones)
    // const applyAllRedactionsForGroup = (items: CommentedHighlight[]) => {
    // if (!currentPdfId) return;

    // setCurrentDocHighlights((prev) => {
    //     const existing = new Set(prev.map((h) => h.id));
    //     const toAdd = items.filter((h) => !existing.has(h.id));
    //     if (toAdd.length === 0) return prev;
    //     return [...prev, ...toAdd]; // keep original order, append new
    // });

    // // persist debounced
    // persistHighlightsToDB(currentPdfId);
    // };


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

      const restored: UploadedPdf[] = pdfs.map((p) => {
        const w64 = p.workingBase64 ?? p.originalBase64;
        const blob = w64 ? base64ToBlob(w64) : new Blob([], { type: "application/pdf" });
        return {
          id: p.id,
          name: p.name,
          url: URL.createObjectURL(blob),
        };
      });

      setUploadedPdfs(restored);

      // Restore highlights maps
      const highlightsMap: Record<string, CommentedHighlight[]> = {};
      const activeMap: Record<string, CommentedHighlight[]> = {};

      for (const p of pdfs) {
        const all = p.allHighlights ?? [];
        const actIds = p.activeHighlights ?? [];
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

      await db.transaction("rw", db.pdfs, async () => {
        const existing = await db.pdfs.get(pdfId);
        if (!existing) {
          // Create a minimal row if missing for any reason
          await db.pdfs.put({
            id: pdfId,
            name: "Unknown.pdf",
            originalBase64: null,
            workingBase64: null,
            finalBase64: null,
            allHighlights: [],
            activeHighlights: [],
          });
        }
        await db.pdfs.update(pdfId, {
          allHighlights: all,
          activeHighlights: active,
        });
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
        activeHighlights: (docHighlights[currentPdfId] ?? []).map((h) => h.id),
      });
    };

    const onBeforeUnload = () => { void flush(); };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") { void flush(); }
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
      deleteHighlight: () => deleteHighlight(highlight),
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

    const h: CommentedHighlight = { ...ghost, comment, id: getNextId() };

    setAllHighlights((prev) => ({
      ...prev,
      [currentPdfId]: [...(prev[currentPdfId] ?? []), h],
    }));

    setCurrentDocHighlights((prev) => [h, ...prev]);

    persistHighlightsToDB(currentPdfId);
  };

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
    setCurrentDocHighlights([]);
    persistHighlightsToDB(currentPdfId);
  };

  const toggleHighlightCheckbox = (
    highlight: CommentedHighlight,
    checked: boolean
  ) => {
    if (!currentPdfId) return;

    if (checked) {
      setCurrentDocHighlights((prev) =>
        prev.some((h) => h.id === highlight.id) ? prev : [...prev, highlight]
      );
    } else {
      setCurrentDocHighlights((prev) =>
        prev.filter((h) => h.id !== highlight.id)
      );
    }

    persistHighlightsToDB(currentPdfId);
  };

    // ⬇️ ADD/REPLACE: single, stable handler for "Apply all" group action
    const onApplyAllGroup = React.useCallback(
    (items: CommentedHighlight[]) => {
        if (!currentPdfId) return;

        // Only add items that are not already active
        setCurrentDocHighlights((prev) => {
        const existing = new Set(prev.map((h) => h.id));
        const toAdd = items.filter((h) => !existing.has(h.id));
        if (toAdd.length === 0) return prev;
        return [...prev, ...toAdd]; // keep existing order; append missing
        });

        // Persist (debounced) if your writer exists
        // If you followed the persistence guide, this is defined above:
        if (typeof (persistHighlightsToDB as any) === "function") {
        persistHighlightsToDB(currentPdfId);
        }
    },
    [currentPdfId, setCurrentDocHighlights] // persistHighlightsToDB is a stable ref in our previous file
    );

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
    if (!currentPdfId) { console.warn("No currentPdfId"); return; }
    await db.pdfs.update(currentPdfId, {
      allHighlights: allHighlights[currentPdfId] ?? [],
      activeHighlights: (docHighlights[currentPdfId] ?? []).map((h) => h.id),
    });
    console.log("[flushDBNow] done");
  };

  /* =========================
     Render
     ========================= */
  return (
    <div className="App" style={{ display: "flex", height: "100vh" }}>
      {/* SIDEBAR */}
      {/* <Sidebar
        uploadedPdfs={uploadedPdfs}
        currentPdfId={currentPdfId}
        setCurrentPdfId={setCurrentPdfId}
        allHighlights={allHighlights}
        currentHighlights={currentHighlights}
        toggleHighlightCheckbox={toggleHighlightCheckbox}
        handlePdfUpload={handlePdfUpload}
        highlights={currentHighlights}
        resetHighlights={resetHighlights}
        toggleDocument={() => {}}
      /> */}
      
    <Sidebar
    uploadedPdfs={uploadedPdfs}
    currentPdfId={currentPdfId}
    setCurrentPdfId={setCurrentPdfId}
    allHighlights={allHighlights}
    currentHighlights={currentHighlights}
    toggleHighlightCheckbox={toggleHighlightCheckbox}
    handlePdfUpload={handlePdfUpload}
    // NEW ↓
    // onApplyAllGroup={applyAllRedactionsForGroup}
    onApplyAllGroup={onApplyAllGroup}
    // legacy
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
          onShowInfo={() => setShowInfoModal(true)}
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
              <li><strong>↑ / ↓</strong> — Move between redaction groups</li>
              <li><strong>Space / Enter</strong> — Toggle selected group</li>
              <li><strong>O</strong> — Expand/collapse selected group</li>
              <li><strong>E</strong> — Expand all groups</li>
              <li><strong>C</strong> — Collapse all groups</li>
            </ul>
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <DefaultButton text="Close" onClick={() => setShowInfoModal(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;