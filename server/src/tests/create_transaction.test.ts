import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type CreateTransactionInput } from '../schema';
import { createTransaction } from '../handlers/create_transaction';
import { eq } from 'drizzle-orm';

// Test input for normal transactions
const testInput: CreateTransactionInput = {
  transaction_id: 'tx_12345',
  user_id: 'user_123',
  amount: 100.50,
  status: 'pending'
};

describe('createTransaction', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a transaction with fraud detection', async () => {
    const result = await createTransaction(testInput);

    // Basic field validation
    expect(result.transaction_id).toEqual('tx_12345');
    expect(result.user_id).toEqual('user_123');
    expect(result.amount).toEqual(100.50);
    expect(typeof result.amount).toBe('number');
    expect(result.status).toEqual('pending');
    expect(result.is_suspicious).toEqual(false);
    expect(result.fraud_reason).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save transaction to database correctly', async () => {
    const result = await createTransaction(testInput);

    // Query database to verify persistence
    const transactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(transactions).toHaveLength(1);
    const saved = transactions[0];
    expect(saved.transaction_id).toEqual('tx_12345');
    expect(saved.user_id).toEqual('user_123');
    expect(parseFloat(saved.amount)).toEqual(100.50);
    expect(saved.status).toEqual('pending');
    expect(saved.is_suspicious).toEqual(false);
    expect(saved.fraud_reason).toBeNull();
    expect(saved.timestamp).toBeInstanceOf(Date);
    expect(saved.created_at).toBeInstanceOf(Date);
  });

  it('should flag high amount transactions as suspicious', async () => {
    const highAmountInput: CreateTransactionInput = {
      transaction_id: 'tx_high_amount',
      user_id: 'user_456',
      amount: 15000, // Above threshold of 10,000
      status: 'pending'
    };

    const result = await createTransaction(highAmountInput);

    expect(result.is_suspicious).toEqual(true);
    expect(result.fraud_reason).toContain('High amount: $15000');
    expect(result.amount).toEqual(15000);
    expect(typeof result.amount).toBe('number');
  });

  it('should flag high frequency transactions as suspicious', async () => {
    const user_id = 'user_frequent';
    
    // Create 5 transactions rapidly (at the threshold)
    for (let i = 0; i < 5; i++) {
      await createTransaction({
        transaction_id: `tx_freq_${i}`,
        user_id: user_id,
        amount: 50,
        status: 'pending'
      });
    }

    // The 6th transaction should be flagged as suspicious
    const result = await createTransaction({
      transaction_id: 'tx_freq_6',
      user_id: user_id,
      amount: 50,
      status: 'pending'
    });

    expect(result.is_suspicious).toEqual(true);
    expect(result.fraud_reason).toContain('High frequency: 5 transactions in 1 minute(s)');
  });

  it('should combine multiple fraud reasons', async () => {
    const user_id = 'user_multiple_fraud';
    
    // Create 5 transactions to trigger frequency threshold
    for (let i = 0; i < 5; i++) {
      await createTransaction({
        transaction_id: `tx_multi_${i}`,
        user_id: user_id,
        amount: 100,
        status: 'pending'
      });
    }

    // Create transaction with both high amount and high frequency
    const result = await createTransaction({
      transaction_id: 'tx_multi_fraud',
      user_id: user_id,
      amount: 12000, // High amount
      status: 'pending'
    });

    expect(result.is_suspicious).toEqual(true);
    expect(result.fraud_reason).toContain('High amount: $12000');
    expect(result.fraud_reason).toContain('High frequency: 5 transactions in 1 minute(s)');
    expect(result.fraud_reason).toContain(';'); // Multiple reasons separated by semicolon
  });

  it('should handle edge case at fraud thresholds', async () => {
    // Test exactly at the amount threshold (should trigger)
    const thresholdResult = await createTransaction({
      transaction_id: 'tx_threshold',
      user_id: 'user_threshold',
      amount: 10000, // Exactly at threshold
      status: 'pending'
    });

    expect(thresholdResult.is_suspicious).toEqual(true);
    expect(thresholdResult.fraud_reason).toContain('High amount: $10000');

    // Test just below threshold (should not trigger)
    const belowThresholdResult = await createTransaction({
      transaction_id: 'tx_below_threshold',
      user_id: 'user_below',
      amount: 9999.99,
      status: 'pending'
    });

    expect(belowThresholdResult.is_suspicious).toEqual(false);
    expect(belowThresholdResult.fraud_reason).toBeNull();
  });

  it('should handle different transaction statuses', async () => {
    const completedInput: CreateTransactionInput = {
      transaction_id: 'tx_completed',
      user_id: 'user_status',
      amount: 500,
      status: 'completed'
    };

    const result = await createTransaction(completedInput);

    expect(result.status).toEqual('completed');
    expect(result.is_suspicious).toEqual(false);
  });

  it('should handle decimal amounts correctly', async () => {
    const decimalInput: CreateTransactionInput = {
      transaction_id: 'tx_decimal',
      user_id: 'user_decimal',
      amount: 123.45,
      status: 'pending'
    };

    const result = await createTransaction(decimalInput);

    expect(result.amount).toEqual(123.45);
    expect(typeof result.amount).toBe('number');

    // Verify in database
    const saved = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, result.id))
      .execute();

    expect(parseFloat(saved[0].amount)).toEqual(123.45);
  });
});