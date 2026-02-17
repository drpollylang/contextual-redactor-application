import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

export async function healthHandler(_req: HttpRequest, _ctx: InvocationContext): Promise<HttpResponseInit> {
  return { status: 200, jsonBody: { status: "ok", backend: process.env.BACKEND_API_URL ?? "(not set)" } };
}

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthHandler,
});