import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type UpdateTransactionStatusInput, type Transaction } from '../schema';
import { eq } from 'drizzle-orm';

export const updateTransactionStatus = async (input: UpdateTransactionStatusInput): Promise<Transaction> => {
  try {
    // Prepare update values
    const updateValues: any = {
      status: input.status,
      is_suspicious: input.status === 'flagged'
    };

    // Add fraud_reason if provided (can be null to clear it)
    if (input.fraud_reason !== undefined) {
      updateValues.fraud_reason = input.fraud_reason;
    }

    // Update transaction record
    const result = await db.update(transactionsTable)
      .set(updateValues)
      .where(eq(transactionsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Transaction with id ${input.id} not found`);
    }

    // Convert numeric fields back to numbers before returning
    const transaction = result[0];
    return {
      ...transaction,
      amount: parseFloat(transaction.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Transaction status update failed:', error);
    throw error;
  }
};