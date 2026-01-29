// // Get a SaS in order to be able to upload files to Azure Blob Storage
// // SaS = Shared Access Signatures, which are tokens that grant time-limited and permission-scoped access to resources in 
// // Azure Storage and other SAS-enabled services.
import {
  BlobServiceClient,
  BlobSASPermissions,
  BlobSASSignatureValues,
  SASProtocol,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

const STORAGE_URL = process.env.STORAGE_URL!; // https://<account>.blob.core.windows.net

function normalizeBlobPath(raw: string): string {
  return raw.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}

// Encode only path segments (directories + filename), not the full URL:
function encodePathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export async function getUploadSas(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const { containerName, blobPath, ttlMinutes = 10 } = (await req.json()) as {
      containerName?: string; blobPath?: string; ttlMinutes?: number;
    };
    if (!containerName || !blobPath) {
      return { status: 400, jsonBody: { error: "containerName and blobPath are required" } };
    }

    // Normalize raw blob name for signing (do NOT encode for signing)
    const rawBlobPath = normalizeBlobPath(blobPath);

    const credential = new DefaultAzureCredential();
    const service    = new BlobServiceClient(STORAGE_URL, credential);

    const now    = new Date();
    const starts = new Date(now.getTime() - 5 * 60_000);
    const ends   = new Date(now.getTime() + ttlMinutes * 60_000);
    const key    = await service.getUserDelegationKey(starts, ends);

    const sasValues: BlobSASSignatureValues = {
      containerName,
      blobName: rawBlobPath,                          // ← include blobName for blob SAS
      permissions: BlobSASPermissions.parse("cwr"),   // create + write + read
      startsOn: starts,
      expiresOn: ends,
      protocol: SASProtocol.Https
    };

    const accountName = new URL(STORAGE_URL).host.split(".")[0];
    const sasToken    = generateBlobSASQueryParameters(sasValues, key, accountName).toString();

    // Encode only when composing the URL path:
    const urlBlobPath = encodePathSegments(rawBlobPath);
    const uploadUrl   = `${STORAGE_URL}/${containerName}/${urlBlobPath}?${sasToken}`;

    return { jsonBody: { uploadUrl, blobPath: rawBlobPath } };
  } catch (err: any) {
    ctx.error(err?.message ?? err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("getUploadSas", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: getUploadSas
});