// src/helpers/aiRedactionHelpers.ts

import { AiJobStatus } from "../mytypes/ai";

import { fetchJsonFromBlob } from "../lib/blobFetch"; 
import { saveWorkingSnapshotToBlob } from "../lib/blobPersist";
import { CommentedHighlight } from "../types";  
import { db } from "../storage";
import { buildPdfId } from "../helpers/utils";


// Defensive converter: if the AI output already contains viewport dimensions (width/height),
// we pass-through; otherwise, derive from pageWidth/pageHeight if present; as a final fallback,
// use a canonical A4-ish ratio at scale ~1000px width to keep proportions deterministic.
function normalizedToViewportRect(r: any, pageNumber: number) {
  // Already scaled? Just ensure the pageNumber exists.
  if (r && typeof r.width === "number" && typeof r.height === "number") {
    return { ...r, pageNumber: r.pageNumber ?? pageNumber };
  }
  const pageW = r?.pageWidth ?? 1000;
  const pageH = r?.pageHeight ?? Math.round((pageW * 11) / 8.5); // A4-ish fallback
  const x1 = (r?.x1 ?? 0) * pageW;
  const y1 = (r?.y1 ?? 0) * pageH;
  const x2 = (r?.x2 ?? 0) * pageW;
  const y2 = (r?.y2 ?? 0) * pageH;
  return {
    x1,
    y1,
    x2,
    y2,
    width: pageW,
    height: pageH,
    pageNumber,
  };
}


/**
 * Trigger AI redaction suggestions for a single PDF in storage.
 * This does NOT apply results. It only starts the Durable orchestration.
 */
export async function startAiRedactionOrchestration({
  userId,
  projectId,
  fileName,
  aiRules,
  userInstructions
}: {
  userId: string;
  projectId: string;
  fileName: string;
  aiRules: string[];
  userInstructions: string;
}) {
  const blobPath = `files/${userId}/${projectId}/original/${fileName}`;

  const res = await fetch("/api/start-redaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      blobName: blobPath,        // SAME as Workspace
      rules: aiRules,
      userInstructions
    })
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  const data = await res.json();

  return {
    instanceId: data.id,
    statusQueryGetUri: data.statusQueryGetUri
  };
}


/**
 * Trigger AI redaction suggestions for ALL PDFs in a project.
 * Sequential for safety (Durable Functions handles queueing).
 */
export async function startAiRedactionForProject({
  userId,
  projectId,
  documents,
  aiRules,
  userInstructions,
  onProgress
}: {
  userId: string;
  projectId: string;
  documents: string[];     // array of fileNames e.g. ["doc1.pdf"]
  aiRules: string[];
  userInstructions: string;
  onProgress?: (info: { fileName: string; index: number; total: number }) => void;
}) {
  const total = documents.length;

  for (let i = 0; i < total; i++) {
    const fileName = documents[i];

    onProgress?.({ fileName, index: i + 1, total });

    await startAiRedactionOrchestration({
      userId,
      projectId,
      fileName,
      aiRules,
      userInstructions
    });
  }
}


/**
 * Start + poll a durable orchestration
 */

// src/helpers/aiRedactionHelpers.ts
//
// Shared helper for triggering a single AI redaction orchestration
// and polling Durable Functions status until completion.
//
// Does NOT apply any redactions (Workspace does that locally).
// ProjectHome uses this to trigger jobs only.
//

export async function startAndPollAiRedaction({
  blobPath,
  aiRules,
  userInstructions,
  onStatusChange,   // optional callback for UI status
  onComplete,       // gets final Durable payload
  onError           // callback for any failure
}: {
  blobPath: string;
  aiRules: string[];
  userInstructions: string;
  onStatusChange?: (runtimeStatus: string) => void;
  onComplete?: (payload: any) => void;
  onError?: (err: any) => void;
}): Promise<void> {

  try {
    // --------------------------
    // 1) START ORCHESTRATION
    // --------------------------
    const res = await fetch("/api/start-redaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blobName: blobPath,
        rules: aiRules,
        userInstructions
      })
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg);
    }

    const data = await res.json();

    const statusUrl = new URL(data.statusQueryGetUri).toString();
    const pollIntervalMs = 2000;

    // --------------------------
    // 2) POLLING UNTIL DONE
    // --------------------------
    const ctrl = new AbortController();

    const pollOnce = async () => {
      const resp = await fetch(statusUrl, { signal: ctrl.signal });
      if (!resp.ok) {
        console.warn("[AI] Poll failed:", resp.status);
        return;
      }

      const status = await resp.json();
      const runtimeStatus = status.runtimeStatus as string;

      onStatusChange?.(runtimeStatus);

      // Terminal states
      if (
        runtimeStatus === "Completed" ||
        runtimeStatus === "Failed" ||
        runtimeStatus === "Terminated"
      ) {
        ctrl.abort();

        if (runtimeStatus === "Completed") {
          onComplete?.(status.output);
        } else {
          onError?.(new Error(`Pipeline ended with status ${runtimeStatus}`));
        }
      }
    };

    // Kick off repeated polling
    const timer = window.setInterval(() => {
      if (ctrl.signal.aborted) {
        clearInterval(timer);
        return;
      }
      pollOnce().catch(err => {
        console.warn("[AI] Poll exception:", err);
      });
    }, pollIntervalMs);

    // immediate first poll
    pollOnce().catch(() => {});

  } catch (err) {
    onError?.(err);
  }
}


export async function runAiRedactionWithPolling({
  userId,
  projectId,
  fileName,
  aiRules,
  userInstructions,
  onStatus,
  onComplete,
  onError
}: {
  userId: string;
  projectId: string;
  fileName: string;
  aiRules: string[];
  userInstructions: string;
  onStatus?: (status: string) => void;      // "Pending", "Running", "Completed", ...
  onComplete?: (payload: any) => void;      // Durable output JSON
  onError?: (err: any) => void;
}) {
  try {
    // 1. Kick off orchestration (your existing function)
    const { statusQueryGetUri } = await startAiRedactionOrchestration({
      userId,
      projectId,
      fileName,
      aiRules,
      userInstructions
    });

    const statusUrl = new URL(statusQueryGetUri).toString();

    // 2. Poll Durable Functions status
    return await new Promise<void>((resolve, reject) => { 
      const ctrl = new AbortController();
      const intervalMs = 2000;

      const poll = async () => {
        try {
          const resp = await fetch(statusUrl, { signal: ctrl.signal });
          if (!resp.ok) return;

          const data = await resp.json();
          const runtimeStatus = data.runtimeStatus;
          onStatus?.(runtimeStatus);

          // Terminal states
          if (runtimeStatus === "Completed") {
            ctrl.abort();
            onComplete?.(data.output);
            resolve();
          }

          if (runtimeStatus === "Failed" || runtimeStatus === "Terminated") {
            ctrl.abort();
            const err = new Error(`Pipeline failed (${runtimeStatus})`);
            onError?.(err);
            reject(err);
          }
        } catch (e) {
          console.warn("[AI Polling] Error:", e);
        }
      };

      const timer = setInterval(() => {
        if (ctrl.signal.aborted) {
          clearInterval(timer);
          return;
        }
        poll();
      }, intervalMs);

      // Kick the first poll immediately
      poll();
    });
  } catch (err) {
    onError?.(err);
  }
}


export async function runAiRedactionForProject({
  userId,
  projectId,
  fileNames,
  aiRules,
  userInstructions,
  onDocumentStart,
  onDocumentStatus,
  onDocumentComplete,
  onDocumentError,
  onBatchComplete
}: {
  userId: string;
  projectId: string;
  fileNames: string[];
  aiRules: string[];
  userInstructions: string;
  onDocumentStart?: (fileName: string, index: number, total: number) => void;
  onDocumentStatus?: (fileName: string, status: string) => void;
  onDocumentComplete?: (fileName: string) => void;
  onDocumentError?: (fileName: string, err: any) => void;
  onBatchComplete?: () => void;
}) {
  const total = fileNames.length;

  for (let i = 0; i < total; i++) {
    const fileName = fileNames[i];

    onDocumentStart?.(fileName, i + 1, total);

    try {
      await runAiRedactionWithPolling({
        userId,
        projectId,
        fileName,
        aiRules,
        userInstructions,
        onStatus: (status) => onDocumentStatus?.(fileName, status),
        onComplete: () => onDocumentComplete?.(fileName),
        onError: (err) => onDocumentError?.(fileName, err)
      });
    } catch (err) {
      onDocumentError?.(fileName, err);
    }
  }

  onBatchComplete?.();
}


export async function runAiRedactionForProjectParallel({
  userId,
  projectId,
  fileNames,
  aiRules,
  userInstructions,
  concurrency = 2,
  signal,
  onDocStatus,
  onDocComplete,
  onDocError,
  onBatchProgress
}: {
  userId: string;
  projectId: string;
  fileNames: string[];
  aiRules: string[];
  userInstructions: string;
  concurrency?: number;
  signal?: AbortSignal;
  onDocStatus?: (fileName: string, status: AiJobStatus) => void;
  onDocComplete?: (fileName: string, output: any) => void;
  onDocError?: (fileName: string, err: any) => void;
  onBatchProgress?: (completed: number, total: number) => void;
}) {
  let active = 0;
  let completed = 0;
  const total = fileNames.length;
  const queue = [...fileNames];
  const aborted = () => signal?.aborted;

  return new Promise<void>((resolve, reject) => {
    const runNext = () => {
      if (aborted()) return reject(new Error("Cancelled"));

      if (queue.length === 0 && active === 0) {
        resolve();
        return;
      }

      while (active < concurrency && queue.length > 0) {
        const fileName = queue.shift()!;
        active++;

        onDocStatus?.(fileName, "submitting");

        // const blobPath = `files/${userId}/${projectId}/original/${fileName}`;

        runAiRedactionWithPolling({
          userId,
          projectId,
          fileName,
          aiRules,
          userInstructions,
          onStatus: (s) => onDocStatus?.(fileName, s as AiJobStatus),
          onComplete: (payload) => {
            onDocStatus?.(fileName, "completed");
            onDocComplete?.(fileName, payload);

            completed++;
            onBatchProgress?.(completed, total);

            active--;
            runNext();
          },
          onError: (err) => {
            onDocStatus?.(fileName, "failed");
            onDocError?.(fileName, err);

            completed++;
            onBatchProgress?.(completed, total);

            active--;
            runNext();
          }
        });
      }
    };

    runNext();
  });
}


/**
 * Merge AI suggestions into the working highlights file without deleting
 * any existing manual / AI highlights.
 */
// export async function applyAiRedactionsToWorkingFile({
//   userId,
//   projectId,
//   fileName,
//   aiPayload
// }: {
//   userId: string;
//   projectId: string;
//   fileName: string;
//   aiPayload: any;   // Durable Functions output
// }) {
//   // build working highlights path
//   const pdfId = `${projectId}::${fileName}`;
//   const highlightsPath = `${userId}/${projectId}/working/${fileName}.highlights.json`;

//   type HighlightsPayload = {
//     allHighlights: CommentedHighlight[];
//     activeHighlights: string[];
//   };

//   // 1. Load existing highlight file (may be empty)
//   const existing: HighlightsPayload | null = await fetchJson("files", highlightsPath);

//   const existingAll = existing?.allHighlights ?? [];
//   const existingActive = new Set(existing?.activeHighlights ?? []);

//   // 2. Convert AI output to CommentedHighlight objects
//   const aiHighlights: CommentedHighlight[] = (aiPayload?.suggestions ?? []).map((s: any) => ({
//     id: s.id ?? crypto.randomUUID(),
//     content: { text: s.text ?? "" },
//     comment: s.comment ?? "",
//     position: s.position,
//     metadata: s.metadata ?? null,
//     source: "ai",
//     label: "AI Generated",
//     category: s.category ?? "Sensitive Information (AI)"
//   }));

//   const text = ai.content?.text ?? "";
//   const metadata = ai.metadata ?? null;

//   if (!ai.position || !ai.position.boundingRect) {
//     console.warn("[AI Plugin] Missing position in AI highlight:", ai);
//     continue;
//   }

//   const { boundingRect, rects } = ai.position;
//   const pageNumber = boundingRect.pageNumber;

//   if (!Array.isArray(rects)) {
//     console.warn("[AI Plugin] rects is not an array:", rects);
//     continue;
//   }

//   // Each normalized rect → scaled viewport rect
//   for (const normRect of rects) {
//     const scaled = normalizedToViewportRect(normRect, pageNumber, viewerObj);
//     if (!scaled) continue;

//   let reason = "AI";
//   let top_level_category = "";
//   if (metadata?.reasoning) {
//     const match = metadata.reasoning.match(/sensitive\s+([A-Za-z]+)/i);
//     if (match) reason = match[1]; // e.g. PII
//     if (metadata.reasoning.includes(" PII ")) {
//       top_level_category = "PII";
//     }
//   }

//   // TODO: create more discrete categories for contextual prompt instructions 
//   // e.g. Sensitive Information (Medical), Sensitive Information (Police), SI (Personal Relationships), 
//   // SI (Employment), SI (Financial), SI (Personal e.g. sexual orientation/gender) 
//   let full_category = "";
//   const category = metadata?.category ?? "Unknown";
//   if (top_level_category != "") {
//     full_category = `${top_level_category} (${category})`;
//   } else {
//     full_category = category;
//   }

//   const h: CommentedHighlight = {
//     id: ai.id ?? String(Math.random()).slice(2),
//     content: { text },
//     comment: metadata?.reasoning ?? "",
//     position: {
//       boundingRect: scaled,
//       rects: [scaled]
//     },
//     metadata,
//     source: "ai",
//     label: `AI generated: ${reason} – ${category}`,
//     category: full_category,
//     confidence: metadata.confidence
//   };

//   // 3. ID-based dedupe (in case AI produces same IDs)
//   const existingIds = new Set(existingAll.map(h => h.id));
//   const filteredAi = aiHighlights.filter(h => !existingIds.has(h.id));

//   // 4. Merge arrays
//   const mergedAll = [...existingAll, ...filteredAi];
//   const mergedActive = new Set([...existingActive, ...filteredAi.map(h => h.id)]);

//   // Update Dexie
//   await db.pdfs.update(pdfId, {
//     allHighlights: mergedAll,
//     activeHighlights: Array.from(mergedActive),
//   });

//   // 5. Save merged JSON back to Blob Storage
//   await saveWorkingSnapshotToBlob(
//     userId,
//     projectId,
//     pdfId,
//     fileName
//   );
// }


// import { normalizedToViewportRect } from "../plugins/applyAiRedactionsPlugin"; // create if needed

// export async function applyAiRedactionsToWorkingFile({
//   userId,
//   projectId,
//   fileName,
//   aiPayload
// }: {
//   userId: string;
//   projectId: string;
//   fileName: string;
//   aiPayload: any;
// }) {
//   const pdfId = buildPdfId(projectId, fileName);
//   const highlightsPath = `${userId}/${projectId}/working/${fileName}.highlights.json`;

//   type HighlightsPayload = {
//     allHighlights: CommentedHighlight[];
//     activeHighlights: string[];
//   };

//   // 1. Load existing highlights
//   const existing: HighlightsPayload | null = await fetchJsonFromBlob("files", highlightsPath);
//   const existingAll = existing?.allHighlights ?? [];
//   const existingActive = new Set(existing?.activeHighlights ?? []);

//   // 2. Convert AI payload → CommentedHighlight[]
//   const aiHighlights: CommentedHighlight[] = [];

//   for (const ai of aiPayload?.suggestions ?? []) {
//     const text = ai.content?.text ?? "";
//     const metadata = ai.metadata ?? null;

//     if (!ai.position || !ai.position.boundingRect) {
//       console.warn("Missing position in AI highlight:", ai);
//       continue;
//     }

//     const { boundingRect, rects } = ai.position;
//     const pageNumber = boundingRect.pageNumber;

//     if (!Array.isArray(rects)) {
//       console.warn("AI rects not array:", rects);
//       continue;
//     }

//     const scaledRects = rects
//       .map(r => normalizedToViewportRect(r, pageNumber))
//       .filter(Boolean);

//     if (!scaledRects.length) continue;

//     let reason = "AI";
//     let topLevel = "";
//     if (metadata?.reasoning) {
//       const m = metadata.reasoning.match(/sensitive\s+([A-Za-z]+)/i);
//       if (m) reason = m[1];
//       if (metadata.reasoning.includes(" PII ")) topLevel = "PII";
//     }

//     const category = metadata?.category ?? "Unknown";
//     const fullCategory =
//       topLevel !== "" ? `${topLevel} (${category})` : category;

//     const h: CommentedHighlight = {
//       id: ai.id ?? String(Math.random()).slice(2),
//       content: { text },
//       comment: metadata?.reasoning ?? "",
//       position: {
//         boundingRect: scaledRects[0],
//         rects: scaledRects,
//       },
//       metadata,
//       source: "ai",
//       label: `AI generated: ${reason} – ${category}`,
//       category: fullCategory,
//       confidence: metadata?.confidence
//     };

//     aiHighlights.push(h);
//   }

//   // 3. Dedupe
//   const existingIds = new Set(existingAll.map(h => h.id));
//   const filteredAi = aiHighlights.filter(h => !existingIds.has(h.id));

//   // 4. Merge
//   const mergedAll = [...existingAll, ...filteredAi];
//   const mergedActive = new Set([...existingActive, ...filteredAi.map(h => h.id)]);

//   // 5. Update Dexie
//   await db.pdfs.update(pdfId, {
//     allHighlights: mergedAll,
//     activeHighlights: Array.from(mergedActive)
//   });

//   // 6. Push to Blob Storage
//   await saveWorkingSnapshotToBlob(userId, projectId, pdfId);
// }

export async function applyAiRedactionsToWorkingFile({ 
  userId, 
  projectId, 
  fileName, 
  aiPayload 
}: { 
  userId: string; 
  projectId: string; 
  fileName: string; 
  aiPayload: any; }) { 
    const pdfId = buildPdfId(projectId, fileName); 
    const highlightsPath = `${userId}/${projectId}/working/${fileName}.highlights.json`; console.log("=== [applyAiRedactionsToWorkingFile] START ==="); 
    console.log("pdfId:", pdfId); 
    console.log("fileName:", fileName); 
    console.log("aiPayload received:", aiPayload); 
    
    if (!aiPayload) { 
      console.warn("[applyAiRedactionsToWorkingFile] aiPayload is NULL/undefined. Nothing to merge."); 
      return; 
    } 
    
    if (!Array.isArray(aiPayload.suggestions)) { 
      console.warn("[applyAiRedactionsToWorkingFile] aiPayload.suggestions is missing or not an array."); 
      return; 
    } 
    console.log(`[applyAiRedactionsToWorkingFile] suggestions count: ${aiPayload.suggestions.length}`); 
    // 1. Load existing working highlights file (if any) 
    const existing: { allHighlights: CommentedHighlight[]; 
    activeHighlights: string[] } | null = await fetchJsonFromBlob("files", highlightsPath); 
    console.log("[applyAiRedactionsToWorkingFile] existing working file:", existing); 
    const existingAll = existing?.allHighlights ?? []; 
    const existingActive = new Set(existing?.activeHighlights ?? []); 
    console.log("[applyAiRedactionsToWorkingFile] existingAll count:", existingAll.length); 
    console.log("[applyAiRedactionsToWorkingFile] existingActive count:", existingActive.size); 
    
    // 2. PASS-THROUGH — do NOT convert geometry here 
    const aiHighlights: CommentedHighlight[] = []; 
    for (const ai of aiPayload.suggestions) { 
      if (!ai.position || !ai.position.boundingRect) { console.warn("[AI merge] Skipped suggestion with missing position:", ai); 
        continue; 
      } 
      const h: CommentedHighlight = { 
        id: ai.id ?? String(Math.random()).slice(2), 
        content: { text: ai.content?.text ?? "" }, 
        comment: ai.metadata?.reasoning ?? "", 
        position: ai.position, // <-- PASS THROUGH RAW 
        metadata: ai.metadata ?? null, 
        source: "ai", 
        label: "AI generated", 
        category: ai.metadata?.category ?? "AI", 
        confidence: ai.metadata?.confidence 
      }; 
      aiHighlights.push(h); 
    } 
    console.log("[applyAiRedactionsToWorkingFile] converted aiHighlights:", aiHighlights); 
    
    // 3. Dedupe by ID 
    const existingIds = new Set(existingAll.map(h => h.id)); 
    const filteredAi = aiHighlights.filter(h => !existingIds.has(h.id)); 
    console.log("[applyAiRedactionsToWorkingFile] filteredAi after ID dedupe:", filteredAi); 
    
    if (filteredAi.length === 0) { 
      console.warn("[applyAiRedactionsToWorkingFile] No NEW AI highlights to merge."); 
    } 
    
    // 4. Merge arrays 
    const mergedAll = [...existingAll, ...filteredAi]; 
    const mergedActive = new Set([...existingActive, ...filteredAi.map(h => h.id)]); 
    console.log("[applyAiRedactionsToWorkingFile] mergedAll length:", mergedAll.length); 
    console.log("[applyAiRedactionsToWorkingFile] mergedActive size:", mergedActive.size); 
    
    // 5. Update Dexie 
    console.log("[applyAiRedactionsToWorkingFile] Updating Dexie record..."); 
    await db.pdfs.update(pdfId, { allHighlights: mergedAll, activeHighlights: Array.from(mergedActive) }); 
    console.log("[applyAiRedactionsToWorkingFile] Dexie update complete."); 
    
    // 6. SAVE back to Blob storage as working snapshot 
    console.log("[applyAiRedactionsToWorkingFile] Saving working snapshot to Blob..."); 
    try { 
      await saveWorkingSnapshotToBlob(userId, projectId, pdfId); 
      console.log("[applyAiRedactionsToWorkingFile] Blob upload COMPLETE."); 
    } catch (err) { 
      console.error("[applyAiRedactionsToWorkingFile] Blob upload FAILED:", err); 
    } 
    
    console.log("=== [applyAiRedactionsToWorkingFile] END ==="); 
  }