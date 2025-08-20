import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Clock, DollarSign, User } from 'lucide-react';
import type { Transaction } from '../../../server/src/schema';

interface TransactionCardProps {
  transaction: Transaction;
  onStatusUpdate?: (id: number, status: string) => void;
  showActions?: boolean;
}

export function TransactionCard({ 
  transaction, 
  onStatusUpdate, 
  showActions = false 
}: TransactionCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      case 'flagged': return 'outline';
      default: return 'secondary';
    }
  };

  const getRiskLevel = (transaction: Transaction) => {
    if (!transaction.is_suspicious) return 'low';
    if (transaction.amount > 50000) return 'high';
    if (transaction.amount > 10000) return 'medium';
    return 'low';
  };

  const riskLevel = getRiskLevel(transaction);

  return (
    <Card className={`financial-card ${
      transaction.is_suspicious 
        ? 'suspicious-transaction border-red-200 bg-red-50' 
        : 'border-gray-200 bg-white'
    }`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-semibold text-lg">
                Transaction #{transaction.transaction_id}
              </h3>
              <Badge variant={getStatusBadgeVariant(transaction.status)}>
                {transaction.status.toUpperCase()}
              </Badge>
              {transaction.is_suspicious && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  FLAGGED
                </Badge>
              )}
            </div>

            {/* Transaction Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">User</p>
                  <p className="font-medium">{transaction.user_id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Amount</p>
                  <p className="currency-display">{formatCurrency(transaction.amount)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Timestamp</p>
                  <p className="text-sm">{formatDateTime(transaction.timestamp)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Risk Level</p>
                <Badge 
                  variant="outline" 
                  className={`risk-${riskLevel} text-xs font-medium`}
                >
                  {riskLevel.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Fraud Reason */}
            {transaction.fraud_reason && (
              <div className="mt-3 p-3 bg-red-100 border border-red-200 rounded-md">
                <h4 className="text-sm font-semibold text-red-800 mb-1">
                  Fraud Detection Alert
                </h4>
                <p className="text-sm text-red-700">{transaction.fraud_reason}</p>
              </div>
            )}

            {/* Action Buttons */}
            {showActions && transaction.is_suspicious && onStatusUpdate && (
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusUpdate(transaction.id, 'completed')}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusUpdate(transaction.id, 'failed')}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStatusUpdate(transaction.id, 'flagged')}
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  Flag for Review
                </Button>
              </div>
            )}
          </div>

          {/* Risk Indicator */}
          <div className="ml-4">
            {transaction.is_suspicious ? (
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 border-2 border-red-300">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 border-2 border-green-300">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Created: {formatDateTime(transaction.created_at)} • ID: {transaction.id}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}