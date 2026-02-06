import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getServiceClient, DEFAULT_CONTAINER } from "../shared/storage";

interface DeleteProjectPayload {
  userId: string;
  projectId: string;
}

app.http("deleteProjectFolder", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (req, ctx): Promise<HttpResponseInit> => {
    try { 
      const body = (await req.json()) as DeleteProjectPayload;
      const userId = (body?.userId || "").trim();
      const projectId = (body?.projectId || "").trim();

      if (!userId || !projectId) {
        return { status: 400, jsonBody: { error: "userId and projectId are required" } };
      }

      const service = getServiceClient();
      const container = service.getContainerClient(DEFAULT_CONTAINER || "files");

      // NOTE: start at <userId>/... not files/<userId>/...
      const srcPrefix = `${userId}/${projectId}/`;
      const destPrefix = `${userId}/discarded/${projectId}/`;

      for await (const blob of container.listBlobsFlat({ prefix: srcPrefix })) {
        const srcBlob = container.getBlobClient(blob.name);
        const nameOnly = blob.name.substring(srcPrefix.length);
        const destBlob = container.getBlockBlobClient(destPrefix + nameOnly);

        // Start a server-side copy and then delete original
        // (If you expect large blobs & eventual consistency concerns,
        // poll copy status before deleting.)
        await destBlob.beginCopyFromURL(srcBlob.url);
        await srcBlob.delete();
      }

      return { jsonBody: { ok: true } };


    } catch (e) {
      ctx.error("[deleteProjectFolder] error:", e?.message, e?.stack);
      return { status: 500, jsonBody: { error: "Internal server error" } };

    }
  }
});