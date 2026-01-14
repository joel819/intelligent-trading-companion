import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Zap, BarChart2 } from 'lucide-react';

interface SymbolSelectorProps {
  symbols: { symbol: string; display_name?: string }[];
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
}

// Common trading symbols with metadata
const SYMBOL_METADATA: Record<string, { label: string; category: string; icon: React.ReactNode }> = {
  'R_10': { label: 'Volatility 10', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  'R_25': { label: 'Volatility 25', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  'R_50': { label: 'Volatility 50', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  'R_75': { label: 'Volatility 75', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  'R_100': { label: 'Volatility 100', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  '1HZ10V': { label: 'Volatility 10 (1s)', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  '1HZ25V': { label: 'Volatility 25 (1s)', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  '1HZ50V': { label: 'Volatility 50 (1s)', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  '1HZ75V': { label: 'Volatility 75 (1s)', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  '1HZ100V': { label: 'Volatility 100 (1s)', category: 'Synthetics', icon: <Zap className="h-3 w-3" /> },
  'BOOM1000': { label: 'Boom 1000', category: 'Crash/Boom', icon: <TrendingUp className="h-3 w-3" /> },
  'BOOM500': { label: 'Boom 500', category: 'Crash/Boom', icon: <TrendingUp className="h-3 w-3" /> },
  'BOOM300N': { label: 'Boom 300', category: 'Crash/Boom', icon: <TrendingUp className="h-3 w-3" /> },
  'CRASH1000': { label: 'Crash 1000', category: 'Crash/Boom', icon: <TrendingUp className="h-3 w-3 rotate-180" /> },
  'CRASH500': { label: 'Crash 500', category: 'Crash/Boom', icon: <TrendingUp className="h-3 w-3 rotate-180" /> },
  'CRASH300N': { label: 'Crash 300', category: 'Crash/Boom', icon: <TrendingUp className="h-3 w-3 rotate-180" /> },
  'JD10': { label: 'Jump 10', category: 'Jump Indices', icon: <BarChart2 className="h-3 w-3" /> },
  'JD25': { label: 'Jump 25', category: 'Jump Indices', icon: <BarChart2 className="h-3 w-3" /> },
  'JD50': { label: 'Jump 50', category: 'Jump Indices', icon: <BarChart2 className="h-3 w-3" /> },
  'JD75': { label: 'Jump 75', category: 'Jump Indices', icon: <BarChart2 className="h-3 w-3" /> },
  'JD100': { label: 'Jump 100', category: 'Jump Indices', icon: <BarChart2 className="h-3 w-3" /> },
  'frxEURUSD': { label: 'EUR/USD', category: 'Forex', icon: <BarChart2 className="h-3 w-3" /> },
  'frxGBPUSD': { label: 'GBP/USD', category: 'Forex', icon: <BarChart2 className="h-3 w-3" /> },
  'frxUSDJPY': { label: 'USD/JPY', category: 'Forex', icon: <BarChart2 className="h-3 w-3" /> },
  'frxXAUUSD': { label: 'Gold (XAU/USD)', category: 'Commodities', icon: <TrendingUp className="h-3 w-3" /> },
  'WLDXAU': { label: 'Gold Basket', category: 'Commodities', icon: <TrendingUp className="h-3 w-3" /> },
  'RDBULL': { label: 'Range Break Bull', category: 'Range Break', icon: <Zap className="h-3 w-3" /> },
  'RDBEAR': { label: 'Range Break Bear', category: 'Range Break', icon: <Zap className="h-3 w-3" /> },
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Synthetics': return 'bg-primary/20 text-primary';
    case 'Crash/Boom': return 'bg-warning/20 text-warning';
    case 'Jump Indices': return 'bg-success/20 text-success';
    case 'Range Break': return 'bg-destructive/20 text-destructive';
    case 'Forex': return 'bg-muted text-muted-foreground';
    case 'Commodities': return 'bg-yellow-500/20 text-yellow-500';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const SymbolSelector = ({ symbols, selectedSymbol, onSymbolChange }: SymbolSelectorProps) => {
  // Use provided symbols or fallback to common ones
  const displaySymbols = symbols.length > 0
    ? symbols
    : Object.keys(SYMBOL_METADATA).map(s => ({ symbol: s }));

  const getSymbolLabel = (symbol: string) => {
    return SYMBOL_METADATA[symbol]?.label || symbol;
  };

  const getSymbolMeta = (symbol: string) => {
    return SYMBOL_METADATA[symbol] || { label: symbol, category: 'Other', icon: <BarChart2 className="h-3 w-3" /> };
  };

  const selectedMeta = getSymbolMeta(selectedSymbol);

  // Group symbols by category
  const groupedSymbols = displaySymbols.reduce((acc, s) => {
    const meta = getSymbolMeta(s.symbol);
    if (!acc[meta.category]) acc[meta.category] = [];
    acc[meta.category].push(s.symbol);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedSymbol} onValueChange={onSymbolChange}>
        <SelectTrigger className="w-[200px] h-9 bg-background border-border">
          <div className="flex items-center gap-2">
            {selectedMeta.icon}
            <SelectValue>
              <span className="font-medium">{getSymbolLabel(selectedSymbol)}</span>
            </SelectValue>
          </div>
        </SelectTrigger>
        <SelectContent className="bg-popover border-border z-50 max-h-[300px]">
          {Object.entries(groupedSymbols).map(([category, categorySymbols]) => (
            <div key={category}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                {category}
              </div>
              {categorySymbols.map((symbol) => {
                const meta = getSymbolMeta(symbol);
                return (
                  <SelectItem
                    key={symbol}
                    value={symbol}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {meta.icon}
                      <span>{meta.label}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </div>
          ))}
        </SelectContent>
      </Select>
      <Badge variant="outline" className={`text-xs ${getCategoryColor(selectedMeta.category)}`}>
        {selectedMeta.category}
      </Badge>
    </div>
  );
};
