import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";

export async function debugHandler(
  req: HttpRequest,
  ctx: InvocationContext,
): Promise<HttpResponseInit> {
  return {
    status: 200,
    jsonBody: {
      status: "ok",
      now: new Date().toISOString(),
      requestUrl: req.url,
      requestMethod: req.method,
      query: Object.fromEntries(req.query),
      env: {
        BACKEND_API_URL: process.env.BACKEND_API_URL ?? "(not set)",
        NODE_ENV: process.env.NODE_ENV ?? "(not set)",
        region: process.env.REGION ?? "(not set)",
      },
    },
  };
}

app.http("debug", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "debug",
  handler: debugHandler,
});