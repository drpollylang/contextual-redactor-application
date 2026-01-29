// /api/src/shared/storage.ts
import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  BlobSASPermissions,
  BlobSASSignatureValues,
  SASProtocol,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";

const ACCOUNT = process.env.STORAGE_ACCOUNT_NAME!;
const ACCOUNT_KEY = process.env.STORAGE_ACCOUNT_KEY!;
const STORAGE_URL = process.env.STORAGE_URL!;
export const DEFAULT_CONTAINER = process.env.DEFAULT_CONTAINER || "files";

if (!ACCOUNT || !ACCOUNT_KEY || !STORAGE_URL) {
  // Fail fast at startup if misconfigured
  // (In production this surfaces via 500 until settings are added)
  console.warn("[API] Storage settings are not fully configured.");
}

export function getSharedKeyCredential() {
  return new StorageSharedKeyCredential(ACCOUNT, ACCOUNT_KEY);
}

export function getServiceClient() {
  return new BlobServiceClient(STORAGE_URL, getSharedKeyCredential());
}

export function normalizePath(p: string) {
  return p.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}
export function encodePathSegments(p: string) {
  return normalizePath(p).split("/").map(encodeURIComponent).join("/");
}

export function buildBlobSasUrl(opts: {
  container: string;
  blobPath: string;
  permissions: string; // e.g., "r", "cwr"
  ttlMinutes?: number;
}) {
  const { container, blobPath, permissions, ttlMinutes = 10 } = opts;

  const cred = getSharedKeyCredential();
  const now = new Date();
  const startsOn  = new Date(now.getTime() - 5 * 60_000);
  const expiresOn = new Date(now.getTime() + ttlMinutes * 60_000);

  const values: BlobSASSignatureValues = {
    containerName: container,
    blobName: normalizePath(blobPath),
    permissions: BlobSASPermissions.parse(permissions),
    startsOn,
    expiresOn,
    protocol: SASProtocol.Https
  };

  const token = generateBlobSASQueryParameters(values, cred).toString();
  const urlPath = encodePathSegments(blobPath);
  const url = `${STORAGE_URL}/${container}/${urlPath}?${token}`;
  return { url, token };
}