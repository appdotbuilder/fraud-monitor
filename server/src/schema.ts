import { z } from 'zod';

// Transaction status enum
export const transactionStatusSchema = z.enum(['pending', 'completed', 'failed', 'flagged']);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

// Transaction schema
export const transactionSchema = z.object({
  id: z.number(),
  transaction_id: z.string(),
  user_id: z.string(),
  amount: z.number(),
  timestamp: z.coerce.date(),
  status: transactionStatusSchema,
  is_suspicious: z.boolean(),
  fraud_reason: z.string().nullable(),
  created_at: z.coerce.date()
});

export type Transaction = z.infer<typeof transactionSchema>;

// Input schema for creating transactions
export const createTransactionInputSchema = z.object({
  transaction_id: z.string(),
  user_id: z.string(),
  amount: z.number().positive(),
  status: transactionStatusSchema.default('pending')
});

export type CreateTransactionInput = z.infer<typeof createTransactionInputSchema>;

// Input schema for updating transaction status
export const updateTransactionStatusInputSchema = z.object({
  id: z.number(),
  status: transactionStatusSchema,
  fraud_reason: z.string().nullable().optional()
});

export type UpdateTransactionStatusInput = z.infer<typeof updateTransactionStatusInputSchema>;

// Query schema for filtering transactions
export const getTransactionsInputSchema = z.object({
  user_id: z.string().optional(),
  is_suspicious: z.boolean().optional(),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0)
});

export type GetTransactionsInput = z.infer<typeof getTransactionsInputSchema>;

// Fraud detection configuration schema
export const fraudDetectionConfigSchema = z.object({
  high_amount_threshold: z.number().positive().default(10000),
  frequency_threshold: z.number().int().positive().default(5), // max transactions per minute
  time_window_minutes: z.number().int().positive().default(1)
});

export type FraudDetectionConfig = z.infer<typeof fraudDetectionConfigSchema>;

// User transaction summary schema
export const userTransactionSummarySchema = z.object({
  user_id: z.string(),
  total_transactions: z.number().int(),
  total_amount: z.number(),
  suspicious_transactions: z.number().int(),
  last_transaction_at: z.coerce.date().nullable()
});

export type UserTransactionSummary = z.infer<typeof userTransactionSummarySchema>;