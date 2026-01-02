import { useState, useMemo } from 'react';
import { 
  Download, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Search,
  ArrowUpDown,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Trade {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  entryPrice: number;
  exitPrice: number;
  lots: number;
  pnl: number;
  openTime: string;
  closeTime: string;
  strategy: string;
  duration: number; // seconds
}

// Generate mock trade history
const generateMockTrades = (): Trade[] => {
  const symbols = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', 'BOOM1000', 'CRASH1000'];
  const strategies = ['Scalper', 'Grid Recovery', 'Spike Bot', 'V75 Sniper', 'Breakout'];
  const trades: Trade[] = [];
  
  for (let i = 0; i < 50; i++) {
    const side = Math.random() > 0.5 ? 'buy' : 'sell';
    const entryPrice = 1000 + Math.random() * 500;
    const priceChange = (Math.random() - 0.4) * 50;
    const exitPrice = side === 'buy' 
      ? entryPrice + priceChange 
      : entryPrice - priceChange;
    const lots = Math.round((0.01 + Math.random() * 0.5) * 100) / 100;
    const pnl = (side === 'buy' ? exitPrice - entryPrice : entryPrice - exitPrice) * lots * 10;
    
    const openDate = new Date();
    openDate.setDate(openDate.getDate() - Math.floor(Math.random() * 30));
    openDate.setHours(Math.floor(Math.random() * 24));
    openDate.setMinutes(Math.floor(Math.random() * 60));
    
    const duration = 60 + Math.floor(Math.random() * 3600);
    const closeDate = new Date(openDate.getTime() + duration * 1000);
    
    trades.push({
      id: `trade-${i}`,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      side,
      entryPrice: Math.round(entryPrice * 100) / 100,
      exitPrice: Math.round(exitPrice * 100) / 100,
      lots,
      pnl: Math.round(pnl * 100) / 100,
      openTime: openDate.toISOString(),
      closeTime: closeDate.toISOString(),
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      duration
    });
  }
  
  return trades.sort((a, b) => new Date(b.closeTime).getTime() - new Date(a.closeTime).getTime());
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export const TradeHistory = () => {
  const [trades] = useState<Trade[]>(generateMockTrades);
  const [searchTerm, setSearchTerm] = useState('');
  const [symbolFilter, setSymbolFilter] = useState<string>('all');
  const [sideFilter, setSideFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof Trade>('closeTime');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Get unique symbols for filter
  const uniqueSymbols = useMemo(() => 
    [...new Set(trades.map(t => t.symbol))], 
    [trades]
  );

  // Filter and sort trades
  const filteredTrades = useMemo(() => {
    return trades
      .filter(trade => {
        const matchesSearch = trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             trade.strategy.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSymbol = symbolFilter === 'all' || trade.symbol === symbolFilter;
        const matchesSide = sideFilter === 'all' || trade.side === sideFilter;
        return matchesSearch && matchesSymbol && matchesSide;
      })
      .sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        const modifier = sortDirection === 'asc' ? 1 : -1;
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return aVal.localeCompare(bVal) * modifier;
        }
        return ((aVal as number) - (bVal as number)) * modifier;
      });
  }, [trades, searchTerm, symbolFilter, sideFilter, sortField, sortDirection]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalTrades = filteredTrades.length;
    const winningTrades = filteredTrades.filter(t => t.pnl > 0).length;
    const losingTrades = filteredTrades.filter(t => t.pnl < 0).length;
    const totalPnl = filteredTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossProfit = filteredTrades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(filteredTrades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    
    return {
      totalTrades,
      winningTrades,
      losingTrades,
      totalPnl,
      winRate,
      profitFactor,
      avgWin,
      avgLoss
    };
  }, [filteredTrades]);

  const handleSort = (field: keyof Trade) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const exportToCSV = () => {
    const headers = ['ID', 'Symbol', 'Side', 'Entry Price', 'Exit Price', 'Lots', 'P&L', 'Open Time', 'Close Time', 'Strategy', 'Duration'];
    const rows = filteredTrades.map(t => [
      t.id,
      t.symbol,
      t.side,
      t.entryPrice,
      t.exitPrice,
      t.lots,
      t.pnl,
      t.openTime,
      t.closeTime,
      t.strategy,
      formatDuration(t.duration)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trade_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setSymbolFilter('all');
    setSideFilter('all');
  };

  const hasActiveFilters = searchTerm || symbolFilter !== 'all' || sideFilter !== 'all';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Total P&L</div>
          <div className={cn(
            "text-xl font-bold",
            stats.totalPnl >= 0 ? "text-success" : "text-destructive"
          )}>
            {stats.totalPnl >= 0 ? '+' : ''}${stats.totalPnl.toFixed(2)}
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Win Rate</div>
          <div className="text-xl font-bold text-foreground">
            {stats.winRate.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground">
            {stats.winningTrades}W / {stats.losingTrades}L
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Profit Factor</div>
          <div className={cn(
            "text-xl font-bold",
            stats.profitFactor >= 1 ? "text-success" : "text-destructive"
          )}>
            {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
          </div>
        </div>
        <div className="glass-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Avg Win / Loss</div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-success font-medium">${stats.avgWin.toFixed(2)}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-destructive font-medium">${stats.avgLoss.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="w-4 h-4" />
            <span>Filters</span>
          </div>
          
          <div className="relative flex-1 min-w-[200px] max-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search symbol or strategy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={symbolFilter} onValueChange={setSymbolFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              <SelectItem value="all">All Symbols</SelectItem>
              {uniqueSymbols.map(symbol => (
                <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={sideFilter} onValueChange={setSideFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Side" />
            </SelectTrigger>
            <SelectContent className="bg-popover border border-border z-50">
              <SelectItem value="all">All Sides</SelectItem>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
          
          <div className="ml-auto">
            <Button onClick={exportToCSV} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Trade Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('closeTime')}
                >
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Date
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('symbol')}
                >
                  <div className="flex items-center gap-1">
                    Symbol
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead>Side</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">Lots</TableHead>
                <TableHead 
                  className="text-right cursor-pointer hover:text-foreground"
                  onClick={() => handleSort('pnl')}
                >
                  <div className="flex items-center justify-end gap-1">
                    P&L
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead>Strategy</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No trades found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrades.map((trade) => (
                  <TableRow key={trade.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs">
                      {new Date(trade.closeTime).toLocaleDateString()}
                      <br />
                      <span className="text-muted-foreground">
                        {new Date(trade.closeTime).toLocaleTimeString()}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{trade.symbol}</TableCell>
                    <TableCell>
                      <div className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium",
                        trade.side === 'buy' 
                          ? "bg-success/20 text-success" 
                          : "bg-destructive/20 text-destructive"
                      )}>
                        {trade.side === 'buy' ? (
                          <TrendingUp className="w-3 h-3" />
                        ) : (
                          <TrendingDown className="w-3 h-3" />
                        )}
                        {trade.side.toUpperCase()}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trade.entryPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trade.exitPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trade.lots}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono text-sm font-medium",
                      trade.pnl >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {trade.strategy}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDuration(trade.duration)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
          Showing {filteredTrades.length} of {trades.length} trades
        </div>
      </div>
    </div>
  );
};
