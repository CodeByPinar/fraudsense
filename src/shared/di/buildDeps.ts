import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";
import { AuthService } from "../../modules/auth/application/AuthService.js";
import { ApiKeyAuthService } from "../../modules/auth/application/ApiKeyAuthService.js";
import { JwtService } from "../../modules/auth/application/JwtService.js";
import { InMemoryServiceApiKeyRepository } from "../../modules/auth/infrastructure/repositories/InMemoryServiceApiKeyRepository.js";
import { InMemoryAuthUserRepository } from "../../modules/auth/infrastructure/repositories/InMemoryAuthUserRepository.js";
import { InMemoryRefreshTokenRepository } from "../../modules/auth/infrastructure/repositories/InMemoryRefreshTokenRepository.js";
import { PrismaServiceApiKeyRepository } from "../../modules/auth/infrastructure/repositories/PrismaServiceApiKeyRepository.js";
import { PrismaRefreshTokenRepository } from "../../modules/auth/infrastructure/repositories/PrismaRefreshTokenRepository.js";
import { InMemoryApiNonceStore } from "../../modules/auth/infrastructure/services/InMemoryApiNonceStore.js";
import { RedisApiNonceStore } from "../../modules/auth/infrastructure/services/RedisApiNonceStore.js";
import { FraudDecisionService } from "../../modules/fraud/application/FraudDecisionService.js";
import type { FraudRuleRepository } from "../../modules/fraud/domain/repositories/FraudRuleRepository.js";
import { PrismaFraudRuleRepository } from "../../modules/fraud/infrastructure/repositories/PrismaFraudRuleRepository.js";
import { InMemoryFraudRuleRepository } from "../../modules/fraud/infrastructure/repositories/InMemoryFraudRuleRepository.js";
import type { TransactionRepository } from "../../modules/transactions/domain/repositories/TransactionRepository.js";
import { InMemoryTransactionRepository } from "../../modules/transactions/infrastructure/repositories/InMemoryTransactionRepository.js";
import { PrismaTransactionRepository } from "../../modules/transactions/infrastructure/repositories/PrismaTransactionRepository.js";
import { logger } from "../logger.js";
import type { ServiceApiKeyRepository } from "../../modules/auth/domain/repositories/ServiceApiKeyRepository.js";
import type { ApiNonceStore } from "../../modules/auth/domain/services/ApiNonceStore.js";

export interface ReadinessStatus {
  database: boolean;
  redis: boolean;
}

type RedisClient = {
  status: string;
  connect(): Promise<unknown>;
  ping(): Promise<string>;
  set(
    key: string,
    value: string,
    mode1: "EX",
    seconds: number,
    mode2: "NX"
  ): Promise<string | null>;
  quit(): Promise<unknown>;
  disconnect(): void;
};

export interface AppDeps {
  transactionRepository: TransactionRepository;
  fraudRuleRepository: FraudRuleRepository;
  fraudDecisionService: FraudDecisionService;
  authService: AuthService;
  apiKeyAuthService: ApiKeyAuthService;
  checkReadiness(): Promise<ReadinessStatus>;
  shutdown(): Promise<void>;
}

export interface BuildDepsOptions {
  repositoryMode: "memory" | "prisma";
  nodeEnv: string;
  jwtPrivateKey?: string;
  jwtPublicKey?: string;
  jwtIssuer: string;
  jwtAudience: string;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  redisUrl?: string;
  serviceApiKeysJson?: string;
}

/**
 * Builds dependency graph with environment-specific repositories.
 */
export function buildDeps(options: BuildDepsOptions): AppDeps {
    const apiKeyMap = parseApiKeys(options.serviceApiKeysJson, options.nodeEnv);

  const decisionService = new FraudDecisionService();
  let prisma: PrismaClient | null = null;
  let redis: RedisClient | null = null;

  let transactionRepository: TransactionRepository;
  let fraudRuleRepository: FraudRuleRepository;
  let serviceApiKeyRepository: ServiceApiKeyRepository;
  let nonceStore: ApiNonceStore;
  let refreshTokenRepository:
    | InMemoryRefreshTokenRepository
    | PrismaRefreshTokenRepository;

  if (options.repositoryMode === "prisma") {
    prisma = new PrismaClient();
    logger.info("Using Prisma repositories for transaction and fraud modules");

    transactionRepository = new PrismaTransactionRepository(prisma);
    fraudRuleRepository = new PrismaFraudRuleRepository(prisma);
    serviceApiKeyRepository = new PrismaServiceApiKeyRepository(prisma);
    refreshTokenRepository = new PrismaRefreshTokenRepository(prisma);
  } else {
    logger.info("Using in-memory repositories for transaction and fraud modules");

    transactionRepository = new InMemoryTransactionRepository();
    fraudRuleRepository = new InMemoryFraudRuleRepository();
    serviceApiKeyRepository = new InMemoryServiceApiKeyRepository(apiKeyMap);
    refreshTokenRepository = new InMemoryRefreshTokenRepository();
  }

  if (options.redisUrl) {
    const RedisCtor = Redis as unknown as {
      new (url: string, options: Record<string, unknown>): RedisClient;
    };
    redis = new RedisCtor(options.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
    nonceStore = new RedisApiNonceStore(redis);
  } else {
    nonceStore = new InMemoryApiNonceStore();
  }

  if (options.repositoryMode === "prisma") {
    serviceApiKeyRepository = new PrismaServiceApiKeyRepository(prisma as PrismaClient);
  }

  const jwtService = new JwtService({
    privateKeyPem: options.jwtPrivateKey,
    publicKeyPem: options.jwtPublicKey,
    issuer: options.jwtIssuer,
    audience: options.jwtAudience,
    accessTokenTtlSec: options.accessTokenTtlSec,
    refreshTokenTtlSec: options.refreshTokenTtlSec,
    isTestMode: options.nodeEnv === "test",
    allowNonProductionFallbackKeys: options.nodeEnv !== "production"
  });

  const authService = new AuthService(
    new InMemoryAuthUserRepository(),
    refreshTokenRepository,
    jwtService
  );

  const apiKeyAuthService = new ApiKeyAuthService({
    keyRepository: serviceApiKeyRepository,
    nonceStore,
    allowedSkewSeconds: 300,
    nonceTtlSeconds: 300
  });

  async function checkReadiness(): Promise<ReadinessStatus> {
    if (options.nodeEnv === "test") {
      return {
        database: true,
        redis: true
      };
    }

    let database = true;
    let redisReady = true;

    if (prisma) {
      try {
        await prisma.$queryRawUnsafe("SELECT 1");
      } catch (_error: unknown) {
        database = false;
      }
    }

    if (redis) {
      try {
        if (redis.status === "wait") {
          await redis.connect();
        }
        const pong = await redis.ping();
        redisReady = pong === "PONG";
      } catch (_error: unknown) {
        redisReady = false;
      }
    }

    return {
      database,
      redis: redisReady
    };
  }

  async function shutdown(): Promise<void> {
    if (redis) {
      await redis.quit().catch(async () => {
        redis?.disconnect();
      });
    }

    if (prisma) {
      await prisma.$disconnect();
    }
  }

  return {
    transactionRepository,
    fraudRuleRepository,
    fraudDecisionService: decisionService,
    authService,
    apiKeyAuthService,
    checkReadiness,
    shutdown
  };
}

function parseApiKeys(raw: string | undefined, nodeEnv: string): Record<string, string> {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const entries = Object.entries(parsed).filter(
        ([key, value]) => typeof key === "string" && key.length > 0 && typeof value === "string" && value.length > 0
      );

      const keyMap: Record<string, string> = {};
      for (const [key, value] of entries) {
        keyMap[key] = value as string;
      }

      return keyMap;
    } catch (_error: unknown) {
      logger.warn("SERVICE_API_KEYS_JSON could not be parsed, fallback will be used");
    }
  }

  if (nodeEnv !== "production") {
    return {
      "svc-default": "svc-default-secret"
    };
  }

  return {};
}
