import { Terminal, Info, AlertTriangle, XCircle, CheckCircle } from 'lucide-react';
import type { LogEntry } from '@/types/trading';
import { cn } from '@/lib/utils';

interface LogsStreamProps {
  logs: LogEntry[];
}

const levelConfig = {
  info: { icon: Info, color: 'text-neutral', bg: 'bg-neutral/10' },
  warn: { icon: AlertTriangle, color: 'text-warning', bg: 'bg-warning/10' },
  error: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  success: { icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
};

export const LogsStream = ({ logs }: LogsStreamProps) => {
  return (
    <div className="glass-card p-5 animate-fade-in h-full">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">System Logs</h3>
      </div>
      
      <div className="space-y-1.5 max-h-[400px] overflow-y-auto scrollbar-thin font-mono text-xs">
        {logs.length === 0 ? (
          <p className="text-muted-foreground">No logs yet...</p>
        ) : (
          logs.map((log, index) => {
            const config = levelConfig[log.level];
            const Icon = config.icon;
            
            return (
              <div 
                key={log.id}
                className={cn(
                  "flex items-start gap-2 py-1.5 px-2 rounded",
                  index === 0 && "animate-fade-in",
                  config.bg
                )}
              >
                <Icon className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", config.color)} />
                <span className="text-muted-foreground shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    hour12: false 
                  })}
                </span>
                <span className="text-accent shrink-0">[{log.source}]</span>
                <span className="text-foreground break-all">{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
