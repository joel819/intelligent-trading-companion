import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  DollarSign,
  Activity,
  GitCompare,
  X,
  Trophy,
  Medal
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, BarChart, Bar, Cell } from 'recharts';
import { BacktestResult } from '@/types/trading';

const STRATEGIES = [
  { id: 'spike_bot', name: 'Spike Bot', description: 'Volatility spike trading', color: 'hsl(var(--primary))' },
  { id: 'v10_safe', name: 'V10 Safe', description: 'Conservative trend strategy', color: 'hsl(142, 76%, 36%)' },
  { id: 'scalper', name: 'Scalper', description: 'Quick in-and-out trades', color: 'hsl(45, 93%, 47%)' },
  { id: 'breakout', name: 'Breakout', description: 'Trades breakouts from ranges', color: 'hsl(280, 87%, 65%)' },
  { id: 'grid_recovery', name: 'Grid Recovery', description: 'Grid-based recovery system', color: 'hsl(200, 95%, 50%)' },
];

const SYMBOLS = [
  { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
  { value: 'R_75', label: 'Volatility 75 Index' },
  { value: 'R_10', label: 'Volatility 10 Index' },
  { value: 'R_100', label: 'Volatility 100 Index' },
  { value: 'BOOM300N', label: 'Boom 300 Index' },
  { value: 'CRASH300N', label: 'Crash 300 Index' },
];

interface ComparisonResult {
  strategyId: string;
  strategyName: string;
  color: string;
  result: BacktestResult;
}

const STRATEGY_COLORS = {
  spike_bot: 'hsl(var(--primary))',
  v10_safe: 'hsl(142, 76%, 36%)',
  scalper: 'hsl(45, 93%, 47%)',
  breakout: 'hsl(280, 87%, 65%)',
  grid_recovery: 'hsl(200, 95%, 50%)',
};

export const StrategyComparison = () => {
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(['spike_bot', 'scalper']);
  const [selectedSymbol, setSelectedSymbol] = useState('R_75');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [initialBalance, setInitialBalance] = useState('10000');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ComparisonResult[]>([]);

  const toggleStrategy = (strategyId: string) => {
    setSelectedStrategies(prev =>
      prev.includes(strategyId)
        ? prev.filter(id => id !== strategyId)
        : [...prev, strategyId]
    );
  };

  const runComparison = async () => {
    if (selectedStrategies.length < 2) return;
    
    setIsRunning(true);
    setProgress(0);
    setResults([]);

    const comparisonResults: ComparisonResult[] = [];
    const totalStrategies = selectedStrategies.length;

    for (let i = 0; i < selectedStrategies.length; i++) {
      const strategyId = selectedStrategies[i];
      const strategy = STRATEGIES.find(s => s.id === strategyId)!;
      
      try {
        const response = await fetch('http://localhost:8000/backtest/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId,
            symbol: selectedSymbol,
            startDate,
            endDate,
            initialBalance: parseFloat(initialBalance)
          })
        });

        if (!response.ok) throw new Error('Backtest failed');
        
        const result: BacktestResult = await response.json();
        
        comparisonResults.push({
          strategyId,
          strategyName: strategy.name,
          color: strategy.color,
          result
        });
      } catch (err) {
        console.error(`Error running backtest for ${strategyId}:`, err);
      }
      
      setProgress(Math.round(((i + 1) / totalStrategies) * 100));
    }

    setResults(comparisonResults);
    setIsRunning(false);
  };

  // Merge equity curves for overlay chart
  const mergedEquityCurve = results.length > 0 ? 
    results[0].result.equityCurve.map((point, idx) => {
      const merged: Record<string, string | number> = { date: point.date };
      results.forEach(r => {
        merged[r.strategyId] = r.result.equityCurve[idx]?.equity || 0;
      });
      return merged;
    }) : [];

  // Radar chart data for strategy comparison
  const radarData = results.length > 0 ? [
    {
      metric: 'Win Rate',
      ...Object.fromEntries(results.map(r => [r.strategyId, r.result.metrics.winRate]))
    },
    {
      metric: 'Profit Factor',
      ...Object.fromEntries(results.map(r => [r.strategyId, Math.min(r.result.metrics.profitFactor * 20, 100)]))
    },
    {
      metric: 'Sharpe Ratio',
      ...Object.fromEntries(results.map(r => [r.strategyId, Math.max(0, r.result.metrics.sharpeRatio * 25 + 50)]))
    },
    {
      metric: 'Risk (Low DD)',
      ...Object.fromEntries(results.map(r => [r.strategyId, Math.max(0, 100 - r.result.metrics.maxDrawdown * 2)]))
    },
    {
      metric: 'Consistency',
      ...Object.fromEntries(results.map(r => [r.strategyId, Math.min(100, r.result.metrics.winRate + (r.result.metrics.profitFactor * 10))]))
    },
  ] : [];

  // Bar chart data for key metrics comparison
  const metricsBarData = [
    {
      metric: 'Total P&L ($)',
      ...Object.fromEntries(results.map(r => [r.strategyId, r.result.metrics.totalPnL]))
    },
    {
      metric: 'Win Rate (%)',
      ...Object.fromEntries(results.map(r => [r.strategyId, r.result.metrics.winRate]))
    },
    {
      metric: 'Profit Factor',
      ...Object.fromEntries(results.map(r => [r.strategyId, r.result.metrics.profitFactor]))
    },
    {
      metric: 'Max Drawdown (%)',
      ...Object.fromEntries(results.map(r => [r.strategyId, r.result.metrics.maxDrawdown]))
    },
  ];

  // Rank strategies
  const rankedStrategies = [...results].sort((a, b) =>
    b.result.metrics.totalPnL - a.result.metrics.totalPnL
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GitCompare className="w-6 h-6 text-primary" />
            Strategy Comparison
          </h2>
          <p className="text-muted-foreground">Compare multiple strategies side-by-side</p>
        </div>
      </div>

      {/* Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg">Select Strategies to Compare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Strategy Selection */}
          <div className="flex flex-wrap gap-3">
            {STRATEGIES.map(strategy => (
              <div
                key={strategy.id}
                onClick={() => toggleStrategy(strategy.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                  selectedStrategies.includes(strategy.id)
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <Checkbox 
                  checked={selectedStrategies.includes(strategy.id)}
                  className="pointer-events-none"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: strategy.color }}
                    />
                    <span className="font-medium text-foreground">{strategy.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{strategy.description}</span>
                </div>
              </div>
            ))}
          </div>

          {selectedStrategies.length < 2 && (
            <p className="text-sm text-amber-500">Select at least 2 strategies to compare</p>
          )}

          {/* Other Settings */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-border">
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

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Initial Balance ($)</label>
              <Input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                min="100"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={runComparison}
              disabled={isRunning || selectedStrategies.length < 2}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              {isRunning ? 'Running...' : 'Run Comparison'}
            </Button>
            
            {isRunning && (
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Testing strategies...</span>
                  <span className="font-medium">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-6 animate-fade-in">
          {/* Rankings */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Strategy Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {rankedStrategies.slice(0, 3).map((item, idx) => (
                  <div 
                    key={item.strategyId}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${
                      idx === 0 ? 'border-amber-500/50 bg-amber-500/10' : 'border-border'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      idx === 0 ? 'bg-amber-500 text-amber-950' : 
                      idx === 1 ? 'bg-slate-400 text-slate-900' : 
                      'bg-orange-700 text-orange-100'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-foreground">{item.strategyName}</span>
                      </div>
                      <div className="flex gap-4 mt-1 text-sm">
                        <span className={item.result.metrics.totalPnL >= 0 ? 'text-emerald-500' : 'text-destructive'}>
                          {item.result.metrics.totalPnL >= 0 ? '+' : ''}${item.result.metrics.totalPnL.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">
                          {item.result.metrics.winRate.toFixed(1)}% WR
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Equity Curve Comparison */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Equity Curve Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mergedEquityCurve}>
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
                      formatter={(value: number, name: string) => {
                        const strategy = STRATEGIES.find(s => s.id === name);
                        return [`$${value.toLocaleString()}`, strategy?.name || name];
                      }}
                    />
                    <Legend 
                      formatter={(value) => {
                        const strategy = STRATEGIES.find(s => s.id === value);
                        return strategy?.name || value;
                      }}
                    />
                    {results.map(r => (
                      <Line
                        key={r.strategyId}
                        type="monotone"
                        dataKey={r.strategyId}
                        stroke={r.color}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Performance Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis 
                        dataKey="metric" 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <PolarRadiusAxis 
                        angle={30} 
                        domain={[0, 100]} 
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      />
                      {results.map(r => (
                        <Radar
                          key={r.strategyId}
                          name={r.strategyName}
                          dataKey={r.strategyId}
                          stroke={r.color}
                          fill={r.color}
                          fillOpacity={0.2}
                        />
                      ))}
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Detailed Metrics Table */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-lg">Detailed Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card border-b border-border">
                      <tr className="text-muted-foreground">
                        <th className="text-left py-2 px-2">Metric</th>
                        {results.map(r => (
                          <th key={r.strategyId} className="text-right py-2 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: r.color }}
                              />
                              {r.strategyName}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Total P&L</td>
                        {results.map(r => (
                          <td key={r.strategyId} className={`py-2 px-2 text-right font-mono font-medium ${r.result.metrics.totalPnL >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                            {r.result.metrics.totalPnL >= 0 ? '+' : ''}${r.result.metrics.totalPnL.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Win Rate</td>
                        {results.map(r => (
                          <td key={r.strategyId} className="py-2 px-2 text-right font-mono text-foreground">
                            {r.result.metrics.winRate.toFixed(1)}%
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Profit Factor</td>
                        {results.map(r => (
                          <td key={r.strategyId} className={`py-2 px-2 text-right font-mono ${r.result.metrics.profitFactor >= 1.5 ? 'text-emerald-500' : 'text-foreground'}`}>
                            {r.result.metrics.profitFactor === Infinity ? '∞' : r.result.metrics.profitFactor.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Max Drawdown</td>
                        {results.map(r => (
                          <td key={r.strategyId} className={`py-2 px-2 text-right font-mono ${r.result.metrics.maxDrawdown > 20 ? 'text-destructive' : 'text-foreground'}`}>
                            {r.result.metrics.maxDrawdown.toFixed(1)}%
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Sharpe Ratio</td>
                        {results.map(r => (
                          <td key={r.strategyId} className={`py-2 px-2 text-right font-mono ${r.result.metrics.sharpeRatio >= 2 ? 'text-emerald-500' : 'text-foreground'}`}>
                            {r.result.metrics.sharpeRatio.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Total Trades</td>
                        {results.map(r => (
                          <td key={r.strategyId} className="py-2 px-2 text-right font-mono text-foreground">
                            {r.result.metrics.totalTrades}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Avg Win</td>
                        {results.map(r => (
                          <td key={r.strategyId} className="py-2 px-2 text-right font-mono text-emerald-500">
                            +${r.result.metrics.avgWin.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Avg Loss</td>
                        {results.map(r => (
                          <td key={r.strategyId} className="py-2 px-2 text-right font-mono text-destructive">
                            -${r.result.metrics.avgLoss.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-2 text-muted-foreground">Expectancy</td>
                        {results.map(r => (
                          <td key={r.strategyId} className={`py-2 px-2 text-right font-mono ${r.result.metrics.expectancy >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>
                            ${r.result.metrics.expectancy.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
