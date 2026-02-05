// api/src/functions/startRedaction.ts

import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

/**
 * POST /api/start-redaction
 * Body: { blobName: string, rules?: string[], userInstructions?: string }
 * Proxies the request to the Python Function App.
 */
export async function startRedactionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    type StartRedactionBody = {
      blobName?: string;
      rules?: string[] | null;
      userInstructions?: string | null;
    };

    // Parse incoming JSON from the front-end
    const body = (await request.json()) as StartRedactionBody;

    // Basic validation
    const blobName = typeof body?.blobName === "string" ? body.blobName : undefined;
    if (!blobName) {
      return { status: 400, body: "Missing or invalid 'blobName'." };
    }

    // Normalize optional fields
    const rules =
      Array.isArray(body?.rules) ? body!.rules.filter((x) => typeof x === "string") : [];
    const userInstructions =
      typeof body?.userInstructions === "string" ? body!.userInstructions : "";

    context.log(
      `[SWA start-redaction] Forwarding payload -> blobName="${blobName}", rules_len=${rules.length}, user_instr_len=${userInstructions.length}`
    );

    const funcUrl = process.env.PYTHON_FUNC_URL; // e.g. https://<func>.azurewebsites.net/api/start_redaction
    const funcKey = process.env.PYTHON_FUNC_KEY; // function-level key for start_redaction

    if (!funcUrl || !funcKey) {
      context.error("Missing PYTHON_FUNC_URL or PYTHON_FUNC_KEY in environment.");
      return { status: 500, body: "Server not configured. Contact the administrator." };
    }

    // Build the payload we’ll send to the Python function
    const payload = {
      blobName,
      rules,
      userInstructions,
    };

    // --- Option A: Send key as header (recommended; avoids URL encoding pitfalls) ---
    const resp = await fetch(funcUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-functions-key": funcKey, // preferred over ?code=
      },
      body: JSON.stringify(payload),
    });

    // --- Option B: If you must use query string (works but can be brittle) ---
    // const resp = await fetch(`${funcUrl}?code=${encodeURIComponent(funcKey)}`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(payload),
    // });

    if (!resp.ok) {
      const text = await resp.text();
      context.error(`Python Function error (${resp.status}): ${text}`);
      return { status: 502, body: text };
    }

    const data = await resp.json();
    return {
      status: 200,
      jsonBody: data, // Durable status payload
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
  handler: startRedactionHandler,
});
