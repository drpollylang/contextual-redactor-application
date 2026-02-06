import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getServiceClient, DEFAULT_CONTAINER } from "../shared/storage";

interface CreateProjectPayload {
  userId: string;
  projectId: string;
}

app.http("createProjectFolder", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (req, ctx) => {
    try {
      const body = (await req.json()) as CreateProjectPayload;
      const userId = (body?.userId || "").trim();
      const projectId = (body?.projectId || "").trim();

      if (!userId || !projectId) {
        return { status: 400, jsonBody: { error: "userId and projectId are required" } };
      }

      const service = getServiceClient();
      const container = service.getContainerClient(DEFAULT_CONTAINER || "files");

      const folderPrefix = `${userId}/${projectId}/`;
      const placeholder = container.getBlockBlobClient(folderPrefix + "placeholder.txt");

      const content = "project initialized";
      await placeholder.upload(content, Buffer.byteLength(content));

      return { jsonBody: { ok: true } };


    } catch (e) {
      ctx.error("[createProjectFolder] error", e);
      return { status: 500 };
    }
  }
});