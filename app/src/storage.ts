
import Dexie, { Table } from "dexie";
import { CommentedHighlight } from "./types";

//
// ================================
//         PDF ENTRY
// ================================
//
export interface PersistedPdf {
  id: string;
  name: string;

  // Base64-encoded versions of the PDF
  originalBase64: string | null;
  workingBase64: string | null;
  finalBase64: string | null;

  // Highlights (all) + list of active highlight IDs
  allHighlights: CommentedHighlight[];
  activeHighlights: string[];
}

//
// ================================
//       APP PREFERENCES
// ================================
//
export interface AppPreferences {
  id: string; // always "preferences"

  lastOpenedPdfId: string | null;

  sidebar: {
    documents: boolean;
    highlights: boolean;
  };

  zoom: number | null;
  highlightPenEnabled: boolean;

  uiMode: "dark" | "light";
  userIdentity: string | null;
  rules: any;
  highlightFilters: any;
}

//
// ================================
//         DEXIE DATABASE
// ================================
//
export class AppDB extends Dexie {
  pdfs!: Table<PersistedPdf, string>;
  preferences!: Table<AppPreferences, string>;

  constructor() {
    super("contextualRedactorDB");

    this.version(1).stores({
      pdfs: "id",
      preferences: "id",
    });
  }
}

export const db = new AppDB();

//
// ================================
//        UTILITY FUNCTIONS
// ================================
//

/**
 * Convert File → Base64 (for IndexedDB).
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;

    reader.readAsDataURL(file);
  });
}

/**
 * Convert Base64 → Blob (so react-pdf can load it using URL.createObjectURL).
 */
export function base64ToBlob(base64: string): Blob {
  const [meta, data] = base64.split(";base64,");
  const contentType = meta.split(":")[1];

  const binary = atob(data);
  const array = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }

  return new Blob([array], { type: contentType });
}
