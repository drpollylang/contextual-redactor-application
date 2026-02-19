// import {
//   app,
//   HttpRequest,
//   HttpResponseInit,
//   InvocationContext,
// } from "@azure/functions";

// export async function jobResultHandler(
//   req: HttpRequest,
//   ctx: InvocationContext
// ): Promise<HttpResponseInit> {
//   try {
//     const jobId = req.query.get("jobId");
//     if (!jobId)
//       return { status: 400, body: "Missing jobId" };

//     const endpoint = process.env.JOB_RESULT_URL;
//     // e.g. https://<container-app>.azurecontainerapps.io/job-result

//     if (!endpoint)
//       return { status: 500, body: "JOB_RESULT_URL not set" };

//     const url = `${endpoint}?jobId=${jobId}`;
//     ctx.log("job-result →", url);

//     const res = await fetch(url);
//     const text = await res.text();

//     if (!res.ok) {
//       return { status: 502, body: text };
//     }

//     return {
//       status: 200,
//       body: text,
//       headers: { "Content-Type": "application/json" },
//     };
//   } catch (err: any) {
//     ctx.error(err);
//     return { status: 500, body: err?.message ?? "Unexpected error" };
//   }
// }

// app.http("job-result", {
//   methods: ["GET"],
//   authLevel: "anonymous",
//   route: "job-result",
//   handler: jobResultHandler,
// });

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
    if (!jobId) {
      return {
        status: 400,
        body: JSON.stringify({ error: "Missing jobId" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const endpoint = process.env.JOB_RESULT_URL;
    if (!endpoint) {
      return {
        status: 500,
        body: JSON.stringify({ error: "JOB_RESULT_URL not set" }),
        headers: { "Content-Type": "application/json" },
      };
    }

    const url = `${endpoint}?jobId=${encodeURIComponent(jobId)}`;
    ctx.log("job-result →", url);

    const res = await fetch(url);
    const text = await res.text();

    if (!res.ok) {
      return {
        status: 502,
        body: JSON.stringify({
          error: "Backend returned non-OK status",
          status: res.status,
          detail: text,
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    // Validate JSON
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      return {
        status: 502,
        body: JSON.stringify({
          error: "Backend returned invalid JSON",
          detail: text,
        }),
        headers: { "Content-Type": "application/json" },
      };
    }

    return {
      status: 200,
      body: JSON.stringify(json),
      headers: { "Content-Type": "application/json" },
    };
  } catch (err: any) {
    ctx.error(err);
    return {
      status: 500,
      body: JSON.stringify({ error: err?.message ?? "Unexpected error" }),
      headers: { "Content-Type": "application/json" },
    };
  }
}

app.http("job-result", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "job-result",
  handler: jobResultHandler,
});