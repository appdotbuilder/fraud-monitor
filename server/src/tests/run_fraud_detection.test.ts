import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { runFraudDetection, type FraudDetectionResult } from '../handlers/run_fraud_detection';
import { type FraudDetectionConfig } from '../schema';

const defaultConfig: FraudDetectionConfig = {
  high_amount_threshold: 10000,
  frequency_threshold: 5,
  time_window_minutes: 1
};

describe('runFraudDetection', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return no fraud for normal transaction', async () => {
    const result: FraudDetectionResult = await runFraudDetection('user1', 500, defaultConfig);

    expect(result.is_suspicious).toBe(false);
    expect(result.fraud_reason).toBe(null);
    expect(result.risk_score).toBe(0);
  });

  it('should detect high amount fraud', async () => {
    const result: FraudDetectionResult = await runFraudDetection('user1', 15000, defaultConfig);

    expect(result.is_suspicious).toBe(true);
    expect(result.fraud_reason).toContain('High transaction amount');
    expect(result.fraud_reason).toContain('$15000 exceeds threshold of $10000');
    expect(result.risk_score).toBe(50);
  });

  it('should detect high frequency fraud', async () => {
    const userId = 'user_frequent';
    const now = new Date();

    // Create 4 recent transactions within the time window (+ 1 current = 5 total)
    for (let i = 0; i < 4; i++) {
      const timestamp = new Date(now.getTime() - (i * 10000)); // 10 seconds apart
      await db.insert(transactionsTable)
        .values({
          transaction_id: `freq_test_${i}`,
          user_id: userId,
          amount: '100.00',
          timestamp: timestamp,
          status: 'completed'
        })
        .execute();
    }

    const result: FraudDetectionResult = await runFraudDetection(userId, 100, defaultConfig);

    expect(result.is_suspicious).toBe(true);
    expect(result.fraud_reason).toContain('High transaction frequency');
    expect(result.fraud_reason).toContain('5 transactions in 1 minute(s)');
    expect(result.risk_score).toBe(55); // 35 (frequency) + 20 (rapid succession)
  });

  it('should detect multiple large transactions fraud', async () => {
    const userId = 'user_large';
    const now = new Date();

    // Create 2 large transactions within the time window
    for (let i = 0; i < 2; i++) {
      const timestamp = new Date(now.getTime() - (i * 40000)); // 40 seconds apart to avoid rapid succession
      await db.insert(transactionsTable)
        .values({
          transaction_id: `large_test_${i}`,
          user_id: userId,
          amount: '6000.00', // Over half of high_amount_threshold (5000)
          timestamp: timestamp,
          status: 'completed'
        })
        .execute();
    }

    const result: FraudDetectionResult = await runFraudDetection(userId, 6000, defaultConfig);

    expect(result.is_suspicious).toBe(true);
    expect(result.fraud_reason).toContain('Multiple large transactions detected');
    expect(result.fraud_reason).toContain('3 transactions over $5000');
    expect(result.risk_score).toBe(50);
  });

  it('should detect rapid successive transactions', async () => {
    const userId = 'user_rapid';
    const now = new Date();

    // Create 3 transactions within 30 seconds of each other
    for (let i = 0; i < 3; i++) {
      const timestamp = new Date(now.getTime() - (i * 15000)); // 15 seconds apart
      await db.insert(transactionsTable)
        .values({
          transaction_id: `rapid_test_${i}`,
          user_id: userId,
          amount: '100.00',
          timestamp: timestamp,
          status: 'completed'
        })
        .execute();
    }

    const result: FraudDetectionResult = await runFraudDetection(userId, 100, defaultConfig);

    expect(result.is_suspicious).toBe(false); // Risk score is 20, below 50 threshold
    expect(result.fraud_reason).toContain('Rapid successive transactions detected within 30 seconds');
    expect(result.risk_score).toBe(20);
  });

  it('should combine multiple fraud indicators', async () => {
    const userId = 'user_combo';
    const now = new Date();

    // Create 5 transactions (frequency fraud) with some being large amounts
    for (let i = 0; i < 5; i++) {
      const timestamp = new Date(now.getTime() - (i * 10000)); // 10 seconds apart
      const amount = i < 2 ? '6000.00' : '100.00'; // First 2 are large
      
      await db.insert(transactionsTable)
        .values({
          transaction_id: `combo_test_${i}`,
          user_id: userId,
          amount: amount,
          timestamp: timestamp,
          status: 'completed'
        })
        .execute();
    }

    // Test with a high amount transaction
    const result: FraudDetectionResult = await runFraudDetection(userId, 12000, defaultConfig);

    expect(result.is_suspicious).toBe(true);
    expect(result.fraud_reason).toContain('High transaction amount');
    expect(result.fraud_reason).toContain('High transaction frequency');
    expect(result.fraud_reason).toContain('Multiple large transactions detected');
    expect(result.fraud_reason).toContain('Rapid successive transactions detected');
    expect(result.risk_score).toBe(100); // Should be capped at 100
  });

  it('should ignore old transactions outside time window', async () => {
    const userId = 'user_old';
    const oldTimestamp = new Date();
    oldTimestamp.setMinutes(oldTimestamp.getMinutes() - 5); // 5 minutes ago

    // Create 10 old transactions (outside 1-minute window)
    for (let i = 0; i < 10; i++) {
      await db.insert(transactionsTable)
        .values({
          transaction_id: `old_test_${i}`,
          user_id: userId,
          amount: '100.00',
          timestamp: oldTimestamp,
          status: 'completed'
        })
        .execute();
    }

    const result: FraudDetectionResult = await runFraudDetection(userId, 500, defaultConfig);

    expect(result.is_suspicious).toBe(false);
    expect(result.fraud_reason).toBe(null);
    expect(result.risk_score).toBe(0);
  });

  it('should use custom configuration', async () => {
    const customConfig: FraudDetectionConfig = {
      high_amount_threshold: 5000,
      frequency_threshold: 2,
      time_window_minutes: 5
    };

    const userId = 'user_custom';
    const now = new Date();

    // Create 1 transaction within 5-minute window (+ 1 current = 2 total)
    const timestamp = new Date(now.getTime() - 60000); // 1 minute apart
    await db.insert(transactionsTable)
      .values({
        transaction_id: `custom_test_0`,
        user_id: userId,
        amount: '100.00',
        timestamp: timestamp,
        status: 'completed'
      })
      .execute();

    const result: FraudDetectionResult = await runFraudDetection(userId, 6000, customConfig);

    expect(result.is_suspicious).toBe(true);
    expect(result.fraud_reason).toContain('High transaction amount');
    expect(result.fraud_reason).toContain('$6000 exceeds threshold of $5000');
    expect(result.fraud_reason).toContain('High transaction frequency');
    expect(result.fraud_reason).toContain('2 transactions in 5 minute(s)');
    expect(result.risk_score).toBe(85); // 50 + 35
  });

  it('should handle user with no transaction history', async () => {
    const result: FraudDetectionResult = await runFraudDetection('new_user', 1000, defaultConfig);

    expect(result.is_suspicious).toBe(false);
    expect(result.fraud_reason).toBe(null);
    expect(result.risk_score).toBe(0);
  });

  it('should work with default configuration when none provided', async () => {
    const result: FraudDetectionResult = await runFraudDetection('user1', 15000); // No config provided

    expect(result.is_suspicious).toBe(true);
    expect(result.fraud_reason).toContain('High transaction amount');
    expect(result.risk_score).toBe(50);
  });

  it('should handle edge case at exact threshold', async () => {
    const result: FraudDetectionResult = await runFraudDetection('user1', 10000, defaultConfig);

    expect(result.is_suspicious).toBe(false); // Exactly at threshold, not over
    expect(result.fraud_reason).toBe(null);
    expect(result.risk_score).toBe(0);
  });

  it('should handle transactions exactly at frequency threshold', async () => {
    const userId = 'user_threshold';
    const now = new Date();

    // Create exactly 3 transactions (+ 1 current = 4 total, below threshold of 5)
    for (let i = 0; i < 3; i++) {
      const timestamp = new Date(now.getTime() - (i * 40000)); // 40 seconds apart to avoid rapid succession
      await db.insert(transactionsTable)
        .values({
          transaction_id: `threshold_test_${i}`,
          user_id: userId,
          amount: '100.00',
          timestamp: timestamp,
          status: 'completed'
        })
        .execute();
    }

    const result: FraudDetectionResult = await runFraudDetection(userId, 100, defaultConfig);

    expect(result.is_suspicious).toBe(false);
    expect(result.fraud_reason).toBe(null);
    expect(result.risk_score).toBe(0);
  });
});