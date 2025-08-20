import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type Transaction } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getSuspiciousTransactions = async (): Promise<Transaction[]> => {
  try {
    // Query transactions table filtering by is_suspicious = true
    // Order by timestamp descending (most recent suspicious first)
    const results = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.is_suspicious, true))
      .orderBy(desc(transactionsTable.timestamp))
      .execute();

    // Convert numeric fields back to numbers before returning
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert string back to number
    }));
  } catch (error) {
    console.error('Failed to fetch suspicious transactions:', error);
    throw error;
  }
};