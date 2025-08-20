import { db } from '../db';
import { transactionsTable } from '../db/schema';
import { eq, gte, and } from 'drizzle-orm';
import { type FraudDetectionConfig } from '../schema';

export interface FraudDetectionResult {
    is_suspicious: boolean;
    fraud_reason: string | null;
    risk_score: number; // 0-100 scale
}

export const runFraudDetection = async (
    userId: string, 
    amount: number, 
    config: FraudDetectionConfig = {
        high_amount_threshold: 10000,
        frequency_threshold: 5,
        time_window_minutes: 1
    }
): Promise<FraudDetectionResult> => {
    try {
        let riskScore = 0;
        const fraudReasons: string[] = [];

        // Check 1: High amount threshold
        if (amount > config.high_amount_threshold) {
            riskScore += 50; // High impact on risk score
            fraudReasons.push(`High transaction amount: $${amount} exceeds threshold of $${config.high_amount_threshold}`);
        }

        // Check 2: Transaction frequency analysis
        const timeWindowStart = new Date();
        timeWindowStart.setMinutes(timeWindowStart.getMinutes() - config.time_window_minutes);

        // Query recent transactions within the time window
        const recentTransactions = await db.select()
            .from(transactionsTable)
            .where(
                and(
                    eq(transactionsTable.user_id, userId),
                    gte(transactionsTable.timestamp, timeWindowStart)
                )
            )
            .execute();

        // Frequency check (including the current transaction being processed)
        const totalTransactionCount = recentTransactions.length + 1; // +1 for current transaction
        if (totalTransactionCount >= config.frequency_threshold) {
            riskScore += 35; // High impact on risk score
            fraudReasons.push(`High transaction frequency: ${totalTransactionCount} transactions in ${config.time_window_minutes} minute(s), threshold is ${config.frequency_threshold}`);
        }

        // Check 3: Multiple large transactions in short time
        const largeTransactions = recentTransactions.filter(t => 
            parseFloat(t.amount) > config.high_amount_threshold / 2
        );
        // Include current transaction if it's also large
        const currentTransactionIsLarge = amount > config.high_amount_threshold / 2;
        const totalLargeTransactions = largeTransactions.length + (currentTransactionIsLarge ? 1 : 0);
        
        if (totalLargeTransactions >= 2) {
            riskScore += 50;
            fraudReasons.push(`Multiple large transactions detected: ${totalLargeTransactions} transactions over $${config.high_amount_threshold / 2} in ${config.time_window_minutes} minute(s)`);
        }

        // Check 4: Rapid successive transactions (same user, quick succession)
        if (recentTransactions.length >= 2) { // Need at least 2 existing transactions to check succession
            const timestamps = recentTransactions
                .map(t => t.timestamp.getTime())
                .sort((a, b) => a - b);
            
            // Check for transactions within 30 seconds of each other
            let rapidSuccession = false;
            for (let i = 1; i < timestamps.length; i++) {
                if (timestamps[i] - timestamps[i - 1] < 30000) { // 30 seconds
                    rapidSuccession = true;
                    break;
                }
            }

            if (rapidSuccession) {
                riskScore += 20;
                fraudReasons.push('Rapid successive transactions detected within 30 seconds');
            }
        }

        // Cap risk score at 100
        riskScore = Math.min(riskScore, 100);

        // Determine if transaction is suspicious (threshold: 50)
        const isSuspicious = riskScore >= 50;
        const fraudReason = fraudReasons.length > 0 ? fraudReasons.join('; ') : null;

        return {
            is_suspicious: isSuspicious,
            fraud_reason: fraudReason,
            risk_score: riskScore
        };

    } catch (error) {
        console.error('Fraud detection failed:', error);
        throw error;
    }
};