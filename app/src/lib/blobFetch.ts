// src/lib/blobFetch.ts
import { getDownloadSas } from "../lib/apiClient";

function fixAmp(url: string) {
  // SWA/Functions often double-encode, normalize &amp; variants
  return url.replace(/&amp;amp;amp;amp;|&amp;amp;amp;|&amp;amp;|&amp;/g, "&");
}

export async function fetchJsonFromBlob<T>(
  containerName: string,
  blobPath: string,
  ttlMinutes = 10
): Promise<T | null> {
  const { downloadUrl } = await getDownloadSas({ containerName, blobPath, ttlMinutes });
  const clean = fixAmp(downloadUrl);
  const res = await fetch(clean);
  if (!res.ok) return null;
  return (await res.json()) as T;
}