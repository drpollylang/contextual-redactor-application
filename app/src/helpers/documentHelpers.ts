import { db } from "../storage";
import { getDownloadSas } from "../lib/apiClient";

/**
 * Delete a document everywhere:
 *   - IndexedDB entry (local)
 *   - Original PDF
 *   - Working PDF + highlights
 *   - Final redacted PDF
 *   - AI redactions JSON
 */
export async function removeDocument(
  userId: string,
  projectId: string,
  fileName: string
): Promise<void> {

  /**************************************
   * 1. Build canonical blob paths
   **************************************/
  
  // fileName should already include .pdf (you currently store like "MyDoc.pdf")
  const originalPath   = `${userId}/${projectId}/original/${fileName}`;
  const workingPdfPath = `${userId}/${projectId}/working/${fileName}`;

  // Highlights file ends with ".pdf.highlights.json"
  const highlightsPath = `${userId}/${projectId}/working/${fileName}.highlights.json`;

  const finalPath      = `${userId}/${projectId}/final/${fileName}`;
  const aiPath         = `${userId}/${projectId}/ai_redactions/${fileName.replace(/\.pdf$/i, ".json")}`;

  const pathsToDelete = [
    originalPath,
    workingPdfPath,
    highlightsPath,
    finalPath,
    aiPath,
  ];


  /**************************************
   * 2. Delete from IndexedDB
   *    (use same id generation as workspace)
   **************************************/
  
  const buildPdfId = (projId: string, name: string) => `${projId}::${name}`;
  const pdfId = buildPdfId(projectId, fileName);

  await db.pdfs.delete(pdfId);


  /**************************************
   * 3. Delete each blob in Azure storage
   **************************************/
  
  async function deleteBlob(blobPath: string) {
    // Skip empty path (safety)
    if (!blobPath) return;

    // Request a SAS URL with delete permission
    const { downloadUrl } = await getDownloadSas({
      containerName: "files",
      blobPath,
      ttlMinutes: 10,
      // permissions: "d" // MUST include delete permission
    });

    const cleanUrl = downloadUrl
      .replace(/&amp;amp;amp;/g, "&")
      .replace(/&amp;amp;/g, "&");

    // Issue DELETE call
    await fetch(cleanUrl, { method: "DELETE" });
  }

  await Promise.all(pathsToDelete.map(p => deleteBlob(p)));
}



/**
 * Download a single document (original, working, or final).
 * 
 * @param userId 
 * @param projectId 
 * @param fileName   Must include `.pdf`
 * @param variant    "original" | "working" | "final"
 */
export async function downloadDocument(
  userId: string,
  projectId: string,
  fileName: string,
  variant: "original" | "working" | "final" = "original"
): Promise<void> {

  /**************************************
   * 1. Select canonical blob path
   **************************************/
  let blobPath: string;

  switch (variant) {
    case "working":
      blobPath = `${userId}/${projectId}/working/${fileName}`;
      break;
    case "final":
      blobPath = `${userId}/${projectId}/final/${fileName}`;
      break;
    default:
      blobPath = `${userId}/${projectId}/original/${fileName}`;
      break;
  }

  /**************************************
   * 2. Request a SAS URL
   **************************************/
  const { downloadUrl } = await getDownloadSas({
    containerName: "files",
    blobPath,
    ttlMinutes: 10,
    // permissions: "r" // read permission
  });

  const cleanUrl = downloadUrl
    .replace(/&amp;amp;amp;/g, "&")
    .replace(/&amp;amp;/g, "&");

  /**************************************
   * 3. Fetch the blob
   **************************************/
  const response = await fetch(cleanUrl);
  if (!response.ok) {
    throw new Error(`Failed to download ${fileName} (${variant}).`);
  }

  const blob = await response.blob();

  /**************************************
   * 4. Trigger browser download
   **************************************/
  const a = document.createElement("a");
  const url = URL.createObjectURL(blob);
  a.href = url;

  // Save with meaningful filename
  const suffix = variant === "original" ? "" : `.${variant}`;
  a.download = fileName.replace(/\.pdf$/i, `${suffix}.pdf`);

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}