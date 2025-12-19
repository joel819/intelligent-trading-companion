import { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { StatCard } from '@/components/dashboard/StatCard';
import { BotControl } from '@/components/dashboard/BotControl';
import { PositionsTable } from '@/components/dashboard/PositionsTable';
import { TickFeed } from '@/components/dashboard/TickFeed';
import { LogsStream } from '@/components/dashboard/LogsStream';
import { StrategySettings } from '@/components/settings/StrategySettings';
import { NotificationsPanel } from '@/components/notifications/NotificationsPanel';
import { AccountsList } from '@/components/accounts/AccountsList';
// import { useMockData } from '@/hooks/useMockData';
import { useTradingData } from '@/hooks/useTradingData';
import { Wallet, TrendingUp, Activity, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const Index = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const {
    accounts,
    selectedAccount,
    selectedAccountId,
    setSelectedAccountId,
    positions,
    ticks,
    logs,
    botStatus,
    toggleBot,
    notifications,
    markNotificationRead,
  } = useTradingData();

  const handleNotificationsClick = () => {
    setActiveTab('notifications');
  };

  const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);

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
        />

        <main className="pt-20 pb-8 px-4 md:px-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-fade-in">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Balance"
                  value={`$${selectedAccount.balance.toLocaleString()}`}
                  icon={<Wallet className="w-5 h-5" />}
                  trend="neutral"
                />
                <StatCard
                  title="Equity"
                  value={`$${selectedAccount.equity.toLocaleString()}`}
                  icon={<TrendingUp className="w-5 h-5" />}
                  trend={selectedAccount.equity >= selectedAccount.balance ? 'up' : 'down'}
                  trendValue={`${((selectedAccount.equity - selectedAccount.balance) / selectedAccount.balance * 100).toFixed(2)}%`}
                />
                <StatCard
                  title="Open P&L"
                  value={`${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`}
                  icon={<BarChart3 className="w-5 h-5" />}
                  trend={totalPnl >= 0 ? 'up' : 'down'}
                />
                <StatCard
                  title="Open Positions"
                  value={positions.length}
                  icon={<Activity className="w-5 h-5" />}
                  subtitle="Active trades"
                />
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                  <PositionsTable positions={positions} />
                  <LogsStream logs={logs} />
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <BotControl status={botStatus} onToggle={toggleBot} />
                  <TickFeed ticks={ticks} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'positions' && (
            <div className="space-y-6 animate-fade-in">
              <h2 className="text-xl font-semibold">Open Positions</h2>
              <PositionsTable positions={positions} />
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
