import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

/**
 * Ensures each incoming request carries a correlation request ID.
 */
export function registerRequestIdHook(app: {
  addHook: FastifyInstance["addHook"];
}): void {
  app.addHook("onRequest", async (request, reply) => {
    const externalRequestId = request.headers["x-request-id"];
    const requestId =
      typeof externalRequestId === "string" && externalRequestId.length > 0
        ? externalRequestId
        : randomUUID();

    request.headers["x-request-id"] = requestId;
    reply.header("x-request-id", requestId);
  });
}
