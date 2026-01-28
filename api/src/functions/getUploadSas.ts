// Get a SaS in order to be able to upload files to Azure Blob Storage
// SaS = Shared Access Signatures, which are tokens that grant time-limited and permission-scoped access to resources in 
// Azure Storage and other SAS-enabled services.
import {
  BlobServiceClient,
  BlobSASPermissions,
  BlobSASSignatureValues,
  SASProtocol,
  generateBlobSASQueryParameters
} from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

const STORAGE_URL = process.env.STORAGE_URL!; // e.g., https://<account>.blob.core.windows.net

type UploadBody = {
  containerName: string;
  blobPath: string;
  ttlMinutes?: number;
};

function getAccountNameFromUrl(accountUrl: string): string {
  const host = new URL(accountUrl).host; // "<account>.blob.core.windows.net"
  const account = host.split(".")[0];
  if (!account) throw new Error("Could not parse storage account name from STORAGE_URL");
  return account;
}

export async function getUploadSas(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as Partial<UploadBody>;
    const { containerName, blobPath, ttlMinutes = 10 } = body;

    if (!containerName || !blobPath) {
      return { status: 400, jsonBody: { error: "containerName and blobPath are required" } };
    }

    // Auth chain: local = Azure CLI; Azure = Managed Identity
    const credential = new DefaultAzureCredential(); // DefaultAzureCredential chooses the best available source
    const service = new BlobServiceClient(STORAGE_URL, credential);

    // Request a user delegation key (requires RBAC on the storage account)
    const now = new Date();
    const ends = new Date(now.getTime() + ttlMinutes * 60_000);
    const userDelegationKey = await service.getUserDelegationKey(now, ends);

    // Build SAS signature values
    const sasValues: BlobSASSignatureValues = {
      containerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse("cwr"), // create, write, read
      startsOn: now,
      expiresOn: ends,
      protocol: SASProtocol.Https
    };

    const accountName = getAccountNameFromUrl(STORAGE_URL);
    const sasToken = generateBlobSASQueryParameters(sasValues, userDelegationKey, accountName).toString(); // UD SAS
    const uploadUrl = `${STORAGE_URL}/${containerName}/${blobPath}?${sasToken}`;

    return { jsonBody: { uploadUrl } };
  } catch (err: any) {
    ctx.error(err?.message ?? err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("getUploadSas", {
  methods: ["POST"],
  authLevel: "anonymous", // lock down later via SWA auth/roles
  handler: getUploadSas
});