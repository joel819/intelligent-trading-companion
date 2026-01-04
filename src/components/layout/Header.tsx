import { Bell, User, Wifi, WifiOff, Search, Settings, Loader2, ArrowLeftRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Account, Notification } from '@/types/trading';

interface HeaderProps {
  accounts: Account[];
  selectedAccountId: string;
  onAccountChange: (id: string) => void;
  notifications: Notification[];
  onNotificationsClick: () => void;
  isConnected: boolean;
  onToggleAccountType?: () => void;
}

export const Header = ({
  accounts,
  selectedAccountId,
  onAccountChange,
  notifications,
  onNotificationsClick,
  isConnected,
  onToggleAccountType
}: HeaderProps) => {
  const unreadCount = notifications.filter(n => !n.read).length;
  // const { isConnected } = useDeriv(); // Removed
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <header className="fixed top-0 right-0 left-16 md:left-56 z-30 h-16 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 md:px-6">
      {/* Left: Account Selector and Search */}
      <div className="flex items-center gap-4">
        <Select value={selectedAccountId} onValueChange={onAccountChange}>
          <SelectTrigger className="w-[180px] bg-secondary border-border">
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                <div className="flex items-center gap-2">
                  <span>{account.name}</span>
                  <Badge variant={account.type === 'demo' ? 'secondary' : 'default'} className="text-xs">
                    {account.type}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {onToggleAccountType && (
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleAccountType}
            className={cn(
              "gap-2 hidden lg:flex border-border/50 transition-all duration-300",
              selectedAccount?.type === 'demo'
                ? "hover:bg-primary/10 hover:border-primary/50 text-muted-foreground"
                : "bg-success/5 border-success/30 hover:bg-success/10 text-success font-semibold"
            )}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            {selectedAccount?.type === 'demo' ? 'Switch to Real' : 'Switch to Demo'}
            {selectedAccount?.type === 'real' && <Shield className="w-3 h-3 fill-success/20" />}
          </Button>
        )}

        {selectedAccount && (
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Balance:</span>
              <span className="ml-2 font-mono font-semibold text-foreground">
                ${selectedAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Equity:</span>
              <span className={`ml-2 font-mono font-semibold ${selectedAccount.equity >= selectedAccount.balance ? 'text-success' : 'text-destructive'
                }`}>
                ${selectedAccount.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Right: Connection + Notifications + User */}
      <div className="flex items-center gap-3">
        {/* Connection Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary">
          {!isConnected ? (
            <>
              <WifiOff className="w-4 h-4 text-destructive" />
              <span className="text-xs font-medium text-destructive hidden sm:inline">Offline</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4 text-success" />
              <span className="text-xs font-medium text-success hidden sm:inline">Online</span>
            </>
          )}
        </div>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={onNotificationsClick}
        >
          <Bell className={unreadCount > 0 ? "w-5 h-5 text-destructive animate-pulse" : "w-5 h-5"} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>

        {/* User */}
        <Button variant="ghost" size="icon">
          <User className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
};
