import { Wallet, TrendingUp, TrendingDown, ExternalLink, Plus, Trash2, ShieldCheck } from 'lucide-react';
import type { Account } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTradingData } from '@/hooks/useTradingData';

interface AccountsListProps {
  accounts: Account[];
  selectedAccountId: string;
  onSelect: (id: string) => void;
}

export const AccountsList = ({ accounts, selectedAccountId, onSelect }: AccountsListProps) => {
  const { addAccount, removeAccount, accountsMetadata, authError, isAuthorized, isConnected } = useTradingData();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: '',
    appId: '',
    token: '',
    type: 'demo' as 'demo' | 'live'
  });

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.name || !newAccount.appId || !newAccount.token) return;

    addAccount({
      id: `acc-${Date.now()}`,
      name: newAccount.name,
      appId: newAccount.appId,
      token: newAccount.token,
      type: newAccount.type
    });

    setNewAccount({ name: '', appId: '', token: '', type: 'demo' });
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Trading Accounts</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="gap-2"
          >
            {showAddForm ? 'Cancel' : <><Plus className="w-4 h-4" /> Add Account</>}
          </Button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddAccount} className="mb-6 p-4 rounded-lg bg-secondary/30 border border-border space-y-4 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="acc-name">Account Name</Label>
                <Input
                  id="acc-name"
                  placeholder="e.g. My Real Account"
                  value={newAccount.name}
                  onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-type">Account Type</Label>
                <select
                  id="acc-type"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={newAccount.type}
                  onChange={e => setNewAccount({ ...newAccount, type: e.target.value as 'demo' | 'live' })}
                >
                  <option value="demo">Demo</option>
                  <option value="live">Live</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-appid">App ID</Label>
                <Input
                  id="acc-appid"
                  placeholder="App ID from Deriv"
                  value={newAccount.appId}
                  onChange={e => setNewAccount({ ...newAccount, appId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acc-token">API Token</Label>
                <Input
                  id="acc-token"
                  type="password"
                  placeholder="API Token from Deriv"
                  value={newAccount.token}
                  onChange={e => setNewAccount({ ...newAccount, token: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" className="w-full gap-2">
              <Plus className="w-4 h-4" /> Save Account
            </Button>
          </form>
        )}

        <div className="space-y-3">
          {accounts.map((account) => {
            const isSelected = account.id === selectedAccountId;
            const pnl = account.equity - account.balance;
            const pnlPercent = account.balance > 0 ? (pnl / account.balance) * 100 : 0;
            const isCustom = accountsMetadata.some(m => m.id === account.id && m.id !== 'default-demo');

            return (
              <div
                key={account.id}
                onClick={() => onSelect(account.id)}
                className={cn(
                  "p-4 rounded-lg cursor-pointer transition-all duration-200 border relative group",
                  isSelected
                    ? "bg-primary/10 border-primary/50 shadow-sm"
                    : "bg-secondary/20 border-transparent hover:border-border"
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-foreground">{account.name}</h4>
                      <Badge variant={account.type === 'demo' ? 'secondary' : 'default'}>
                        {account.type}
                      </Badge>
                      {isSelected && isAuthorized && <ShieldCheck className="w-4 h-4 text-success" />}
                      {isSelected && !isAuthorized && !authError && <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 font-mono uppercase">
                      {account.currency} Account {isCustom ? '(Local)' : ''}
                    </p>

                    {isSelected && authError && (
                      <div className="mt-2 text-[10px] text-destructive font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                        Auth Failed: {authError}
                      </div>
                    )}

                    {isSelected && !isAuthorized && !authError && isConnected && (
                      <div className="mt-2 text-[10px] text-muted-foreground animate-pulse">
                        Authorizing...
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {isCustom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeAccount(account.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Balance</p>
                    <p className="font-mono text-sm font-semibold">
                      ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Equity</p>
                    <p className={cn(
                      "font-mono text-sm font-semibold",
                      pnl >= 0 ? "text-success" : "text-destructive"
                    )}>
                      ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>

                {isSelected && isAuthorized && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground uppercase">Session P&L</span>
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-mono font-semibold",
                        pnl >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
