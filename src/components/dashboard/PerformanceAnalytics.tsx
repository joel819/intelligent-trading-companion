import { useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { TrendingUp, TrendingDown, Activity, Target, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyStats {
  date: string;
  equity: number;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  drawdown: number;
  peakEquity: number;
}

// Generate mock performance data
const generatePerformanceData = (): DailyStats[] => {
  const data: DailyStats[] = [];
  let equity = 10000;
  let peakEquity = equity;
  
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    const trades = 5 + Math.floor(Math.random() * 15);
    const winRate = 0.45 + Math.random() * 0.25;
    const wins = Math.round(trades * winRate);
    const losses = trades - wins;
    
    // Daily PnL with some variance
    const avgWin = 15 + Math.random() * 25;
    const avgLoss = 10 + Math.random() * 20;
    const pnl = (wins * avgWin) - (losses * avgLoss) + (Math.random() - 0.5) * 50;
    
    equity += pnl;
    peakEquity = Math.max(peakEquity, equity);
    const drawdown = ((peakEquity - equity) / peakEquity) * 100;
    
    data.push({
      date: date.toISOString().split('T')[0],
      equity: Math.round(equity * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      trades,
      wins,
      losses,
      winRate: Math.round(winRate * 100),
      drawdown: Math.round(drawdown * 100) / 100,
      peakEquity
    });
  }
  
  return data;
};

const StatCard = ({ 
  label, 
  value, 
  subValue, 
  icon: Icon, 
  trend 
}: { 
  label: string; 
  value: string; 
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) => (
  <div className="glass-card p-4">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className={cn(
          "text-xl font-bold",
          trend === 'up' && "text-success",
          trend === 'down' && "text-destructive",
          trend === 'neutral' && "text-foreground"
        )}>
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-muted-foreground mt-1">{subValue}</div>
        )}
      </div>
      <Icon className={cn(
        "w-5 h-5",
        trend === 'up' && "text-success",
        trend === 'down' && "text-destructive",
        trend === 'neutral' && "text-muted-foreground"
      )} />
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: entry.color }} 
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {typeof entry.value === 'number' 
              ? entry.name.includes('%') || entry.name.includes('Rate') || entry.name.includes('Drawdown')
                ? `${entry.value.toFixed(1)}%`
                : `$${entry.value.toFixed(2)}`
              : entry.value
            }
          </span>
        </div>
      ))}
    </div>
  );
};

export const PerformanceAnalytics = () => {
  const data = useMemo(() => generatePerformanceData(), []);
  
  // Calculate summary stats
  const stats = useMemo(() => {
    const totalPnl = data.reduce((sum, d) => sum + d.pnl, 0);
    const totalTrades = data.reduce((sum, d) => sum + d.trades, 0);
    const totalWins = data.reduce((sum, d) => sum + d.wins, 0);
    const winRate = (totalWins / totalTrades) * 100;
    const maxDrawdown = Math.max(...data.map(d => d.drawdown));
    const currentEquity = data[data.length - 1]?.equity || 0;
    const startEquity = data[0]?.equity - data[0]?.pnl || 10000;
    const returnPct = ((currentEquity - startEquity) / startEquity) * 100;
    
    // Calculate Sharpe ratio approximation
    const dailyReturns = data.map(d => d.pnl / (d.equity - d.pnl));
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const stdDev = Math.sqrt(
      dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length
    );
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    
    return {
      totalPnl,
      totalTrades,
      winRate,
      maxDrawdown,
      currentEquity,
      returnPct,
      sharpeRatio
    };
  }, [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Return"
          value={`${stats.returnPct >= 0 ? '+' : ''}${stats.returnPct.toFixed(2)}%`}
          subValue={`$${stats.totalPnl.toFixed(2)}`}
          icon={stats.returnPct >= 0 ? TrendingUp : TrendingDown}
          trend={stats.returnPct >= 0 ? 'up' : 'down'}
        />
        <StatCard
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          subValue={`${stats.totalTrades} trades`}
          icon={Target}
          trend={stats.winRate >= 50 ? 'up' : 'down'}
        />
        <StatCard
          label="Max Drawdown"
          value={`${stats.maxDrawdown.toFixed(2)}%`}
          icon={AlertTriangle}
          trend={stats.maxDrawdown > 10 ? 'down' : 'neutral'}
        />
        <StatCard
          label="Sharpe Ratio"
          value={stats.sharpeRatio.toFixed(2)}
          icon={Activity}
          trend={stats.sharpeRatio >= 1 ? 'up' : stats.sharpeRatio >= 0 ? 'neutral' : 'down'}
        />
      </div>

      {/* Equity Curve */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Equity Curve
        </h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => `$${(value / 1000).toFixed(1)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="equity"
                name="Equity"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#equityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Win Rate Over Time & Daily PnL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win Rate Chart */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-success" />
            Win Rate Over Time
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" opacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  name="Win Rate"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: 'hsl(var(--success))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily PnL Chart */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Daily P&L
          </h3>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                <Bar
                  dataKey="pnl"
                  name="Daily P&L"
                  radius={[2, 2, 0, 0]}
                  fill="hsl(var(--primary))"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Drawdown Chart */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Drawdown
        </h3>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                reversed
                domain={[0, 'dataMax']}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="drawdown"
                name="Drawdown"
                stroke="hsl(var(--destructive))"
                strokeWidth={2}
                fill="url(#drawdownGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
