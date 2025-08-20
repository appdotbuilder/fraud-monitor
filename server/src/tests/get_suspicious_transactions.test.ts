import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { getSuspiciousTransactions } from '../handlers/get_suspicious_transactions';

describe('getSuspiciousTransactions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no suspicious transactions exist', async () => {
    // Create regular (non-suspicious) transaction
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'tx_regular_001',
        user_id: 'user_001',
        amount: '100.00',
        timestamp: new Date(),
        status: 'completed',
        is_suspicious: false
      })
      .execute();

    const result = await getSuspiciousTransactions();

    expect(result).toEqual([]);
  });

  it('should return suspicious transactions with correct data types', async () => {
    const testTimestamp = new Date('2024-01-15T10:00:00Z');
    
    // Create suspicious transaction
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'tx_suspicious_001',
        user_id: 'user_002',
        amount: '5000.50',
        timestamp: testTimestamp,
        status: 'flagged',
        is_suspicious: true,
        fraud_reason: 'High amount transaction'
      })
      .execute();

    const result = await getSuspiciousTransactions();

    expect(result).toHaveLength(1);
    expect(result[0].transaction_id).toEqual('tx_suspicious_001');
    expect(result[0].user_id).toEqual('user_002');
    expect(result[0].amount).toEqual(5000.50);
    expect(typeof result[0].amount).toEqual('number');
    expect(result[0].timestamp).toEqual(testTimestamp);
    expect(result[0].status).toEqual('flagged');
    expect(result[0].is_suspicious).toEqual(true);
    expect(result[0].fraud_reason).toEqual('High amount transaction');
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return multiple suspicious transactions ordered by timestamp descending', async () => {
    const olderTimestamp = new Date('2024-01-10T10:00:00Z');
    const newerTimestamp = new Date('2024-01-15T15:00:00Z');
    
    // Insert transactions in chronological order
    await db.insert(transactionsTable)
      .values([
        {
          transaction_id: 'tx_suspicious_old',
          user_id: 'user_003',
          amount: '1000.00',
          timestamp: olderTimestamp,
          status: 'flagged',
          is_suspicious: true,
          fraud_reason: 'Suspicious pattern'
        },
        {
          transaction_id: 'tx_suspicious_new',
          user_id: 'user_004',
          amount: '2000.00',
          timestamp: newerTimestamp,
          status: 'flagged',
          is_suspicious: true,
          fraud_reason: 'Multiple rapid transactions'
        }
      ])
      .execute();

    const result = await getSuspiciousTransactions();

    expect(result).toHaveLength(2);
    // Should be ordered by timestamp descending (newest first)
    expect(result[0].transaction_id).toEqual('tx_suspicious_new');
    expect(result[0].timestamp).toEqual(newerTimestamp);
    expect(result[1].transaction_id).toEqual('tx_suspicious_old');
    expect(result[1].timestamp).toEqual(olderTimestamp);
  });

  it('should filter out non-suspicious transactions', async () => {
    // Create mix of suspicious and non-suspicious transactions
    await db.insert(transactionsTable)
      .values([
        {
          transaction_id: 'tx_normal_001',
          user_id: 'user_005',
          amount: '50.00',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          status: 'completed',
          is_suspicious: false
        },
        {
          transaction_id: 'tx_suspicious_001',
          user_id: 'user_006',
          amount: '10000.00',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          status: 'flagged',
          is_suspicious: true,
          fraud_reason: 'Amount exceeds threshold'
        },
        {
          transaction_id: 'tx_normal_002',
          user_id: 'user_007',
          amount: '75.25',
          timestamp: new Date('2024-01-15T12:00:00Z'),
          status: 'completed',
          is_suspicious: false
        }
      ])
      .execute();

    const result = await getSuspiciousTransactions();

    expect(result).toHaveLength(1);
    expect(result[0].transaction_id).toEqual('tx_suspicious_001');
    expect(result[0].is_suspicious).toEqual(true);
    expect(result[0].fraud_reason).toEqual('Amount exceeds threshold');
  });

  it('should handle transactions with null fraud_reason', async () => {
    // Create suspicious transaction without fraud_reason
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'tx_suspicious_no_reason',
        user_id: 'user_008',
        amount: '3000.00',
        timestamp: new Date(),
        status: 'flagged',
        is_suspicious: true
        // fraud_reason intentionally omitted (will be null)
      })
      .execute();

    const result = await getSuspiciousTransactions();

    expect(result).toHaveLength(1);
    expect(result[0].transaction_id).toEqual('tx_suspicious_no_reason');
    expect(result[0].is_suspicious).toEqual(true);
    expect(result[0].fraud_reason).toBeNull();
  });

  it('should handle decimal amounts correctly', async () => {
    // Create suspicious transaction with precise decimal amount
    await db.insert(transactionsTable)
      .values({
        transaction_id: 'tx_decimal_test',
        user_id: 'user_009',
        amount: '12345.67',
        timestamp: new Date(),
        status: 'flagged',
        is_suspicious: true,
        fraud_reason: 'Decimal precision test'
      })
      .execute();

    const result = await getSuspiciousTransactions();

    expect(result).toHaveLength(1);
    expect(result[0].amount).toEqual(12345.67);
    expect(typeof result[0].amount).toEqual('number');
  });
});