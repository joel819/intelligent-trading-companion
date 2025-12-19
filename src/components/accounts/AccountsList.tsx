import { Wallet, TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';
import type { Account } from '@/types/trading';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface AccountsListProps {
  accounts: Account[];
  selectedAccountId: string;
  onSelect: (id: string) => void;
}

export const AccountsList = ({ accounts, selectedAccountId, onSelect }: AccountsListProps) => {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Trading Accounts</h3>
      </div>

      <div className="space-y-3">
        {accounts.map((account) => {
          const isSelected = account.id === selectedAccountId;
          const pnl = account.equity - account.balance;
          const pnlPercent = (pnl / account.balance) * 100;

          return (
            <div
              key={account.id}
              onClick={() => onSelect(account.id)}
              className={cn(
                "p-4 rounded-lg cursor-pointer transition-all duration-200 border",
                isSelected 
                  ? "bg-primary/10 border-primary/50" 
                  : "bg-secondary/50 border-transparent hover:border-border"
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-foreground">{account.name}</h4>
                    <Badge variant={account.type === 'demo' ? 'secondary' : 'default'}>
                      {account.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{account.currency} Account</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-mono font-semibold">
                    ${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Equity</p>
                  <p className={cn(
                    "font-mono font-semibold",
                    pnl >= 0 ? "text-success" : "text-destructive"
                  )}>
                    ${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Session P&L</span>
                  <div className={cn(
                    "flex items-center gap-1 text-sm font-mono font-semibold",
                    pnl >= 0 ? "text-success" : "text-destructive"
                  )}>
                    {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {pnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
