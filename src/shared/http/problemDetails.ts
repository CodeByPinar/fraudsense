import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../errors/AppError.js";

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  requestId: string;
}

/**
 * Converts internal errors into RFC 7807 compatible problem details.
 */
export function toProblemDetails(
  error: unknown,
  request: FastifyRequest
): ProblemDetails {
  if (error instanceof AppError) {
    return {
      type: `https://fraudsense.dev/problems/${error.code.toLowerCase()}`,
      title: error.code,
      status: error.statusCode,
      detail: error.message,
      instance: request.url,
      requestId: request.id
    };
  }

  return {
    type: "https://fraudsense.dev/problems/internal-server-error",
    title: "INTERNAL_SERVER_ERROR",
    status: 500,
    detail: "Unexpected error occurred",
    instance: request.url,
    requestId: request.id
  };
}

export function sendProblem(
  reply: FastifyReply,
  problem: ProblemDetails
): FastifyReply {
  return reply
    .code(problem.status)
    .header("content-type", "application/problem+json")
    .send(problem);
}
