import { buildApp } from "../../src/app.js";

describe("Transaction Cursor Pagination", () => {
  it("should return paged transactions when query is valid", async () => {
    // Arrange
    const app = buildApp();
    const userId = "user-cursor";
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "risk",
        password: "Risk#12345"
      }
    });
    const accessToken = loginResponse.json().accessToken as string;

    for (let i = 0; i < 3; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/v1/transactions",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "idempotency-key": `cursor-key-${i}-0000`
        },
        payload: {
          userId,
          amount: 100 + i,
          currency: "USD",
          occurredAt: new Date().toISOString()
        }
      });
    }

    // Act
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/transactions?userId=${userId}&limit=2`,
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    // Assert
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(2);
    expect(body.nextCursor).toBeTruthy();

    await app.close();
  });

  it("should return problem details when query is invalid", async () => {
    // Arrange
    const app = buildApp();
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "analyst",
        password: "Analyst#12345"
      }
    });
    const accessToken = loginResponse.json().accessToken as string;

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/transactions?userId=&limit=1000",
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    // Assert
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");

    await app.close();
  });

  it("should return 200 when same idempotency-key and same payload are replayed", async () => {
    // Arrange
    const app = buildApp();
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "risk",
        password: "Risk#12345"
      }
    });
    const accessToken = loginResponse.json().accessToken as string;

    const payload = {
      userId: "user-replay",
      amount: 190,
      currency: "USD",
      occurredAt: new Date().toISOString()
    };

    // Act
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "idempotency-key": "replay-key-0001"
      },
      payload
    });

    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "idempotency-key": "replay-key-0001"
      },
      payload
    });

    // Assert
    expect(first.statusCode).toBe(201);
    expect(replay.statusCode).toBe(200);
    expect(replay.json().id).toBe(first.json().id);

    await app.close();
  });

  it("should return 409 when same idempotency-key is reused with different payload", async () => {
    // Arrange
    const app = buildApp();
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "risk",
        password: "Risk#12345"
      }
    });
    const accessToken = loginResponse.json().accessToken as string;

    // Act
    await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "idempotency-key": "conflict-key-0001"
      },
      payload: {
        userId: "user-conflict",
        amount: 100,
        currency: "USD",
        occurredAt: new Date().toISOString()
      }
    });

    const conflict = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "idempotency-key": "conflict-key-0001"
      },
      payload: {
        userId: "user-conflict",
        amount: 999,
        currency: "USD",
        occurredAt: new Date().toISOString()
      }
    });

    // Assert
    expect(conflict.statusCode).toBe(409);
    expect(conflict.headers["content-type"]).toContain("application/problem+json");

    await app.close();
  });
});
