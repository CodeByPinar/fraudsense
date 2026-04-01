import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { InfraError, ValidationError } from "../../../shared/errors/AppError.js";
import type { GitHubFeedbackService } from "../application/GitHubFeedbackService.js";

const feedbackSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  category: z.enum(["bug", "improvement", "question", "security"]),
  message: z.string().trim().min(10).max(2000),
  pageUrl: z.string().trim().url().max(500).optional(),
  website: z.string().trim().max(200).optional()
});

export interface FeedbackRouteDeps {
  feedbackService: GitHubFeedbackService;
}

export async function registerFeedbackRoutes(
  app: FastifyInstance,
  deps: FeedbackRouteDeps
): Promise<void> {
  app.post(
    "/api/v1/feedback",
    {
      config: {
        rateLimit: {
          max: 8,
          timeWindow: "10 minutes"
        }
      }
    },
    async (request, reply) => {
      const parsed = feedbackSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid feedback payload", {
          issues: parsed.error.issues
        });
      }

      if (parsed.data.website && parsed.data.website.length > 0) {
        return reply.code(202).send({
          status: "accepted",
          message: "Mesajınız alındı. Teşekkür ederiz."
        });
      }

      if (!deps.feedbackService.isConfigured()) {
        throw new InfraError("Feedback service is temporarily unavailable");
      }

      const submitted = await deps.feedbackService.submit({
        name: parsed.data.name,
        email: parsed.data.email,
        category: parsed.data.category,
        message: parsed.data.message,
        pageUrl: parsed.data.pageUrl,
        requestId: request.id,
        userAgent: typeof request.headers["user-agent"] === "string" ? request.headers["user-agent"] : undefined,
        ip: request.ip
      });

      return reply.code(201).send({
        status: "received",
        message: "Geri bildiriminiz başarıyla iletildi.",
        issueUrl: submitted.issueUrl,
        issueNumber: submitted.issueNumber
      });
    }
  );
}
