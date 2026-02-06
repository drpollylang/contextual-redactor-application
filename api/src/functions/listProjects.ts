// import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
// import { getServiceClient, DEFAULT_CONTAINER } from "../shared/storage";

// app.http("listProjects", {
//   methods: ["GET"],
//   authLevel: "anonymous",
//   handler: async (req, ctx): Promise<HttpResponseInit> => {
//     try {
//       const userId = (req.query.get("userId") || "").trim();
//       if (!userId) {
//         return { status: 400, jsonBody: { error: "userId is required" } };
//       }

//       const service = getServiceClient();
//       const container = service.getContainerClient(DEFAULT_CONTAINER || "files");

//       const prefix = `${userId}/`;
//       const projectIds = new Set<string>();

//       for await (const item of container.listBlobsByHierarchy("/", { prefix })) {
//         if (item.kind === "prefix") {
//           const parts = item.name.split("/").filter(Boolean);

//           // Example: files/<userId>/<projectId>/
//           const projectId = parts[2];

//           if (projectId && projectId !== "discarded") {
//             projectIds.add(projectId);
//           }
//         }
//       }

//       return { jsonBody: { projects: [...projectIds] } };

//     } catch (e) {
//       ctx.error("[listProjects] error:", e?.message, e?.stack);
//       return { status: 500, jsonBody: { error: "Internal server error" } };
//     }
//   }
// });

// /api/src/functions/listProjects.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getServiceClient, DEFAULT_CONTAINER } from "../shared/storage";

app.http("listProjects", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const userId = (req.query.get("userId") || "").trim();
      if (!userId) {
        return { status: 400, jsonBody: { error: "userId is required" } };
      }

      const containerName = DEFAULT_CONTAINER || "files";
      const service = getServiceClient();
      const container = service.getContainerClient(containerName);

      ctx.log("[listProjects] using container:", containerName);

      // Primary approach: derive by scanning flat and splitting
      const prefix = `${userId}/`;
      const projectIds = new Set<string>();
      let scannedAny = false;

      for await (const blob of container.listBlobsFlat({ prefix })) {
        scannedAny = true;
        // e.g. "anonymous/DevTesting/original/A.pdf"
        const parts = blob.name.split("/").filter(Boolean);
        // ["anonymous", "DevTesting", "original", "A.pdf"]
        if (parts.length >= 2) {
          const projectId = parts[1];
          if (projectId && projectId !== "discarded") {
            projectIds.add(projectId);
          }
        }
      }

      // Diagnostics: if nothing found, try to see if content accidentally lives under "files/<userId>/"
      if (projectIds.size === 0) {
        const altPrefix = `files/${userId}/`;
        let foundAlt = false;
        for await (const blob of container.listBlobsFlat({ prefix: altPrefix })) {
          foundAlt = true;
          const parts = blob.name.split("/").filter(Boolean);
          // ["files","anonymous","DevTesting", ...]
          if (parts.length >= 3) {
            const projectId = parts[2];
            if (projectId && projectId !== "discarded") {
              projectIds.add(projectId);
            }
          }
        }
        if (foundAlt) {
          ctx.warn(
            `[listProjects] WARNING: blobs are under "files/${userId}/..." inside container "${containerName}".` +
            ` You likely have double "files" in the path. Consider migrating them to "${userId}/...".`
          );
        }
      }

      // Extra diagnostics to help you confirm paths while debugging
      if (!scannedAny && projectIds.size === 0) {
        ctx.warn(`[listProjects] No blobs under prefix "${prefix}" in container "${containerName}".`);
      }

      return { jsonBody: { projects: [...projectIds] } };
    } catch (e: any) {
      ctx.error("[listProjects] error:", e?.message, e?.stack);
      return { status: 500, jsonBody: { error: "Internal server error" } };
    }
  }
});