// // Get a SaS in order to be able to upload files to Azure Blob Storage
// // SaS = Shared Access Signatures, which are tokens that grant time-limited and permission-scoped access to resources in 
// // Azure Storage and other SAS-enabled services.
// import {
//   BlobServiceClient,
//   BlobSASPermissions,
//   BlobSASSignatureValues,
//   SASProtocol,
//   generateBlobSASQueryParameters
// } from "@azure/storage-blob";
// import { DefaultAzureCredential } from "@azure/identity";
// import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// const STORAGE_URL = process.env.STORAGE_URL!; // https://<account>.blob.core.windows.net

// function normalizeBlobPath(raw: string): string {
//   return raw.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
// }

// // Encode only path segments (directories + filename), not the full URL:
// function encodePathSegments(path: string): string {
//   return path.split("/").map(encodeURIComponent).join("/");
// }

// export async function getUploadSas(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
//   try {
//     const { containerName, blobPath, ttlMinutes = 10 } = (await req.json()) as {
//       containerName?: string; blobPath?: string; ttlMinutes?: number;
//     };
//     if (!containerName || !blobPath) {
//       return { status: 400, jsonBody: { error: "containerName and blobPath are required" } };
//     }

//     // Normalize raw blob name for signing (do NOT encode for signing)
//     const rawBlobPath = normalizeBlobPath(blobPath);

//     const credential = new DefaultAzureCredential();
//     const service    = new BlobServiceClient(STORAGE_URL, credential);

//     const now    = new Date();
//     const starts = new Date(now.getTime() - 5 * 60_000);
//     const ends   = new Date(now.getTime() + ttlMinutes * 60_000);
//     const key    = await service.getUserDelegationKey(starts, ends);

//     const sasValues: BlobSASSignatureValues = {
//       containerName,
//       blobName: rawBlobPath,                          // ← include blobName for blob SAS
//       permissions: BlobSASPermissions.parse("cwr"),   // create + write + read
//       startsOn: starts,
//       expiresOn: ends,
//       protocol: SASProtocol.Https
//     };

//     const accountName = new URL(STORAGE_URL).host.split(".")[0];
//     const sasToken    = generateBlobSASQueryParameters(sasValues, key, accountName).toString();

//     // Encode only when composing the URL path:
//     const urlBlobPath = encodePathSegments(rawBlobPath);
//     const uploadUrl   = `${STORAGE_URL}/${containerName}/${urlBlobPath}?${sasToken}`;

//     return { jsonBody: { uploadUrl, blobPath: rawBlobPath } };
//   } catch (err: any) {
//     ctx.error(err?.message ?? err);
//     return { status: 500, jsonBody: { error: "Internal server error" } };
//   }
// }

// app.http("getUploadSas", {
//   methods: ["POST"],
//   authLevel: "anonymous",
//   handler: getUploadSas
// });

import {
  StorageSharedKeyCredential,
  BlobSASPermissions,
  BlobSASSignatureValues,
  SASProtocol,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// API settings (configure in SWA -> Configuration -> Application settings)
const ACCOUNT = process.env.STORAGE_ACCOUNT_NAME!;
const ACCOUNT_KEY = process.env.STORAGE_ACCOUNT_KEY!;
const STORAGE_URL = process.env.STORAGE_URL!;
const DEFAULT_CONTAINER = process.env.DEFAULT_CONTAINER || "files";

type UploadBody = {
  containerName?: string;
  blobPath?: string;
  ttlMinutes?: number;
  mode?: "blob" | "container";
};

// --- helpers ---
function normalize(path: string) {
  return path.replace(/^\/+/, "").replace(/\/{2,}/g, "/");
}
function encodeSeg(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Read a JSON body safely and narrow to Partial<UploadBody>.
 * Returns null if there is no JSON body or content-type is not application/json.
 */
async function readJsonBody(req: HttpRequest): Promise<Partial<UploadBody> | null> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) {
    return null;
  }
  try {
    const raw = await req.json(); // Promise<unknown>
    // Narrow to a plain object
    if (raw && typeof raw === "object") {
      return raw as Partial<UploadBody>;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getUploadSas(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    // Basic server config guards
    if (!ACCOUNT || !ACCOUNT_KEY || !STORAGE_URL) {
      ctx.error("[getUploadSas] Missing STORAGE_ACCOUNT_NAME/KEY or STORAGE_URL");
      return { status: 500, jsonBody: { error: "Server not configured" } };
    }

    const body = await readJsonBody(req);

    // Pull fields with defaults
    const containerName = (body?.containerName || DEFAULT_CONTAINER).trim();
    const blobPath = body?.blobPath ? normalize(body.blobPath) : undefined;
    const ttlMinutes = Number.isFinite(body?.ttlMinutes as number) ? (body!.ttlMinutes as number) : 10;
    const mode = (body?.mode === "blob" || body?.mode === "container") ? body!.mode! : "container";

    // Validate required fields for selected mode
    if (!containerName) {
      return { status: 400, jsonBody: { error: "containerName is required (or DEFAULT_CONTAINER must be set)" } };
    }
    if (mode === "blob" && !blobPath) {
      return { status: 400, jsonBody: { error: "blobPath is required when mode='blob'" } };
    }

    const cred = new StorageSharedKeyCredential(ACCOUNT, ACCOUNT_KEY);
    const now = new Date();
    const startsOn  = new Date(now.getTime() - 5 * 60_000);
    const expiresOn = new Date(now.getTime() + ttlMinutes * 60_000);

    if (mode === "blob") {
      // ---------- Blob-level SAS (create+write+read on one blob) ----------
      const sasValues: BlobSASSignatureValues = {
        containerName,
        blobName: blobPath!,
        permissions: BlobSASPermissions.parse("cwr"),
        startsOn,
        expiresOn,
        protocol: SASProtocol.Https
      };

      const sasToken = generateBlobSASQueryParameters(sasValues, cred).toString();
      const urlPath  = encodeSeg(blobPath!);
      const uploadUrl = `${STORAGE_URL}/${containerName}/${urlPath}?${sasToken}`;
      return { jsonBody: { uploadUrl, blobPath } };
    }

    // ---------- Container-level SAS (create+write at container) ----------
    const sasValues: BlobSASSignatureValues = {
      containerName,
      permissions: /* ContainerSASPermissions */ (BlobSASPermissions.parse("cw") as any),
      startsOn,
      expiresOn,
      protocol: SASProtocol.Https
    };

    const sasToken = generateBlobSASQueryParameters(sasValues, cred).toString();
    const uploadBase = `${STORAGE_URL}/${containerName}?${sasToken}`;
    // Return raw path (if provided) so client can compose blob client
    return { jsonBody: { uploadBase, blobPath: blobPath ?? undefined } };

  } catch (err: any) {
    ctx.error("[getUploadSas] error:", err?.message, err?.stack);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("getUploadSas", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: getUploadSas
});