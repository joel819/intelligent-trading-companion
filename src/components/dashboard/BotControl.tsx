import { Power, Clock, Activity, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BotStatus } from '@/types/trading';
import { cn } from '@/lib/utils';

interface BotControlProps {
  status: BotStatus;
  onToggle: () => void;
}

const formatUptime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

export const BotControl = ({ status, onToggle }: BotControlProps) => {
  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">Bot Control</h3>
        <div className={cn(
          "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
          status.isRunning ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full",
            status.isRunning ? "bg-success animate-pulse" : "bg-destructive"
          )} />
          {status.isRunning ? 'Running' : 'Stopped'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Zap className="w-3 h-3" />
            Strategy
          </div>
          <p className="font-medium text-sm">{status.strategy}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Clock className="w-3 h-3" />
            Uptime
          </div>
          <p className="font-mono text-sm">{formatUptime(status.uptime)}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Activity className="w-3 h-3" />
            Trades Today
          </div>
          <p className="font-mono text-sm">{status.tradesExecuted}</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            P&L Today
          </div>
          <p className={cn(
            "font-mono text-sm font-semibold",
            status.profitToday >= 0 ? "text-success" : "text-destructive"
          )}>
            {status.profitToday >= 0 ? '+' : ''}${status.profitToday.toFixed(2)}
          </p>
        </div>
      </div>

      <Button
        onClick={onToggle}
        variant={status.isRunning ? "destructive" : "success"}
        className="w-full"
        size="lg"
      >
        <Power className="w-4 h-4 mr-2" />
        {status.isRunning ? 'Stop Bot' : 'Start Bot'}
      </Button>
    </div>
  );
};
