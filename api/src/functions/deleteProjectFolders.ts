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
      const { userId, projectId } = body;

      const service = getServiceClient();
      const container = service.getContainerClient(DEFAULT_CONTAINER);

      const srcPrefix = `files/${userId}/${projectId}/`;
      const destPrefix = `files/${userId}/discarded/${projectId}/`;

      // Copy all blobs into discarded/
      for await (const blob of container.listBlobsFlat({ prefix: srcPrefix })) {
        const src = container.getBlobClient(blob.name);
        const nameOnly = blob.name.substring(srcPrefix.length);
        const dest = container.getBlockBlobClient(destPrefix + nameOnly);

        await dest.beginCopyFromURL(src.url);
        await src.delete();
      }

      return { jsonBody: { ok: true } };

    } catch (e) {
      ctx.error("[deleteProjectFolder] error", e);
      return { status: 500 };
    }
  }
});