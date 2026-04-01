import Fastify from "fastify";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAuthRoutes } from "./modules/auth/presentation/authRoutes.js";
import { registerFeedbackRoutes } from "./modules/feedback/presentation/feedbackRoutes.js";
import { GitHubFeedbackService } from "./modules/feedback/application/GitHubFeedbackService.js";
import { buildDeps } from "./shared/di/buildDeps.js";
import { logger } from "./shared/logger.js";
import { sendProblem, toProblemDetails } from "./shared/http/problemDetails.js";
import { registerTransactionRoutes } from "./modules/transactions/presentation/transactionRoutes.js";

export interface BuildAppOptions {
  repositoryMode?: "memory" | "prisma";
  nodeEnv?: string;
  redisUrl?: string;
  serviceApiKeysJson?: string;
  jwtPrivateKey?: string;
  jwtPublicKey?: string;
  jwtIssuer?: string;
  jwtAudience?: string;
  accessTokenTtlSec?: number;
  refreshTokenTtlSec?: number;
  githubFeedbackToken?: string;
  githubFeedbackRepoOwner?: string;
  githubFeedbackRepoName?: string;
  githubFeedbackLabels?: string;
}

export function buildApp(options?: BuildAppOptions) {
  const app = Fastify({ logger });
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(currentDir, "..");
  const inferredNodeEnv =
    options?.nodeEnv ??
    process.env.NODE_ENV ??
    (process.env.JEST_WORKER_ID ? "test" : "development");

  const deps = buildDeps({
    repositoryMode: options?.repositoryMode ?? "memory",
    nodeEnv: inferredNodeEnv,
    redisUrl: options?.redisUrl,
    serviceApiKeysJson: options?.serviceApiKeysJson,
    jwtPrivateKey: options?.jwtPrivateKey,
    jwtPublicKey: options?.jwtPublicKey,
    jwtIssuer: options?.jwtIssuer ?? "fraudsense",
    jwtAudience: options?.jwtAudience ?? "fraudsense-api",
    accessTokenTtlSec: options?.accessTokenTtlSec ?? 900,
    refreshTokenTtlSec: options?.refreshTokenTtlSec ?? 604800
  });

  const feedbackService = new GitHubFeedbackService({
    token: options?.githubFeedbackToken,
    owner: options?.githubFeedbackRepoOwner,
    repo: options?.githubFeedbackRepoName,
    labels: options?.githubFeedbackLabels
  });

  app.addHook("onRequest", async (request, reply) => {
    const externalRequestId = request.headers["x-request-id"];
    const requestId =
      typeof externalRequestId === "string" && externalRequestId.length > 0
        ? externalRequestId
        : randomUUID();

    request.headers["x-request-id"] = requestId;
    reply.header("x-request-id", requestId);
  });

  app.register(helmet);
  app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute"
  });

  app.register(fastifyStatic, {
    root: join(projectRoot, "assets", "ui"),
    prefix: "/ui/"
  });

  app.register(fastifyStatic, {
    root: join(projectRoot, "assets"),
    prefix: "/assets/",
    decorateReply: false
  });

  app.get("/", async (_request, reply) => {
    return reply.type("text/html").sendFile("index.html");
  });

  app.get("/health/live", async () => {
    return { status: "ok" };
  });

  app.get("/health/ready", async (_request, reply) => {
    const readiness = await deps.checkReadiness();
    const isReady = readiness.database && readiness.redis;
    return reply.code(isReady ? 200 : 503).send({
      status: isReady ? "ready" : "not_ready",
      checks: readiness
    });
  });

  app.addHook("onClose", async () => {
    await deps.shutdown();
  });

  app.register(async (scoped) => {
    await registerAuthRoutes(scoped, { authService: deps.authService });
    await registerFeedbackRoutes(scoped, { feedbackService });
    await registerTransactionRoutes(scoped, {
      txRepository: deps.transactionRepository,
      ruleRepository: deps.fraudRuleRepository,
      decisionService: deps.fraudDecisionService,
      authService: deps.authService,
      apiKeyAuthService: deps.apiKeyAuthService
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const problem = toProblemDetails(error, request);
    request.log.error({ err: error, requestId: request.id }, "Unhandled request error");
    return sendProblem(reply, problem);
  });

  return app;
}
