import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type CreateTransactionInput, type Transaction } from '../schema';
import { eq, gte, count, and } from 'drizzle-orm';

// Default fraud detection configuration
const FRAUD_CONFIG = {
  high_amount_threshold: 10000,
  frequency_threshold: 5, // max transactions per minute
  time_window_minutes: 1
};

export const createTransaction = async (input: CreateTransactionInput): Promise<Transaction> => {
  try {
    const now = new Date();
    
    // Run fraud detection checks
    const fraudAnalysis = await runFraudDetection(input.user_id, input.amount, now);
    
    // Insert transaction record with fraud analysis results
    const result = await db.insert(transactionsTable)
      .values({
        transaction_id: input.transaction_id,
        user_id: input.user_id,
        amount: input.amount.toString(), // Convert number to string for numeric column
        timestamp: now,
        status: input.status,
        is_suspicious: fraudAnalysis.is_suspicious,
        fraud_reason: fraudAnalysis.fraud_reason
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const transaction = result[0];
    return {
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Transaction creation failed:', error);
    throw error;
  }
};

interface FraudAnalysis {
  is_suspicious: boolean;
  fraud_reason: string | null;
}

async function runFraudDetection(
  user_id: string, 
  amount: number, 
  timestamp: Date
): Promise<FraudAnalysis> {
  const suspiciousReasons: string[] = [];

  // Check 1: High amount threshold
  if (amount >= FRAUD_CONFIG.high_amount_threshold) {
    suspiciousReasons.push(`High amount: $${amount}`);
  }

  // Check 2: Frequency analysis - transactions in the last minute
  const timeWindowStart = new Date(timestamp.getTime() - (FRAUD_CONFIG.time_window_minutes * 60 * 1000));
  
  const recentTransactionsResult = await db.select({ count: count() })
    .from(transactionsTable)
    .where(and(
      eq(transactionsTable.user_id, user_id),
      gte(transactionsTable.timestamp, timeWindowStart)
    ))
    .execute();

  const recentTransactionCount = recentTransactionsResult[0]?.count || 0;
  
  if (recentTransactionCount >= FRAUD_CONFIG.frequency_threshold) {
    suspiciousReasons.push(`High frequency: ${recentTransactionCount} transactions in ${FRAUD_CONFIG.time_window_minutes} minute(s)`);
  }

  // Return analysis results
  return {
    is_suspicious: suspiciousReasons.length > 0,
    fraud_reason: suspiciousReasons.length > 0 ? suspiciousReasons.join('; ') : null
  };
}