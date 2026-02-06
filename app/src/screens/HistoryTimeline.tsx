
import React from "react";
import { CommentedHighlight } from "../types";

type Snapshot = {
  doc: Record<string, CommentedHighlight[]>;
  all: Record<string, CommentedHighlight[]>;
};

export type HistoryEntry = {
  id: string;
  ts: number;
  action: string;
  prev: Snapshot;
  next: Snapshot;
  currentPdfId: string | null;
  counts: {
    prevActive: number;
    nextActive: number;
    prevAll: number;
    nextAll: number;
  };
  note?: string;
};

type Props = {
  entries: HistoryEntry[];
  currentIndex: number;
  onJump: (index: number) => void;
  onClose: () => void;
};

const fmt = (ts: number) =>
  new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const HistoryTimeline: React.FC<Props> = ({ entries, currentIndex, onJump, onClose }) => {
  return (
    <div
      style={{
        position: "fixed",
        right: 12,
        top: 56,
        bottom: 12,
        width: 420,
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid #eee",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <strong>History Timeline</strong>
        <span style={{ opacity: 0.6, fontSize: 12 }}>({entries.length} events)</span>
        <span style={{ marginLeft: "auto" }} />
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
          title="Close"
        >
          ✕
        </button>
      </div>

      <div style={{ overflowY: "auto", padding: "8px 6px" }}>
        {entries.length === 0 ? (
          <div style={{ padding: 12, opacity: 0.6 }}>No history yet.</div>
        ) : (
          entries.map((e, idx) => {
            const isCurrent = idx === currentIndex;
            const deltaActive = e.counts.nextActive - e.counts.prevActive;
            const deltaAll = e.counts.nextAll - e.counts.prevAll;
            const deltaActiveStr =
              deltaActive === 0 ? "±0" : deltaActive > 0 ? `+${deltaActive}` : `${deltaActive}`;
            const deltaAllStr =
              deltaAll === 0 ? "±0" : deltaAll > 0 ? `+${deltaAll}` : `${deltaAll}`;

            return (
              <div
                key={e.id}
                onClick={() => onJump(idx)}
                style={{
                  borderRadius: 6,
                  padding: "8px 10px",
                  margin: "6px 6px",
                  border: isCurrent ? "1px solid #0078d4" : "1px solid #eee",
                  background: isCurrent ? "rgba(0,120,212,0.10)" : "#fff",
                  cursor: "pointer",
                }}
                title={e.note}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.7 }}>
                    {fmt(e.ts)}
                  </span>
                  <strong style={{ fontSize: 13 }}>{e.action}</strong>
                  <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.8 }}>
                    Active: {e.counts.prevActive} → {e.counts.nextActive} ({deltaActiveStr})
                    {" · "}
                    All: {e.counts.prevAll} → {e.counts.nextAll} ({deltaAllStr})
                  </span>
                </div>
                {e.note && (
                  <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{e.note}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default HistoryTimeline;
