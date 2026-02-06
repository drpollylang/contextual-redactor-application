// app/src/lib/blobPersist.ts
import { getUploadSas } from "./apiClient";
import { uploadFileToBlob } from "./blobUpload";
import { db } from "../storage";
import { base64ToBlob } from "../storage";

/**
 * Build canonical blob paths.
 */
function originalBlobPath(userId: string, projectId: string, fileName: string) {
  return `${userId}/${projectId}/original/${fileName}`;
}
function workingBlobPath(userId: string, projectId: string, fileName: string) {
  return `${userId}/${projectId}/working/${fileName}`;
}
function workingHighlightsPath(userId: string, projectId: string, fileName: string) {
  // e.g., report.pdf.highlights.json
  return `${userId}/${projectId}/working/${fileName}.highlights.json`;
}

/**
 * Upload a Blob/File to Blob Storage given a blobPath.
 * Handles both blob-level SAS and container-level SAS (your server supports either).
 */
async function uploadToBlob(container: string, blobPath: string, payload: Blob) {
  const resp = await getUploadSas({ containerName: container, blobPath });
  let uploadBase: string | undefined;
  let uploadUrl: string | undefined;
  let effectiveBlobPath = blobPath;

  if ("uploadUrl" in resp) {
    uploadUrl = resp.uploadUrl;
    if (resp.blobPath) effectiveBlobPath = resp.blobPath; // normalized from server
  } else if ("uploadBase" in resp) {
    uploadBase = resp.uploadBase;
    effectiveBlobPath = resp.blobPath; // required in this branch
  } else {
    throw new Error("Invalid getUploadSas response shape.");
  }

  await uploadFileToBlob({
    uploadBase,
    uploadUrl,
    blobPath: effectiveBlobPath,
    file: payload as File, // azure SDK accepts Blob; TS is ok with File-like
    onProgress: (b) => console.log("[BLOB] uploaded bytes:", b),
  });
}

/**
 * Upload the original PDF right after user import.
 */
export async function saveOriginalPdfToBlob(userId: string, projectId: string, file: File) {
  const blobPath = originalBlobPath(userId, projectId, file.name);
  await uploadToBlob("files", blobPath, file);
}

/**
 * Upload the current "working" PDF (bytes) and highlights JSON.
 * - Working PDF: for now, we upload the current workingBase64 (or originalBase64 if not set).
 * - Highlights: serialize from Dexie.
 */
export async function saveWorkingSnapshotToBlob(userId: string, projectId: string, pdfId: string) {
  const pdfRow = await db.pdfs.get(pdfId);
  if (!pdfRow) return;

  const pdfPath = null;
  const fileName = pdfRow.name;
  const pdfBase64 = pdfRow.workingBase64 ?? pdfRow.originalBase64;
  if (!pdfBase64) {
    console.warn("[BLOB] No base64 available for working/original; skipping PDF upload");
  } else {
    const pdfBlob = base64ToBlob(pdfBase64);
    const pdfPath = workingBlobPath(userId, projectId, fileName);
    await uploadToBlob("files", pdfPath, pdfBlob);
  }

  // Serialize highlights (both master + active list) and preferences if useful
  const payload = {
    pdfId,
    fileName,
    allHighlights: pdfRow.allHighlights ?? [],
    activeHighlights: pdfRow.activeHighlights ?? [],
    savedAt: new Date().toISOString(),
  };
  const json = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const jsonPath = workingHighlightsPath(userId, projectId, fileName);
  await uploadToBlob("files", jsonPath, json);

  console.log("[BLOB] Working snapshot saved:", { pdfPath: pdfPath ?? null, jsonPath });
}

// Add a Blob uploader for final redacted pdfs
function finalBlobPath(userId: string, projectId: string, fileName: string) {
  return `${userId}/${projectId}/final/${fileName}`;
}

/**
 * Upload the final (true‑redacted) PDF into:
 *   files/<userId>/<projectId>/final/<fileName>
 */
export async function saveFinalPdfToBlob(
  userId: string,
  projectId: string,
  finalBlob: Blob,
  fileName: string
) {
  const blobPath = finalBlobPath(userId, projectId, fileName);
  await uploadToBlob("files", blobPath, finalBlob);
  console.log("[BLOB] Final redacted PDF uploaded:", blobPath);
  return { blobPath };
}


// export async function saveFinalPdfToBlob(
//   userId: string,
//   projectId: string,
//   fileName: string,
//   finalBlob: Blob
// ): Promise<{ blobPath: string }> {
//   // Keep your current convention (same container and pathing as the rest):
//   // files/<userId>/<projectId>/final/<fileName>
//   const blobPath = `${userId}/${projectId}/final/${fileName}`;

//   // If your existing saveOriginalPdfToBlob knows how to PUT blobs (via SAS or API),
//   // you can reuse the same internal helper. For example, if you have an upload API:
//   const res = await fetch("/api/upload-final", {
//     method: "POST",
//     body: (() => {
//       const fd = new FormData();
//       fd.append("userId", userId);
//       fd.append("projectId", projectId);
//       fd.append("path", blobPath);
//       fd.append("file", finalBlob, fileName);
//       return fd;
//     })(),
//   });

//   if (!res.ok) {
//     throw new Error(`Failed to upload final PDF: ${res.status} ${await res.text()}`);
//   }
//   return { blobPath };
// }