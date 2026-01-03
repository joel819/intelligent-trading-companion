import { useState, useMemo, useEffect } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  PieChart,
  BarChart3,
  CheckCircle2,
  Circle,
  Plus,
  Tag,
  FolderPlus,
  X,
  Filter,
  Palette,
  Edit2,
  Trash2,
  Tags
} from 'lucide-react';
import type { Account } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

const LABEL_COLORS = [
  { name: 'Blue', value: 'bg-blue-500' },
  { name: 'Green', value: 'bg-green-500' },
  { name: 'Yellow', value: 'bg-yellow-500' },
  { name: 'Red', value: 'bg-red-500' },
  { name: 'Purple', value: 'bg-purple-500' },
  { name: 'Pink', value: 'bg-pink-500' },
  { name: 'Orange', value: 'bg-orange-500' },
  { name: 'Teal', value: 'bg-teal-500' },
];

interface AccountLabel {
  id: string;
  name: string;
  color: string;
}

interface AccountGroup {
  id: string;
  name: string;
  accountIds: string[];
}

interface AccountLabelsMap {
  [accountId: string]: string[]; // array of label ids
}

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
    type: 'demo' as 'demo' | 'live' | 'real'
  });

  // Labels and Groups State (persisted to localStorage)
  const [labels, setLabels] = useState<AccountLabel[]>(() => {
    const saved = localStorage.getItem('account-labels');
    return saved ? JSON.parse(saved) : [
      { id: 'high-risk', name: 'High Risk', color: 'bg-red-500' },
      { id: 'low-risk', name: 'Low Risk', color: 'bg-green-500' },
      { id: 'scalping', name: 'Scalping', color: 'bg-blue-500' },
    ];
  });

  const [groups, setGroups] = useState<AccountGroup[]>(() => {
    const saved = localStorage.getItem('account-groups');
    return saved ? JSON.parse(saved) : [];
  });

  const [accountLabels, setAccountLabels] = useState<AccountLabelsMap>(() => {
    const saved = localStorage.getItem('account-labels-map');
    return saved ? JSON.parse(saved) : {};
  });

  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('bg-blue-500');
  const [newGroupName, setNewGroupName] = useState('');
  const [editingLabel, setEditingLabel] = useState<AccountLabel | null>(null);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('account-labels', JSON.stringify(labels));
  }, [labels]);

  useEffect(() => {
    localStorage.setItem('account-groups', JSON.stringify(groups));
  }, [groups]);

  useEffect(() => {
    localStorage.setItem('account-labels-map', JSON.stringify(accountLabels));
  }, [accountLabels]);

  // Label management functions
  const addLabel = () => {
    if (!newLabelName.trim()) return;
    const id = `label-${Date.now()}`;
    setLabels([...labels, { id, name: newLabelName.trim(), color: newLabelColor }]);
    setNewLabelName('');
    setNewLabelColor('bg-blue-500');
  };

  const updateLabel = (label: AccountLabel) => {
    setLabels(labels.map(l => l.id === label.id ? label : l));
    setEditingLabel(null);
  };

  const deleteLabel = (labelId: string) => {
    setLabels(labels.filter(l => l.id !== labelId));
    // Remove from all accounts
    const updated = { ...accountLabels };
    Object.keys(updated).forEach(accId => {
      updated[accId] = updated[accId].filter(id => id !== labelId);
    });
    setAccountLabels(updated);
    if (filterLabel === labelId) setFilterLabel(null);
  };

  const toggleLabelOnAccount = (accountId: string, labelId: string) => {
    const current = accountLabels[accountId] || [];
    const updated = current.includes(labelId)
      ? current.filter(id => id !== labelId)
      : [...current, labelId];
    setAccountLabels({ ...accountLabels, [accountId]: updated });
  };

  // Group management functions
  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const id = `group-${Date.now()}`;
    setGroups([...groups, { id, name: newGroupName.trim(), accountIds: [] }]);
    setNewGroupName('');
  };

  const deleteGroup = (groupId: string) => {
    setGroups(groups.filter(g => g.id !== groupId));
    if (filterGroup === groupId) setFilterGroup(null);
  };

  const toggleAccountInGroup = (groupId: string, accountId: string) => {
    setGroups(groups.map(g => {
      if (g.id !== groupId) return g;
      const hasAccount = g.accountIds.includes(accountId);
      return {
        ...g,
        accountIds: hasAccount
          ? g.accountIds.filter(id => id !== accountId)
          : [...g.accountIds, accountId]
      };
    }));
  };

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    let result = accounts;

    if (filterLabel) {
      result = result.filter(acc =>
        (accountLabels[acc.id] || []).includes(filterLabel)
      );
    }

    if (filterGroup) {
      const group = groups.find(g => g.id === filterGroup);
      if (group) {
        result = result.filter(acc => group.accountIds.includes(acc.id));
      }
    }

    return result;
  }, [accounts, filterLabel, filterGroup, accountLabels, groups]);

  // Calculate aggregated statistics
  const aggregatedStats = useMemo((): AggregatedStats => {
    const targetAccounts = filteredAccounts;
    const totalBalance = targetAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    const totalEquity = targetAccounts.reduce((sum, acc) => sum + (acc.equity || 0), 0);
    const totalPnl = totalEquity - totalBalance;
    const totalPnlPercent = totalBalance > 0 ? (totalPnl / totalBalance) * 100 : 0;

    const demoAccounts = targetAccounts.filter(acc => acc.type === 'demo');
    const liveAccounts = targetAccounts.filter(acc => acc.type === 'live' || acc.type === 'real');

    // Group by currency
    const currencyMap = new Map<string, { balance: number; count: number }>();
    targetAccounts.forEach(acc => {
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
      accountCount: targetAccounts.length,
      demoCount: demoAccounts.length,
      liveCount: liveAccounts.length,
      currencyBreakdown,
      typeBreakdown
    };
  }, [filteredAccounts]);

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
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList>
            <TabsTrigger value="accounts" className="gap-2">
              <Wallet className="w-4 h-4" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="labels" className="gap-2">
              <Tags className="w-4 h-4" />
              Labels & Groups
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

          <div className="flex items-center gap-2">
            {/* Filter by Label */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-4 h-4" />
                  {filterLabel ? labels.find(l => l.id === filterLabel)?.name : 'Filter'}
                  {filterLabel && (
                    <X
                      className="w-3 h-3 ml-1"
                      onClick={(e) => { e.stopPropagation(); setFilterLabel(null); }}
                    />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Filter by Label</p>
                  {labels.map(label => (
                    <button
                      key={label.id}
                      onClick={() => setFilterLabel(filterLabel === label.id ? null : label.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                        filterLabel === label.id ? "bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <div className={cn("w-3 h-3 rounded-full", label.color)} />
                      {label.name}
                    </button>
                  ))}
                  {labels.length === 0 && (
                    <p className="text-xs text-muted-foreground px-2 py-2">No labels created</p>
                  )}
                  <div className="border-t border-border mt-2 pt-2">
                    <p className="text-xs font-medium text-muted-foreground px-2 py-1">Filter by Group</p>
                    {groups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => setFilterGroup(filterGroup === group.id ? null : group.id)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                          filterGroup === group.id ? "bg-primary/10" : "hover:bg-muted"
                        )}
                      >
                        <FolderPlus className="w-3 h-3" />
                        {group.name}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {group.accountIds.length}
                        </span>
                      </button>
                    ))}
                    {groups.length === 0 && (
                      <p className="text-xs text-muted-foreground px-2 py-2">No groups created</p>
                    )}
                  </div>
                  {(filterLabel || filterGroup) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => { setFilterLabel(null); setFilterGroup(null); }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="gap-2"
            >
              {showAddForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Account</>}
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {(filterLabel || filterGroup) && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Filtering:</span>
            {filterLabel && (
              <Badge variant="secondary" className="gap-1">
                <div className={cn("w-2 h-2 rounded-full", labels.find(l => l.id === filterLabel)?.color)} />
                {labels.find(l => l.id === filterLabel)?.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterLabel(null)} />
              </Badge>
            )}
            {filterGroup && (
              <Badge variant="secondary" className="gap-1">
                <FolderPlus className="w-3 h-3" />
                {groups.find(g => g.id === filterGroup)?.name}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterGroup(null)} />
              </Badge>
            )}
          </div>
        )}

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
                    <option value="real">Real</option>
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
            {filteredAccounts.map((account) => {
              const accLabels = (accountLabels[account.id] || []).map(id => labels.find(l => l.id === id)).filter(Boolean) as AccountLabel[];
              const accGroups = groups.filter(g => g.accountIds.includes(account.id));
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
                          {account.type === 'real' || account.type === 'live' ? 'Live' : 'Demo'}
                        </Badge>
                        {isSelected && isAuthorized && (
                          <Badge variant="outline" className="text-success border-success">
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Labels on account */}
                    {accLabels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {accLabels.map(label => (
                          <span
                            key={label.id}
                            className={cn("px-2 py-0.5 rounded-full text-xs text-white", label.color)}
                          >
                            {label.name}
                          </span>
                        ))}
                      </div>
                    )}
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

                    {/* Label/Group Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs h-7"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Tag className="w-3 h-3" />
                            Labels
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            {labels.map(label => (
                              <button
                                key={label.id}
                                onClick={() => toggleLabelOnAccount(account.id, label.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                                  (accountLabels[account.id] || []).includes(label.id) ? "bg-primary/10" : "hover:bg-muted"
                                )}
                              >
                                <div className={cn("w-3 h-3 rounded-full", label.color)} />
                                {label.name}
                                {(accountLabels[account.id] || []).includes(label.id) && (
                                  <CheckCircle2 className="w-3 h-3 ml-auto text-primary" />
                                )}
                              </button>
                            ))}
                            {labels.length === 0 && (
                              <p className="text-xs text-muted-foreground px-2 py-2">No labels. Create in Labels tab.</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs h-7"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FolderPlus className="w-3 h-3" />
                            Groups
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2" align="start" onClick={(e) => e.stopPropagation()}>
                          <div className="space-y-1">
                            {groups.map(group => (
                              <button
                                key={group.id}
                                onClick={() => toggleAccountInGroup(group.id, account.id)}
                                className={cn(
                                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors",
                                  group.accountIds.includes(account.id) ? "bg-primary/10" : "hover:bg-muted"
                                )}
                              >
                                <FolderPlus className="w-3 h-3" />
                                {group.name}
                                {group.accountIds.includes(account.id) && (
                                  <CheckCircle2 className="w-3 h-3 ml-auto text-primary" />
                                )}
                              </button>
                            ))}
                            {groups.length === 0 && (
                              <p className="text-xs text-muted-foreground px-2 py-2">No groups. Create in Labels tab.</p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
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

        {/* Labels & Groups Tab */}
        <TabsContent value="labels" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Labels Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Labels
                </CardTitle>
                <CardDescription>Create color-coded labels to categorize your accounts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create new label */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Label name..."
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addLabel()}
                  />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="icon" className="shrink-0">
                        <div className={cn("w-4 h-4 rounded-full", newLabelColor)} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2" align="end">
                      <div className="grid grid-cols-4 gap-1">
                        {LABEL_COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setNewLabelColor(color.value)}
                            className={cn(
                              "w-8 h-8 rounded-full transition-transform hover:scale-110",
                              color.value,
                              newLabelColor === color.value && "ring-2 ring-offset-2 ring-foreground"
                            )}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <Button onClick={addLabel} disabled={!newLabelName.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Labels list */}
                <div className="space-y-2">
                  {labels.map((label) => {
                    const accountCount = Object.values(accountLabels).filter(ids => ids.includes(label.id)).length;

                    return (
                      <div
                        key={label.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group"
                      >
                        <div className={cn("w-4 h-4 rounded-full shrink-0", label.color)} />
                        {editingLabel?.id === label.id ? (
                          <Input
                            value={editingLabel.name}
                            onChange={(e) => setEditingLabel({ ...editingLabel, name: e.target.value })}
                            onBlur={() => updateLabel(editingLabel)}
                            onKeyDown={(e) => e.key === 'Enter' && updateLabel(editingLabel)}
                            className="flex-1 h-7"
                            autoFocus
                          />
                        ) : (
                          <span className="flex-1 text-sm font-medium">{label.name}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {accountCount} account{accountCount !== 1 ? 's' : ''}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingLabel(label)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => deleteLabel(label.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {labels.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Tag className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No labels created yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Groups Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FolderPlus className="w-5 h-5" />
                  Groups
                </CardTitle>
                <CardDescription>Organize accounts into groups for easier management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Create new group */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Group name..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && addGroup()}
                  />
                  <Button onClick={addGroup} disabled={!newGroupName.trim()}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {/* Groups list */}
                <div className="space-y-2">
                  {groups.map((group) => (
                    <div
                      key={group.id}
                      className="p-3 rounded-lg bg-muted/50 space-y-3"
                    >
                      <div className="flex items-center gap-3 group">
                        <FolderPlus className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1 text-sm font-medium">{group.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {group.accountIds.length} account{group.accountIds.length !== 1 ? 's' : ''}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteGroup(group.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      {/* Accounts in group */}
                      <div className="flex flex-wrap gap-1">
                        {accounts.map((account) => (
                          <button
                            key={account.id}
                            onClick={() => toggleAccountInGroup(group.id, account.id)}
                            className={cn(
                              "px-2 py-1 rounded text-xs transition-colors",
                              group.accountIds.includes(account.id)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted hover:bg-muted/80"
                            )}
                          >
                            {account.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {groups.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <FolderPlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No groups created yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Assignment Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Label Assignment</CardTitle>
              <CardDescription>Quickly assign labels to all your accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Account</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                      {labels.map(label => (
                        <th key={label.id} className="text-center py-3 px-4 font-medium">
                          <div className="flex items-center justify-center gap-1">
                            <div className={cn("w-3 h-3 rounded-full", label.color)} />
                            <span className="text-xs">{label.name}</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account.id} className="border-b border-border/50 hover:bg-muted/50">
                        <td className="py-3 px-4 font-medium">{account.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant={account.type === 'demo' ? 'secondary' : 'default'} className="text-xs">
                            {account.type}
                          </Badge>
                        </td>
                        {labels.map(label => (
                          <td key={label.id} className="py-3 px-4 text-center">
                            <button
                              onClick={() => toggleLabelOnAccount(account.id, label.id)}
                              className={cn(
                                "w-6 h-6 rounded border-2 transition-colors mx-auto flex items-center justify-center",
                                (accountLabels[account.id] || []).includes(label.id)
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/30 hover:border-primary/50"
                              )}
                            >
                              {(accountLabels[account.id] || []).includes(label.id) && (
                                <CheckCircle2 className="w-4 h-4 text-primary-foreground" />
                              )}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {accounts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No accounts to assign labels to
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
