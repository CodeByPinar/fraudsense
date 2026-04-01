import type { ApiNonceStore } from "../../domain/services/ApiNonceStore.js";

export class InMemoryApiNonceStore implements ApiNonceStore {
  private readonly entries = new Map<string, number>();

  public async consumeNonce(
    keyId: string,
    nonce: string,
    ttlSeconds: number
  ): Promise<boolean> {
    const now = Date.now();
    const key = `${keyId}:${nonce}`;

    for (const [entryKey, expiresAt] of this.entries.entries()) {
      if (expiresAt <= now) {
        this.entries.delete(entryKey);
      }
    }

    if (this.entries.has(key)) {
      return false;
    }

    this.entries.set(key, now + ttlSeconds * 1000);
    return true;
  }
}
