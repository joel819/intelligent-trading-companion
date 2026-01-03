import { useState, useMemo } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ArrowRightLeft,
  PieChart,
  BarChart3,
  CheckCircle2,
  Circle,
  Plus,
  Settings2,
  RefreshCw
} from 'lucide-react';
import type { Account } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTradingData } from '@/hooks/useTradingData';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface AggregatedStats {
  totalBalance: number;
  totalEquity: number;
  totalPnl: number;
  totalPnlPercent: number;
  accountCount: number;
  demoCount: number;
  liveCount: number;
  currencyBreakdown: { currency: string; balance: number; count: number }[];
  typeBreakdown: { type: string; balance: number; count: number }[];
}

export const MultiAccountDashboard = () => {
  const { 
    accounts, 
    selectedAccountId, 
    setSelectedAccountId, 
    addAccount,
    isAuthorized,
    isConnected,
    positions
  } = useTradingData();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    appId: '',
    token: '',
    type: 'demo' as 'demo' | 'live'
  });

  // Calculate aggregated statistics
  const aggregatedStats = useMemo((): AggregatedStats => {
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const totalEquity = accounts.reduce((sum, acc) => sum + (acc.equity || 0), 0);
    const totalPnl = totalEquity - totalBalance;
    const totalPnlPercent = totalBalance > 0 ? (totalPnl / totalBalance) * 100 : 0;
    
    const demoAccounts = accounts.filter(acc => acc.type === 'demo');
    const liveAccounts = accounts.filter(acc => acc.type === 'live');
    
    // Group by currency
    const currencyMap = new Map<string, { balance: number; count: number }>();
    accounts.forEach(acc => {
      const curr = acc.currency || 'USD';
      const existing = currencyMap.get(curr) || { balance: 0, count: 0 };
      currencyMap.set(curr, {
        balance: existing.balance + (acc.balance || 0),
        count: existing.count + 1
      });
    });
    
    const currencyBreakdown = Array.from(currencyMap.entries()).map(([currency, data]) => ({
      currency,
      ...data
    }));
    
    const typeBreakdown = [
      { type: 'Demo', balance: demoAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0), count: demoAccounts.length },
      { type: 'Live', balance: liveAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0), count: liveAccounts.length }
    ].filter(t => t.count > 0);
    
    return {
      totalBalance,
      totalEquity,
      totalPnl,
      totalPnlPercent,
      accountCount: accounts.length,
      demoCount: demoAccounts.length,
      liveCount: liveAccounts.length,
      currencyBreakdown,
      typeBreakdown
    };
  }, [accounts]);

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.appId || !newAccount.token) return;
    
    addAccount({
      appId: newAccount.appId,
      token: newAccount.token
    });
    
    setNewAccount({ name: '', appId: '', token: '', type: 'demo' });
    setShowAddForm(false);
  };

  const selectedAccount = accounts.find(acc => acc.id === selectedAccountId);
  const safePositions = Array.isArray(positions) ? positions : [];

  return (
    <div className="space-y-6">
      {/* Aggregated Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Wallet className="w-4 h-4" />
              Total Balance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">
              ${aggregatedStats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Across {aggregatedStats.accountCount} account{aggregatedStats.accountCount !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-2/10 to-chart-2/5 border-chart-2/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Equity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold font-mono",
              aggregatedStats.totalPnl >= 0 ? "text-success" : "text-destructive"
            )}>
              ${aggregatedStats.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {aggregatedStats.totalPnl >= 0 ? '+' : ''}{aggregatedStats.totalPnlPercent.toFixed(2)}% overall
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-3/10 to-chart-3/5 border-chart-3/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Unrealized P&L
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold font-mono",
              aggregatedStats.totalPnl >= 0 ? "text-success" : "text-destructive"
            )}>
              {aggregatedStats.totalPnl >= 0 ? '+' : ''}${aggregatedStats.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {safePositions.length} open position{safePositions.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-chart-4/10 to-chart-4/5 border-chart-4/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Account Types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div>
                <p className="text-2xl font-bold">{aggregatedStats.liveCount}</p>
                <p className="text-xs text-muted-foreground">Live</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-2xl font-bold">{aggregatedStats.demoCount}</p>
                <p className="text-xs text-muted-foreground">Demo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="accounts" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="accounts" className="gap-2">
              <Wallet className="w-4 h-4" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="breakdown" className="gap-2">
              <PieChart className="w-4 h-4" />
              Breakdown
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Comparison
            </TabsTrigger>
          </TabsList>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-2"
          >
            {showAddForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Account</>}
          </Button>
        </div>

        {/* Add Account Form */}
        {showAddForm && (
          <Card className="animate-in fade-in slide-in-from-top-4">
            <CardHeader>
              <CardTitle className="text-lg">Add New Account</CardTitle>
              <CardDescription>Connect a new Deriv trading account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account Name</label>
                  <input
                    type="text"
                    placeholder="e.g. My Real Account"
                    value={newAccount.name}
                    onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Account Type</label>
                  <select
                    value={newAccount.type}
                    onChange={e => setNewAccount({ ...newAccount, type: e.target.value as 'demo' | 'live' })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="demo">Demo</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">App ID</label>
                  <input
                    type="text"
                    placeholder="App ID from Deriv"
                    value={newAccount.appId}
                    onChange={e => setNewAccount({ ...newAccount, appId: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Token</label>
                  <input
                    type="password"
                    placeholder="API Token from Deriv"
                    value={newAccount.token}
                    onChange={e => setNewAccount({ ...newAccount, token: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full gap-2">
                    <Plus className="w-4 h-4" /> Connect Account
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Accounts List Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accounts.map((account) => {
              const isSelected = account.id === selectedAccountId;
              const pnl = (account.equity || 0) - (account.balance || 0);
              const pnlPercent = (account.balance || 0) > 0 ? (pnl / account.balance) * 100 : 0;
              const balanceShare = aggregatedStats.totalBalance > 0 
                ? ((account.balance || 0) / aggregatedStats.totalBalance) * 100 
                : 0;

              return (
                <Card
                  key={account.id}
                  className={cn(
                    "cursor-pointer transition-all duration-200 hover:shadow-md",
                    isSelected && "ring-2 ring-primary border-primary"
                  )}
                  onClick={() => setSelectedAccountId(account.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-base">{account.name}</CardTitle>
                          <CardDescription className="font-mono text-xs">
                            {account.currency} • {account.id}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={account.type === 'demo' ? 'secondary' : 'default'}>
                          {account.type}
                        </Badge>
                        {isSelected && isAuthorized && (
                          <Badge variant="outline" className="text-success border-success">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
                        <p className="font-mono text-lg font-semibold">
                          ${(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Equity</p>
                        <p className={cn(
                          "font-mono text-lg font-semibold",
                          pnl >= 0 ? "text-success" : "text-destructive"
                        )}>
                          ${(account.equity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Portfolio Share</span>
                        <span className="font-mono">{balanceShare.toFixed(1)}%</span>
                      </div>
                      <Progress value={balanceShare} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">Session P&L</span>
                      <div className={cn(
                        "flex items-center gap-1 text-sm font-mono font-semibold",
                        pnl >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {accounts.length === 0 && (
            <Card className="py-12">
              <CardContent className="text-center">
                <Wallet className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No Accounts Connected</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Add your first Deriv account to get started
                </p>
                <Button onClick={() => setShowAddForm(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Add Account
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Balance by Type */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Balance by Account Type</CardTitle>
                <CardDescription>Distribution of funds across demo and live accounts</CardDescription>
              </CardHeader>
              <CardContent>
                {aggregatedStats.typeBreakdown.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={aggregatedStats.typeBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="balance"
                          nameKey="type"
                          label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {aggregatedStats.typeBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Balance by Currency */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Balance by Currency</CardTitle>
                <CardDescription>Holdings breakdown by currency type</CardDescription>
              </CardHeader>
              <CardContent>
                {aggregatedStats.currencyBreakdown.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={aggregatedStats.currencyBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          dataKey="balance"
                          nameKey="currency"
                          label={({ currency, percent }) => `${currency}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {aggregatedStats.currencyBreakdown.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [`$${value.toLocaleString()}`, 'Balance']}
                        />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account Balance Comparison</CardTitle>
              <CardDescription>Compare balances and equity across all accounts</CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={accounts.map(acc => ({
                        name: acc.name.length > 15 ? acc.name.substring(0, 15) + '...' : acc.name,
                        balance: acc.balance || 0,
                        equity: acc.equity || 0,
                        pnl: (acc.equity || 0) - (acc.balance || 0)
                      }))}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <XAxis 
                        dataKey="name" 
                        angle={-45} 
                        textAnchor="end"
                        height={60}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${value.toLocaleString()}`}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
                          name.charAt(0).toUpperCase() + name.slice(1)
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="balance" name="Balance" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="equity" name="Equity" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  No accounts to compare
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Performance Summary</CardTitle>
              <CardDescription>Detailed performance metrics for each account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Account</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Balance</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Equity</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">P&L</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">P&L %</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => {
                      const pnl = (account.equity || 0) - (account.balance || 0);
                      const pnlPercent = (account.balance || 0) > 0 ? (pnl / account.balance) * 100 : 0;
                      const share = aggregatedStats.totalBalance > 0 
                        ? ((account.balance || 0) / aggregatedStats.totalBalance) * 100 
                        : 0;

                      return (
                        <tr 
                          key={account.id} 
                          className={cn(
                            "border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors",
                            account.id === selectedAccountId && "bg-primary/5"
                          )}
                          onClick={() => setSelectedAccountId(account.id)}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {account.id === selectedAccountId && (
                                <CheckCircle2 className="w-4 h-4 text-primary" />
                              )}
                              <span className="font-medium">{account.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={account.type === 'demo' ? 'secondary' : 'default'} className="text-xs">
                              {account.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            ${(account.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            ${(account.equity || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={cn(
                            "py-3 px-4 text-right font-mono",
                            pnl >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {pnl >= 0 ? '+' : ''}${pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                          <td className={cn(
                            "py-3 px-4 text-right font-mono",
                            pnl >= 0 ? "text-success" : "text-destructive"
                          )}>
                            {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            {share.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                    {accounts.length > 0 && (
                      <tr className="bg-muted/30 font-semibold">
                        <td className="py-3 px-4" colSpan={2}>Total</td>
                        <td className="py-3 px-4 text-right font-mono">
                          ${aggregatedStats.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          ${aggregatedStats.totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-right font-mono",
                          aggregatedStats.totalPnl >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {aggregatedStats.totalPnl >= 0 ? '+' : ''}${aggregatedStats.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className={cn(
                          "py-3 px-4 text-right font-mono",
                          aggregatedStats.totalPnl >= 0 ? "text-success" : "text-destructive"
                        )}>
                          {aggregatedStats.totalPnl >= 0 ? '+' : ''}{aggregatedStats.totalPnlPercent.toFixed(2)}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono">100%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
