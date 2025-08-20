import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type GetTransactionsInput, type Transaction } from '../schema';
import { eq, and, desc, type SQL } from 'drizzle-orm';

export const getTransactions = async (input: GetTransactionsInput = { limit: 100, offset: 0 }): Promise<Transaction[]> => {
  try {
    const { user_id, is_suspicious, limit, offset } = input;

    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (user_id !== undefined) {
      conditions.push(eq(transactionsTable.user_id, user_id));
    }

    if (is_suspicious !== undefined) {
      conditions.push(eq(transactionsTable.is_suspicious, is_suspicious));
    }

    // Build complete query in one chain to avoid type issues
    const baseQuery = db.select().from(transactionsTable);
    
    const results = conditions.length > 0
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(transactionsTable.timestamp))
          .limit(limit)
          .offset(offset)
          .execute()
      : await baseQuery
          .orderBy(desc(transactionsTable.timestamp))
          .limit(limit)
          .offset(offset)
          .execute();

    // Convert numeric fields back to numbers
    return results.map(transaction => ({
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert numeric string to number
    }));
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    throw error;
  }
};