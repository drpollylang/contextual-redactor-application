import { ContainerClient, BlockBlobClient } from "@azure/storage-blob";

type UploadInputs = {
  uploadBase?: string;  // container SAS
  uploadUrl?: string;   // blob SAS
  blobPath?: string;    // required with uploadBase; optional with uploadUrl
  file: File;
  onProgress?: (bytes: number) => void;
};

export async function uploadFileToBlob({
  uploadBase,
  uploadUrl,
  blobPath,
  file,
  onProgress
}: UploadInputs) {
  console.log("[WEB] upload inputs:", { hasUploadBase: !!uploadBase, hasUploadUrl: !!uploadUrl, blobPath });

  // Case A: blob-level SAS (full URL per-blob)
  if (uploadUrl) {
    const cleanUrl = uploadUrl.replace(/&amp;/g, "&"); // de-HTML-escape just in case
    const client = new BlockBlobClient(cleanUrl);
    await client.uploadData(file, {
      blockSize: 4 * 1024 * 1024,
      onProgress: p => onProgress?.(p.loadedBytes)
    });
    return;
  }

  // Case B: container-level SAS (requires blobPath)
  if (uploadBase) {
    if (!blobPath) {
      throw new Error("Container SAS provided, but 'blobPath' is missing.");
    }
    const cleanBase = uploadBase.replace(/&amp;/g, "&");
    const container = new ContainerClient(cleanBase);

    // If server returned raw name (recommended), this is a no-op; if it was %20-encoded, this decodes once.
    const effectiveBlobPath = decodeURIComponent(blobPath);

    const blockBlob = container.getBlockBlobClient(effectiveBlobPath);
    await blockBlob.uploadData(file, {
      blockSize: 4 * 1024 * 1024,
      onProgress: p => onProgress?.(p.loadedBytes)
    });
    return;
  }

  // If we get here, server didn't return either field
  throw new Error("Neither uploadUrl nor uploadBase was provided.");
}