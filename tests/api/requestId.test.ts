import { buildApp } from "../../src/app.js";

describe("Request ID Hook", () => {
  it("should generate x-request-id when client does not provide one", async () => {
    // Arrange
    const app = buildApp();

    // Act
    const response = await app.inject({
      method: "GET",
      url: "/health/live"
    });

    // Assert
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBeDefined();

    await app.close();
  });
});
