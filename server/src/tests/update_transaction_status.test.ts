import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type UpdateTransactionStatusInput, type Transaction } from '../schema';
import { updateTransactionStatus } from '../handlers/update_transaction_status';
import { eq } from 'drizzle-orm';

// Create a test transaction first
const createTestTransaction = async (): Promise<Transaction> => {
  const result = await db.insert(transactionsTable)
    .values({
      transaction_id: 'test-txn-001',
      user_id: 'user123',
      amount: '999.99', // Store as string for numeric column
      timestamp: new Date(),
      status: 'pending',
      is_suspicious: false
    })
    .returning()
    .execute();

  return {
    ...result[0],
    amount: parseFloat(result[0].amount) // Convert back to number
  };
};

describe('updateTransactionStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update transaction status to completed', async () => {
    const testTransaction = await createTestTransaction();

    const input: UpdateTransactionStatusInput = {
      id: testTransaction.id,
      status: 'completed'
    };

    const result = await updateTransactionStatus(input);

    expect(result.id).toEqual(testTransaction.id);
    expect(result.status).toEqual('completed');
    expect(result.is_suspicious).toEqual(false);
    expect(result.transaction_id).toEqual('test-txn-001');
    expect(result.user_id).toEqual('user123');
    expect(result.amount).toEqual(999.99);
    expect(typeof result.amount).toBe('number');
  });

  it('should update transaction status to flagged and set suspicious flag', async () => {
    const testTransaction = await createTestTransaction();

    const input: UpdateTransactionStatusInput = {
      id: testTransaction.id,
      status: 'flagged',
      fraud_reason: 'Unusual spending pattern detected'
    };

    const result = await updateTransactionStatus(input);

    expect(result.status).toEqual('flagged');
    expect(result.is_suspicious).toEqual(true);
    expect(result.fraud_reason).toEqual('Unusual spending pattern detected');
  });

  it('should update fraud reason without changing status', async () => {
    const testTransaction = await createTestTransaction();

    const input: UpdateTransactionStatusInput = {
      id: testTransaction.id,
      status: 'pending',
      fraud_reason: 'Manual review required'
    };

    const result = await updateTransactionStatus(input);

    expect(result.status).toEqual('pending');
    expect(result.is_suspicious).toEqual(false);
    expect(result.fraud_reason).toEqual('Manual review required');
  });

  it('should clear fraud reason when null is provided', async () => {
    // First create a transaction with fraud reason
    const testTransaction = await createTestTransaction();
    await db.update(transactionsTable)
      .set({ fraud_reason: 'Initial reason' })
      .where(eq(transactionsTable.id, testTransaction.id))
      .execute();

    const input: UpdateTransactionStatusInput = {
      id: testTransaction.id,
      status: 'completed',
      fraud_reason: null
    };

    const result = await updateTransactionStatus(input);

    expect(result.status).toEqual('completed');
    expect(result.fraud_reason).toBeNull();
  });

  it('should save changes to database', async () => {
    const testTransaction = await createTestTransaction();

    const input: UpdateTransactionStatusInput = {
      id: testTransaction.id,
      status: 'failed',
      fraud_reason: 'Payment declined'
    };

    await updateTransactionStatus(input);

    // Verify changes were saved
    const savedTransaction = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, testTransaction.id))
      .execute();

    expect(savedTransaction).toHaveLength(1);
    expect(savedTransaction[0].status).toEqual('failed');
    expect(savedTransaction[0].is_suspicious).toEqual(false);
    expect(savedTransaction[0].fraud_reason).toEqual('Payment declined');
  });

  it('should handle all transaction statuses correctly', async () => {
    const testTransaction = await createTestTransaction();

    // Test each status
    const statuses = ['pending', 'completed', 'failed', 'flagged'] as const;

    for (const status of statuses) {
      const input: UpdateTransactionStatusInput = {
        id: testTransaction.id,
        status: status
      };

      const result = await updateTransactionStatus(input);

      expect(result.status).toEqual(status);
      expect(result.is_suspicious).toEqual(status === 'flagged');
    }
  });

  it('should throw error for non-existent transaction', async () => {
    const input: UpdateTransactionStatusInput = {
      id: 99999,
      status: 'completed'
    };

    expect(updateTransactionStatus(input)).rejects.toThrow(/not found/i);
  });

  it('should not update fraud_reason when not provided', async () => {
    // Create transaction with existing fraud reason
    const testTransaction = await createTestTransaction();
    await db.update(transactionsTable)
      .set({ fraud_reason: 'Existing reason' })
      .where(eq(transactionsTable.id, testTransaction.id))
      .execute();

    const input: UpdateTransactionStatusInput = {
      id: testTransaction.id,
      status: 'completed'
      // fraud_reason not provided
    };

    const result = await updateTransactionStatus(input);

    expect(result.status).toEqual('completed');
    expect(result.fraud_reason).toEqual('Existing reason'); // Should remain unchanged
  });

  it('should preserve transaction timestamps and other fields', async () => {
    const testTransaction = await createTestTransaction();

    const input: UpdateTransactionStatusInput = {
      id: testTransaction.id,
      status: 'completed'
    };

    const result = await updateTransactionStatus(input);

    expect(result.transaction_id).toEqual(testTransaction.transaction_id);
    expect(result.user_id).toEqual(testTransaction.user_id);
    expect(result.amount).toEqual(testTransaction.amount);
    expect(result.timestamp).toEqual(testTransaction.timestamp);
    expect(result.created_at).toEqual(testTransaction.created_at);
  });
});