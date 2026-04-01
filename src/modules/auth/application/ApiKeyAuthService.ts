import { createHmac, timingSafeEqual } from "node:crypto";
import { AuthError } from "../../../shared/errors/AppError.js";
import type { ServiceApiKeyRepository } from "../domain/repositories/ServiceApiKeyRepository.js";
import type { ApiNonceStore } from "../domain/services/ApiNonceStore.js";

export interface ApiKeyAuthServiceConfig {
  keyRepository: ServiceApiKeyRepository;
  nonceStore: ApiNonceStore;
  allowedSkewSeconds: number;
  nonceTtlSeconds: number;
}

export interface ApiKeyAuthInput {
  method: string;
  path: string;
  keyId?: string;
  signature?: string;
  timestamp?: string;
  nonce?: string;
  bodyHash?: string;
}

export class ApiKeyAuthService {
  private readonly config: ApiKeyAuthServiceConfig;

  public constructor(config: ApiKeyAuthServiceConfig) {
    this.config = config;
  }

  public async verify(input: ApiKeyAuthInput): Promise<{ keyId: string }> {
    if (!input.keyId || !input.signature || !input.timestamp || !input.nonce || !input.bodyHash) {
      throw new AuthError("Missing API key auth headers");
    }

    const record = await this.config.keyRepository.findActiveByKeyId(input.keyId);
    if (!record) {
      throw new AuthError("Unknown API key id");
    }

    const ts = Number(input.timestamp);
    if (!Number.isFinite(ts)) {
      throw new AuthError("Invalid API key timestamp");
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - ts) > this.config.allowedSkewSeconds) {
      throw new AuthError("API key timestamp is out of allowed window");
    }

    const payload = `${input.method.toUpperCase()}\n${input.path}\n${input.timestamp}\n${input.nonce}\n${input.bodyHash}`;
    const expected = createHmac("sha256", record.secret).update(payload).digest("hex");

    const actualBuffer = Buffer.from(input.signature, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new AuthError("Invalid API key signature");
    }

    const consumed = await this.config.nonceStore.consumeNonce(
      input.keyId,
      input.nonce,
      this.config.nonceTtlSeconds
    );

    if (!consumed) {
      throw new AuthError("API key nonce was already used");
    }

    return { keyId: input.keyId };
  }
}
