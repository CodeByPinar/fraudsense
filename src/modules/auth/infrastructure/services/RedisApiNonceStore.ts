import type { ApiNonceStore } from "../../domain/services/ApiNonceStore.js";

type RedisMinimal = {
  set(
    key: string,
    value: string,
    mode1: "EX",
    seconds: number,
    mode2: "NX"
  ): Promise<string | null>;
};

export class RedisApiNonceStore implements ApiNonceStore {
  public constructor(private readonly redis: RedisMinimal) {}

  public async consumeNonce(
    keyId: string,
    nonce: string,
    ttlSeconds: number
  ): Promise<boolean> {
    const key = `apikey:nonce:${keyId}:${nonce}`;
    const result = await this.redis.set(key, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  }
}
