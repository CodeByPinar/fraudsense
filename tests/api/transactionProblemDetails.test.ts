import { buildApp } from "../../src/app.js";

describe("Transaction Problem Details", () => {
  it("should return RFC7807 response when idempotency-key header is missing", async () => {
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
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/transactions",
      headers: {
        authorization: `Bearer ${accessToken}`
      },
      payload: {
        userId: "user-1",
        amount: 50,
        currency: "USD",
        occurredAt: new Date().toISOString()
      }
    });

    // Assert
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");

    const body = response.json();
    expect(body.title).toBe("VALIDATION_ERROR");
    expect(body.requestId).toBeDefined();

    await app.close();
  });
});
