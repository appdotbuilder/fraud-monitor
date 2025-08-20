import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Shield, 
  DollarSign, 
  Users,
  Clock,
  Activity
} from 'lucide-react';
import type { Transaction, UserTransactionSummary } from '../../../server/src/schema';

interface DashboardSummaryProps {
  transactions: Transaction[];
  suspiciousTransactions: Transaction[];
  userSummary?: UserTransactionSummary | null;
}

export function DashboardSummary({ 
  transactions, 
  suspiciousTransactions, 
  userSummary 
}: DashboardSummaryProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Calculate metrics
  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0);
  const suspiciousVolume = suspiciousTransactions.reduce((sum, t) => sum + t.amount, 0);
  const fraudRate = transactions.length > 0 ? (suspiciousTransactions.length / transactions.length) * 100 : 0;
  const riskScore = fraudRate > 15 ? 'high' : fraudRate > 5 ? 'medium' : 'low';
  
  // Recent activity (last hour mock)
  const recentTransactions = transactions.filter(t => 
    new Date(t.timestamp).getTime() > Date.now() - 3600000
  ).length;

  // Status distribution
  const statusCounts = transactions.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Unique users
  const uniqueUsers = new Set(transactions.map(t => t.user_id)).size;

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="financial-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
            <p className="text-xs text-muted-foreground">
              {transactions.length} total transactions
            </p>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fraud Rate</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${
              riskScore === 'high' ? 'text-red-500' : 
              riskScore === 'medium' ? 'text-yellow-500' : 'text-green-500'
            }`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fraudRate.toFixed(1)}%</div>
            <div className="flex items-center space-x-2">
              <Progress value={fraudRate} className="flex-1" />
              <Badge variant={
                riskScore === 'high' ? 'destructive' :
                riskScore === 'medium' ? 'secondary' : 'default'
              }>
                {riskScore.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">
              Unique users in system
            </p>
          </CardContent>
        </Card>

        <Card className="financial-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentTransactions}</div>
            <p className="text-xs text-muted-foreground">
              Transactions last hour
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Risk Analysis and Status Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Risk Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Suspicious Volume</span>
              <span className="text-sm text-red-600 font-semibold">
                {formatCurrency(suspiciousVolume)}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Clean Transactions</span>
              <span className="text-sm text-green-600 font-semibold">
                {transactions.length - suspiciousTransactions.length}
              </span>
            </div>

            <div className="pt-2">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Risk Distribution</span>
                <span>{fraudRate.toFixed(1)}% flagged</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full ${
                    riskScore === 'high' ? 'bg-red-500' : 
                    riskScore === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(fraudRate, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Transaction Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(statusCounts).map(([status, count]) => {
                const percentage = transactions.length > 0 ? (count / transactions.length) * 100 : 0;
                const statusColors = {
                  'completed': 'bg-green-500',
                  'pending': 'bg-yellow-500',
                  'failed': 'bg-red-500',
                  'flagged': 'bg-orange-500'
                } as Record<string, string>;
                
                return (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-gray-500'}`} />
                      <span className="text-sm font-medium capitalize">{status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{count}</span>
                      <Badge variant="outline" className="text-xs">
                        {percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* User-specific Summary */}
      {userSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>User Profile: {userSummary.user_id}</span>
              <Badge variant={
                userSummary.suspicious_transactions > userSummary.total_transactions * 0.1 
                  ? 'destructive' : 'default'
              }>
                {userSummary.suspicious_transactions > userSummary.total_transactions * 0.1 
                  ? 'High Risk' : 'Standard Risk'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{userSummary.total_transactions}</p>
                <p className="text-xs text-blue-600">Total Transactions</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(userSummary.total_amount)}</p>
                <p className="text-xs text-green-600">Total Volume</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{userSummary.suspicious_transactions}</p>
                <p className="text-xs text-red-600">Flagged Count</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-bold text-gray-600">
                  {userSummary.last_transaction_at 
                    ? formatDateTime(userSummary.last_transaction_at)
                    : 'No Activity'
                  }
                </p>
                <p className="text-xs text-gray-600">Last Transaction</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}