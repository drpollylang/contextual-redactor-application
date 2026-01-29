
// app/src/lib/apiClient.ts
// const API_BASE =
//   import.meta.env.MODE === "development"
//     ? "http://localhost:7071/api" // dev: direct to local Functions host
//     : "/api";                      // prod: SWA reverse proxy

const API_BASE = "/api";  

export type UploadSasResponse = { uploadUrl: string };
export type DownloadSasResponse = { downloadUrl: string };

// apiClient.ts (or wherever you call the Function)
export type GetUploadSasResponse =
  | { uploadUrl: string; blobPath?: string }              // blob-level SAS
  | { uploadBase: string; blobPath: string };             // container-level SAS

export async function getUploadSas(params: {
  containerName: string;
  blobPath: string;      // raw or encoded, server will normalize
  ttlMinutes?: number;
}): Promise<GetUploadSasResponse> {
  const res = await fetch(`${API_BASE}/getUploadSas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`getUploadSas failed: ${res.status}`);
  const data = await res.json();
  // Helpful logging while we stabilize:
  console.log("[WEB] getUploadSas response:", data);
  return data;
}

export async function getDownloadSas(params: {
  containerName: string;
  blobPath: string;
  ttlMinutes?: number;
}): Promise<DownloadSasResponse> {
  // const res = await fetch("/api/src/functions/getDownloadSas", {
  const res = await fetch(`${API_BASE}/getDownloadSas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`getDownloadSas failed: ${res.status}`);
  return res.json();
}


export type UserDocEntry = {
  projectId: string;
  fileName: string;
  originalPath?: string;
  workingPath?: string;
  highlightsPath?: string;
};

export async function listUserDocuments(userId: string): Promise<UserDocEntry[]> {
  // Use GET with query; you can also send POST with body if you prefer
  const res = await fetch(`${API_BASE}/listUserDocuments?userId=${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`listUserDocuments failed: ${res.status}`);
  const data = await res.json();
  const docs = (data?.documents ?? []) as UserDocEntry[];
  console.log("[WEB] listUserDocuments:", docs);
  return docs;
}
