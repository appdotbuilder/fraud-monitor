import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type UserTransactionSummary } from '../schema';
import { eq, count, sum, max } from 'drizzle-orm';

export const getUserTransactionSummary = async (userId: string): Promise<UserTransactionSummary> => {
  try {
    // Query all transactions for the user to get comprehensive summary
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, userId))
      .execute();

    // Calculate summary statistics
    const totalTransactions = transactions.length;
    const totalAmount = transactions.reduce((sum, transaction) => sum + parseFloat(transaction.amount), 0);
    const suspiciousTransactions = transactions.filter(transaction => transaction.is_suspicious).length;
    
    // Find the most recent transaction timestamp
    const lastTransactionAt = transactions.length > 0 
      ? new Date(Math.max(...transactions.map(t => t.timestamp.getTime())))
      : null;

    return {
      user_id: userId,
      total_transactions: totalTransactions,
      total_amount: totalAmount,
      suspicious_transactions: suspiciousTransactions,
      last_transaction_at: lastTransactionAt
    };
  } catch (error) {
    console.error('Failed to get user transaction summary:', error);
    throw error;
  }
};