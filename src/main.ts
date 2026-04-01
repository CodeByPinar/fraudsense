import "reflect-metadata";
import { buildApp } from "./app.js";
import { loadEnv } from "./shared/config/env.js";
import { logger } from "./shared/logger.js";

const env = loadEnv();
const app = buildApp({
  repositoryMode: env.NODE_ENV === "test" ? "memory" : env.REPOSITORY_MODE,
  nodeEnv: env.NODE_ENV,
  redisUrl: env.REDIS_URL,
  serviceApiKeysJson: env.SERVICE_API_KEYS_JSON,
  jwtPrivateKey: env.JWT_PRIVATE_KEY,
  jwtPublicKey: env.JWT_PUBLIC_KEY,
  jwtIssuer: env.JWT_ISSUER,
  jwtAudience: env.JWT_AUDIENCE,
  accessTokenTtlSec: env.ACCESS_TOKEN_TTL_SEC,
  refreshTokenTtlSec: env.REFRESH_TOKEN_TTL_SEC,
  githubFeedbackToken: env.GITHUB_FEEDBACK_TOKEN,
  githubFeedbackRepoOwner: env.GITHUB_FEEDBACK_REPO_OWNER,
  githubFeedbackRepoName: env.GITHUB_FEEDBACK_REPO_NAME,
  githubFeedbackLabels: env.GITHUB_FEEDBACK_LABELS
});

async function bootstrap(): Promise<void> {
  await app.listen({ host: "0.0.0.0", port: env.PORT });

  const readyResponse = await app.inject({
    method: "GET",
    url: "/health/ready"
  });

  if (readyResponse.statusCode !== 200) {
    logger.warn({ body: readyResponse.body }, "Service started but dependencies are not ready");
  } else {
    logger.info({ body: readyResponse.body }, "Service dependencies are ready");
  }
}

bootstrap().catch((error: unknown) => {
  logger.error({ error }, "Application failed to start");
  process.exit(1);
});
