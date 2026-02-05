// src/SettingsPage.tsx
import * as React from "react";
import { DefaultButton } from "@fluentui/react";

/** Keep this in sync with the shape you already use in App */
export type HighlightFilters = {
  source: "all" | "manual" | "ai";
  categories: string[];
  text: string;
};

export interface SettingsPageProps {
  /** When a rule is selected, ONLY the description string is stored in rules */
  rules: string[];
  setRules: React.Dispatch<React.SetStateAction<string[]>>;

  userInstructions: string;
  setUserInstructions: React.Dispatch<React.SetStateAction<string>>;

  /** Viewer filters moved from Sidebar */
  // highlightFilters: HighlightFilters;
  // setHighlightFilters: React.Dispatch<React.SetStateAction<HighlightFilters>>;

  /** Categories seen in the current document (for filter chips) */
  availableCategories: string[];
}

/**
 * STATIC AI RULES
 * title = bold heading
 * description = the text to store in aiRules and send to the API
 */
export const STATIC_AI_RULES: Array<{ title: string; description: string }> = [
  {
    title: "Sensitive Information (Health)",
    description:
      "Redact any mention of health information, including mental health information, medical history, prescriptions, medications, treatment information, diagnoses and appointments."
  },
  {
    title: "Sensitive Information (Health)",
    description:
      "Redact any mention of alcohol or drug use and any mention of treatment or services accessed for substance abuse."
  },
  {
    title: "Sensitive Information (Crime and Policing)",
    description:
      "Redact any mention of crime, arrests or police investigations."
  },
  {
    title: "Sensitive Information (Crime and Policing)",
    description:
      "Redact any mention of CPS (Crown Prosecution Service) decisions."
  },
  {
    title: "Sensitive Information (Crime and Policing)",
    description:
      "Redact any mention of criminality, imprisonment and legal charges or records."
  },
  {
    title: "Sensitive Information (National Security)",
    description:
      "Redact any information related to national security."
  },
  {
    title: "Sensitive Information (Financial and Taxation)",
    description:
      "Redact any mention of taxation, personal finances, corporate finances, and any statements or decisions relating to finances."
  },
  {
    title: "Sensitive Information (Abuse)",
    description:
      "Redact any mention of child abuse and any quotes or statements regarding child abuse, sexual abuse or abuse allegations made by any party."
  },
  {
    title: "Sensitive Information (Abuse)",
    description:
      "Redact any mention of domestic abuse or violence, including statements or allegations regarding it or domestic abuse services."
  },
  {
    title: "Sensitive Information (Personal Info)",
    description:
      "Redact any mention of racial or ethnic origin, political options or affiliations, religious or philosophical beliefs, sexual orientation, gender identity or trade union membership."
  },
  {
    title: "Statements From Third Parties",
    description:
      "Redact any statements or quotes made by third parties."
  }
];

const SettingsPage: React.FC<SettingsPageProps> = ({
  rules,
  setRules,
  userInstructions,
  setUserInstructions,
  // highlightFilters,
  // setHighlightFilters,
  availableCategories
}) => {
  /** Toggle by DESCRIPTION — we store only description strings in rules */
  const toggleRuleByDescription = (description: string) => {
    setRules(prev => {
      const set = new Set(prev);
      if (set.has(description)) set.delete(description);
      else set.add(description);
      return [...set];
    });
  };

  // const allSelected = (highlightFilters.categories?.length ?? 0) === 0;

//   const toggleCategoryChip = (cat: string) => {
//     setHighlightFilters(f => {
//       // If "all selected" implicitly (empty array), clicking a chip starts explicit selection.
//       if (allSelected) {
//         return { ...f, categories: [cat] };
//       }
//       const next = new Set(f.categories);
//       if (next.has(cat)) next.delete(cat);
//       else next.add(cat);
//       return { ...f, categories: [...next] };
//     });
//   };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ─────────────────────────────
          AI Rule Selection (static)
         ───────────────────────────── */}
      <section>
        <h3 style={{ margin: "0 0 8px" }}>AI Redaction Rules</h3>
        <p style={{ margin: "0 0 8px", opacity: 0.8, fontSize: 13 }}>
          Select sensitive content rules to apply when generating AI redactions. Only the selected rules will be applied by the AI when suggesting redactions.
        </p>

        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <DefaultButton
            text="Select All"
            onClick={() => setRules(STATIC_AI_RULES.map(r => r.description))}
          />

          <DefaultButton
            text="Deselect All"
            onClick={() => setRules([])}
          />
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {STATIC_AI_RULES.map(({ title, description }, idx) => {
            const checked = rules.includes(description); // store/compare by description only
            return (
              <label
                key={`${title}-${idx}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 10px",
                  border: "1px solid #eee",
                  borderRadius: 6
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleRuleByDescription(description)}
                  style={{ marginTop: 3 }}
                  aria-label={`${title}: ${description}`}
                />
                <div>
                  <div style={{ fontWeight: 600 }}>{title}</div> {/* bold heading */}
                  <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                    {description} {/* smaller, unbolded description */}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────
          Custom User Instructions
        ───────────────────────────── */}
      <section style={{ marginTop: 20 }}>
        <h3 style={{ margin: "0 0 8px" }}>
          Additional Instructions for AI (Optional)
        </h3>

        <p style={{ margin: "0 0 8px", opacity: 0.8, fontSize: 13 }}>
          Add any extra context or guidance for the AI when generating redactions.
          For example: “Be conservative”, “Ignore dates”, or “Focus on financial references”.
        </p>

        <textarea
          value={userInstructions}
          onChange={(e) => setUserInstructions(e.target.value)}
          placeholder="Enter additional AI instructions..."
          style={{
            width: "100%",
            height: 120,
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 14,
            resize: "vertical",
            boxSizing: "border-box"
          }}
        />
      </section>

      {/* ─────────────────────────────
          Filters (moved from sidebar)
         ───────────────────────────── */}
      {/* <section>
        <h3 style={{ margin: "0 0 8px" }}>Filter Redactions</h3>
        */}
        {/* Source filter */}
        {/* <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
            Source
          </label>
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
        </div> */}

        {/* Category multi-select chips */}
        {/*}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>Categories</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {availableCategories.map((cat: string) => {
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
        </div> */}

        {/* Text search */}
        {/*
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
      </section> */}
    </div>
  );
};

export default SettingsPage;
