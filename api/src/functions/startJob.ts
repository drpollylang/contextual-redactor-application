import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function startJobHandler(
  req: HttpRequest,
  ctx: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const backend = process.env.BACKEND_START_ENDPOINT; 
    // e.g. https://<container-app>.azurecontainerapps.io/start-redaction

    if (!backend) {
      return {
        status: 500,
        body: JSON.stringify({ error: "BACKEND_START_ENDPOINT not configured" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const body = await req.json();
    ctx.log("start-job payload =", body);

    const res = await fetch(backend, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      ctx.log("backend error:", text);
      return { status: 502, body: JSON.stringify({ error: text })  };
    }

    return {
      status: 202,
      body: JSON.stringify(text),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err: any) {
    ctx.error("start-job error:", err);
    return { status: 500, body: JSON.stringify({ error: err?.message ?? "Unexpected error" })};
  }
}

app.http("start-job", {
  methods: ["POST"],
  authLevel: "anonymous",
  route: "start-job",
  handler: startJobHandler,
});