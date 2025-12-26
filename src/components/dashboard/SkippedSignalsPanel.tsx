import { AlertTriangle, TrendingDown, Clock, Target, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SkippedSignal {
  tick_count: number;
  reason: string;
  symbol: string;
  atr: number;
  confidence: number;
  regime: string;
  volatility: string;
  timestamp: string;
}

interface SkippedSignalsProps {
  signals: SkippedSignal[];
}

const reasonConfig = {
  'Volatility Filter Blocked': { icon: BarChart3, color: 'text-warning' },
  'EntryValidator Rejected': { icon: Target, color: 'text-destructive' },
  'Low Confidence': { icon: TrendingDown, color: 'text-muted-foreground' },
  'Risk Guard Blocked': { icon: AlertTriangle, color: 'text-destructive' },
  'Cooldown Manager': { icon: Clock, color: 'text-neutral' },
  'default': { icon: AlertTriangle, color: 'text-muted-foreground' }
};

export const SkippedSignalsPanel = ({ signals }: SkippedSignalsProps) => {
  const getReasonConfig = (reason: string) => {
    for (const key in reasonConfig) {
      if (reason.includes(key)) {
        return reasonConfig[key as keyof typeof reasonConfig];
      }
    }
    return reasonConfig.default;
  };

  return (
    <div className="glass-card p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h3 className="font-semibold text-foreground">Skipped Signals Analysis</h3>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {signals.length} signals
        </span>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
        {signals.length === 0 ? (
          <p className="text-muted-foreground text-sm">No signals skipped yet...</p>
        ) : (
          signals.slice().reverse().map((signal, index) => {
            const config = getReasonConfig(signal.reason);
            const Icon = config.icon;

            return (
              <div
                key={`${signal.tick_count}-${index}`}
                className={cn(
                  "p-3 rounded-lg border bg-card/50 animate-fade-in",
                  "hover:bg-card/80 transition-colors"
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className={cn("w-4 h-4 mt-0.5 shrink-0", config.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">
                        #{signal.tick_count}
                      </span>
                      <span className="text-xs font-mono text-accent">
                        {signal.symbol}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-foreground break-all mb-2">
                      {signal.reason}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>ATR: {signal.atr.toFixed(6)}</span>
                      <span>Conf: {(signal.confidence * 100).toFixed(1)}%</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full",
                        signal.regime === 'trending' && "bg-success/20 text-success",
                        signal.regime === 'ranging' && "bg-warning/20 text-warning",
                        signal.regime === 'volatile' && "bg-destructive/20 text-destructive"
                      )}>
                        {signal.regime}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full",
                        signal.volatility === 'low' && "bg-neutral/20 text-neutral",
                        signal.volatility === 'medium' && "bg-warning/20 text-warning",
                        signal.volatility === 'high' && "bg-destructive/20 text-destructive"
                      )}>
                        {signal.volatility}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
