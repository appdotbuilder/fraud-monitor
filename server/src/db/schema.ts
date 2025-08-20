import { serial, text, pgTable, timestamp, numeric, boolean, pgEnum } from 'drizzle-orm/pg-core';

// Transaction status enum
export const transactionStatusEnum = pgEnum('transaction_status', ['pending', 'completed', 'failed', 'flagged']);

// Transactions table
export const transactionsTable = pgTable('transactions', {
  id: serial('id').primaryKey(),
  transaction_id: text('transaction_id').notNull().unique(),
  user_id: text('user_id').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  timestamp: timestamp('timestamp').notNull(),
  status: transactionStatusEnum('status').notNull().default('pending'),
  is_suspicious: boolean('is_suspicious').notNull().default(false),
  fraud_reason: text('fraud_reason'), // Nullable by default
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// TypeScript types for the table schema
export type Transaction = typeof transactionsTable.$inferSelect;
export type NewTransaction = typeof transactionsTable.$inferInsert;

// Important: Export all tables for proper query building
export const tables = { 
  transactions: transactionsTable 
};