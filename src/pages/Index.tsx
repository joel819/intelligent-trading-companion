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
import { StrategySettings } from '@/components/settings/StrategySettings';
import { StrategySelector } from '@/components/settings/StrategySelector';
import { NotificationsPanel } from '@/components/notifications/NotificationsPanel';
import { AccountsList } from '@/components/accounts/AccountsList';
import { PriceChart } from '@/components/charts/PriceChart';
import { SymbolSelector } from '@/components/dashboard/SymbolSelector';
import { useTradingData } from '@/hooks/useTradingData';
import { Wallet, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lotSize, setLotSize] = useState(0.1); // Default Lot Size
  const {
    accounts,
    selectedAccount,
    selectedAccountId,
    setSelectedAccountId,
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
    marketStatus
  } = useTradingData();

  const handleNotificationsClick = () => {
    setActiveTab('notifications');
  };

  const safePositions = Array.isArray(positions) ? positions : [];
  const totalPnl = safePositions.reduce((sum, pos) => sum + (pos.pnl || 0), 0);

  const handleManualTrade = (type: 'CALL' | 'PUT') => {
    executeTrade({
      symbol: selectedSymbol,
      contract_type: type,
      amount: lotSize,
      duration: 1,
      duration_unit: 'm'
    });
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
                ticks={ticks}
                positions={safePositions}
              />

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Manual Trade Controls */}
                  <div className="flex flex-col gap-4 p-4 bg-muted/20 rounded-lg">
                    <div className="flex items-center gap-4">
                      <label className="text-sm font-medium">Lot Size:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={lotSize}
                        onChange={(e) => setLotSize(parseFloat(e.target.value))}
                        className="p-2 rounded border border-input bg-background w-24"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <button onClick={() => handleManualTrade('CALL')} className="px-4 py-2 bg-buy hover:bg-buy/80 text-white rounded font-bold">
                        BUY / CALL (Up)
                      </button>
                      <button onClick={() => handleManualTrade('PUT')} className="px-4 py-2 bg-sell hover:bg-sell/80 text-white rounded font-bold">
                        SELL / PUT (Down)
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
                    prediction={{
                      buyProbability: skippedSignals.length > 0 
                        ? Math.max(0.3, Math.min(0.9, skippedSignals[0]?.confidence || 0.5))
                        : 0.52,
                      sellProbability: skippedSignals.length > 0 
                        ? Math.max(0.2, Math.min(0.8, 1 - (skippedSignals[0]?.confidence || 0.5)))
                        : 0.48,
                      confidence: skippedSignals.length > 0 
                        ? skippedSignals[0]?.confidence || 0.65
                        : 0.72,
                      regime: marketStatus.regime || 'trending',
                      volatility: marketStatus.volatility || 'medium',
                      lastUpdated: skippedSignals[0]?.timestamp || new Date().toISOString()
                    }}
                    skippedSignals={skippedSignals}
                    symbol={selectedSymbol}
                  />
                  <BotControl status={botStatus} onToggle={toggleBot} />
                  <MarketStatusCard />
                  <TickFeed ticks={ticks.filter((t: any) => t?.symbol === selectedSymbol)} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'positions' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-semibold">Open Positions</h2>
              <PositionsTable positions={safePositions} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <TickFeed ticks={ticks} />
                <LogsStream logs={logs} />
              </div>
            </div>
          )}

          {activeTab === 'accounts' && (
            <div className="space-y-6 animate-fade-in max-w-2xl">
              <h2 className="text-xl font-semibold">Trading Accounts</h2>
              <AccountsList
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onSelect={setSelectedAccountId}
              />
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
