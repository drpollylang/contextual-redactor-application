// api/src/functions/startRedaction.ts

// import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

/**
 * POST /api/start-redaction
 * Body: { blobName: string, rules?: string[], userInstructions?: string }
 * Proxies the request to the Python Function App.
 */
// export async function startRedactionHandler(
//   request: HttpRequest,
//   context: InvocationContext
// ): Promise<HttpResponseInit> {
//   try {
//     type StartRedactionBody = {
//       blobName?: string;
//       rules?: string[] | null;
//       userInstructions?: string | null;
//     };

//     // Parse incoming JSON from the front-end
//     const body = (await request.json()) as StartRedactionBody;

//     // Basic validation
//     const blobName = typeof body?.blobName === "string" ? body.blobName : undefined;
//     if (!blobName) {
//       return { status: 400, body: "Missing or invalid 'blobName'." };
//     }

//     // Normalize optional fields
//     const rules =
//       Array.isArray(body?.rules) ? body!.rules.filter((x) => typeof x === "string") : [];
//     const userInstructions =
//       typeof body?.userInstructions === "string" ? body!.userInstructions : "";

//     context.log(
//       `[SWA start-redaction] Forwarding payload -> blobName="${blobName}", rules_len=${rules.length}, user_instr_len=${userInstructions.length}`
//     );

//     const funcUrl = process.env.PYTHON_FUNC_URL; // e.g. https://<func>.azurewebsites.net/api/start_redaction
//     // const funcUrl = process.env.BACKEND_API_URL;
//     const funcKey = process.env.PYTHON_FUNC_KEY; // function-level key for start_redaction

//     if (!funcUrl || !funcKey) {
//       context.error("Missing PYTHON_FUNC_URL or PYTHON_FUNC_KEY in environment.");
//       return { status: 500, body: "Server not configured. Contact the administrator." };
//     }

//     // Build the payload we’ll send to the Python function
//     const payload = {
//       blobName,
//       rules,
//       userInstructions,
//     };

//     // --- Option A: Send key as header (recommended; avoids URL encoding pitfalls) ---
//     const resp = await fetch(funcUrl, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "x-functions-key": funcKey, // preferred over ?code=
//       },
//       body: JSON.stringify(payload),
//     });

//     // --- Option B: If you must use query string (works but can be brittle) ---
//     // const resp = await fetch(`${funcUrl}?code=${encodeURIComponent(funcKey)}`, {
//     //   method: "POST",
//     //   headers: { "Content-Type": "application/json" },
//     //   body: JSON.stringify(payload),
//     // });

//     if (!resp.ok) {
//       const text = await resp.text();
//       context.error(`Python Function error (${resp.status}): ${text}`);
//       return { status: 502, body: text };
//     }

//     const data = await resp.json();
//     return {
//       status: 200,
//       jsonBody: data, // Durable status payload
//     };
//   } catch (err: any) {
//     context.error(err);
//     return { status: 500, body: err?.message ?? "Unexpected error" };
//   }
// }

// /** Register the HTTP trigger (v4 model) */
// app.http("start-redaction", {
//   methods: ["POST"],
//   authLevel: "anonymous",
//   route: "start-redaction", // → /api/start-redaction
//   handler: startRedactionHandler,
// });

// api/src/functions/startRedaction.ts
// import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

// type StartRedactionBody = {
//   blobName?: string;
//   rules?: string[] | null;
//   userInstructions?: string | null;
// };

// function asStringArray(maybe: unknown): string[] {
//   if (!Array.isArray(maybe)) return [];
//   return maybe.filter((x) => typeof x === "string") as string[];
// }

// /**
//  * POST /api/start-redaction
//  * Body: { blobName: string, rules?: string[], userInstructions?: string }
//  * Proxies the request to the Container App FastAPI endpoint.
//  */
// export async function startRedactionHandler(
//   request: HttpRequest,
//   context: InvocationContext
// ): Promise<HttpResponseInit> {
//   try {
//     const apiUrl = process.env.BACKEND_API_URL; // e.g. https://<containerapp>.azurecontainerapps.io/start-redaction
//     console.log(`[SWA start-redaction] Received request. BACKEND_API_URL=${apiUrl ? "(set)" : "(not set)"}`);
//     if (!apiUrl) {
//       context.error("Missing BACKEND_API_URL environment variable.");
//       return { status: 500, body: "Server not configured (BACKEND_API_URL not set)." };
//     }

//     const body = (await request.json()) as StartRedactionBody;

//     // Validate required
//     const blobName = typeof body?.blobName === "string" ? body.blobName : undefined;
//     if (!blobName) {
//       return { status: 400, body: "Missing or invalid 'blobName'." };
//     }

//     // Normalize optional
//     const rules = asStringArray(body?.rules);
//     const userInstructions = typeof body?.userInstructions === "string" ? body.userInstructions : "";

//     const payload = { blobName, rules, userInstructions };

//     context.log(
//       `[SWA start-redaction] → Container App: ${apiUrl} | payload: blobName="${blobName}", rules_len=${rules.length}, user_instr_len=${userInstructions.length}`
//     );

//     // Optional: basic timeout safeguard (Node fetch defaults are unlimited)
//     const ctrl = new AbortController();
//     const to = setTimeout(() => ctrl.abort(), 1000 * 60 * 15); // 15 mins max (tune to your needs)

//     const resp = await fetch(apiUrl, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload),
//       signal: ctrl.signal,
//     }).catch((e) => {
//       context.error(`[SWA → ContainerApp] network error: ${e?.message || e}`);
//       throw e;
//     });
//     clearTimeout(to);

//     const text = await resp.text();
//     if (!resp.ok) {
//       // surface container error body for easier debugging
//       context.error(`[SWA → ContainerApp] ${resp.status}: ${text}`);
//       return { status: 502, body: text };
//     }

//     // Pass-through JSON to client
//     return { status: 200, body: text, headers: { "Content-Type": "application/json" } };
//   } catch (err: any) {
//     context.error(err);
//     return { status: 500, body: err?.message ?? "Unexpected error" };
//   }
// }

// app.http("start-redaction", {
//   methods: ["POST"],
//   authLevel: "anonymous",
//   route: "start-redaction",
//   handler: startRedactionHandler,
// });

// api/src/functions/startRedaction.ts
// import {
//   app,
//   HttpRequest,
//   HttpResponseInit,
//   InvocationContext,
// } from "@azure/functions";

// interface StartRedactionBody {
//   blobName?: string;
//   rules?: string[] | null;
//   userInstructions?: string | null;
// }

// function asStringArray(maybe: unknown): string[] {
//   if (!Array.isArray(maybe)) return [];
//   return maybe.filter((x) => typeof x === "string") as string[];
// }

// const START_JOB_URL = process.env.START_JOB_URL;     // → points to your /api/start-job
// const JOB_STATUS_URL = process.env.JOB_STATUS_URL;   // → points to your /api/job-status
// const JOB_RESULT_URL = process.env.JOB_RESULT_URL;   // → points to your /api/job-result
// const POLL_INTERVAL_MS = 2000;                       // poll every 2 sec
// const TIMEOUT_MS = 1000 * 60 * 15;                   // 15 min timeout

// export async function startRedactionHandler(
//   request: HttpRequest,
//   context: InvocationContext
// ): Promise<HttpResponseInit> {
//   try {
//     // if (!START_JOB_URL || !JOB_STATUS_URL || !JOB_RESULT_URL) {
//     if (!START_JOB_URL || !JOB_STATUS_URL) {
//       return {
//         status: 500,
//         body: "Server not configured (missing START_JOB_URL / JOB_STATUS_URL)",
//       };
//     }

//     // -----------------------------
//     // 1. Validate + parse input
//     // -----------------------------
//     const body = (await request.json()) as StartRedactionBody;

//     const blobName = typeof body?.blobName === "string" ? body.blobName : undefined;
//     if (!blobName) {
//       return { status: 400, body: "Missing or invalid 'blobName'." };
//     }

//     const rules = asStringArray(body?.rules);
//     const userInstructions =
//       typeof body?.userInstructions === "string" ? body.userInstructions : "";

//     const payload = { blobName, rules, userInstructions };

//     context.log("➡️ /start-redaction starting job with payload:", payload);

//     // -----------------------------
//     // 2. Call start-job
//     // -----------------------------
//     const startResp = await fetch(START_JOB_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload),
//     });

//     if (!startResp.ok) {
//       const err = await startResp.text();
//       context.error("Start-job failed:", err);
//       return { status: 502, body: err };
//     }

//     const { jobId } = await startResp.json();

//     context.log(`🟢 Job started successfully: jobId=${jobId}`);

//     // -----------------------------
//     // 3. Poll job-status until complete
//     // -----------------------------
//     const startTime = Date.now();

//     while (true) {
//       if (Date.now() - startTime > TIMEOUT_MS) {
//         return {
//           status: 504,
//           body: `Job ${jobId} timed out after ${TIMEOUT_MS / 1000} seconds`,
//         };
//       }

//       const statusResp = await fetch(`${JOB_STATUS_URL}?jobId=${jobId}`);
//       const statusJson = await statusResp.json();

//       if (statusJson.status === "complete") {
//         break;
//       }

//       context.log(`⏳ Job ${jobId} still running...`);
//       await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
//     }

//     context.log(`🟢 Job ${jobId} completed. Fetching results...`);

//     // -----------------------------
//     // 4. Fetch job result
//     // -----------------------------
//     const resultResp = await fetch(`${JOB_RESULT_URL}?jobId=${jobId}`);
//     const resultJson = await resultResp.json();

//     return {
//       status: 200,
//       jsonBody: resultJson,
//     };
//   } catch (err: any) {
//     context.error("❌ start-redaction error:", err);
//     return { status: 500, body: err?.message ?? "Unexpected error" };
//   }
// }

// app.http("start-redaction", {
//   methods: ["POST"],
//   authLevel: "anonymous",
//   route: "start-redaction",
//   handler: startRedactionHandler,
// });


// v3 - aligned with Container App interface/polling contract
import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

interface StartRedactionBody {
  blobName?: string;
  rules?: string[] | null;
  userInstructions?: string | null;
}

function asStringArray(maybe: unknown): string[] {
  if (!Array.isArray(maybe)) return [];
  return maybe.filter((x) => typeof x === "string") as string[];
}

const START_JOB_URL = process.env.START_JOB_URL;     // POST /start-redaction
const JOB_STATUS_URL = process.env.JOB_STATUS_URL;   // GET /job-status?jobId=
const JOB_RESULT_URL = process.env.JOB_RESULT_URL;   // GET /job-result?jobId=
const POLL_INTERVAL_MS = 2000;                       
const TIMEOUT_MS = 1000 * 60 * 15;                   

// export async function startRedactionHandler(
//   request: HttpRequest,
//   context: InvocationContext
// ): Promise<HttpResponseInit> {
//   try {
//     if (!START_JOB_URL || !JOB_STATUS_URL || !JOB_RESULT_URL) {
//       return {
//         status: 500,
//         body: "SWA server not configured. Missing START_JOB_URL, JOB_STATUS_URL, or JOB_RESULT_URL.",
//       };
//     }

//     // --- Parse & Validate Input ---
//     const body = (await request.json()) as StartRedactionBody;

//     const blobName = typeof body?.blobName === "string" ? body.blobName : undefined;
//     if (!blobName) {
//       return { status: 400, body: "Missing or invalid 'blobName'." };
//     }

//     const rules = asStringArray(body?.rules);
//     const userInstructions = typeof body?.userInstructions === "string" ? body.userInstructions : "";

//     const payload = { blobName, rules, userInstructions };

//     context.log("➡️ SWA /start-redaction: calling backend:", payload);

//     // --- Step 1: Call backend to start the job ---
//     const startResp = await fetch(START_JOB_URL, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload),
//     });

//     if (!startResp.ok) {
//       const text = await startResp.text();
//       return { status: 502, body: text };
//     }

//     const { jobId } = await startResp.json();
//     context.log(`🟢 Job started: ${jobId}`);

//     // --- Step 2: Poll backend job-status ---
//     const startTime = Date.now();

//     while (true) {
//       if (Date.now() - startTime > TIMEOUT_MS) {
//         return {
//           status: 504,
//           body: `Job ${jobId} timed out after ${TIMEOUT_MS / 1000}s`,
//         };
//       }

//       const statusResp = await fetch(`${JOB_STATUS_URL}?jobId=${jobId}`);
//       const statusJson = await statusResp.json();

//       if (statusJson.status === "complete") break;

//       context.log(`⏳ Job ${jobId} still running...`);
//       await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
//     }

//     context.log(`🟢 Job ${jobId} complete. Fetching result...`);

//     // --- Step 3: Fetch final redaction JSON ---
//     const resultResp = await fetch(`${JOB_RESULT_URL}?jobId=${jobId}`);
//     if (!resultResp.ok) {
//       return { status: 502, body: await resultResp.text() };
//     }

//     const resultJson = await resultResp.json();

//     // return {
//     //   status: 200,
//     //   jsonBody: resultJson,
//     // };
//     return {
//       status: 200,
//       body: JSON.stringify(resultJson),
//       headers: { "Content-Type": "application/json" }
//     };
//   } catch (err: any) {
//     context.error("start-redaction error:", err);
//     return { status: 500, body: err?.message ?? "Unexpected error" };
//   }
// }

export async function startRedactionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    // --- Config guard ---
    if (!START_JOB_URL || !JOB_STATUS_URL || !JOB_RESULT_URL) {
      const msg =
        "SWA server not configured. Missing START_JOB_URL, JOB_STATUS_URL, or JOB_RESULT_URL.";
      context.error(msg);
      return {
        status: 500,
        body: JSON.stringify({ error: msg }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // --- Parse & validate input ---
    let bodyJson: StartRedactionBody | undefined;
    try {
      bodyJson = (await request.json()) as StartRedactionBody;
    } catch {
      // Body may be empty or invalid JSON
      bodyJson = undefined;
    }

    const blobName =
      typeof bodyJson?.blobName === "string" && bodyJson.blobName.trim().length > 0
        ? bodyJson.blobName
        : undefined;
    if (!blobName) {
      const msg = "Missing or invalid 'blobName'.";
      context.warn(msg);
      return {
        status: 400,
        body: JSON.stringify({ error: msg }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const rules = asStringArray(bodyJson?.rules);
    const userInstructions =
      typeof bodyJson?.userInstructions === "string" ? bodyJson.userInstructions : "";

    const payload = { blobName, rules, userInstructions };
    context.log("➡️ SWA /start-redaction: calling backend with payload:", payload);

    // --- Step 1: Start job in container app ---
    const startResp = await fetch(START_JOB_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const startText = await startResp.text(); // read once
    if (!startResp.ok) {
      const detail = startText || "(no response body)";
      const msg = `Backend start-redaction failed: ${startResp.status} ${startResp.statusText} — ${detail}`;
      context.error(msg);
      return {
        status: 502,
        body: JSON.stringify({ error: msg }),
        headers: { "Content-Type": "application/json" },
      };
    }

    let jobId: string | undefined;
    try {
      const json = startText ? JSON.parse(startText) : {};
      jobId = json?.jobId;
    } catch (e) {
      const msg = `Failed to parse backend start-redaction JSON: ${(e as Error).message}`;
      context.error(msg, startText);
      return {
        status: 502,
        body: JSON.stringify({ error: msg }),
        headers: { "Content-Type": "application/json" },
      };
    }

    if (!jobId || typeof jobId !== "string") {
      const msg = `Backend did not return a valid jobId. Payload: ${startText}`;
      context.error(msg);
      return {
        status: 502,
        body: JSON.stringify({ error: msg }),
        headers: { "Content-Type": "application/json" },
      };
    }

    context.log(`🟢 Job started: ${jobId}`);

    // --- Step 2: Poll job-status until complete or timeout ---
    const startTime = Date.now();
    while (true) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        const msg = `Job ${jobId} timed out after ${Math.round(TIMEOUT_MS / 1000)}s`;
        context.warn(msg);
        return {
          status: 504,
          body: JSON.stringify({ error: msg }),
          headers: { "Content-Type": "application/json" },
        };
      }

      let statusResp: Response;
      try {
        statusResp = await fetch(`${JOB_STATUS_URL}?jobId=${encodeURIComponent(jobId)}`);
      } catch (e) {
        const msg = `Error calling job-status: ${(e as Error).message}`;
        context.warn(msg);
        await delay(POLL_INTERVAL_MS);
        continue;
      }

      let statusJson: any = null;
      try {
        const t = await statusResp.text();
        statusJson = t ? JSON.parse(t) : {};
      } catch {
        statusJson = null;
      }

      // Non-OK status: keep polling (job API might be momentarily unavailable)
      if (!statusResp.ok) {
        context.warn(
          `job-status returned ${statusResp.status} ${statusResp.statusText} — continuing to poll...`
        );
        await delay(POLL_INTERVAL_MS);
        continue;
      }

      if (statusJson && statusJson.status === "complete") {
        break;
      }

      context.log(`⏳ Job ${jobId} still running...`);
      await delay(POLL_INTERVAL_MS);
    }

    context.log(`🟢 Job ${jobId} complete. Fetching result...`);

    // --- Step 3: Fetch final redaction JSON ---
    let resultResp: Response;
    try {
      resultResp = await fetch(`${JOB_RESULT_URL}?jobId=${encodeURIComponent(jobId)}`);
    } catch (e) {
      const msg = `Error calling job-result: ${(e as Error).message}`;
      context.error(msg);
      return {
        status: 502,
        body: JSON.stringify({ error: msg }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const resultText = await resultResp.text();
    if (!resultResp.ok) {
      const msg = `job-result failed: ${resultResp.status} ${resultResp.statusText} — ${
        resultText || "(no body)"
      }`;
      context.error(msg);
      return {
        status: 502,
        body: JSON.stringify({ error: msg }),
        headers: { "Content-Type": "application/json" },
      };
    }

    let resultJson: any;
    try {
      resultJson = resultText ? JSON.parse(resultText) : {};
    } catch (e) {
      const msg = `Failed to parse job-result JSON: ${(e as Error).message}`;
      context.error(msg, resultText);
      return {
        status: 502,
        body: JSON.stringify({ error: msg }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Success
    return {
      status: 200,
      body: JSON.stringify(resultJson),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err: any) {
    // Last-chance error handler
    const message =
      (err && (err.message || err.toString?.())) || "Unexpected error";
    context.error("start-redaction unhandled error:", message, err);
    return {
      status: 500,
      body: JSON.stringify({ error: message }),
      headers: { "Content-Type": "application/json" },
    };
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


app.http("start-redaction", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "start-redaction",
  handler: startRedactionHandler,
});