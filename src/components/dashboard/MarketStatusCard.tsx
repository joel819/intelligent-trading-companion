import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, TrendingDown, Minus, Cpu, Zap } from 'lucide-react';
import { useTradingContext } from '@/context/TradingContext';

export function MarketStatusCard() {
    const { marketStatus: status } = useTradingContext();

    const getRegimeIcon = (regime: string) => {
        if (!regime) return <Activity className="h-4 w-4 text-gray-500" />;
        switch (regime.toLowerCase()) {
            case 'trending_up': return <TrendingUp className="h-4 w-4 text-green-500" />;
            case 'trending_down': return <TrendingDown className="h-4 w-4 text-red-500" />;
            case 'ranging': return <Minus className="h-4 w-4 text-yellow-500" />;
            case 'breakout': return <Zap className="h-4 w-4 text-purple-500" />;
            default: return <Activity className="h-4 w-4 text-gray-500" />;
        }
    };

    const getVolatilityColor = (vol: string) => {
        if (!vol) return 'bg-gray-100 text-gray-800';
        switch (vol.toLowerCase()) {
            case 'low': return 'bg-green-100 text-green-800 border-green-200';
            case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'extreme': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Card className="col-span-1 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Market Intelligence</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="flex flex-col gap-4">

                    {/* Regime */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Regime</span>
                        <div className="flex items-center gap-2">
                            {getRegimeIcon(status.regime || '')}
                            <span className="font-medium capitalize">{(status.regime || 'Unknown').replace('_', ' ')}</span>
                        </div>
                    </div>

                    {/* Volatility */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Volatility</span>
                        <Badge variant="outline" className={`${getVolatilityColor(status.volatility || '')} capitalize`}>
                            {status.volatility || 'Unknown'}
                        </Badge>
                    </div>

                    {/* Active Strategy */}
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Strategy</span>
                        <div className="flex items-center gap-2">
                            <Cpu className="h-3 w-3 text-blue-500" />
                            <span className="font-bold font-mono text-sm">{(status.active_strategy || 'Loading...').toUpperCase()}</span>
                        </div>
                    </div>

                    <div className="text-[10px] text-gray-400 text-right mt-1">
                        {status.symbol}
                    </div>

                </div>
            </CardContent>
        </Card>
    );
}
