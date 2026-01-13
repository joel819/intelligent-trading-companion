import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Play,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Calendar,
  DollarSign,
  Percent,
  Activity,
  LineChart,
  History,
  Settings2
} from 'lucide-react';
import { format, subDays, differenceInDays } from 'date-fns';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

import { BacktestResult, BacktestTrade } from '@/types/trading';

const STRATEGIES = [
  { id: 'spike_bot', name: 'Spike Bot', description: 'Volatility spike trading (V75, Boom/Crash)' },
  { id: 'v10_safe', name: 'V10 Safe', description: 'Conservative Trend Strategy for V10' },
  { id: 'scalper', name: 'Scalper', description: 'Quick in-and-out trades' },
  { id: 'breakout', name: 'Breakout', description: 'Trades breakouts from ranges' },
  { id: 'grid_recovery', name: 'Grid Recovery', description: 'Grid-based recovery system' },
];

const SYMBOLS = [
  { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
  { value: 'R_75', label: 'Volatility 75 Index' },
  { value: 'R_10', label: 'Volatility 10 Index' },
  { value: 'R_100', label: 'Volatility 100 Index' },
  { value: 'R_50', label: 'Volatility 50 Index' },
  { value: 'BOOM300N', label: 'Boom 300 Index' },
  { value: 'CRASH300N', label: 'Crash 300 Index' },
  { value: 'BOOM500', label: 'Boom 500 Index' },
  { value: 'CRASH500', label: 'Crash 500 Index' },
];



export const StrategyBacktesting = () => {
  const [selectedStrategy, setSelectedStrategy] = useState('spike_bot');
  const [selectedSymbol, setSelectedSymbol] = useState('R_75');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [initialBalance, setInitialBalance] = useState('10000');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const runBacktest = async () => {
    setIsRunning(true);
    setProgress(0);
    setResult(null);

    // Fake progress while waiting for API
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 200);

    try {
      const response = await fetch('http://localhost:8000/backtest/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: selectedStrategy,
          symbol: selectedSymbol,
          startDate,
          endDate,
          initialBalance: parseFloat(initialBalance)
        })
      });

      if (!response.ok) {
        throw new Error(`Backtest failed: ${response.statusText}`);
      }

      const data: BacktestResult = await response.json();

      // Ensure date objects for charts if needed (Recharts handles strings mostly fine, but let's be safe if logic needs it)
      // For now, assuming strings returned by API are ISO/Compatible

      // Re-map trades for date usage if necessary
      const processedValues = {
        ...data,
        trades: data.trades.map(t => ({
          ...t,
          entryDate: new Date(t.entryDate),
          exitDate: new Date(t.exitDate)
        }))
      };

      // Use Type Assertion or map manually if strict mismatch on Date vs string occurs in component usage downstrem
      // The component uses format(trade.entryDate) so we need Date objects.

      // Fix Types locally for current component state usage
      // @ts-ignore
      setResult(processedValues);

    } catch (err) {
      console.error("Backtest error:", err);
      // Toast notification here suggested
    } finally {
      clearInterval(interval);
      setProgress(100);
      setIsRunning(false);
    }
  };

  const selectedStrategyInfo = STRATEGIES.find(s => s.id === selectedStrategy);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Strategy Backtesting
          </h2>
          <p className="text-muted-foreground">Test strategies against historical data</p>
        </div>
      </div>

      {/* Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="w-5 h-5" />
            Backtest Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Strategy</label>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex flex-col">
                        <span>{s.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStrategyInfo && (
                <p className="text-xs text-muted-foreground mt-1">{selectedStrategyInfo.description}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Symbol</label>
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYMBOLS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-end gap-4">
            <div className="w-48">
              <label className="text-sm font-medium text-foreground mb-2 block">Initial Balance ($)</label>
              <Input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                min="100"
              />
            </div>
            <Button
              onClick={runBacktest}
              disabled={isRunning}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run Backtest'}
            </Button>
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processing historical data...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total P&L</span>
                </div>
                <p className={`text-xl font-bold ${result.metrics.totalPnL >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                  {result.metrics.totalPnL >= 0 ? '+' : ''}${result.metrics.totalPnL.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Win Rate</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {result.metrics.winRate.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Profit Factor</span>
                </div>
                <p className={`text-xl font-bold ${result.metrics.profitFactor >= 1.5 ? 'text-emerald-500' : result.metrics.profitFactor >= 1 ? 'text-foreground' : 'text-destructive'}`}>
                  {result.metrics.profitFactor === Infinity ? '∞' : result.metrics.profitFactor.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Max Drawdown</span>
                </div>
                <p className={`text-xl font-bold ${result.metrics.maxDrawdown > 20 ? 'text-destructive' : result.metrics.maxDrawdown > 10 ? 'text-amber-500' : 'text-foreground'}`}>
                  {result.metrics.maxDrawdown.toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Sharpe Ratio</span>
                </div>
                <p className={`text-xl font-bold ${result.metrics.sharpeRatio >= 2 ? 'text-emerald-500' : result.metrics.sharpeRatio >= 1 ? 'text-foreground' : 'text-destructive'}`}>
                  {result.metrics.sharpeRatio.toFixed(2)}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Trades</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {result.metrics.totalTrades}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts and Details */}
          <Tabs defaultValue="equity" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="equity" className="gap-2">
                <LineChart className="w-4 h-4" />
                Equity Curve
              </TabsTrigger>
              <TabsTrigger value="trades" className="gap-2">
                <History className="w-4 h-4" />
                Trade List
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Statistics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="equity" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Equity Curve & Drawdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.equityCurve}>
                        <defs>
                          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          tickFormatter={(value) => `$${value.toLocaleString()}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number, name: string) => [
                            name === 'equity' ? `$${value.toLocaleString()}` : `${value.toFixed(2)}%`,
                            name === 'equity' ? 'Equity' : 'Drawdown'
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="equity"
                          stroke="hsl(var(--primary))"
                          fill="url(#equityGradient)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trades" className="mt-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Trade History ({result.trades.length} trades)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-card border-b border-border">
                        <tr className="text-muted-foreground">
                          <th className="text-left py-2 px-2">Date</th>
                          <th className="text-left py-2 px-2">Side</th>
                          <th className="text-right py-2 px-2">Entry</th>
                          <th className="text-right py-2 px-2">Exit</th>
                          <th className="text-right py-2 px-2">P&L</th>
                          <th className="text-right py-2 px-2">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.trades.slice(0, 100).map(trade => (
                          <tr key={trade.id} className="border-b border-border/50 hover:bg-muted/50">
                            <td className="py-2 px-2 text-foreground">
                              {format(trade.entryDate, 'MMM d, HH:mm')}
                            </td>
                            <td className="py-2 px-2">
                              <Badge variant={trade.side === 'buy' ? 'default' : 'destructive'} className="text-xs">
                                {trade.side.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-foreground">
                              ${trade.entryPrice.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-foreground">
                              ${trade.exitPrice.toFixed(2)}
                            </td>
                            <td className={`py-2 px-2 text-right font-mono font-medium ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                              {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                            </td>
                            <td className={`py-2 px-2 text-right font-mono ${trade.pnlPercent >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                              {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.trades.length > 100 && (
                      <p className="text-center text-sm text-muted-foreground py-4">
                        Showing first 100 of {result.trades.length} trades
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                      Winning Trades
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Count</span>
                      <span className="font-medium text-foreground">{result.metrics.winningTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Win</span>
                      <span className="font-medium text-emerald-500">+${result.metrics.avgWin.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Largest Win</span>
                      <span className="font-medium text-emerald-500">+${result.metrics.largestWin.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingDown className="w-5 h-5 text-destructive" />
                      Losing Trades
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Count</span>
                      <span className="font-medium text-foreground">{result.metrics.losingTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Loss</span>
                      <span className="font-medium text-destructive">-${result.metrics.avgLoss.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Largest Loss</span>
                      <span className="font-medium text-destructive">${result.metrics.largestLoss.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Risk Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Drawdown</span>
                      <span className={`font-medium ${result.metrics.maxDrawdown > 20 ? 'text-destructive' : 'text-foreground'}`}>
                        {result.metrics.maxDrawdown.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sharpe Ratio</span>
                      <span className="font-medium text-foreground">{result.metrics.sharpeRatio.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expectancy</span>
                      <span className={`font-medium ${result.metrics.expectancy >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                        ${result.metrics.expectancy.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-primary" />
                      Time Metrics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Hold Time</span>
                      <span className="font-medium text-foreground">{result.metrics.avgHoldTime.toFixed(0)} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Trades</span>
                      <span className="font-medium text-foreground">{result.metrics.totalTrades}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Profit Factor</span>
                      <span className={`font-medium ${result.metrics.profitFactor >= 1.5 ? 'text-emerald-500' : 'text-foreground'}`}>
                        {result.metrics.profitFactor === Infinity ? '∞' : result.metrics.profitFactor.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
};
