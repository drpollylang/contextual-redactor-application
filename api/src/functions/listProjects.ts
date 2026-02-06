import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getServiceClient, DEFAULT_CONTAINER } from "../shared/storage";

app.http("listProjects", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (req, ctx): Promise<HttpResponseInit> => {
    try {
      const userId = (req.query.get("userId") || "").trim();
      if (!userId) {
        return { status: 400, jsonBody: { error: "userId is required" } };
      }

      const service = getServiceClient();
      const container = service.getContainerClient(DEFAULT_CONTAINER || "files");

      const prefix = `${userId}/`;
      const projectIds = new Set<string>();

      for await (const item of container.listBlobsByHierarchy("/", { prefix })) {
        if (item.kind === "prefix") {
          const parts = item.name.split("/").filter(Boolean);

          // Example: files/<userId>/<projectId>/
          const projectId = parts[2];

          if (projectId && projectId !== "discarded") {
            projectIds.add(projectId);
          }
        }
      }

      return { jsonBody: { projects: [...projectIds] } };

    } catch (e) {
      ctx.error("[listProjects] error:", e?.message, e?.stack);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  }
});