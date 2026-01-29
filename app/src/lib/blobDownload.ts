import { getDownloadSas } from "./apiClient";

export async function getDownloadUrl(
  container: string,
  blobPath: string,
  ttlMinutes = 5
): Promise<string> {
  const { downloadUrl } = await getDownloadSas({ containerName: container, blobPath, ttlMinutes });
  return downloadUrl.replaceAll("&amp;", "&");
}