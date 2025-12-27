import { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useTradingData } from '@/hooks/useTradingData';

interface Strategy {
    symbol: string;
    name: string;
    description: string;
    direction: string;
    type: string;
}

export const StrategySelector = () => {
    const [strategies, setStrategies] = useState<Strategy[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const { selectedSymbol: globalSymbol, setSelectedSymbol: setGlobalSymbol, botStatus } = useTradingData();
    const [localSelectedSymbol, setLocalSelectedSymbol] = useState<string>('');
    const [currentStrategy, setCurrentStrategy] = useState<any>(null);

    useEffect(() => {
        loadStrategies();
    }, []);

    // Sync local selection with global symbol if it changes from outside (e.g. backend update or other component)
    useEffect(() => {
        if (globalSymbol && globalSymbol !== localSelectedSymbol) {
            setLocalSelectedSymbol(globalSymbol);
            // Also fetch info for the strategy to keep UI updated
            fetchStrategyInfo(globalSymbol);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalSymbol]);

    const loadStrategies = async () => {
        try {
            const response = await fetch('/api/strategies/list');
            const data = await response.json();

            if (data.success) {
                setStrategies(data.strategies);

                // Use bot's current symbol as initial state if available
                const initialSymbol = botStatus?.symbol || data.strategies[0].symbol;
                setLocalSelectedSymbol(initialSymbol);
                await fetchStrategyInfo(initialSymbol);
            }
        } catch (error) {
            console.error('Failed to load strategies:', error);
            toast({
                title: 'Error',
                description: 'Failed to load available strategies',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchStrategyInfo = async (symbol: string) => {
        try {
            const response = await fetch(`/api/strategies/info/${symbol}`);
            const data = await response.json();
            if (data.success) {
                setCurrentStrategy(data);
            }
        } catch (error) {
            console.error('Failed to fetch strategy info:', error);
        }
    };

    const selectStrategy = async (symbol: string) => {
        try {
            // Call strategies endpoint
            const response = await fetch('/api/strategies/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol })
            });

            const data = await response.json();

            if (data.success) {
                // Also update settings endpoint to keep both in sync
                try {
                    await fetch('/api/settings/symbol', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ symbol })
                    });
                } catch (e) {
                    console.warn('Failed to sync with settings endpoint:', e);
                }

                setCurrentStrategy(data);
                setLocalSelectedSymbol(symbol);
                setGlobalSymbol(symbol); // Update global state

                toast({
                    title: 'Strategy Selected',
                    description: `${data.strategy_name} is now active`,
                });
            }
        } catch (error) {
            console.error('Failed to select strategy:', error);
            toast({
                title: 'Error',
                description: 'Failed to select strategy',
                variant: 'destructive'
            });
        }
    };

    const handleStrategyChange = (symbol: string) => {
        selectStrategy(symbol);
    };

    const getDirectionIcon = (direction: string) => {
        if (direction.includes('BUY') && direction.includes('SELL')) {
            return <Activity className="w-4 h-4" />;
        } else if (direction.includes('BUY')) {
            return <TrendingUp className="w-4 h-4 text-green-500" />;
        } else if (direction.includes('SELL')) {
            return <TrendingDown className="w-4 h-4 text-red-500" />;
        }
        return <Target className="w-4 h-4" />;
    };

    const getDirectionColor = (direction: string) => {
        if (direction.includes('BUY') && direction.includes('SELL')) {
            return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
        } else if (direction.includes('BUY')) {
            return 'bg-green-500/10 text-green-500 border-green-500/20';
        } else if (direction.includes('SELL')) {
            return 'bg-red-500/10 text-red-500 border-red-500/20';
        }
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    };

    if (loading) {
        return (
            <Card className="glass-card">
                <CardHeader>
                    <CardTitle>Loading Strategies...</CardTitle>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="glass-card">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-primary" />
                    Strategy Selection
                </CardTitle>
                <CardDescription>
                    Choose a trading strategy optimized for specific market indices
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Strategy Dropdown */}
                <div className="space-y-3">
                    <Label htmlFor="strategy-select" className="text-sm font-medium">
                        Active Trading Strategy
                    </Label>
                    <Select value={localSelectedSymbol} onValueChange={handleStrategyChange}>
                        <SelectTrigger id="strategy-select" className="w-full bg-background/50">
                            <SelectValue placeholder="Select a strategy..." />
                        </SelectTrigger>
                        <SelectContent>
                            {strategies.map((strategy) => (
                                <SelectItem key={strategy.symbol} value={strategy.symbol}>
                                    <div className="flex items-center gap-3 py-1">
                                        {getDirectionIcon(strategy.direction)}
                                        <div className="flex flex-col">
                                            <span className="font-medium">{strategy.name}</span>
                                            <span className="text-xs text-muted-foreground">{strategy.symbol}</span>
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Selected Strategy Details */}
                {currentStrategy && (
                    <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <h4 className="font-semibold text-primary">{currentStrategy.strategy_name}</h4>
                                <p className="text-sm text-muted-foreground">
                                    {strategies.find(s => s.symbol === localSelectedSymbol)?.description}
                                </p>
                            </div>
                            {getDirectionIcon(strategies.find(s => s.symbol === localSelectedSymbol)?.direction || '')}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className={getDirectionColor(strategies.find(s => s.symbol === localSelectedSymbol)?.direction || '')}>
                                {strategies.find(s => s.symbol === localSelectedSymbol)?.direction}
                            </Badge>
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                                {strategies.find(s => s.symbol === localSelectedSymbol)?.type}
                            </Badge>
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                {currentStrategy.symbol}
                            </Badge>
                        </div>

                        {/* Strategy Config Preview */}
                        {currentStrategy.config && (
                            <div className="pt-3 border-t border-border/50">
                                <p className="text-xs text-muted-foreground mb-2">Configuration</p>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Min Volatility:</span>
                                        <span className="font-mono">{currentStrategy.config.min_volatility || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Max Volatility:</span>
                                        <span className="font-mono">{currentStrategy.config.max_volatility || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">SL Points:</span>
                                        <span className="font-mono">{currentStrategy.config.sl_points_min || 'N/A'}-{currentStrategy.config.sl_points_max || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">TP Points:</span>
                                        <span className="font-mono">{currentStrategy.config.tp_points_min || 'N/A'}-{currentStrategy.config.tp_points_max || 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3">
                    {strategies.map((strategy) => (
                        <button
                            key={strategy.symbol}
                            onClick={() => handleStrategyChange(strategy.symbol)}
                            className={`p-3 rounded-lg border transition-all hover:scale-105 ${localSelectedSymbol === strategy.symbol
                                ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20'
                                : 'bg-background/30 border-border/50 hover:border-primary/50'
                                }`}
                        >
                            <div className="flex flex-col items-center gap-2 text-center">
                                {getDirectionIcon(strategy.direction)}
                                <span className="text-xs font-medium">{strategy.symbol.replace('_', ' ')}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
