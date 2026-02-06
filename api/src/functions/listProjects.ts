import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getServiceClient, DEFAULT_CONTAINER } from "../shared/storage";

app.http("listProjects", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (req, ctx): Promise<HttpResponseInit> => {
    try {
      const userId = req.query.get("userId");
      const service = getServiceClient();
      const container = service.getContainerClient(DEFAULT_CONTAINER);

      const prefix = `files/${userId}/`;

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
      ctx.error("[listProjects] error", e);
      return { status: 500 };
    }
  }
});