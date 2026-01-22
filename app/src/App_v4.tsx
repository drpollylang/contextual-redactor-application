// ----- v3->v4 Persistent storage of docs (original, working, final) and app state (redactions, docs, collapses) using IndexedDB in a form that sets us up to move to Cosmos DB/Blob Storage at later date -----
import React, { MouseEvent, useEffect, useRef, useState } from "react";

import CommentForm from "./CommentForm";
import ContextMenu, { ContextMenuProps } from "./ContextMenu";
import ExpandableTip from "./ExpandableTip";
import HighlightContainer from "./HighlightContainer";
import Toolbar from "./Toolbar";
import Sidebar from "./Sidebar_v2_0";

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
import { DefaultButton, IconButton } from "@fluentui/react";

//
// Helpers
//
const getNextId = () => String(Math.random()).slice(2);
const parseIdFromHash = () =>
  document.location.hash.slice("#highlight-".length);
const resetHash = () => {
  document.location.hash = "";
};

//
// Component
//
const App: React.FC = () => {
  //
  // ===== PDF & STATE =====
  //
  const [uploadedPdfs, setUploadedPdfs] = useState<
    Array<{ id: string; name: string; url: string }>
  >([]);

  const [currentPdfId, setCurrentPdfId] = useState<string | null>(null);

  const [docHighlights, setDocHighlights] = useState<
    Record<string, CommentedHighlight[]>
  >({});

  const [allHighlights, setAllHighlights] = useState<
    Record<string, CommentedHighlight[]>
  >({});

  const [sidebarState, setSidebarState] = useState({
    documents: true,
    highlights: true,
  });

  const [zoom, setZoom] = useState<number | null>(null);
  const [highlightPen, setHighlightPen] = useState<boolean>(false);

  const [uiMode, setUiMode] = useState<"dark" | "light">("dark");
  const [userIdentity, setUserIdentity] = useState<string | null>(null);

  const currentHighlights =
    currentPdfId && docHighlights[currentPdfId]
      ? docHighlights[currentPdfId]
      : [];

  const currentPdf =
    currentPdfId && uploadedPdfs.length > 0
      ? uploadedPdfs.find((p) => p.id === currentPdfId) ?? null
      : null;

  const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const highlighterUtilsRef = useRef<PdfHighlighterUtils | null>(null);

  //
  // ===== LOAD APP STATE ON START =====
  //
  useEffect(() => {
    (async () => {
      // Load preferences
      const prefs = await db.preferences.get("preferences");
      if (prefs) {
        setCurrentPdfId(prefs.lastOpenedPdfId);
        setSidebarState(prefs.sidebar);
        setZoom(prefs.zoom);
        setHighlightPen(prefs.highlightPenEnabled);
        setUiMode(prefs.uiMode);
        setUserIdentity(prefs.userIdentity);
      }

      // Load PDFs
      const pdfs = await db.pdfs.toArray();

      const restored = pdfs.map((p) => ({
        id: p.id,
        name: p.name,
        url: URL.createObjectURL(base64ToBlob(p.workingBase64!)),
      }));

      setUploadedPdfs(restored);

      // Map highlights back into per-doc state
      const highlightsMap: Record<string, CommentedHighlight[]> = {};
      const activeMap: Record<string, CommentedHighlight[]> = {};

      for (const p of pdfs) {
        highlightsMap[p.id] = p.allHighlights ?? [];
        activeMap[p.id] = (p.allHighlights ?? []).filter((h) =>
          (p.activeHighlights ?? []).includes(h.id)
        );
      }

      setAllHighlights(highlightsMap);
      setDocHighlights(activeMap);
    })();
  }, []);

  //
  // ===== SAVE PREFERENCES ON CHANGE =====
  //
  useEffect(() => {
    db.preferences.put({
      id: "preferences",
      lastOpenedPdfId: currentPdfId,
      sidebar: sidebarState,
      zoom,
      highlightPenEnabled: highlightPen,
      uiMode,
      userIdentity,
    });
  }, [
    currentPdfId,
    sidebarState,
    zoom,
    highlightPen,
    uiMode,
    userIdentity,
  ]);

  //
  // ===== HANDLE PDF UPLOAD =====
  //
  const handlePdfUpload = async (file: File) => {
    const id = getNextId();
    const base64 = await fileToBase64(file);

    // Persist PDF in DB
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

    setCurrentPdfId(id);

    // Initialize local highlight maps
    setDocHighlights((prev) => ({ ...prev, [id]: [] }));
    setAllHighlights((prev) => ({ ...prev, [id]: [] }));
  };

  //
  // ===== HIGHLIGHT SYNC TO DB =====
  //
  useEffect(() => {
    if (!currentPdfId) return;

    db.pdfs.update(currentPdfId, {
      allHighlights: allHighlights[currentPdfId] ?? [],
      activeHighlights: currentHighlights.map((h) => h.id),
    });
  }, [allHighlights, currentHighlights, currentPdfId]);

  //
  // ===== CONTEXT MENU =====
  //
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

  //
  // ===== HIGHLIGHT MANAGEMENT =====
  //
  const setCurrentDocHighlights = (
    updater:
      | CommentedHighlight[]
      | ((prev: CommentedHighlight[]) => CommentedHighlight[])
  ) => {
    if (!currentPdfId) return;

    setDocHighlights((prev) => {
      const oldArr = prev[currentPdfId] ?? [];
      const next =
        typeof updater === "function" ? updater(oldArr) : updater;
      return { ...prev, [currentPdfId]: next };
    });
  };

  const addHighlight = (ghost: GhostHighlight, comment: string) => {
    if (!currentPdfId) return;

    const h: CommentedHighlight = {
      ...ghost,
      comment,
      id: getNextId(),
    };

    setAllHighlights((prev) => ({
      ...prev,
      [currentPdfId]: [...(prev[currentPdfId] ?? []), h],
    }));

    setCurrentDocHighlights((prev) => [h, ...prev]);
  };

  const deleteHighlight = (h: ViewportHighlight | Highlight) => {
    if (!currentPdfId) return;

    setCurrentDocHighlights((prev) => prev.filter((x) => x.id !== h.id));
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
  };

  const resetHighlights = () => {
    if (!currentPdfId) return;
    setCurrentDocHighlights([]);
  };

  const toggleHighlightCheckbox = (
    highlight: CommentedHighlight,
    checked: boolean
  ) => {
    if (!currentPdfId) return;

    if (checked) {
      if (!currentHighlights.some((h) => h.id === highlight.id)) {
        setCurrentDocHighlights((prev) => [...prev, highlight]);
      }
    } else {
      setCurrentDocHighlights((prev) =>
        prev.filter((h) => h.id !== highlight.id)
      );
    }
  };

  //
  // ===== COMMENT EDIT TIP =====
  //
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

  //
  // ===== SCROLL TO HIGHLIGHT FROM HASH =====
  //
  const scrollToHighlightFromHash = () => {
    const h = currentHighlights.find(
      (x) => x.id === parseIdFromHash()
    );
    if (h && highlighterUtilsRef.current) {
      highlighterUtilsRef.current.scrollToHighlight(h);
    }
  };

  useEffect(() => {
    window.addEventListener("hashchange", scrollToHighlightFromHash);
    return () =>
      window.removeEventListener("hashchange", scrollToHighlightFromHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHighlights]);

  //
  // ========================
  //       RENDER
  // ========================
  //
  return (
    <div className="App" style={{ display: "flex", height: "100vh" }}>
      <Sidebar
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
      />

      <div
        style={{
          height: "100vh",
          width: "75vw",
          overflow: "hidden",
          flexGrow: 1,
          position: "relative",
        }}
      >
        {/* TOOLBAR */}
        <Toolbar
          setPdfScaleValue={setZoom}
          toggleHighlightPen={() => setHighlightPen(!highlightPen)}
          onShowInfo={() => setShowInfoModal(true)}
        />

        {/* PDF VIEW */}
        {!currentPdf ? (
          <div
            style={{
              height: "calc(100% - 41px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 0.6,
            }}
          >
            Upload a PDF to begin
          </div>
        ) : (
          <PdfLoader document={currentPdf.url}>
            {(pdfDocument) => (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                enableAreaSelection={(e) => e.altKey}
                onScrollAway={resetHash}
                utilsRef={(utils) => (highlighterUtilsRef.current = utils)}
                pdfScaleValue={zoom ?? undefined}
                textSelectionColor={
                  highlightPen ? "rgba(255, 226, 143, 1)" : undefined
                }
                onSelection={
                  highlightPen
                    ? (sel) =>
                        addHighlight(sel.makeGhostHighlight(), "")
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
            <h2>Keyboard Shortcuts</h2>
            <ul style={{ lineHeight: 1.6 }}>
              <li><strong>↑ / ↓</strong> – Move between redaction groups</li>
              <li><strong>Space / Enter</strong> – Toggle a group</li>
              <li><strong>O</strong> – Expand/collapse group</li>
              <li><strong>E</strong> – Expand all</li>
              <li><strong>C</strong> – Collapse all</li>
            </ul>
            <div style={{ textAlign: "right" }}>
              <DefaultButton text="Close" onClick={() => setShowInfoModal(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
