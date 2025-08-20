import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { getUserTransactionSummary } from '../handlers/get_user_transaction_summary';

describe('getUserTransactionSummary', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty summary for user with no transactions', async () => {
    const result = await getUserTransactionSummary('user123');

    expect(result.user_id).toEqual('user123');
    expect(result.total_transactions).toEqual(0);
    expect(result.total_amount).toEqual(0);
    expect(result.suspicious_transactions).toEqual(0);
    expect(result.last_transaction_at).toBeNull();
  });

  it('should calculate summary for user with single transaction', async () => {
    const testTimestamp = new Date('2024-01-15T10:30:00Z');
    
    // Insert test transaction
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'txn_001',
        user_id: 'user123',
        amount: '150.75',
        timestamp: testTimestamp,
        status: 'completed',
        is_suspicious: false
      })
      .execute();

    const result = await getUserTransactionSummary('user123');

    expect(result.user_id).toEqual('user123');
    expect(result.total_transactions).toEqual(1);
    expect(result.total_amount).toEqual(150.75);
    expect(result.suspicious_transactions).toEqual(0);
    expect(result.last_transaction_at).toEqual(testTimestamp);
  });

  it('should calculate summary for user with multiple transactions', async () => {
    const timestamp1 = new Date('2024-01-15T10:00:00Z');
    const timestamp2 = new Date('2024-01-15T11:00:00Z');
    const timestamp3 = new Date('2024-01-15T12:00:00Z');
    
    // Insert multiple test transactions
    await db.insert(transactionsTable)
      .values([
        {
          transaction_id: 'txn_001',
          user_id: 'user123',
          amount: '100.00',
          timestamp: timestamp1,
          status: 'completed',
          is_suspicious: false
        },
        {
          transaction_id: 'txn_002',
          user_id: 'user123',
          amount: '250.50',
          timestamp: timestamp2,
          status: 'completed',
          is_suspicious: true,
          fraud_reason: 'High amount'
        },
        {
          transaction_id: 'txn_003',
          user_id: 'user123',
          amount: '75.25',
          timestamp: timestamp3,
          status: 'pending',
          is_suspicious: false
        }
      ])
      .execute();

    const result = await getUserTransactionSummary('user123');

    expect(result.user_id).toEqual('user123');
    expect(result.total_transactions).toEqual(3);
    expect(result.total_amount).toEqual(425.75); // 100 + 250.50 + 75.25
    expect(result.suspicious_transactions).toEqual(1);
    expect(result.last_transaction_at).toEqual(timestamp3); // Most recent
  });

  it('should only include transactions for specified user', async () => {
    const timestamp = new Date('2024-01-15T10:00:00Z');
    
    // Insert transactions for different users
    await db.insert(transactionsTable)
      .values([
        {
          transaction_id: 'txn_001',
          user_id: 'user123',
          amount: '100.00',
          timestamp: timestamp,
          status: 'completed',
          is_suspicious: false
        },
        {
          transaction_id: 'txn_002',
          user_id: 'user456',
          amount: '200.00',
          timestamp: timestamp,
          status: 'completed',
          is_suspicious: true
        }
      ])
      .execute();

    const result = await getUserTransactionSummary('user123');

    expect(result.user_id).toEqual('user123');
    expect(result.total_transactions).toEqual(1);
    expect(result.total_amount).toEqual(100.00);
    expect(result.suspicious_transactions).toEqual(0);
  });

  it('should handle all suspicious transactions correctly', async () => {
    const timestamp1 = new Date('2024-01-15T10:00:00Z');
    const timestamp2 = new Date('2024-01-15T11:00:00Z');
    
    // Insert all suspicious transactions
    await db.insert(transactionsTable)
      .values([
        {
          transaction_id: 'txn_001',
          user_id: 'user123',
          amount: '500.00',
          timestamp: timestamp1,
          status: 'flagged',
          is_suspicious: true,
          fraud_reason: 'Unusual pattern'
        },
        {
          transaction_id: 'txn_002',
          user_id: 'user123',
          amount: '1000.00',
          timestamp: timestamp2,
          status: 'flagged',
          is_suspicious: true,
          fraud_reason: 'High amount'
        }
      ])
      .execute();

    const result = await getUserTransactionSummary('user123');

    expect(result.user_id).toEqual('user123');
    expect(result.total_transactions).toEqual(2);
    expect(result.total_amount).toEqual(1500.00);
    expect(result.suspicious_transactions).toEqual(2);
    expect(result.last_transaction_at).toEqual(timestamp2);
  });

  it('should handle decimal amounts correctly', async () => {
    const timestamp = new Date('2024-01-15T10:00:00Z');
    
    // Insert transaction with decimal amount
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'txn_001',
        user_id: 'user123',
        amount: '99.99',
        timestamp: timestamp,
        status: 'completed',
        is_suspicious: false
      })
      .execute();

    const result = await getUserTransactionSummary('user123');

    expect(result.total_amount).toEqual(99.99);
    expect(typeof result.total_amount).toBe('number');
  });
});