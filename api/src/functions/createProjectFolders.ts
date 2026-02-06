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

      const { userId, projectId } = body; // <-- typed

      if (!userId || !projectId) {
        return { status: 400, jsonBody: { error: "Missing userId or projectId" } };
      }

      const service = getServiceClient();
      const container = service.getContainerClient(DEFAULT_CONTAINER);

      const prefix = `files/${userId}/${projectId}/`;
      const placeholder = container.getBlockBlobClient(prefix + "placeholder.txt");

      await placeholder.upload("project initialized", "project initialized".length);

      return { jsonBody: { ok: true } };

    } catch (e) {
      ctx.error("[createProjectFolder] error", e);
      return { status: 500 };
    }
  }
});