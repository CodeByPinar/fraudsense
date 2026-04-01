import { buildApp } from "../../src/app.js";

describe("Auth RBAC and Refresh Rotation", () => {
  it("should rotate refresh token and reject reused old refresh token", async () => {
    // Arrange
    const app = buildApp();

    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "admin",
        password: "Admin#12345"
      }
    });

    const firstTokens = login.json();

    // Act
    const refreshed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: {
        refreshToken: firstTokens.refreshToken
      }
    });

    const reused = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      payload: {
        refreshToken: firstTokens.refreshToken
      }
    });

    // Assert
    expect(login.statusCode).toBe(200);
    expect(refreshed.statusCode).toBe(200);
    expect(reused.statusCode).toBe(401);

    await app.close();
  });

  it("should deny ANALYST role for POST /api/v1/transactions", async () => {
    // Arrange
    const app = buildApp();
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        username: "analyst",
        password: "Analyst#12345"
      }
    });

    const accessToken = login.json().accessToken as string;

    // Act
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "idempotency-key": "rbac-key-0001"
      },
      payload: {
        userId: "user-rbac",
        amount: 90,
        currency: "USD",
        occurredAt: new Date().toISOString()
      }
    });

    // Assert
    expect(response.statusCode).toBe(403);

    await app.close();
  });
});
