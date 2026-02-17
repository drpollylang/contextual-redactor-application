import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function jobResultHandler(
  req: HttpRequest,
  ctx: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const jobId = req.query.get("jobId");
    if (!jobId)
      return { status: 400, body: "Missing jobId" };

    const endpoint = process.env.BACKEND_RESULT_ENDPOINT;
    // e.g. https://<container-app>.azurecontainerapps.io/job-result

    if (!endpoint)
      return { status: 500, body: "BACKEND_RESULT_ENDPOINT not set" };

    const url = `${endpoint}?jobId=${jobId}`;
    ctx.log("job-result →", url);

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
      return { status: 502, body: text };
    }

    return {
      status: 200,
      body: text,
      headers: { "Content-Type": "application/json" },
    };
  } catch (err: any) {
    ctx.error(err);
    return { status: 500, body: err?.message ?? "Unexpected error" };
  }
}

app.http("job-result", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "job-result",
  handler: jobResultHandler,
});