import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Position } from '@/types/trading';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface PositionsTableProps {
  positions: Position[];
}

export const PositionsTable = ({ positions }: PositionsTableProps) => {
  if (positions.length === 0) {
    return (
      <div className="glass-card p-5 animate-fade-in">
        <h3 className="font-semibold text-foreground mb-4">Open Positions</h3>
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          No open positions
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-5 animate-fade-in">
      <h3 className="font-semibold text-foreground mb-4">Open Positions ({positions.length})</h3>
      <div className="overflow-x-auto scrollbar-thin">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground">Symbol</TableHead>
              <TableHead className="text-muted-foreground">Side</TableHead>
              <TableHead className="text-muted-foreground text-right">Lots</TableHead>
              <TableHead className="text-muted-foreground text-right">Entry</TableHead>
              <TableHead className="text-muted-foreground text-right">Current</TableHead>
              <TableHead className="text-muted-foreground text-right">P&L</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow key={position.id} className="border-border/50">
                <TableCell className="font-medium">{position.symbol}</TableCell>
                <TableCell>
                  <div className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                    (position.side || '').toLowerCase() === 'buy'
                      ? "bg-success/20 text-success"
                      : "bg-destructive/20 text-destructive"
                  )}>
                    {(position.side || '').toLowerCase() === 'buy' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {(position.side || 'N/A').toUpperCase()}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">{position.lots || 0}</TableCell>
                <TableCell className="text-right font-mono">
                  {(position.entryPrice || 0).toFixed((position.symbol || '').includes('JPY') ? 3 : 5)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {(position.currentPrice || 0).toFixed((position.symbol || '').includes('JPY') ? 3 : 5)}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-mono font-semibold",
                  (position.pnl || 0) >= 0 ? "text-success" : "text-destructive"
                )}>
                  {(position.pnl || 0) >= 0 ? '+' : ''}${(position.pnl || 0).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
