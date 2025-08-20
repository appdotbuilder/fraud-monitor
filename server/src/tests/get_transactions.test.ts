import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { type GetTransactionsInput } from '../schema';
import { getTransactions } from '../handlers/get_transactions';
import { eq } from 'drizzle-orm';

// Test transaction data
const testTransactions = [
  {
    transaction_id: 'txn_001',
    user_id: 'user_1',
    amount: '150.75',
    timestamp: new Date('2024-01-01T10:00:00Z'),
    status: 'completed' as const,
    is_suspicious: false,
    fraud_reason: null
  },
  {
    transaction_id: 'txn_002',
    user_id: 'user_1',
    amount: '25.50',
    timestamp: new Date('2024-01-01T11:00:00Z'),
    status: 'pending' as const,
    is_suspicious: true,
    fraud_reason: 'High frequency transactions'
  },
  {
    transaction_id: 'txn_003',
    user_id: 'user_2',
    amount: '500.00',
    timestamp: new Date('2024-01-01T12:00:00Z'),
    status: 'completed' as const,
    is_suspicious: false,
    fraud_reason: null
  },
  {
    transaction_id: 'txn_004',
    user_id: 'user_2',
    amount: '12000.00',
    timestamp: new Date('2024-01-01T13:00:00Z'),
    status: 'flagged' as const,
    is_suspicious: true,
    fraud_reason: 'High amount transaction'
  }
];

describe('getTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  const seedTransactions = async () => {
    await db.insert(transactionsTable)
      .values(testTransactions)
      .execute();
  };

  it('should return all transactions when no filters applied', async () => {
    await seedTransactions();

    const result = await getTransactions();

    expect(result).toHaveLength(4);
    
    // Verify transactions are ordered by timestamp descending (most recent first)
    expect(result[0].transaction_id).toEqual('txn_004');
    expect(result[1].transaction_id).toEqual('txn_003');
    expect(result[2].transaction_id).toEqual('txn_002');
    expect(result[3].transaction_id).toEqual('txn_001');

    // Verify numeric conversion
    expect(typeof result[0].amount).toBe('number');
    expect(result[0].amount).toEqual(12000.00);
    expect(result[1].amount).toEqual(500.00);
  });

  it('should filter transactions by user_id', async () => {
    await seedTransactions();

    const input: GetTransactionsInput = {
      user_id: 'user_1',
      limit: 100,
      offset: 0
    };

    const result = await getTransactions(input);

    expect(result).toHaveLength(2);
    result.forEach(transaction => {
      expect(transaction.user_id).toEqual('user_1');
    });

    // Verify ordering is maintained
    expect(result[0].transaction_id).toEqual('txn_002');
    expect(result[1].transaction_id).toEqual('txn_001');
  });

  it('should filter transactions by is_suspicious flag', async () => {
    await seedTransactions();

    const input: GetTransactionsInput = {
      is_suspicious: true,
      limit: 100,
      offset: 0
    };

    const result = await getTransactions(input);

    expect(result).toHaveLength(2);
    result.forEach(transaction => {
      expect(transaction.is_suspicious).toBe(true);
    });

    // Verify both suspicious transactions are returned
    expect(result[0].transaction_id).toEqual('txn_004');
    expect(result[1].transaction_id).toEqual('txn_002');
  });

  it('should filter by both user_id and is_suspicious', async () => {
    await seedTransactions();

    const input: GetTransactionsInput = {
      user_id: 'user_1',
      is_suspicious: true,
      limit: 100,
      offset: 0
    };

    const result = await getTransactions(input);

    expect(result).toHaveLength(1);
    expect(result[0].transaction_id).toEqual('txn_002');
    expect(result[0].user_id).toEqual('user_1');
    expect(result[0].is_suspicious).toBe(true);
  });

  it('should apply pagination correctly', async () => {
    await seedTransactions();

    // Test with limit only
    const firstPage: GetTransactionsInput = {
      limit: 2,
      offset: 0
    };

    const firstResult = await getTransactions(firstPage);
    expect(firstResult).toHaveLength(2);
    expect(firstResult[0].transaction_id).toEqual('txn_004');
    expect(firstResult[1].transaction_id).toEqual('txn_003');

    // Test with offset
    const secondPage: GetTransactionsInput = {
      limit: 2,
      offset: 2
    };

    const secondResult = await getTransactions(secondPage);
    expect(secondResult).toHaveLength(2);
    expect(secondResult[0].transaction_id).toEqual('txn_002');
    expect(secondResult[1].transaction_id).toEqual('txn_001');
  });

  it('should handle empty result set', async () => {
    // Don't seed any transactions
    const input: GetTransactionsInput = {
      user_id: 'nonexistent_user',
      limit: 100,
      offset: 0
    };

    const result = await getTransactions(input);

    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should use default pagination when called with empty input', async () => {
    await seedTransactions();

    const result = await getTransactions();

    expect(result).toHaveLength(4); // All transactions returned with default limit of 100
    
    // Verify ordering is still applied
    expect(result[0].transaction_id).toEqual('txn_004');
  });

  it('should handle transactions with all data types correctly', async () => {
    await seedTransactions();

    const result = await getTransactions();
    const transaction = result[0];

    // Verify all field types are correct
    expect(typeof transaction.id).toBe('number');
    expect(typeof transaction.transaction_id).toBe('string');
    expect(typeof transaction.user_id).toBe('string');
    expect(typeof transaction.amount).toBe('number');
    expect(transaction.timestamp).toBeInstanceOf(Date);
    expect(typeof transaction.status).toBe('string');
    expect(typeof transaction.is_suspicious).toBe('boolean');
    expect(transaction.fraud_reason === null || typeof transaction.fraud_reason === 'string').toBe(true);
    expect(transaction.created_at).toBeInstanceOf(Date);
  });

  it('should verify database integration', async () => {
    await seedTransactions();
    
    const result = await getTransactions({ 
      user_id: 'user_2',
      limit: 100,
      offset: 0
    });

    // Verify data is actually retrieved from database
    const dbTransactions = await db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.user_id, 'user_2'))
      .execute();

    expect(result).toHaveLength(dbTransactions.length);
    expect(result[0].user_id).toEqual('user_2');
    expect(result[1].user_id).toEqual('user_2');
  });
});