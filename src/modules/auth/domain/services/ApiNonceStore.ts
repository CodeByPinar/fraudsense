export interface ApiNonceStore {
  consumeNonce(keyId: string, nonce: string, ttlSeconds: number): Promise<boolean>;
}
