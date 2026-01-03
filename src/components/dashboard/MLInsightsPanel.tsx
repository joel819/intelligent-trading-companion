import { Brain, TrendingUp, TrendingDown, AlertTriangle, Activity, Target, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { SkippedSignal } from '@/types/trading';

interface MLPrediction {
  buyProbability: number;
  sellProbability: number;
  confidence: number;
  regime: string;
  volatility: string;
  lastUpdated: string;
}

interface MLInsightsPanelProps {
  prediction: MLPrediction;
  skippedSignals: SkippedSignal[];
  symbol: string;
}

const ConfidenceGauge = ({ value, label }: { value: number; label: string }) => {
  const percentage = Math.round(value * 100);
  const getColor = () => {
    if (percentage >= 70) return 'text-success';
    if (percentage >= 40) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/30"
          />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeDasharray={`${percentage * 2.14} 214`}
            strokeLinecap="round"
            className={cn("transition-all duration-500", getColor())}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-lg font-bold", getColor())}>{percentage}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
};

const ProbabilityBar = ({
  buyProb,
  sellProb
}: {
  buyProb: number;
  sellProb: number;
}) => {
  const buyPct = Math.round(buyProb * 100);
  const sellPct = Math.round(sellProb * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-success" />
          <span className="text-muted-foreground">Buy Signal</span>
        </div>
        <span className="font-mono font-semibold text-success">{buyPct}%</span>
      </div>
      <Progress value={buyPct} className="h-2 bg-muted/30" indicatorClassName="bg-success" />

      <div className="flex items-center justify-between text-sm mt-4">
        <div className="flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-destructive" />
          <span className="text-muted-foreground">Sell Signal</span>
        </div>
        <span className="font-mono font-semibold text-destructive">{sellPct}%</span>
      </div>
      <Progress value={sellPct} className="h-2 bg-muted/30" indicatorClassName="bg-destructive" />
    </div>
  );
};

const getSkipReasonSummary = (signals: SkippedSignal[]) => {
  const reasons: Record<string, number> = {};
  signals.forEach(s => {
    const key = s.reason?.split(':')[0] || 'Unknown';
    reasons[key] = (reasons[key] || 0) + 1;
  });
  return Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
};

export const MLInsightsPanel = ({ prediction, skippedSignals, symbol }: MLInsightsPanelProps) => {
  const skipReasons = getSkipReasonSummary(skippedSignals);

  const buyProb = prediction?.buyProbability ?? 0.5;
  const sellProb = prediction?.sellProbability ?? 0.5;

  const signalDirection = buyProb > sellProb ? 'BUY' :
    sellProb > buyProb ? 'SELL' : 'NEUTRAL';

  const signalStrength = Math.abs(buyProb - sellProb);

  return (
    <div className="glass-card p-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">ML Insights</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="w-3 h-3 animate-pulse text-success" />
          <span>Live • {symbol}</span>
        </div>
      </div>

      {/* Main Signal Display */}
      <div className={cn(
        "p-4 rounded-lg mb-6 text-center",
        signalDirection === 'BUY' && "bg-success/10 border border-success/30",
        signalDirection === 'SELL' && "bg-destructive/10 border border-destructive/30",
        signalDirection === 'NEUTRAL' && "bg-muted/30 border border-muted"
      )}>
        <div className="text-xs text-muted-foreground mb-1">Current Signal</div>
        <div className={cn(
          "text-2xl font-bold",
          signalDirection === 'BUY' && "text-success",
          signalDirection === 'SELL' && "text-destructive",
          signalDirection === 'NEUTRAL' && "text-muted-foreground"
        )}>
          {signalDirection}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Strength: {(signalStrength * 100).toFixed(1)}%
        </div>
      </div>

      {/* Confidence Gauges */}
      <div className="flex justify-around mb-6">
        <ConfidenceGauge value={prediction?.confidence ?? 0} label="Model Confidence" />
        <ConfidenceGauge value={signalStrength} label="Signal Strength" />
      </div>

      {/* Prediction Probabilities */}
      <div className="mb-6">
        <div className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          Prediction Probabilities
        </div>
        <ProbabilityBar
          buyProb={buyProb}
          sellProb={sellProb}
        />
      </div>

      {/* Market Regime */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Market Regime</div>
          <div className={cn(
            "text-sm font-medium",
            prediction.regime === 'trending' && "text-success",
            prediction.regime === 'ranging' && "text-warning",
            prediction.regime === 'volatile' && "text-destructive"
          )}>
            {prediction.regime?.charAt(0).toUpperCase() + prediction.regime?.slice(1) || 'Analyzing'}
          </div>
        </div>
        <div className="bg-muted/20 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Volatility</div>
          <div className={cn(
            "text-sm font-medium",
            prediction.volatility === 'low' && "text-neutral",
            prediction.volatility === 'medium' && "text-warning",
            prediction.volatility === 'high' && "text-destructive"
          )}>
            {prediction.volatility?.charAt(0).toUpperCase() + prediction.volatility?.slice(1) || 'Unknown'}
          </div>
        </div>
      </div>

      {/* Skipped Signals Summary */}
      {skipReasons.length > 0 && (
        <div>
          <div className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Why Signals Were Skipped
          </div>
          <div className="space-y-2">
            {skipReasons.map(([reason, count]) => (
              <div
                key={reason}
                className="flex items-center justify-between text-xs bg-muted/20 rounded-lg px-3 py-2"
              >
                <span className="text-muted-foreground truncate max-w-[200px]">{reason}</span>
                <span className="font-mono text-foreground bg-muted px-2 py-0.5 rounded-full">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground text-center">
        Last updated: {prediction.lastUpdated ? new Date(prediction.lastUpdated).toLocaleTimeString() : 'N/A'}
      </div>
    </div>
  );
};
