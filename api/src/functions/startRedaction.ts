// api/src/functions/startRedaction.ts

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

/**
 * POST /api/start-redaction
 * Body: { blobName: string }
 * Returns: The JSON returned by the Python Function App (e.g., Durable status URLs)
 */
export async function startRedactionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    type StartRedactionBody = { blobName?: string };

    const body = (await request.json()) as StartRedactionBody;
    const blobName = body?.blobName;

    if (!blobName || typeof blobName !== "string") {
    return { status: 400, body: "Missing or invalid 'blobName'." };
    }

    const funcUrl = process.env.PY_FUNC_URL; // e.g. https://<func>.azurewebsites.net/api/start_redaction
    const funcKey = process.env.PY_FUNC_KEY; // function-level key for start_redaction

    if (!funcUrl || !funcKey) {
      context.error("Missing PY_FUNC_URL or PY_FUNC_KEY in environment.");
      return { status: 500, body: "Server not configured. Contact the administrator." };
    }

    const resp = await fetch(`${funcUrl}?code=${encodeURIComponent(funcKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobName })
    });

    if (!resp.ok) {
      const text = await resp.text();
      context.error(`Python Function error (${resp.status}): ${text}`);
      return { status: 502, body: text };
    }

    const data = await resp.json();

    return {
      status: 200,
      jsonBody: data
    };
  } catch (err: any) {
    context.error(err);
    return { status: 500, body: err?.message ?? "Unexpected error" };
  }
}

/** Register the HTTP trigger (v4 model) */
app.http("start-redaction", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "start-redaction", // → /api/start-redaction
  handler: startRedactionHandler
});