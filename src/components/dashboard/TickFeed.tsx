import { Activity } from 'lucide-react';
import type { Tick } from '@/types/trading';
import { cn } from '@/lib/utils';

interface TickFeedProps {
  ticks?: Tick[];
}

export const TickFeed = ({ ticks = [] }: TickFeedProps) => {
  return (
    <div className="glass-card p-5 animate-fade-in h-full">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Live Ticks</h3>
        <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
        {ticks.length === 0 ? (
          <p className="text-muted-foreground text-sm">Waiting for ticks...</p>
        ) : (
          ticks.slice(0, 15).map((tick, index) => (
            <div
              key={`${tick.timestamp}-${index}`}
              className={cn(
                "flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50 text-sm",
                index === 0 && "animate-fade-in ring-1 ring-primary/30"
              )}
            >
              <span className="font-medium">{tick.symbol}</span>
              <div className="flex items-center gap-4 font-mono text-xs">
                <span className="text-success">{(tick.bid || 0).toFixed(tick.symbol.includes('JPY') ? 3 : 5)}</span>
                <span className="text-destructive">{(tick.ask || 0).toFixed(tick.symbol.includes('JPY') ? 3 : 5)}</span>
                <span className="text-muted-foreground w-16 text-right">
                  {new Date(tick.timestamp).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
