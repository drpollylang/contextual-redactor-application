// src/FiltersPage.tsx
import * as React from "react";

export type HighlightFilters = {
  source: "all" | "manual" | "ai";
  categories: string[];
  text: string;
  confidence: number;
};

export interface FiltersPageProps {
  highlightFilters: HighlightFilters;
  setHighlightFilters: React.Dispatch<React.SetStateAction<HighlightFilters>>;
  /** Categories available for the current document */
  availableCategories: string[];
}

const FiltersPage: React.FC<FiltersPageProps> = ({
  highlightFilters,
  setHighlightFilters,
  availableCategories
}) => {
  const allSelected = (highlightFilters.categories?.length ?? 0) === 0;

  const toggleCategoryChip = (cat: string) => {
    setHighlightFilters((f) => {
      if (allSelected) {
        // Start explicit selection with the clicked category
        return { ...f, categories: [cat] };
      }
      const next = new Set(f.categories);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return { ...f, categories: [...next] };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <h3 style={{ margin: "0 0 8px" }}>Filter Redactions</h3>

      {/* Source filter */}
      <div>
        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>Source</label>
        <select
          value={highlightFilters.source}
          onChange={(e) =>
            setHighlightFilters((f) => ({
              ...f,
              source: e.target.value as HighlightFilters["source"]
            }))
          }
          style={{ width: "100%" }}
        >
          <option value="all">All Sources</option>
          <option value="manual">Manual Only</option>
          <option value="ai">AI Only</option>
        </select>
      </div>

      {/* Categories */}
      <div>
        <div style={{ fontSize: 13, marginBottom: 6 }}>Categories</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {availableCategories.map((cat) => {
            const isActive = allSelected || highlightFilters.categories.includes(cat);
            return (
              <span
                key={cat}
                onClick={() => toggleCategoryChip(cat)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 12,
                  background: isActive ? "rgba(60, 120, 200, 0.85)" : "rgba(220,220,220,0.9)",
                  color: isActive ? "white" : "#333",
                  border: isActive ? "1px solid #1e3a8a" : "1px solid #ccc",
                  userSelect: "none"
                }}
              >
                {cat}
              </span>
            );
          })}
          {availableCategories.length === 0 && (
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              No categories found in this document yet.
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          Tip: If none are explicitly selected, all categories are shown.
        </div>
      </div>

      {/* CONFIDENCE SLIDER */}
      <div>
      <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
          Minimum Confidence ({Math.round(highlightFilters.confidence * 100)}%)
      </label>

      <input
          type="range"
          min={0}
          max={100}
          value={highlightFilters.confidence * 100}
          onChange={(e) =>
          setHighlightFilters((f) => ({
              ...f,
              confidence: Number(e.target.value) / 100   // store 0–1
          }))
          }
          style={{ width: "100%" }}
      />

      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
          Only show AI redactions with confidence ≥ {Math.round(highlightFilters.confidence * 100)}%
      </div>
      </div>

      {/* Text search */}
      <div>
        <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
          Text search
        </label>
        <input
          type="text"
          placeholder="Filter by text / label / comment"
          value={highlightFilters.text}
          onChange={(e) =>
            setHighlightFilters((f) => ({ ...f, text: e.target.value }))
          }
          style={{ width: "100%" }}
        />
      </div>
    </div>
  );
};

export default FiltersPage;