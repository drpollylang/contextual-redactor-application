// Get a SaS in order to be able to download files from Azure Blob Storage
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

const STORAGE_URL = process.env.STORAGE_URL!;

type DownloadBody = {
  containerName: string;
  blobPath: string;
  ttlMinutes?: number;
};

function getAccountNameFromUrl(accountUrl: string): string {
  const host = new URL(accountUrl).host;
  const account = host.split(".")[0];
  if (!account) throw new Error("Could not parse storage account name from STORAGE_URL");
  return account;
}

export async function getDownloadSas(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const body = (await req.json()) as Partial<DownloadBody>;
    const { containerName, blobPath, ttlMinutes = 10 } = body;
    if (!containerName || !blobPath) {
      return { status: 400, jsonBody: { error: "containerName and blobPath are required" } };
    }

    const credential = new DefaultAzureCredential();
    const service = new BlobServiceClient(STORAGE_URL, credential);

    const now = new Date();
    const ends = new Date(now.getTime() + ttlMinutes * 60_000);
    const userDelegationKey = await service.getUserDelegationKey(now, ends);

    const sasValues: BlobSASSignatureValues = {
      containerName,
      blobName: blobPath,
      permissions: BlobSASPermissions.parse("r"), // read-only
      startsOn: now,
      expiresOn: ends,
      protocol: SASProtocol.Https
    };

    const accountName = getAccountNameFromUrl(STORAGE_URL);
    const sasToken = generateBlobSASQueryParameters(sasValues, userDelegationKey, accountName).toString();
    const downloadUrl = `${STORAGE_URL}/${containerName}/${blobPath}?${sasToken}`;

    return { jsonBody: { downloadUrl } };
  } catch (err: any) {
    ctx.error(err?.message ?? err);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("getDownloadSas", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: getDownloadSas
});