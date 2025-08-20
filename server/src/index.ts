import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createTransactionInputSchema,
  updateTransactionStatusInputSchema,
  getTransactionsInputSchema,
  fraudDetectionConfigSchema
} from './schema';

// Import handlers
import { createTransaction } from './handlers/create_transaction';
import { getTransactions } from './handlers/get_transactions';
import { getSuspiciousTransactions } from './handlers/get_suspicious_transactions';
import { updateTransactionStatus } from './handlers/update_transaction_status';
import { getUserTransactionSummary } from './handlers/get_user_transaction_summary';
import { runFraudDetection } from './handlers/run_fraud_detection';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Create a new transaction with fraud detection
  createTransaction: publicProcedure
    .input(createTransactionInputSchema)
    .mutation(({ input }) => createTransaction(input)),

  // Get transactions with optional filtering
  getTransactions: publicProcedure
    .input(getTransactionsInputSchema.optional())
    .query(({ input }) => getTransactions(input)),

  // Get all suspicious transactions for monitoring
  getSuspiciousTransactions: publicProcedure
    .query(() => getSuspiciousTransactions()),

  // Update transaction status (for manual review)
  updateTransactionStatus: publicProcedure
    .input(updateTransactionStatusInputSchema)
    .mutation(({ input }) => updateTransactionStatus(input)),

  // Get transaction summary for a specific user
  getUserTransactionSummary: publicProcedure
    .input(z.string())
    .query(({ input }) => getUserTransactionSummary(input)),

  // Run fraud detection analysis on demand
  runFraudDetection: publicProcedure
    .input(z.object({
      user_id: z.string(),
      amount: z.number().positive(),
      config: fraudDetectionConfigSchema.optional()
    }))
    .query(({ input }) => runFraudDetection(input.user_id, input.amount, input.config)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Fraud Monitoring TRPC server listening at port: ${port}`);
}

start();