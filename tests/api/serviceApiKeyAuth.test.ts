import { createHash, createHmac } from "node:crypto";
import { buildApp } from "../../src/app.js";

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

function sign(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  bodyHash: string,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(`${method}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`)
    .digest("hex");
}

describe("Service API Key HMAC Auth", () => {
  it("should allow POST /api/v1/transactions with valid HMAC API key headers", async () => {
    // Arrange
    const app = buildApp({
      serviceApiKeysJson: JSON.stringify({ "svc-default": "svc-default-secret" })
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = "/api/v1/transactions";
    const nonce = `nonce-${Date.now()}`;
    const payload = {
      userId: "svc-user-1",
      amount: 50,
      currency: "USD",
      occurredAt: new Date().toISOString()
    };
    const bodyHash = sha256Hex(stableJson(payload));
    const signature = sign("POST", path, timestamp, nonce, bodyHash, "svc-default-secret");

    // Act
    const response = await app.inject({
      method: "POST",
      url: path,
      headers: {
        "x-api-key-id": "svc-default",
        "x-api-key-timestamp": timestamp,
        "x-api-key-nonce": nonce,
        "x-api-key-body-sha256": bodyHash,
        "x-api-key-signature": signature,
        "idempotency-key": `svc-key-${Date.now()}`
      },
      payload
    });

    // Assert
    expect(response.statusCode).toBe(201);

    await app.close();
  });

  it("should reject POST /api/v1/transactions with invalid HMAC API key signature", async () => {
    // Arrange
    const app = buildApp({
      serviceApiKeysJson: JSON.stringify({ "svc-default": "svc-default-secret" })
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = `nonce-${Date.now()}`;
    const payload = {
      userId: "svc-user-2",
      amount: 55,
      currency: "USD",
      occurredAt: new Date().toISOString()
    };
    const bodyHash = sha256Hex(stableJson(payload));

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        "x-api-key-id": "svc-default",
        "x-api-key-timestamp": timestamp,
        "x-api-key-nonce": nonce,
        "x-api-key-body-sha256": bodyHash,
        "x-api-key-signature": "invalid-signature",
        "idempotency-key": `svc-key-${Date.now()}`
      },
      payload
    });

    // Assert
    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("should reject replayed nonce for POST /api/v1/transactions", async () => {
    // Arrange
    const app = buildApp({
      serviceApiKeysJson: JSON.stringify({ "svc-default": "svc-default-secret" })
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = `nonce-${Date.now()}`;
    const payload = {
      userId: "svc-user-3",
      amount: 75,
      currency: "USD",
      occurredAt: new Date().toISOString()
    };
    const bodyHash = sha256Hex(stableJson(payload));
    const signature = sign("POST", "/api/v1/transactions", timestamp, nonce, bodyHash, "svc-default-secret");

    // Act
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        "x-api-key-id": "svc-default",
        "x-api-key-timestamp": timestamp,
        "x-api-key-nonce": nonce,
        "x-api-key-body-sha256": bodyHash,
        "x-api-key-signature": signature,
        "idempotency-key": `svc-key-first-${Date.now()}`
      },
      payload
    });

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        "x-api-key-id": "svc-default",
        "x-api-key-timestamp": timestamp,
        "x-api-key-nonce": nonce,
        "x-api-key-body-sha256": bodyHash,
        "x-api-key-signature": signature,
        "idempotency-key": `svc-key-second-${Date.now()}`
      },
      payload
    });

    // Assert
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(401);

    await app.close();
  });

  it("should allow GET /api/v1/transactions with valid HMAC API key headers", async () => {
    // Arrange
    const app = buildApp({
      serviceApiKeysJson: JSON.stringify({ "svc-default": "svc-default-secret" })
    });

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = `nonce-get-${Date.now()}`;
    const bodyHash = sha256Hex("");
    const signature = sign(
      "GET",
      "/api/v1/transactions",
      timestamp,
      nonce,
      bodyHash,
      "svc-default-secret"
    );

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?userId=svc-user-1&limit=5",
      headers: {
        "x-api-key-id": "svc-default",
        "x-api-key-timestamp": timestamp,
        "x-api-key-nonce": nonce,
        "x-api-key-body-sha256": bodyHash,
        "x-api-key-signature": signature
      }
    });

    // Assert
    expect(response.statusCode).toBe(200);

    await app.close();
  });
});
