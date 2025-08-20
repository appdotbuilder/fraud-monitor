import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Search, TrendingUp, AlertTriangle, Shield } from 'lucide-react';
import { trpc } from '@/utils/trpc';

interface FraudAnalyticsProps {
  onUserSelect?: (userId: string) => void;
}

export function FraudAnalytics({ onUserSelect }: FraudAnalyticsProps) {
  const [analysisForm, setAnalysisForm] = useState({
    user_id: '',
    amount: 0,
    config: {
      high_amount_threshold: 10000,
      frequency_threshold: 5,
      time_window_minutes: 1
    }
  });
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleRunAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!analysisForm.user_id || analysisForm.amount <= 0) return;

    setIsAnalyzing(true);
    try {
      const result = await trpc.runFraudDetection.query(analysisForm);
      setAnalysisResult(result);
    } catch (error) {
      console.error('Failed to run fraud analysis:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Fraud Risk Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRunAnalysis} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">User ID to Analyze</label>
                <Input
                  placeholder="user-123"
                  value={analysisForm.user_id}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAnalysisForm((prev) => ({ ...prev, user_id: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Transaction Amount ($)</label>
                <Input
                  type="number"
                  placeholder="5000.00"
                  value={analysisForm.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAnalysisForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))
                  }
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-semibold mb-3">Fraud Detection Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">High Amount Threshold ($)</label>
                  <Input
                    type="number"
                    value={analysisForm.config.high_amount_threshold}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setAnalysisForm((prev) => ({
                        ...prev,
                        config: { ...prev.config, high_amount_threshold: parseFloat(e.target.value) || 10000 }
                      }))
                    }
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Frequency Threshold (txns/min)</label>
                  <Input
                    type="number"
                    value={analysisForm.config.frequency_threshold}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setAnalysisForm((prev) => ({
                        ...prev,
                        config: { ...prev.config, frequency_threshold: parseInt(e.target.value) || 5 }
                      }))
                    }
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Time Window (minutes)</label>
                  <Input
                    type="number"
                    value={analysisForm.config.time_window_minutes}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setAnalysisForm((prev) => ({
                        ...prev,
                        config: { ...prev.config, time_window_minutes: parseInt(e.target.value) || 1 }
                      }))
                    }
                    min="1"
                  />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={isAnalyzing} className="w-full">
              {isAnalyzing ? 'Analyzing...' : 'Run Fraud Analysis'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Analysis Results</span>
              {onUserSelect && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUserSelect(analysisForm.user_id)}
                >
                  View User Transactions
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  {analysisResult.is_suspicious ? (
                    <>
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                      <div>
                        <p className="font-semibold text-red-600">High Risk Transaction</p>
                        <p className="text-sm text-gray-600">This transaction should be flagged</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Shield className="h-6 w-6 text-green-500" />
                      <div>
                        <p className="font-semibold text-green-600">Low Risk Transaction</p>
                        <p className="text-sm text-gray-600">Transaction appears normal</p>
                      </div>
                    </>
                  )}
                </div>
                <Badge variant={analysisResult.is_suspicious ? 'destructive' : 'default'}>
                  {analysisResult.is_suspicious ? 'FLAGGED' : 'APPROVED'}
                </Badge>
              </div>

              {/* Analysis Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Transaction Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>User ID:</span>
                      <span className="font-medium">{analysisForm.user_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount:</span>
                      <span className="font-medium">{formatCurrency(analysisForm.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Risk Score:</span>
                      <span className={`font-medium ${
                        analysisResult.risk_score > 0.7 ? 'text-red-600' :
                        analysisResult.risk_score > 0.4 ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {(analysisResult.risk_score * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Detection Rules</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Amount Threshold:</span>
                      <span className="font-medium">{formatCurrency(analysisForm.config.high_amount_threshold)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Frequency Limit:</span>
                      <span className="font-medium">{analysisForm.config.frequency_threshold}/min</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Time Window:</span>
                      <span className="font-medium">{analysisForm.config.time_window_minutes} min</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reasons */}
              {analysisResult.reasons && analysisResult.reasons.length > 0 && (
                <Alert className={analysisResult.is_suspicious ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}>
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Analysis Details:</strong>
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      {analysisResult.reasons.map((reason: string, index: number) => (
                        <li key={index} className="text-sm">{reason}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}