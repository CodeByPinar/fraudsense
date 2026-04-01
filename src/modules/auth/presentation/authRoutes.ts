import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ValidationError } from "../../../shared/errors/AppError.js";
import type { AuthService } from "../application/AuthService.js";

const loginBodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8)
});

const refreshBodySchema = z.object({
  refreshToken: z.string().min(1)
});

export interface AuthRouteDeps {
  authService: AuthService;
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  deps: AuthRouteDeps
): Promise<void> {
  app.post("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid login payload", { issues: parsed.error.issues });
    }

    const tokens = await deps.authService.login(parsed.data.username, parsed.data.password);
    return reply.code(200).send(tokens);
  });

  app.post("/api/v1/auth/refresh", async (request, reply) => {
    const parsed = refreshBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid refresh payload", { issues: parsed.error.issues });
    }

    const tokens = await deps.authService.refresh(parsed.data.refreshToken);
    return reply.code(200).send(tokens);
  });
}
