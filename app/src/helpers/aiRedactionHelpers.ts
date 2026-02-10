// src/helpers/aiRedactionHelpers.ts

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