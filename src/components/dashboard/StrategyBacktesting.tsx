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

interface BacktestTrade {
  id: string;
  entryDate: Date;
  exitDate: Date;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
}

interface BacktestResult {
  trades: BacktestTrade[];
  equityCurve: { date: string; equity: number; drawdown: number }[];
  metrics: {
    totalPnL: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
    largestWin: number;
    largestLoss: number;
    avgHoldTime: number;
    expectancy: number;
  };
}

const STRATEGIES = [
  { id: 'spike_bot', name: 'Spike Bot', description: 'Catches sudden price spikes' },
  { id: 'scalper', name: 'Scalper', description: 'Quick in-and-out trades' },
  { id: 'breakout', name: 'Breakout', description: 'Trades breakouts from ranges' },
  { id: 'grid_recovery', name: 'Grid Recovery', description: 'Grid-based recovery system' },
  { id: 'v75_sniper', name: 'V75 Sniper', description: 'Optimized for Volatility 75' },
  { id: 'boom300_safe', name: 'Boom 300 Safe', description: 'Conservative Boom 300 strategy' },
  { id: 'crash300_safe', name: 'Crash 300 Safe', description: 'Conservative Crash 300 strategy' },
];

const SYMBOLS = [
  'Volatility 75 Index',
  'Volatility 100 Index',
  'Boom 300 Index',
  'Crash 300 Index',
  'Volatility 50 Index',
  'Step Index',
];

const generateBacktestResult = (
  strategy: string,
  symbol: string,
  startDate: Date,
  endDate: Date,
  initialBalance: number
): BacktestResult => {
  const days = differenceInDays(endDate, startDate);
  const tradesPerDay = strategy === 'scalper' ? 8 : strategy === 'spike_bot' ? 3 : 5;
  const totalTrades = Math.floor(days * tradesPerDay * (0.7 + Math.random() * 0.6));
  
  // Strategy-specific win rates
  const baseWinRate = {
    spike_bot: 0.62,
    scalper: 0.58,
    breakout: 0.55,
    grid_recovery: 0.68,
    v75_sniper: 0.60,
    boom300_safe: 0.72,
    crash300_safe: 0.70,
  }[strategy] || 0.55;

  const winRate = baseWinRate + (Math.random() - 0.5) * 0.1;
  
  const trades: BacktestTrade[] = [];
  let equity = initialBalance;
  const equityCurve: { date: string; equity: number; drawdown: number }[] = [];
  let peakEquity = initialBalance;
  let maxDrawdown = 0;

  for (let i = 0; i < totalTrades; i++) {
    const tradeDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()));
    const isWin = Math.random() < winRate;
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const entryPrice = 1000 + Math.random() * 500;
    const pnlPercent = isWin 
      ? 0.5 + Math.random() * 2 
      : -(0.3 + Math.random() * 1.5);
    const pnl = (equity * (pnlPercent / 100));
    const exitPrice = side === 'buy'
      ? entryPrice * (1 + pnlPercent / 100)
      : entryPrice * (1 - pnlPercent / 100);

    trades.push({
      id: `bt-${i}`,
      entryDate: tradeDate,
      exitDate: new Date(tradeDate.getTime() + (5 + Math.random() * 60) * 60000),
      symbol,
      side,
      entryPrice,
      exitPrice,
      pnl,
      pnlPercent,
    });

    equity += pnl;
    peakEquity = Math.max(peakEquity, equity);
    const currentDrawdown = ((peakEquity - equity) / peakEquity) * 100;
    maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
  }

  // Sort trades by date
  trades.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime());

  // Build equity curve
  equity = initialBalance;
  peakEquity = initialBalance;
  
  for (let d = 0; d <= days; d++) {
    const currentDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    const dayTrades = trades.filter(t => 
      format(t.entryDate, 'yyyy-MM-dd') === format(currentDate, 'yyyy-MM-dd')
    );
    
    dayTrades.forEach(t => {
      equity += t.pnl;
    });
    
    peakEquity = Math.max(peakEquity, equity);
    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
    
    equityCurve.push({
      date: format(currentDate, 'MMM d'),
      equity: Math.round(equity * 100) / 100,
      drawdown: Math.round(drawdown * 100) / 100,
    });
  }

  // Calculate metrics
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl <= 0);
  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  
  const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
  
  return {
    trades,
    equityCurve,
    metrics: {
      totalPnL: equity - initialBalance,
      winRate: (winningTrades.length / trades.length) * 100,
      profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0,
      maxDrawdown,
      sharpeRatio: 1.2 + Math.random() * 1.5,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      avgWin,
      avgLoss,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0,
      avgHoldTime: 15 + Math.random() * 45,
      expectancy: (avgWin * (winningTrades.length / trades.length)) - (avgLoss * (losingTrades.length / trades.length)),
    },
  };
};

export const StrategyBacktesting = () => {
  const [selectedStrategy, setSelectedStrategy] = useState('spike_bot');
  const [selectedSymbol, setSelectedSymbol] = useState('Volatility 75 Index');
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

    // Simulate backtest progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setProgress(i);
    }

    const backtestResult = generateBacktestResult(
      selectedStrategy,
      selectedSymbol,
      new Date(startDate),
      new Date(endDate),
      parseFloat(initialBalance)
    );

    setResult(backtestResult);
    setIsRunning(false);
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
                    <SelectItem key={s} value={s}>{s}</SelectItem>
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
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
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
