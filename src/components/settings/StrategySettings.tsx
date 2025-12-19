import { useState, useEffect } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import type { StrategySettings as StrategySettingsType } from '@/types/trading';
import { useToast } from '@/hooks/use-toast';
import { api } from '@/api/client';

const defaultSettings: StrategySettingsType = {
  gridSize: 10,
  riskPercent: 2,
  maxLots: 1.0,
  confidenceThreshold: 0.75,
  stopLossPoints: 50,
  takeProfitPoints: 100,
  maxOpenTrades: 5,
  drawdownLimit: 10,
};

export const StrategySettings = () => {
  const [settings, setSettings] = useState<StrategySettingsType>(defaultSettings);
  const { toast } = useToast();

  useEffect(() => {
    // Load settings from backend
    api.settings.get().then(data => {
      if (data) setSettings(data);
    }).catch(err => console.error("Failed to load settings", err));
  }, []);

  const handleSave = async () => {
    try {
      await api.settings.update(settings);
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
              max={95}
              min={50}
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
