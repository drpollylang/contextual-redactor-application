/* Lists documents within the userId and projectId directories associated with the 
  current user/project. Used to restore previous app state/docs/redactions upon 
  session restart. */
// import { BlobServiceClient } from "@azure/storage-blob";
// import { DefaultAzureCredential } from "@azure/identity";
// import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// const STORAGE_URL = process.env.STORAGE_URL!; // e.g., https://<account>.blob.core.windows.net
// const CONTAINER = "files";

// type UserDoc = {
//   projectId: string;
//   fileName: string;
//   originalPath?: string;    // <userId>/<projectId>/original/<filename>.pdf
//   workingPath?: string;     // <userId>/<projectId>/working/<filename>.pdf
//   highlightsPath?: string;  // <userId>/<projectId>/working/<filename>.highlights.json
// };


// function getAccountNameFromUrl(accountUrl: string): string {
//   const host = new URL(accountUrl).host; // "<account>.blob.core.windows.net"
//   const account = host.split(".")[0];
//   if (!account) throw new Error("Could not parse storage account name from STORAGE_URL");
//   return account;
// }

// // Helper: safely read userId from query string or JSON body (with type annotation)
// async function readUserId(req: HttpRequest): Promise<string | null> {
//   // Prefer query (?userId=...) — works for GET and POST
//   const fromQuery = req.query.get("userId");
//   if (fromQuery && fromQuery.trim()) return fromQuery.trim();

//   // Only try to read body for methods that typically carry one
//   const method = (req.method || "GET").toUpperCase();
//   if (method === "POST" || method === "PUT" || method === "PATCH") {
//     // Optional: check content-type is JSON to avoid exceptions
//     const ct = (req.headers.get("content-type") || "").toLowerCase();
//     if (!ct.includes("application/json")) return null;

//     try {
//       // Resolve the Promise<unknown> and then narrow/annotate
//       const body = (await req.json()) as { userId?: string } | null;
//       const uid = body?.userId?.trim();
//       return uid || null;
//     } catch {
//       return null; // invalid/missing JSON body
//     }
//   }

//   return null;
// }


// export async function listUserDocuments(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  
//   try {
//     const userId = await readUserId(req);
//     if (!userId) {
//       return { status: 400, jsonBody: { error: "userId is required (query ?userId=... or JSON body {userId})" } };
//     }

//     const credential = new DefaultAzureCredential();
//     const service = new BlobServiceClient(STORAGE_URL, credential);
//     const container = service.getContainerClient(CONTAINER);

//     const prefix = `${userId}/`; // list projects under userId
//     const docs: UserDoc[] = [];

    
//     // Iterate the hierarchy under <userId>/
//     for await (const item of container.listBlobsByHierarchy("/", { prefix })) {
//       if (item.kind === "prefix") {
//         const projectPrefix = item.name; // e.g., "user123/<projectId>/"
//         const parts = projectPrefix.split("/").filter(Boolean);
//         const projectId = parts[1]; // ["user123", "<projectId>"]

//         let originalPath: string | undefined;
//         let workingPath: string | undefined;
//         let highlightsPath: string | undefined;
//         let fileName: string | undefined;

//         // Find original PDF
//         for await (const blob of container.listBlobsFlat({ prefix: `${projectPrefix}original/` })) {
//           if (blob.name.toLowerCase().endsWith(".pdf")) {
//             originalPath = blob.name;
//             fileName = blob.name.split("/").pop();
//             break; // only one original expected
//           }
//         }

//         // Find working PDF and highlights JSON
//         for await (const blob of container.listBlobsFlat({ prefix: `${projectPrefix}working/` })) {
//           const lower = blob.name.toLowerCase();
//           if (lower.endsWith(".highlights.json")) {
//             highlightsPath = blob.name;
//           } else if (lower.endsWith(".pdf")) {
//             workingPath = blob.name;
//             if (!fileName) fileName = blob.name.split("/").pop();
//           }
//         }

//         docs.push({
//           projectId,
//           fileName: fileName ?? "document.pdf",
//           originalPath,
//           workingPath,
//           highlightsPath,
//         });
//       }
//     }

//     return { jsonBody: { documents: docs } };
//   } catch (err: any) {
//     ctx.error(err?.message ?? err);
//     return { status: 500, jsonBody: { error: "Internal server error" } };
//   }
// }


// app.http("listUserDocuments", {
//   methods: ["GET", "POST"],          // allow both; GET with ?userId=..., POST with {userId}
//   authLevel: "anonymous",            // lock down later via SWA/Functions auth
//   handler: listUserDocuments
// });

// /api/src/functions/listUserDocuments.ts
// import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
// import { getServiceClient, normalizePath, DEFAULT_CONTAINER } from "../shared/storage";

// type UserDoc = {
//   projectId: string;
//   fileName: string;
//   originalPath?: string;    // userId/<projectId>/original/<file>.pdf
//   workingPath?: string;     // userId/<projectId>/working/<file>.pdf
//   highlightsPath?: string;  // userId/<projectId>/working/<file>.pdf.highlights.json
// };

// /** Read userId from query or JSON body (POST/PUT/PATCH) safely. */
// async function readUserId(req: HttpRequest): Promise<string | null> {
//   // Prefer query (?userId=...)
//   const q = req.query.get("userId");
//   if (q && q.trim()) return q.trim();

//   // Only parse JSON for methods that typically carry a body
//   const method = (req.method || "GET").toUpperCase();
//   if (!["POST", "PUT", "PATCH"].includes(method)) return null;

//   const ct = (req.headers.get("content-type") || "").toLowerCase();
//   if (!ct.includes("application/json")) return null;

//   try {
//     // Resolve Promise<unknown>, then narrow to the shape we need
//     const body = (await req.json()) as { userId?: string } | null;
//     const uid = (body?.userId ?? "").trim();
//     return uid || null;
//   } catch {
//     return null;
//   }
// }

// export async function listUserDocuments(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
//   try {
//     const userId = await readUserId(req);
//     if (!userId) {
//       return { status: 400, jsonBody: { error: "userId is required (?userId=... or JSON {userId})" } };
//     }

//     const service = getServiceClient();
//     const containerName = DEFAULT_CONTAINER || "files";
//     const container = service.getContainerClient(containerName);

//     const prefix = normalizePath(`${userId}/`);
//     const docs: UserDoc[] = [];

//     // Iterate project "folders" under userId/
//     for await (const item of container.listBlobsByHierarchy("/", { prefix })) {
//       if (item.kind !== "prefix") continue;

//       const projectPrefix = item.name;                     // e.g. "user123/<projectId>/"
//       const parts = projectPrefix.split("/").filter(Boolean);
//       const projectId = parts[1];                          // ["user123","<projectId>"]

//       let originalPath: string | undefined;
//       let workingPath: string | undefined;
//       let highlightsPath: string | undefined;
//       let fileName: string | undefined;

//       // Find original PDF (take first match)
//       for await (const blob of container.listBlobsFlat({ prefix: projectPrefix + "original/" })) {
//         if (blob.name.toLowerCase().endsWith(".pdf")) {
//           originalPath = blob.name;
//           fileName = blob.name.split("/").pop();
//           break;
//         }
//       }

//       // Find working PDF + highlights JSON
//       for await (const blob of container.listBlobsFlat({ prefix: projectPrefix + "working/" })) {
//         const lower = blob.name.toLowerCase();
//         if (lower.endsWith(".highlights.json")) {
//           highlightsPath = blob.name;
//         } else if (lower.endsWith(".pdf")) {
//           workingPath = blob.name;
//           if (!fileName) fileName = blob.name.split("/").pop();
//         }
//       }

//       docs.push({
//         projectId,
//         fileName: fileName ?? "document.pdf",
//         originalPath,
//         workingPath,
//         highlightsPath
//       });
//     }

//     return { jsonBody: { documents: docs } };
//   } catch (err: any) {
//     ctx.error("[listUserDocuments] error:", err?.message, err?.stack);
//     return { status: 500, jsonBody: { error: "Internal server error" } };
//   }
// }

// app.http("listUserDocuments", {
//   methods: ["GET", "POST"],
//   authLevel: "anonymous",
//   handler: listUserDocuments
// });

// /api/src/functions/listUserDocuments.ts
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getServiceClient, normalizePath, DEFAULT_CONTAINER } from "../shared/storage";

type UserDoc = {
  projectId: string;
  fileName: string;
  originalPath?: string;    // userId/<projectId>/original/<file>.pdf
  workingPath?: string;     // userId/<projectId>/working/<file>.pdf
  highlightsPath?: string;  // userId/<projectId>/working/<file>.pdf.highlights.json
};

/** Read userId from query or JSON body (POST/PUT/PATCH) safely. */
async function readUserId(req: HttpRequest): Promise<string | null> {
  const q = req.query.get("userId");
  if (q && q.trim()) return q.trim();

  const method = (req.method || "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH"].includes(method)) return null;

  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (!ct.includes("application/json")) return null;

  try {
    const body = (await req.json()) as { userId?: string } | null;
    const uid = (body?.userId ?? "").trim();
    return uid || null;
  } catch {
    return null;
  }
}

/** Safe file name extraction (handles spaces and simple encoding). */
function fileNameFromPath(path: string): string {
  const leaf = path.split("/").filter(Boolean).pop() || "";
  try {
    return decodeURIComponent(leaf);
  } catch {
    return leaf;
  }
}

/** Given "foo.pdf.highlights.json" -> "foo.pdf" */
function fileNameFromHighlights(path: string): string {
  const leaf = fileNameFromPath(path);
  return leaf.replace(/\.highlights\.json$/i, "");
}

export async function listUserDocuments(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  try {
    const userId = await readUserId(req);
    if (!userId) {
      return { status: 400, jsonBody: { error: "userId is required (?userId=... or JSON {userId})" } };
    }

    // Optional: allow filtering to a single project via query (?projectId=DevTesting)
    const filterProjectId = (req.query.get("projectId") || "").trim() || null;

    const service = getServiceClient();
    const containerName = DEFAULT_CONTAINER || "files";
    const container = service.getContainerClient(containerName);

    // user prefix: e.g. "anonymous/"
    const userPrefix = normalizePath(`${userId}/`);

    const docs: UserDoc[] = [];

    // Iterate project "folders" under userId/
    for await (const item of container.listBlobsByHierarchy("/", { prefix: userPrefix })) {
      if (item.kind !== "prefix") continue; // skip blobs; only care about sub-prefixes (projects)

      const projectPrefix = item.name; // e.g. "anonymous/DevTesting/"
      const parts = projectPrefix.split("/").filter(Boolean);
      const projectId = parts[1];      // ["anonymous","DevTesting"]

      // If request filters to a specific project, skip others.
      if (filterProjectId && projectId !== filterProjectId) continue;

      // ✅ Build a map keyed by fileName so we return ONE entry per file
      const perFile = new Map<string, UserDoc>();

      // ---- Scan ORIGINAL PDFs (list all; do NOT break after first) ----
      for await (const blob of container.listBlobsFlat({ prefix: projectPrefix + "original/" })) {
        const lower = blob.name.toLowerCase();
        if (!lower.endsWith(".pdf")) continue;

        const fileName = fileNameFromPath(blob.name);
        const entry = perFile.get(fileName) ?? { projectId, fileName };
        entry.originalPath = blob.name; // keep raw blob path; frontend provides container separately
        perFile.set(fileName, entry);
      }

      // ---- Scan WORKING PDFs + HIGHLIGHTS (pair by file name) ----
      for await (const blob of container.listBlobsFlat({ prefix: projectPrefix + "working/" })) {
        const lower = blob.name.toLowerCase();

        if (lower.endsWith(".highlights.json")) {
          // highlights are named "<file>.pdf.highlights.json" -> base file = "<file>.pdf"
          const basePdfName = fileNameFromHighlights(blob.name);
          if (!basePdfName) continue;

          const entry = perFile.get(basePdfName) ?? { projectId, fileName: basePdfName };
          entry.highlightsPath = blob.name;
          perFile.set(basePdfName, entry);
        } else if (lower.endsWith(".pdf")) {
          const fileName = fileNameFromPath(blob.name);
          const entry = perFile.get(fileName) ?? { projectId, fileName };
          entry.workingPath = blob.name;
          perFile.set(fileName, entry);
        }
      }

      // Push all files found for this project
      // (you may sort for stable ordering)
      const sorted = Array.from(perFile.values()).sort((a, b) => a.fileName.localeCompare(b.fileName));
      docs.push(...sorted);
    }

    return { jsonBody: { documents: docs } };
  } catch (err: any) {
    ctx.error("[listUserDocuments] error:", err?.message, err?.stack);
    return { status: 500, jsonBody: { error: "Internal server error" } };
  }
}

app.http("listUserDocuments", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: listUserDocuments
});