import { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { StrategySettings as StrategySettingsType } from '@/types/trading';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/api/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTradingData } from '@/hooks/useTradingData';

const defaultSettings: StrategySettingsType = {
  gridSize: 10,
  riskPercent: 2,
  maxLots: 1.0,
  confidenceThreshold: 0.75,
  stopLossPoints: 50,
  takeProfitPoints: 100,
  maxOpenTrades: 5,
  drawdownLimit: 10,
  symbol: 'R_100',
  minATR: 0.0003,
  maxATR: 0.01,
  minPips: 5.0,
  atrSpikeMultiplier: 3.0,
  rsiOversold: 30.0,
  rsiOverbought: 70.0,
  maxDailyLoss: 5.0,
  maxSLHits: 3,
};

export const StrategySettings = () => {
  const { symbols, selectedSymbol, setSelectedSymbol } = useTradingData();
  const [settings, setSettings] = useState<StrategySettingsType>(defaultSettings);
  const { toast } = useToast();

  useEffect(() => {
    // Load settings from backend
    api.settings.get().then(data => {
      if (data) setSettings(data);
    }).catch(err => console.error("Failed to load settings", err));
  }, [selectedSymbol]);

  const handleSave = async () => {
    try {
      await api.settings.update({ ...settings, symbol: selectedSymbol });
      toast({
        title: "Settings Saved",
        description: "Strategy settings have been updated successfully.",
      });
    } catch (e) {
      toast({
        title: "Error",
        description: "Failed to save settings.",
        variant: "destructive"
      });
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    toast({
      title: "Settings Reset",
      description: "Strategy settings have been reset to defaults.",
    });
  };

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">Strategy Parameters</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Trading Asset Selection */}
        <div className="md:col-span-2 p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="font-semibold text-primary">Trading Asset</h4>
              <p className="text-sm text-muted-foreground">Select the market you want the bot to trade on</p>
            </div>
            <div className="w-[300px]">
              <Select
                value={selectedSymbol}
                onValueChange={async (sym) => {
                  try {
                    // Update global state first
                    setSelectedSymbol(sym);
                    
                    // Update settings endpoint
                    await api.settings.setSymbol(sym);
                    
                    // Also update strategies endpoint to keep both in sync
                    try {
                      await fetch('/api/strategies/select', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ symbol: sym })
                      });
                    } catch (e) {
                      console.warn('Failed to sync with strategies endpoint:', e);
                    }
                    
                    toast({
                      title: "Symbol Synced",
                      description: `Active symbol switched to ${sym}`,
                    });
                  } catch (e) {
                    toast({
                      title: "Error",
                      description: "Failed to switch symbol on backend.",
                      variant: "destructive",
                    });
                  }
                }}
              >
                <SelectTrigger className="w-full bg-background border-border">
                  <SelectValue placeholder="Search symbols..." />
                </SelectTrigger>
                <SelectContent>
                  {symbols.length === 0 ? (
                    <div className="p-2 text-sm text-center text-muted-foreground">Loading symbols...</div>
                  ) : (
                    symbols.map((sym) => (
                      <SelectItem key={sym.symbol} value={sym.symbol}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{sym.display_name}</span>
                          <span className="text-[10px] font-mono opacity-50 uppercase">{sym.symbol}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Grid Trading Settings */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Grid Trading</h4>

          <div className="space-y-2">
            <Label htmlFor="gridSize">Grid Size (points)</Label>
            <Input
              id="gridSize"
              type="number"
              value={settings.gridSize}
              onChange={(e) => setSettings({ ...settings, gridSize: Number(e.target.value) })}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxOpenTrades">Max Open Trades</Label>
            <Input
              id="maxOpenTrades"
              type="number"
              value={settings.maxOpenTrades}
              onChange={(e) => setSettings({ ...settings, maxOpenTrades: Number(e.target.value) })}
              className="font-mono"
            />
          </div>
        </div>

        {/* Risk Management */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Risk Management</h4>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Risk per Trade (%)</Label>
              <span className="font-mono text-sm text-primary">{settings.riskPercent}%</span>
            </div>
            <Slider
              value={[settings.riskPercent]}
              onValueChange={(value) => setSettings({ ...settings, riskPercent: value[0] })}
              max={10}
              min={0.5}
              step={0.5}
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Max Drawdown Limit (%)</Label>
              <span className="font-mono text-sm text-destructive">{settings.drawdownLimit}%</span>
            </div>
            <Slider
              value={[settings.drawdownLimit]}
              onValueChange={(value) => setSettings({ ...settings, drawdownLimit: value[0] })}
              max={30}
              min={5}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxLots">Max Lot Size</Label>
            <Input
              id="maxLots"
              type="number"
              step="0.01"
              value={settings.maxLots}
              onChange={(e) => setSettings({ ...settings, maxLots: Number(e.target.value) })}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxDailyLoss">Max Daily Loss (%)</Label>
            <Input
              id="maxDailyLoss"
              type="number"
              step="0.1"
              value={settings.maxDailyLoss}
              onChange={(e) => setSettings({ ...settings, maxDailyLoss: Number(e.target.value) })}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxSLHits">Max SL Hits/Day</Label>
            <Input
              id="maxSLHits"
              type="number"
              value={settings.maxSLHits}
              onChange={(e) => setSettings({ ...settings, maxSLHits: Number(e.target.value) })}
              className="font-mono"
            />
          </div>
        </div>

        {/* Intelligence Settings */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Market Intelligence</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minATR">Min ATR</Label>
              <Input
                id="minATR"
                type="number"
                step="0.0001"
                value={settings.minATR}
                onChange={(e) => setSettings({ ...settings, minATR: Number(e.target.value) })}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxATR">Max ATR</Label>
              <Input
                id="maxATR"
                type="number"
                step="0.0001"
                value={settings.maxATR}
                onChange={(e) => setSettings({ ...settings, maxATR: Number(e.target.value) })}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minPips">Min Candle Body (Pips)</Label>
            <Input
              id="minPips"
              type="number"
              value={settings.minPips}
              onChange={(e) => setSettings({ ...settings, minPips: Number(e.target.value) })}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="spikeMultiplier">ATR Spike Multiplier</Label>
            <Input
              id="spikeMultiplier"
              type="number"
              step="0.5"
              value={settings.atrSpikeMultiplier}
              onChange={(e) => setSettings({ ...settings, atrSpikeMultiplier: Number(e.target.value) })}
              className="font-mono"
            />
          </div>
        </div>

        {/* Signal Sensitivity */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Signal Sensitivity</h4>

          <div className="flex flex-col gap-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>RSI Oversold Level</Label>
                <span className="font-mono text-sm text-green-500">{settings.rsiOversold}</span>
              </div>
              <Slider
                value={[settings.rsiOversold]}
                onValueChange={(value) => setSettings({ ...settings, rsiOversold: value[0] })}
                max={50}
                min={10}
                step={1}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>RSI Overbought Level</Label>
                <span className="font-mono text-sm text-red-500">{settings.rsiOverbought}</span>
              </div>
              <Slider
                value={[settings.rsiOverbought]}
                onValueChange={(value) => setSettings({ ...settings, rsiOverbought: value[0] })}
                max={90}
                min={50}
                step={1}
              />
            </div>
          </div>
        </div>

        {/* ML Settings */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">ML Configuration</h4>

          <div className="space-y-3">
            <div className="flex justify-between">
              <Label>Confidence Threshold</Label>
              <span className="font-mono text-sm text-accent">{(settings.confidenceThreshold * 100).toFixed(0)}%</span>
            </div>
            <Slider
              value={[settings.confidenceThreshold * 100]}
              onValueChange={(value) => setSettings({ ...settings, confidenceThreshold: value[0] / 100 })}
              max={100}
              min={0}
              step={5}
            />
            <p className="text-xs text-muted-foreground">
              Only execute trades when ML confidence exceeds this threshold
            </p>
          </div>
        </div>

        {/* Trade Limits */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Trade Limits</h4>

          <div className="space-y-2">
            <Label htmlFor="stopLoss">Stop Loss (points)</Label>
            <Input
              id="stopLoss"
              type="number"
              value={settings.stopLossPoints}
              onChange={(e) => setSettings({ ...settings, stopLossPoints: Number(e.target.value) })}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="takeProfit">Take Profit (points)</Label>
            <Input
              id="takeProfit"
              type="number"
              value={settings.takeProfitPoints}
              onChange={(e) => setSettings({ ...settings, takeProfitPoints: Number(e.target.value) })}
              className="font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
