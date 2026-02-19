// src/helpers/aiRedactionHelpers.ts

// import { AiJobStatus } from "../mytypes/ai";

// import { fetchJsonFromBlob } from "../lib/blobFetch"; 
// import { saveWorkingSnapshotToBlob } from "../lib/blobPersist";
// import { CommentedHighlight } from "../types";  
// import { db } from "../storage";
// import { buildPdfId } from "../helpers/utils";



// /**
//  * Trigger AI redaction suggestions for a single PDF in storage.
//  * This does NOT apply results. It only starts the Durable orchestration.
//  */
// export async function startAiRedactionOrchestration({
//   userId,
//   projectId,
//   fileName,
//   aiRules,
//   userInstructions
// }: {
//   userId: string;
//   projectId: string;
//   fileName: string;
//   aiRules: string[];
//   userInstructions: string;
// }) {
//   const blobPath = `files/${userId}/${projectId}/original/${fileName}`;

//   const res = await fetch("/api/start-redaction", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({
//       blobName: blobPath,        // SAME as Workspace
//       rules: aiRules,
//       userInstructions
//     })
//   });

//   if (!res.ok) {
//     throw new Error(await res.text());
//   }

//   const data = await res.json();

//   return {
//     instanceId: data.id,
//     statusQueryGetUri: data.statusQueryGetUri
//   };
// }


// /**
//  * Trigger AI redaction suggestions for ALL PDFs in a project.
//  * Sequential for safety (Durable Functions handles queueing).
//  */
// export async function startAiRedactionForProject({
//   userId,
//   projectId,
//   documents,
//   aiRules,
//   userInstructions,
//   onProgress
// }: {
//   userId: string;
//   projectId: string;
//   documents: string[];     // array of fileNames e.g. ["doc1.pdf"]
//   aiRules: string[];
//   userInstructions: string;
//   onProgress?: (info: { fileName: string; index: number; total: number }) => void;
// }) {
//   const total = documents.length;

//   for (let i = 0; i < total; i++) {
//     const fileName = documents[i];

//     onProgress?.({ fileName, index: i + 1, total });

//     await startAiRedactionOrchestration({
//       userId,
//       projectId,
//       fileName,
//       aiRules,
//       userInstructions
//     });
//   }
// }


// /**
//  * Start + poll a durable orchestration
//  */

// // src/helpers/aiRedactionHelpers.ts
// //
// // Shared helper for triggering a single AI redaction orchestration
// // and polling Durable Functions status until completion.
// //
// // Does NOT apply any redactions (Workspace does that locally).
// // ProjectHome uses this to trigger jobs only.
// //

// // export async function startAndPollAiRedaction({
// //   blobPath,
// //   aiRules,
// //   userInstructions,
// //   onStatusChange,   // optional callback for UI status
// //   onComplete,       // gets final Durable payload
// //   onError           // callback for any failure
// // }: {
// //   blobPath: string;
// //   aiRules: string[];
// //   userInstructions: string;
// //   onStatusChange?: (runtimeStatus: string) => void;
// //   onComplete?: (payload: any) => void;
// //   onError?: (err: any) => void;
// // }): Promise<void> {

// //   try {
// //     // --------------------------
// //     // 1) START ORCHESTRATION
// //     // --------------------------
// //     const res = await fetch("/api/start-redaction", {
// //       method: "POST",
// //       headers: { "Content-Type": "application/json" },
// //       body: JSON.stringify({
// //         blobName: blobPath,
// //         rules: aiRules,
// //         userInstructions
// //       })
// //     });

// //     if (!res.ok) {
// //       const msg = await res.text();
// //       throw new Error(msg);
// //     }

// //     const data = await res.json();

// //     const statusUrl = new URL(data.statusQueryGetUri).toString();
// //     const pollIntervalMs = 2000;

// //     // --------------------------
// //     // 2) POLLING UNTIL DONE
// //     // --------------------------
// //     const ctrl = new AbortController();

// //     const pollOnce = async () => {
// //       const resp = await fetch(statusUrl, { signal: ctrl.signal });
// //       if (!resp.ok) {
// //         console.warn("[AI] Poll failed:", resp.status);
// //         return;
// //       }

// //       const status = await resp.json();
// //       const runtimeStatus = status.runtimeStatus as string;

// //       onStatusChange?.(runtimeStatus);

// //       // Terminal states
// //       if (
// //         runtimeStatus === "Completed" ||
// //         runtimeStatus === "Failed" ||
// //         runtimeStatus === "Terminated"
// //       ) {
// //         ctrl.abort();

// //         if (runtimeStatus === "Completed") {
// //           onComplete?.(status.output);
// //         } else {
// //           onError?.(new Error(`Pipeline ended with status ${runtimeStatus}`));
// //         }
// //       }
// //     };

// //     // Kick off repeated polling
// //     const timer = window.setInterval(() => {
// //       if (ctrl.signal.aborted) {
// //         clearInterval(timer);
// //         return;
// //       }
// //       pollOnce().catch(err => {
// //         console.warn("[AI] Poll exception:", err);
// //       });
// //     }, pollIntervalMs);

// //     // immediate first poll
// //     pollOnce().catch(() => {});

// //   } catch (err) {
// //     onError?.(err);
// //   }
// // }

// export async function startAndPollAiRedaction({
//   blobPath,
//   aiRules,
//   userInstructions,
//   onStatusChange,
//   onComplete,
//   onError
// }: {
//   blobPath: string;
//   aiRules: string[];
//   userInstructions: string;
//   onStatusChange?: (status: string) => void;
//   onComplete?: (payload: any) => void;
//   onError?: (err: any) => void;
// }) {
//   try {
//     // STEP 1: Start job
//     const startResp = await fetch("/api/start-redaction", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         blobName: blobPath,
//         rules: aiRules,
//         userInstructions
//       })
//     });

//     if (!startResp.ok) {
//       const msg = await startResp.text();
//       throw new Error(msg);
//     }

//     const { jobId } = await startResp.json();
//     onStatusChange?.("running");

//     // STEP 2: Poll status
//     const pollIntervalMs = 2000;

//     while (true) {
//       const statusResp = await fetch(`/api/job-status?jobId=${jobId}`);
//       const statusJson = await statusResp.json();

//       if (statusJson.status === "complete") break;

//       onStatusChange?.("running");
//       await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
//     }

//     onStatusChange?.("complete");

//     // STEP 3: Fetch result
//     const resultResp = await fetch(`/api/job-result?jobId=${jobId}`);
//     const resultJson = await resultResp.json();

//     onComplete?.(resultJson);

//   } catch (err) {
//     onError?.(err);
//   }
// }


// export async function runAiRedactionWithPolling({
//   userId,
//   projectId,
//   fileName,
//   aiRules,
//   userInstructions,
//   onStatus,
//   onComplete,
//   onError
// }: {
//   userId: string;
//   projectId: string;
//   fileName: string;
//   aiRules: string[];
//   userInstructions: string;
//   onStatus?: (status: string) => void;      // "Pending", "Running", "Completed", ...
//   onComplete?: (payload: any) => void;      // Durable output JSON
//   onError?: (err: any) => void;
// }) {
//   try {
//     // 1. Kick off orchestration (your existing function)
//     const { statusQueryGetUri } = await startAiRedactionOrchestration({
//       userId,
//       projectId,
//       fileName,
//       aiRules,
//       userInstructions
//     });

//     const statusUrl = new URL(statusQueryGetUri).toString();

//     // 2. Poll Durable Functions status
//     return await new Promise<void>((resolve, reject) => { 
//       const ctrl = new AbortController();
//       const intervalMs = 2000;

//       const poll = async () => {
//         try {
//           const resp = await fetch(statusUrl, { signal: ctrl.signal });
//           if (!resp.ok) return;

//           const data = await resp.json();
//           const runtimeStatus = data.runtimeStatus;
//           onStatus?.(runtimeStatus);

//           // Terminal states
//           if (runtimeStatus === "Completed") {
//             ctrl.abort();
//             onComplete?.(data.output);
//             resolve();
//           }

//           if (runtimeStatus === "Failed" || runtimeStatus === "Terminated") {
//             ctrl.abort();
//             const err = new Error(`Pipeline failed (${runtimeStatus})`);
//             onError?.(err);
//             reject(err);
//           }
//         } catch (e) {
//           console.warn("[AI Polling] Error:", e);
//         }
//       };

//       const timer = setInterval(() => {
//         if (ctrl.signal.aborted) {
//           clearInterval(timer);
//           return;
//         }
//         poll();
//       }, intervalMs);

//       // Kick the first poll immediately
//       poll();
//     });
//   } catch (err) {
//     onError?.(err);
//   }
// }


// export async function runAiRedactionForProject({
//   userId,
//   projectId,
//   fileNames,
//   aiRules,
//   userInstructions,
//   onDocumentStart,
//   onDocumentStatus,
//   onDocumentComplete,
//   onDocumentError,
//   onBatchComplete
// }: {
//   userId: string;
//   projectId: string;
//   fileNames: string[];
//   aiRules: string[];
//   userInstructions: string;
//   onDocumentStart?: (fileName: string, index: number, total: number) => void;
//   onDocumentStatus?: (fileName: string, status: string) => void;
//   onDocumentComplete?: (fileName: string) => void;
//   onDocumentError?: (fileName: string, err: any) => void;
//   onBatchComplete?: () => void;
// }) {
//   const total = fileNames.length;

//   for (let i = 0; i < total; i++) {
//     const fileName = fileNames[i];

//     onDocumentStart?.(fileName, i + 1, total);

//     try {
//       await runAiRedactionWithPolling({
//         userId,
//         projectId,
//         fileName,
//         aiRules,
//         userInstructions,
//         onStatus: (status) => onDocumentStatus?.(fileName, status),
//         onComplete: () => onDocumentComplete?.(fileName),
//         onError: (err) => onDocumentError?.(fileName, err)
//       });
//     } catch (err) {
//       onDocumentError?.(fileName, err);
//     }
//   }

//   onBatchComplete?.();
// }


// export async function runAiRedactionForProjectParallel({
//   userId,
//   projectId,
//   fileNames,
//   aiRules,
//   userInstructions,
//   concurrency = 2,
//   signal,
//   onDocStatus,
//   onDocComplete,
//   onDocError,
//   onBatchProgress
// }: {
//   userId: string;
//   projectId: string;
//   fileNames: string[];
//   aiRules: string[];
//   userInstructions: string;
//   concurrency?: number;
//   signal?: AbortSignal;
//   onDocStatus?: (fileName: string, status: AiJobStatus) => void;
//   onDocComplete?: (fileName: string, output: any) => void;
//   onDocError?: (fileName: string, err: any) => void;
//   onBatchProgress?: (completed: number, total: number) => void;
// }) {
//   let active = 0;
//   let completed = 0;
//   const total = fileNames.length;
//   const queue = [...fileNames];
//   const aborted = () => signal?.aborted;

//   return new Promise<void>((resolve, reject) => {
//     const runNext = () => {
//       if (aborted()) return reject(new Error("Cancelled"));

//       if (queue.length === 0 && active === 0) {
//         resolve();
//         return;
//       }

//       while (active < concurrency && queue.length > 0) {
//         const fileName = queue.shift()!;
//         active++;

//         onDocStatus?.(fileName, "submitting");

//         // const blobPath = `files/${userId}/${projectId}/original/${fileName}`;

//         runAiRedactionWithPolling({
//           userId,
//           projectId,
//           fileName,
//           aiRules,
//           userInstructions,
//           onStatus: (s) => onDocStatus?.(fileName, s as AiJobStatus),
//           onComplete: (payload) => {
//             onDocStatus?.(fileName, "completed");
//             onDocComplete?.(fileName, payload);

//             completed++;
//             onBatchProgress?.(completed, total);

//             active--;
//             runNext();
//           },
//           onError: (err) => {
//             onDocStatus?.(fileName, "failed");
//             onDocError?.(fileName, err);

//             completed++;
//             onBatchProgress?.(completed, total);

//             active--;
//             runNext();
//           }
//         });
//       }
//     };

//     runNext();
//   });
// }


// /**
//  * Merge AI suggestions into the working highlights file without deleting
//  * any existing manual / AI highlights.
//  */
// export async function applyAiRedactionsToWorkingFile({ 
//   userId, 
//   projectId, 
//   fileName, 
//   aiPayload 
// }: { 
//   userId: string; 
//   projectId: string; 
//   fileName: string; 
//   aiPayload: any; }) { 
//     const pdfId = buildPdfId(projectId, fileName); 
//     const highlightsPath = `${userId}/${projectId}/working/${fileName}.highlights.json`; 
//     console.log("=== [applyAiRedactionsToWorkingFile] START ==="); 
//     console.log("pdfId:", pdfId); 
//     console.log("fileName:", fileName); 
//     console.log("aiPayload received:", aiPayload); 
    
//     if (!aiPayload) { 
//       console.warn("[applyAiRedactionsToWorkingFile] aiPayload is NULL/undefined. Nothing to merge."); 
//       return; 
//     } 
    
//     if (!Array.isArray(aiPayload.allHighlights)) { 
//       console.warn("[applyAiRedactionsToWorkingFile] aiPayload.allHighlights is missing or not an array."); 
//       return; 
//     } 
//     console.log(`[applyAiRedactionsToWorkingFile] suggestions count: ${aiPayload.allHighlights.length}`); 
//     // 1. Load existing working highlights file (if any) 
//     const existing: { allHighlights: CommentedHighlight[]; 
//     activeHighlights: string[] } | null = await fetchJsonFromBlob("files", highlightsPath); 
//     console.log("[applyAiRedactionsToWorkingFile] existing working file:", existing); 
//     const existingAll = existing?.allHighlights ?? []; 
//     const existingActive = new Set(existing?.activeHighlights ?? []); 
//     console.log("[applyAiRedactionsToWorkingFile] existingAll count:", existingAll.length); 
//     console.log("[applyAiRedactionsToWorkingFile] existingActive count:", existingActive.size); 
    
//     // 2. PASS-THROUGH — do NOT convert geometry here 
//     const aiHighlights: CommentedHighlight[] = []; 
//     for (const ai of aiPayload.allHighlights) { 
//       if (!ai.position || !ai.position.boundingRect) { console.warn("[AI merge] Skipped highlight with missing position:", ai); 
//         continue; 
//       } 
//       const metadata = ai.metadata ?? null;
//       let reason = "AI";
//       let top_level_category = "";
//       if (metadata?.reasoning) {
//         const match = metadata.reasoning.match(/sensitive\s+([A-Za-z]+)/i);
//         if (match) reason = match[1]; // e.g. PII
//         if (metadata.reasoning.includes(" PII ")) {
//           top_level_category = "PII";
//         }
//       }

//       // TODO: create more discrete categories for contextual prompt instructions 
//       // e.g. Sensitive Information (Medical), Sensitive Information (Police), SI (Personal Relationships), 
//       // SI (Employment), SI (Financial), SI (Personal e.g. sexual orientation/gender) 
//       let full_category = "";
//       const category = metadata?.category ?? "Unknown";
//       if (top_level_category != "") {
//         full_category = `${top_level_category} (${category})`;
//       } else {
//         full_category = category;
//       }
//       const h: CommentedHighlight = { 
//         id: ai.id ?? String(Math.random()).slice(2), 
//         content: { text: ai.content?.text ?? "" }, 
//         comment: ai.metadata?.reasoning ?? "", 
//         position: ai.position, // <-- PASS THROUGH RAW 
//         metadata: ai.metadata ?? null, 
//         source: "ai", 
//         label: `AI generated: ${reason} – ${category}`, 
//         category: full_category,
//         confidence: ai.metadata?.confidence 
//       }; 
//       aiHighlights.push(h); 
//     } 
//     console.log("[applyAiRedactionsToWorkingFile] converted aiHighlights:", aiHighlights); 
    
//     // 3. Dedupe by ID 
//     const existingIds = new Set(existingAll.map(h => h.id)); 
//     const filteredAi = aiHighlights.filter(h => !existingIds.has(h.id)); 
//     console.log("[applyAiRedactionsToWorkingFile] filteredAi after ID dedupe:", filteredAi); 
    
//     if (filteredAi.length === 0) { 
//       console.warn("[applyAiRedactionsToWorkingFile] No NEW AI highlights to merge."); 
//     } 
    
//     // 4. Merge arrays 
//     const mergedAll = [...existingAll, ...filteredAi]; 
//     const mergedActive = new Set([...existingActive, ...filteredAi.map(h => h.id)]); 
//     console.log("[applyAiRedactionsToWorkingFile] mergedAll length:", mergedAll.length); 
//     console.log("[applyAiRedactionsToWorkingFile] mergedActive size:", mergedActive.size); 
    
//     // 5. Update Dexie 
//     console.log("[applyAiRedactionsToWorkingFile] Updating Dexie record..."); 
//     await db.pdfs.update(pdfId, { allHighlights: mergedAll, activeHighlights: Array.from(mergedActive) }); 
//     console.log("[applyAiRedactionsToWorkingFile] Dexie update complete."); 
    
//     // 6. SAVE back to Blob storage as working snapshot 
//     console.log("[applyAiRedactionsToWorkingFile] Saving working snapshot to Blob..."); 
//     try { 
//       await saveWorkingSnapshotToBlob(userId, projectId, pdfId); 
//       console.log("[applyAiRedactionsToWorkingFile] Blob upload COMPLETE."); 
//     } catch (err) { 
//       console.error("[applyAiRedactionsToWorkingFile] Blob upload FAILED:", err); 
//     } 
    
//     console.log("=== [applyAiRedactionsToWorkingFile] END ==="); 
//   }


//
// aiRedactionHelpers.ts — UPDATED FOR CONTAINER APP BACKEND
//

// import { AiJobStatus } from "../mytypes/ai";

// /**
//  * Start backend job + poll until complete.
//  * Returns the final redaction JSON.
//  */
// export async function runSingleRedactionJob({
//   blobPath,
//   aiRules,
//   userInstructions,
//   onStatusChange,
//   onComplete,
//   onError,
// }: {
//   blobPath: string;
//   aiRules: string[];
//   userInstructions: string;
//   onStatusChange?: (status: AiJobStatus) => void;
//   onComplete?: (output: any) => void;
//   onError?: (err: any) => void;
// }): Promise<void> {
//   try {
//     // ------------------------------------------------------
//     // 1. START JOB
//     // ------------------------------------------------------
//     const startRes = await fetch("/api/start-redaction", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         blobName: blobPath,
//         rules: aiRules,
//         userInstructions,
//       }),
//     });

//     if (!startRes.ok) {
//       throw new Error(await startRes.text());
//     }

//     const { jobId } = await startRes.json();
//     onStatusChange?.("running");

//     // ------------------------------------------------------
//     // 2. POLL JOB STATUS
//     // ------------------------------------------------------
//     const pollIntervalMs = 2000;

//     while (true) {
//       const statusRes = await fetch(`/api/job-status?jobId=${jobId}`);
//       const statusJson = await statusRes.json();

//       if (statusJson.status === "complete") break;

//       onStatusChange?.("running");
//       await new Promise((r) => setTimeout(r, pollIntervalMs));
//     }

//     onStatusChange?.("completed");

//     // ------------------------------------------------------
//     // 3. FETCH FINAL OUTPUT
//     // ------------------------------------------------------
//     const resultRes = await fetch(`/api/job-result?jobId=${jobId}`);
//     if (!resultRes.ok) {
//       throw new Error(await resultRes.text());
//     }

//     const output = await resultRes.json();
//     onComplete?.(output);
//   } catch (err) {
//     onError?.(err);
//   }
// }

// /**
//  * Run AI redaction for multiple documents in parallel.
//  */
// export async function runAiRedactionForProjectParallel({
//   userId,
//   projectId,
//   fileNames,
//   aiRules,
//   userInstructions,
//   concurrency = 2,
//   signal,
//   onDocStatus,
//   onDocComplete,
//   onDocError,
//   onBatchProgress,
// }: {
//   userId: string;
//   projectId: string;
//   fileNames: string[];
//   aiRules: string[];
//   userInstructions: string;
//   concurrency?: number;
//   signal?: AbortSignal;
//   onDocStatus?: (fileName: string, status: AiJobStatus) => void;
//   onDocComplete?: (fileName: string, output: any) => void;
//   onDocError?: (fileName: string, err: any) => void;
//   onBatchProgress?: (completed: number, total: number) => void;
// }): Promise<void> {
//   let active = 0;
//   let completed = 0;
//   const total = fileNames.length;
//   const queue = [...fileNames];
//   const abort = () => signal?.aborted;

//   return new Promise<void>((resolve, reject) => {
//     const runNext = () => {
//       if (abort()) return reject(new Error("Cancelled"));
//       if (queue.length === 0 && active === 0) {
//         resolve();
//         return;
//       }

//       while (active < concurrency && queue.length > 0) {
//         const fileName = queue.shift()!;
//         active++;

//         onDocStatus?.(fileName, "running");

//         const blobPath = `files/${userId}/${projectId}/original/${fileName}`;

//         runSingleRedactionJob({
//           blobPath,
//           aiRules,
//           userInstructions,
//           onStatusChange: (s) => onDocStatus?.(fileName, s),
//           onComplete: (payload) => {
//             onDocStatus?.(fileName, "completed");
//             onDocComplete?.(fileName, payload);
//             completed++;
//             onBatchProgress?.(completed, total);
//             active--;
//             runNext();
//           },
//           onError: (err) => {
//             onDocStatus?.(fileName, "failed");
//             onDocError?.(fileName, err);
//             completed++;
//             onBatchProgress?.(completed, total);
//             active--;
//             runNext();
//           },
//         });
//       }
//     };

//     runNext();
//   });
// }

import { AiJobStatus } from "../mytypes/ai";

type OnStatus = (status: AiJobStatus) => void;
type OnComplete = (output: any) => void;
type OnError = (err: any) => void;

interface RunJobOpts {
  blobPath: string;
  aiRules: string[];
  userInstructions: string;
  onStatusChange?: OnStatus;
  onComplete?: OnComplete;
  onError?: OnError;
  signal?: AbortSignal;
  pollIntervalMs?: number;     // default 2000
  timeoutMs?: number;          // default 15 * 60 * 1000
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => resolve(), ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal.aborted) onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

async function safeJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) throw new Error("Empty response body");
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    throw new Error(`Invalid JSON: ${(e as Error).message}. Body: ${text}`);
  }
}

/**
 * Start backend job and poll SWA status/result endpoints until completion.
 * Returns final payload via onComplete and updates onStatusChange.
 */
export async function runSingleRedactionJob({
  blobPath,
  aiRules,
  userInstructions,
  onStatusChange,
  onComplete,
  onError,
  signal,
  pollIntervalMs = 2000,
  timeoutMs = 15 * 60 * 1000,
}: RunJobOpts): Promise<void> {
  const startedAt = Date.now();

  const guardTimeout = () => {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Timed out after ${(timeoutMs / 1000).toFixed(0)}s`);
    }
  };

  try {
    // 1) START
    const startRes = await fetch("/api/start-redaction", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blobName: blobPath,
        rules: aiRules,
        userInstructions,
      }),
      signal,
    });

    if (!startRes.ok) {
      // Always try to propagate structured error from SWA
      const errText = await startRes.text();
      throw new Error(
        `start-redaction failed: ${startRes.status} ${startRes.statusText} — ${errText || "(no body)"}`
      );
    }

    const startJson = await safeJson<{ jobId: string }>(startRes);
    const jobId = startJson?.jobId;
    if (!jobId) {
      throw new Error("start-redaction did not return a jobId");
    }

    onStatusChange?.("running");

    // 2) POLL STATUS
    let attempt = 0;
    const backoffMin = pollIntervalMs;           // baseline 2s
    const backoffMax = Math.min(10000, pollIntervalMs * 5); // cap 10s

    while (true) {
      guardTimeout();

      // a) call /api/job-status
      let statusOk = false;
      try {
        const statusRes = await fetch(`/api/job-status?jobId=${encodeURIComponent(jobId)}`, { signal });
        if (statusRes.ok) {
          const statusJson = await safeJson<{ status: string }>(statusRes);
          if (statusJson?.status === "complete") {
            break;
          }
          statusOk = true; // “running” is a valid response
        } else {
          // non-OK: transient; keep polling with backoff
          /* no-op */
        }
      } catch {
        // network or parse error; treat as transient
      }

      // b) Adaptive backoff to reduce noise during transient errors
      const wait =
        statusOk
          ? backoffMin
          : Math.min(backoffMax, backoffMin * Math.pow(1.6, attempt++)); // 2s, 3.2s, 5.1s, ...

      onStatusChange?.("running");
      await sleep(wait, signal);
    }

    onStatusChange?.("completed");

    // 3) FETCH RESULT
    const resultRes = await fetch(`/api/job-result?jobId=${encodeURIComponent(jobId)}`, { signal });
    if (!resultRes.ok) {
      const errText = await resultRes.text();
      throw new Error(
        `job-result failed: ${resultRes.status} ${resultRes.statusText} — ${errText || "(no body)"}`
      );
    }

    const output = await safeJson<any>(resultRes);
    onComplete?.(output);
  } catch (err) {
    if ((err as any)?.name === "AbortError") {
      onStatusChange?.("cancelled");
      onError?.(new Error("Cancelled"));
      return;
    }
    onStatusChange?.("failed");
    onError?.(err);
  }
}

/**
 * Lightweight parallel batch runner with concurrency control.
 * (Keeps your existing signatures so ProjectHome can plug in.)
 */
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
  onBatchProgress,
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
}): Promise<void> {
  let active = 0;
  let completed = 0;
  const total = fileNames.length;
  const queue = [...fileNames];

  return new Promise<void>((resolve, reject) => {
    const tick = () => onBatchProgress?.(completed, total);

    const next = () => {
      if (signal?.aborted) return reject(new Error("Cancelled"));
      if (queue.length === 0 && active === 0) return resolve();

      while (active < concurrency && queue.length > 0) {
        const fileName = queue.shift()!;
        active++;

        const blobPath = `files/${userId}/${projectId}/original/${fileName}`;
        onDocStatus?.(fileName, "running");

        runSingleRedactionJob({
          blobPath,
          aiRules,
          userInstructions,
          signal,
          onStatusChange: (s) => onDocStatus?.(fileName, s),
          onComplete: (output) => {
            onDocStatus?.(fileName, "completed");
            onDocComplete?.(fileName, output);
            completed++;
            active--;
            tick();
            next();
          },
          onError: (err) => {
            onDocStatus?.(fileName, "failed");
            onDocError?.(fileName, err);
            completed++;
            active--;
            tick();
            next();
          },
        });
      }
    };

    next();
  });
}