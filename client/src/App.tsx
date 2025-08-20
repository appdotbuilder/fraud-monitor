import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Shield, TrendingUp, Clock } from 'lucide-react';
import { TransactionCard } from '@/components/TransactionCard';
import { FraudAnalytics } from '@/components/FraudAnalytics';
import { DashboardSummary } from '@/components/DashboardSummary';
import { trpc } from '@/utils/trpc';
import type { 
  Transaction, 
  CreateTransactionInput, 
  UserTransactionSummary 
} from '../../server/src/schema';

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [suspiciousTransactions, setSuspiciousTransactions] = useState<Transaction[]>([]);
  const [userSummary, setUserSummary] = useState<UserTransactionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Form state for creating new transactions
  const [transactionForm, setTransactionForm] = useState<CreateTransactionInput>({
    transaction_id: '',
    user_id: '',
    amount: 0,
    status: 'pending'
  });

  // Filter states
  const [userFilter, setUserFilter] = useState('');
  const [suspiciousFilter, setSuspiciousFilter] = useState<string>('all');

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Load all transactions with filters
      const filters = {
        user_id: userFilter || undefined,
        is_suspicious: suspiciousFilter === 'all' ? undefined : suspiciousFilter === 'suspicious'
      };
      
      const [allTransactions, suspicious] = await Promise.all([
        trpc.getTransactions.query(filters),
        trpc.getSuspiciousTransactions.query()
      ]);
      
      setTransactions(allTransactions);
      setSuspiciousTransactions(suspicious);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userFilter, suspiciousFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load user summary when user filter changes
  useEffect(() => {
    const loadUserSummary = async () => {
      if (userFilter.trim()) {
        try {
          const summary = await trpc.getUserTransactionSummary.query(userFilter);
          setUserSummary(summary);
        } catch (error) {
          console.error('Failed to load user summary:', error);
          setUserSummary(null);
        }
      } else {
        setUserSummary(null);
      }
    };
    
    loadUserSummary();
  }, [userFilter]);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const newTransaction = await trpc.createTransaction.mutate(transactionForm);
      setTransactions((prev: Transaction[]) => [newTransaction, ...prev]);
      
      // Reset form
      setTransactionForm({
        transaction_id: '',
        user_id: '',
        amount: 0,
        status: 'pending'
      });
      
      // Reload suspicious transactions if new one might be flagged
      if (newTransaction.is_suspicious) {
        const suspicious = await trpc.getSuspiciousTransactions.query();
        setSuspiciousTransactions(suspicious);
      }
    } catch (error) {
      console.error('Failed to create transaction:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (transactionId: number, newStatus: string) => {
    try {
      await trpc.updateTransactionStatus.mutate({
        id: transactionId,
        status: newStatus as 'pending' | 'completed' | 'failed' | 'flagged'
      });
      
      // Reload transactions to reflect the status change
      await loadData();
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  };

  const handleUserSelect = (userId: string) => {
    setUserFilter(userId);
    setActiveTab('transactions');
  };



  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Shield className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Fraud Monitoring System</h1>
                <p className="text-sm text-gray-600">Financial Transaction Security</p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-700 border-green-300">
              System Active
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Stub Usage Alert */}
        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700">
            <strong>Development Mode:</strong> This system is currently using stub implementations for backend handlers. 
            In production, these would connect to a real database with fraud detection algorithms.
          </AlertDescription>
        </Alert>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="create">Create</TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <DashboardSummary 
              transactions={transactions}
              suspiciousTransactions={suspiciousTransactions}
              userSummary={userSummary}
            />

            {/* Recent Suspicious Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recent Suspicious Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {suspiciousTransactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No suspicious transactions detected
                  </p>
                ) : (
                  <div className="space-y-4">
                    {suspiciousTransactions.slice(0, 3).map((transaction: Transaction) => (
                      <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                        onStatusUpdate={handleStatusUpdate}
                        showActions={true}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            {/* Filters */}
            <Card>
              <CardHeader>
                <CardTitle>Transaction Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-48">
                    <Input
                      placeholder="Filter by User ID"
                      value={userFilter}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserFilter(e.target.value)}
                    />
                  </div>
                  <Select value={suspiciousFilter} onValueChange={setSuspiciousFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Transactions</SelectItem>
                      <SelectItem value="suspicious">Suspicious Only</SelectItem>
                      <SelectItem value="normal">Normal Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={loadData} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Apply Filters'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Transactions List */}
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">
                    <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading transactions...</p>
                  </div>
                ) : transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No transactions found. Try adjusting your filters or create a new transaction.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {transactions.map((transaction: Transaction) => (
                      <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                        onStatusUpdate={handleStatusUpdate}
                        showActions={transaction.is_suspicious}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <FraudAnalytics onUserSelect={handleUserSelect} />
          </TabsContent>

          {/* Create Transaction Tab */}
          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create New Transaction</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateTransaction} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Transaction ID</label>
                    <Input
                      placeholder="TX-123456"
                      value={transactionForm.transaction_id}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTransactionForm((prev: CreateTransactionInput) => ({ 
                          ...prev, 
                          transaction_id: e.target.value 
                        }))
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">User ID</label>
                    <Input
                      placeholder="user-123"
                      value={transactionForm.user_id}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTransactionForm((prev: CreateTransactionInput) => ({ 
                          ...prev, 
                          user_id: e.target.value 
                        }))
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Amount ($)</label>
                    <Input
                      type="number"
                      placeholder="100.00"
                      value={transactionForm.amount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setTransactionForm((prev: CreateTransactionInput) => ({ 
                          ...prev, 
                          amount: parseFloat(e.target.value) || 0 
                        }))
                      }
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Initial Status</label>
                    <Select 
                      value={transactionForm.status} 
                      onValueChange={(value: 'pending' | 'completed' | 'failed' | 'flagged') =>
                        setTransactionForm((prev: CreateTransactionInput) => ({ 
                          ...prev, 
                          status: value 
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="flagged">Flagged</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button type="submit" disabled={isLoading} className="w-full">
                    {isLoading ? 'Creating Transaction...' : 'Create Transaction'}
                  </Button>
                </form>

                <Alert className="mt-6">
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    Transactions are automatically analyzed for fraud patterns including high amounts 
                    ($10,000+) and unusual frequency patterns.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;