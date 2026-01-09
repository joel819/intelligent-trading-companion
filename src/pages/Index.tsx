import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { BotControl } from '@/components/dashboard/BotControl';
import { MarketStatusCard } from '@/components/dashboard/MarketStatusCard';
import { PositionsTable } from '@/components/dashboard/PositionsTable';
import { TickFeed } from '@/components/dashboard/TickFeed';
import { LogsStream } from '@/components/dashboard/LogsStream';
import { SkippedSignalsPanel } from '@/components/dashboard/SkippedSignalsPanel';
import { MLInsightsPanel } from '@/components/dashboard/MLInsightsPanel';
import { TradeHistory } from '@/components/dashboard/TradeHistory';
import { PerformanceAnalytics } from '@/components/dashboard/PerformanceAnalytics';
import { PnLCalendar } from '@/components/dashboard/PnLCalendar';
import { StrategySettings } from '@/components/settings/StrategySettings';
import { StrategySelector } from '@/components/settings/StrategySelector';
import { NotificationsPanel } from '@/components/notifications/NotificationsPanel';
import { MultiAccountDashboard } from '@/components/accounts/MultiAccountDashboard';
import { PriceChart } from '@/components/charts/PriceChart';
import { SymbolSelector } from '@/components/dashboard/SymbolSelector';
import { useTradingData } from '@/hooks/useTradingData';
import { Wallet, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Symbol-specific stake configurations (min, step, default) per mode
type StakeConfig = { min: number; step: number; default: number };
const SYMBOL_STAKE_CONFIG: Record<string, { options: StakeConfig; multipliers: StakeConfig }> = {
  // Volatility Indices (1s variants)
  '1HZ10V': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  '1HZ25V': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  '1HZ50V': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  '1HZ75V': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  '1HZ100V': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  // Standard Volatility Indices
  'R_10': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'R_25': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'R_50': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'R_75': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'R_100': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  // Boom Indices
  'BOOM300N': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'BOOM500': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'BOOM1000': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  // Crash Indices
  'CRASH300N': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'CRASH500': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'CRASH1000': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  // Jump Indices
  'JD10': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'JD25': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'JD50': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'JD75': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'JD100': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  // Step Index
  'stpRNG': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  // Range Break Indices
  'RDBULL': { options: { min: 0.50, step: 0.01, default: 0.50 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'RDBEAR': { options: { min: 0.50, step: 0.01, default: 0.50 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  // Forex Pairs
  'FRXEURUSD': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'FRXGBPUSD': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  'FRXUSDJPY': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
  // Default fallback
  'default': { options: { min: 0.35, step: 0.01, default: 0.35 }, multipliers: { min: 1.0, step: 0.01, default: 1.0 } },
};

const getStakeConfig = (symbol: string, mode: 'OPTIONS' | 'MULTIPLIERS'): StakeConfig => {
  const cfg = SYMBOL_STAKE_CONFIG[symbol] || SYMBOL_STAKE_CONFIG['default'];
  return mode === 'OPTIONS' ? cfg.options : cfg.multipliers;
};

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [optionsStake, setOptionsStake] = useState(0.35);
  const [multiplierStake, setMultiplierStake] = useState(0.01);
  const [tradeMode, setTradeMode] = useState<'OPTIONS' | 'MULTIPLIERS'>('MULTIPLIERS');
  const [multiplier, setMultiplier] = useState(20);
  const {
    accounts,
    selectedAccount,
    selectedAccountId,
    setSelectedAccountId,
    toggleAccountType,
    positions,
    ticks,
    logs,
    skippedSignals,
    botStatus,
    toggleBot,
    notifications,
    markNotificationRead,
    isConnected,
    executeTrade,
    selectedSymbol,
    setSelectedSymbol,
    symbols,
    marketStatus,
    latestPrediction,
    performanceAnalytics
  } = useTradingData();

  const handleNotificationsClick = () => {
    setActiveTab('notifications');
  };

  const safePositions = Array.isArray(positions) ? positions : [];
  const totalPnl = safePositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);

  // optionsStake and multiplierStake are separate state variables
  // Each maintains its own value independently when switching modes

  const handleManualTrade = (type: 'CALL' | 'PUT') => {
    // If Options mode, standard logic
    if (tradeMode === 'OPTIONS') {
      executeTrade({
        symbol: selectedSymbol,
        contract_type: type,
        amount: optionsStake,
        duration: 1,
        duration_unit: 'm'
      });
    } else {
      // If Multipliers mode, send MULTUP/MULTDOWN and multiplier
      executeTrade({
        symbol: selectedSymbol,
        contract_type: type === 'CALL' ? 'MULTUP' : 'MULTDOWN',
        amount: multiplierStake,
        multiplier: multiplier
      });
    }
  };

  const [isBypassed, setIsBypassed] = useState(false);
  const displayAccount = selectedAccount;

  // Debug Connection Logic
  console.log('[DEBUG] Connection State:', {
    strategy: botStatus.strategy,
    isConnected: isConnected,
    isAuthorized: botStatus.isAuthorized,
    isBypassed
  });

  // Stabilize connection state to prevent flickering
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);

  useEffect(() => {
    if (isConnected && !hasConnectedOnce) {
      setHasConnectedOnce(true);
    }
  }, [isConnected, hasConnectedOnce]);

  // Only show full-screen loader if we have NEVER connected and aren't bypassed
  const showFullScreenLoader = !hasConnectedOnce && !isConnected && !isBypassed;

  if (activeTab === 'dashboard' && showFullScreenLoader) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6 animate-pulse">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <div className="space-y-2">
            <p className="text-xl font-semibold text-foreground">Securely Connecting to Deriv...</p>
            <p className="text-sm text-muted-foreground">Checking account status and live feed</p>
          </div>
          <div className="pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsBypassed(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Manual Setup Mode
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="pl-16 md:pl-56">
        <Header
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onAccountChange={setSelectedAccountId}
          onToggleAccountType={toggleAccountType}
          notifications={notifications}
          onNotificationsClick={handleNotificationsClick}
          isConnected={isConnected}
        />

        <main className="pt-20 pb-8 px-4 md:px-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {/* Symbol Selector */}
              <div className="flex items-center justify-between flex-wrap gap-4">
                <SymbolSelector
                  symbols={symbols}
                  selectedSymbol={selectedSymbol}
                  onSymbolChange={setSelectedSymbol}
                />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Balance"
                  value={`$${(displayAccount.balance ?? 0).toLocaleString()}`}
                  icon={<Wallet className="w-5 h-5" />}
                  trend="neutral"
                />
                <StatCard
                  title="Equity"
                  value={`$${(displayAccount.equity ?? 0).toLocaleString()}`}
                  icon={<TrendingUp className="w-5 h-5" />}
                  trend={(displayAccount.equity ?? 0) >= (displayAccount.balance ?? 0) ? 'up' : 'down'}
                  trendValue={`${(displayAccount.balance ?? 0) > 0 ? (((displayAccount.equity ?? 0) - (displayAccount.balance ?? 0)) / (displayAccount.balance ?? 0) * 100).toFixed(2) : "0.00"}%`}
                />
                <StatCard
                  title="Open P&L"
                  value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
                  icon={<BarChart3 className="w-5 h-5" />}
                  trend={totalPnl >= 0 ? 'up' : 'down'}
                />
                <StatCard
                  title="Profit Today"
                  value={`${botStatus.profitToday >= 0 ? '+' : ''}$${botStatus.profitToday.toFixed(2)}`}
                  icon={<Activity className="w-5 h-5" />}
                  trend={botStatus.profitToday >= 0 ? 'up' : 'down'}
                  subtitle={`${safePositions.length} active positions`}
                />
              </div>

              {/* Price Chart */}
              <PriceChart
                symbol={selectedSymbol || 'VOLATILITY 75'}
                ticks={ticks[selectedSymbol] || []}
                positions={safePositions}
              />

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Manual Trade Controls */}
                  <div className="flex flex-col gap-4 p-4 bg-muted/20 rounded-lg">

                    {/* Trade Mode Toggle */}
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Trade Mode:</label>
                      <div className="flex bg-background rounded-md border border-input p-1">
                        <button
                          onClick={() => setTradeMode('OPTIONS')}
                          className={cn("px-3 py-1 text-xs rounded transition-colors", tradeMode === 'OPTIONS' ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted text-muted-foreground")}
                        >
                          Options
                        </button>
                        <button
                          onClick={() => setTradeMode('MULTIPLIERS')}
                          className={cn("px-3 py-1 text-xs rounded transition-colors", tradeMode === 'MULTIPLIERS' ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted text-muted-foreground")}
                        >
                          Normal (Mult)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">
                          {tradeMode === 'MULTIPLIERS' ? 'Volume:' : 'Stake:'}
                        </label>
                        <input
                          type="number"
                          step={getStakeConfig(selectedSymbol || '', tradeMode).step.toString()}
                          min={getStakeConfig(selectedSymbol || '', tradeMode).min.toString()}
                          value={tradeMode === 'MULTIPLIERS' ? multiplierStake : optionsStake}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val >= 0) {
                              if (tradeMode === 'MULTIPLIERS') setMultiplierStake(val);
                              else setOptionsStake(val);
                            }
                          }}
                          className="p-2 rounded border border-input bg-background w-24 text-center font-mono"
                        />
                        <span className="text-xs text-muted-foreground">
                          (min: {getStakeConfig(selectedSymbol || '', tradeMode).min})
                        </span>
                      </div>

                      {tradeMode === 'MULTIPLIERS' && (
                        <div className="flex items-center gap-2 animate-fade-in">
                          <label className="text-sm font-medium">Multiplier:</label>
                          <select
                            value={multiplier}
                            onChange={(e) => setMultiplier(Number(e.target.value))}
                            className="p-2 rounded border border-input bg-background w-20 font-mono"
                          >
                            <option value={20}>x20</option>
                            <option value={40}>x40</option>
                            <option value={50}>x50</option>
                            <option value={100}>x100</option>
                            <option value={200}>x200</option>
                            <option value={300}>x300</option>
                            <option value={400}>x400</option>
                            <option value={500}>x500</option>
                            <option value={600}>x600</option>
                            <option value={700}>x700</option>
                            <option value={800}>x800</option>
                            <option value={900}>x900</option>
                            <option value={1000}>x1000</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleManualTrade('CALL')} className="px-4 py-3 bg-buy hover:bg-buy/90 text-white rounded font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
                        {tradeMode === 'MULTIPLIERS' ? 'BUY (Up)' : 'CALL (Rise)'}
                      </button>
                      <button onClick={() => handleManualTrade('PUT')} className="px-4 py-3 bg-sell hover:bg-sell/90 text-white rounded font-bold shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]">
                        {tradeMode === 'MULTIPLIERS' ? 'SELL (Down)' : 'PUT (Fall)'}
                      </button>
                    </div>
                  </div>

                  <PositionsTable positions={safePositions} />
                  <SkippedSignalsPanel signals={skippedSignals} />
                  <LogsStream logs={logs} />
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <MLInsightsPanel
                    prediction={latestPrediction}
                    skippedSignals={skippedSignals}
                    symbol={selectedSymbol}
                  />
                  <BotControl status={botStatus} onToggle={toggleBot} />
                  <MarketStatusCard />
                  <TickFeed ticks={ticks[selectedSymbol] || []} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'positions' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-semibold">Open Positions</h2>
              <PositionsTable positions={safePositions} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TickFeed ticks={ticks[selectedSymbol] || []} />
                <LogsStream logs={logs} />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-semibold">Trade History</h2>
              <TradeHistory />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-semibold">Performance Analytics</h2>
              <PerformanceAnalytics />
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-semibold">P&L Calendar</h2>
              <PnLCalendar pnlData={performanceAnalytics} />
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-semibold">Multi-Account Management</h2>
              <MultiAccountDashboard />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in max-w-4xl">
              <h2 className="text-xl font-semibold">Strategy Settings</h2>
              <StrategySelector />
              <StrategySettings />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 animate-fade-in max-w-2xl">
              <h2 className="text-xl font-semibold">Alerts & Notifications</h2>
              <NotificationsPanel
                notifications={notifications}
                onMarkRead={markNotificationRead}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Index;
