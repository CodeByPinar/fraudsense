import { z } from "zod";

export const createTransactionBodySchema = z.object({
  userId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  deviceFingerprint: z.string().min(8).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  occurredAt: z.coerce.date()
});

export type CreateTransactionBody = z.infer<typeof createTransactionBodySchema>;

export const listTransactionsQuerySchema = z.object({
  userId: z.string().min(1),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
