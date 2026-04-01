import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ApiKeyAuthService } from "../../auth/application/ApiKeyAuthService.js";
import type { AuthService } from "../../auth/application/AuthService.js";
import { AuthError, ValidationError } from "../../../shared/errors/AppError.js";
import { CreateTransactionUseCase } from "../application/CreateTransactionUseCase.js";
import {
  createTransactionBodySchema,
  listTransactionsQuerySchema
} from "../application/validation/createTransactionSchema.js";
import type { FraudRuleRepository } from "../../fraud/domain/repositories/FraudRuleRepository.js";
import { FraudDecisionService } from "../../fraud/application/FraudDecisionService.js";
import type { TransactionRepository } from "../domain/repositories/TransactionRepository.js";

const idempotencyHeaderSchema = z.string().min(8);

export interface TransactionRouteDeps {
  txRepository: TransactionRepository;
  ruleRepository: FraudRuleRepository;
  decisionService: FraudDecisionService;
  authService: AuthService;
  apiKeyAuthService: ApiKeyAuthService;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  const content = entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",");
  return `{${content}}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function registerTransactionRoutes(
  app: FastifyInstance,
  deps: TransactionRouteDeps
): Promise<void> {
  const createTransaction = new CreateTransactionUseCase(
    deps.txRepository,
    deps.ruleRepository,
    deps.decisionService
  );

  app.post("/api/v1/transactions", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      await deps.authService.authorize(authHeader, ["RISK_OFFICER", "ADMIN"]);
    } else {
      const bodyHash = sha256Hex(stableJson(request.body ?? {}));
      const headerBodyHash =
        typeof request.headers["x-api-key-body-sha256"] === "string"
          ? request.headers["x-api-key-body-sha256"]
          : undefined;

      if (!headerBodyHash || headerBodyHash !== bodyHash) {
        throw new AuthError("Invalid API key body hash");
      }

      await deps.apiKeyAuthService.verify({
        method: request.method,
        path: request.url.split("?")[0] ?? request.url,
        keyId:
          typeof request.headers["x-api-key-id"] === "string"
            ? request.headers["x-api-key-id"]
            : undefined,
        signature:
          typeof request.headers["x-api-key-signature"] === "string"
            ? request.headers["x-api-key-signature"]
            : undefined,
        timestamp:
          typeof request.headers["x-api-key-timestamp"] === "string"
            ? request.headers["x-api-key-timestamp"]
            : undefined,
        nonce:
          typeof request.headers["x-api-key-nonce"] === "string"
            ? request.headers["x-api-key-nonce"]
            : undefined,
        bodyHash: headerBodyHash
      });
    }

    const idempotencyKey = idempotencyHeaderSchema.safeParse(
      request.headers["idempotency-key"]
    );

    if (!idempotencyKey.success) {
      throw new ValidationError("idempotency-key header is required and must be valid");
    }

    const parsedBody = createTransactionBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw new ValidationError("Invalid transaction payload", {
        issues: parsedBody.error.issues
      });
    }

    const result = await createTransaction.execute({
      idempotencyKey: idempotencyKey.data,
      ...parsedBody.data
    });

    return reply.code(result.wasCreated ? 201 : 200).send(result.transaction);
  });

  app.get("/api/v1/transactions", async (request) => {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      await deps.authService.authorize(authHeader, ["ANALYST", "RISK_OFFICER", "ADMIN"]);
    } else if (typeof request.headers["x-api-key-id"] === "string") {
      const headerBodyHash =
        typeof request.headers["x-api-key-body-sha256"] === "string"
          ? request.headers["x-api-key-body-sha256"]
          : undefined;

      if (!headerBodyHash || headerBodyHash !== sha256Hex("")) {
        throw new AuthError("Invalid API key body hash");
      }

      await deps.apiKeyAuthService.verify({
        method: request.method,
        path: request.url.split("?")[0] ?? request.url,
        keyId: request.headers["x-api-key-id"],
        signature:
          typeof request.headers["x-api-key-signature"] === "string"
            ? request.headers["x-api-key-signature"]
            : undefined,
        timestamp:
          typeof request.headers["x-api-key-timestamp"] === "string"
            ? request.headers["x-api-key-timestamp"]
            : undefined,
        nonce:
          typeof request.headers["x-api-key-nonce"] === "string"
            ? request.headers["x-api-key-nonce"]
            : undefined,
        bodyHash: headerBodyHash
      });
    } else {
      await deps.authService.authorize(request.headers.authorization, [
        "ANALYST",
        "RISK_OFFICER",
        "ADMIN"
      ]);
    }

    const queryResult = listTransactionsQuerySchema.safeParse(request.query);
    if (!queryResult.success) {
      throw new ValidationError("Invalid cursor pagination query", {
        issues: queryResult.error.issues
      });
    }

    return deps.txRepository.findByUserCursor(
      queryResult.data.userId,
      queryResult.data.cursor ?? null,
      queryResult.data.limit
    );
  });
}
